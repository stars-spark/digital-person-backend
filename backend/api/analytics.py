"""
数据分析接口，供管理后台数据大屏调用。

GET /analytics/dashboard       — 核心运营数据（总量、情绪分布、每日趋势）
GET /analytics/hot-topics      — 游客热门问题词云
GET /analytics/sentiment-trend — 满意度按天趋势
GET /analytics/conversations   — 历史对话列表（分页）
POST /analytics/report         — LLM 生成游客感受度报告（按需调用）
"""

from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter
from pydantic import BaseModel

from backend.db.database import get_db
from backend.llm.client import chat

router = APIRouter(prefix="/analytics", tags=["analytics"])

# 满意情绪：happy + excited；负面：apologetic
_POSITIVE = {"happy", "excited"}
_NEUTRAL  = {"neutral", "curious"}
_NEGATIVE = {"empathetic", "apologetic"}


def _date_range(days: int) -> str:
    """返回 SQLite 可用的最早日期字符串。"""
    start = datetime.now() - timedelta(days=days)
    return start.strftime("%Y-%m-%d %H:%M:%S")


# ── 1. 数据大屏核心数据 ────────────────────────────────────────────
@router.get("/dashboard")
def dashboard(scenic_id: str = "lingshan", days: int = 7):
    since = _date_range(days)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM conversations WHERE scenic_id=? AND created_at>=? ORDER BY created_at",
            (scenic_id, since),
        ).fetchall()

    total = len(rows)
    sessions = len({r["session_id"] for r in rows})

    emotion_dist = Counter(r["emotion"] for r in rows)
    context_hits = sum(1 for r in rows if r["context_used"])

    # 每日统计
    daily: dict[str, dict] = {}
    for r in rows:
        day = r["created_at"][:10]
        if day not in daily:
            daily[day] = {"date": day, "conversations": 0, "sessions": set()}
        daily[day]["conversations"] += 1
        daily[day]["sessions"].add(r["session_id"])
    daily_list = [
        {"date": d["date"], "conversations": d["conversations"], "sessions": len(d["sessions"])}
        for d in sorted(daily.values(), key=lambda x: x["date"])
    ]

    positive = sum(emotion_dist.get(e, 0) for e in _POSITIVE)
    satisfaction = round(positive / total, 3) if total else 0.0

    return {
        "scenic_id": scenic_id,
        "period_days": days,
        "total_conversations": total,
        "total_sessions": sessions,
        "satisfaction_rate": satisfaction,
        "context_hit_rate": round(context_hits / total, 3) if total else 0.0,
        "emotion_distribution": dict(emotion_dist),
        "daily_stats": daily_list,
    }


# ── 2. 热门话题（词频统计） ────────────────────────────────────────
@router.get("/hot-topics")
def hot_topics(scenic_id: str = "lingshan", days: int = 7, limit: int = 10):
    since = _date_range(days)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT user_message FROM conversations WHERE scenic_id=? AND created_at>=?",
            (scenic_id, since),
        ).fetchall()

    # 中文 2-4 字 n-gram 词频（无需分词库）
    stop_chars = set("的了是我你他她它们吗呢啊哦哈嗯呀在有没有什么怎么哪里多少为什么吧好可以请问，。？！、：；""''…—～ ，,。.?!:;\"'()（）【】 \t\n")
    counter: Counter = Counter()
    for row in rows:
        msg = row["user_message"]
        for n in (2, 3, 4):
            for i in range(len(msg) - n + 1):
                gram = msg[i: i + n]
                if not any(c in stop_chars for c in gram):
                    counter[gram] += 1

    topics = [term for term, _ in counter.most_common(limit * 3) if len(set(term)) > 1]
    return {"topics": topics[:limit]}


# ── 3. 满意度趋势 ──────────────────────────────────────────────────
@router.get("/sentiment-trend")
def sentiment_trend(scenic_id: str = "lingshan", days: int = 30):
    since = _date_range(days)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DATE(created_at) as day, emotion FROM conversations "
            "WHERE scenic_id=? AND created_at>=? ORDER BY day",
            (scenic_id, since),
        ).fetchall()

    by_day: dict[str, list] = {}
    for r in rows:
        by_day.setdefault(r["day"], []).append(r["emotion"])

    trend = []
    for day in sorted(by_day):
        emotions = by_day[day]
        total = len(emotions)
        pos = sum(1 for e in emotions if e in _POSITIVE)
        trend.append({
            "date": day,
            "total": total,
            "happy_ratio": round(pos / total, 3) if total else 0.0,
            "emotion_counts": dict(Counter(emotions)),
        })

    all_emotions = [r["emotion"] for r in rows]
    overall = round(
        sum(1 for e in all_emotions if e in _POSITIVE) / len(all_emotions), 3
    ) if all_emotions else 0.0

    return {"overall_satisfaction": overall, "trend": trend}


# ── 4. 历史对话列表 ────────────────────────────────────────────────
@router.get("/conversations")
def conversations(
    scenic_id: str | None = None,
    session_id: str | None = None,
    days: int = 7,
    limit: int = 50,
    offset: int = 0,
):
    since = _date_range(days)
    conditions = ["created_at >= ?"]
    params: list = [since]

    if scenic_id:
        conditions.append("scenic_id = ?")
        params.append(scenic_id)
    if session_id:
        conditions.append("session_id = ?")
        params.append(session_id)

    where = " AND ".join(conditions)

    with get_db() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM conversations WHERE {where}", params
        ).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM conversations WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [dict(r) for r in rows],
    }


# ── 5. 知识盲区（闭环1：游客问了但知识库答不上来的问题） ──────────
def _normalize_q(q: str) -> str:
    """归一化问题文本，用于合并近似提问。"""
    return "".join(ch for ch in q if ch not in " \t\n，。？！、：；,.?!:;\"'").strip()


@router.get("/knowledge-gaps")
def knowledge_gaps(
    scenic_id: str = "lingshan",
    days: int = 30,
    limit: int = 20,
    cluster: bool = False,
):
    """
    返回知识库未命中的提问（context_used=0），按频次降序。
    这些是知识库的盲区——管理员据此补充文档，让知识库越用越准。

    cluster=True 时额外调用 LLM 把盲区聚成主题并给出补充建议（消耗 API）。
    """
    since = _date_range(days)
    with get_db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM conversations WHERE scenic_id=? AND created_at>=?",
            (scenic_id, since),
        ).fetchone()[0]
        rows = conn.execute(
            "SELECT user_message, created_at FROM conversations "
            "WHERE scenic_id=? AND created_at>=? AND context_used=0 "
            "ORDER BY created_at DESC",
            (scenic_id, since),
        ).fetchall()

    # 按归一化文本合并近似提问
    grouped: dict[str, dict] = {}
    for r in rows:
        key = _normalize_q(r["user_message"])
        if not key:
            continue
        if key not in grouped:
            grouped[key] = {"question": r["user_message"], "count": 0,
                            "last_asked": r["created_at"]}
        grouped[key]["count"] += 1

    gaps = sorted(grouped.values(), key=lambda x: x["count"], reverse=True)[:limit]

    result = {
        "scenic_id": scenic_id,
        "period_days": days,
        "total_conversations": total,
        "total_unanswered": len(rows),
        "unanswered_rate": round(len(rows) / total, 3) if total else 0.0,
        "gaps": gaps,
    }

    if cluster and gaps:
        gap_list = "\n".join(f"- {g['question']}（被问 {g['count']} 次）" for g in gaps)
        prompt = f"""你是景区知识库运营专家。以下是{scenic_id}景区数字人导游"答不上来"的游客提问（知识库未命中）：

{gap_list}

请把这些问题归纳成 2-4 个主题，每个主题给出：
1. **主题名**
2. **建议补充的知识内容**（具体到该写什么文档/资料）

输出用 Markdown，简洁，供管理员据此补充知识库。"""
        result["suggestions"] = chat(prompt, [], "请归纳并给出补充建议")

    return result


# ── 6. 实时负面情绪预警（闭环2） ──────────────────────────────────
def _hours_ago(hours: float) -> str:
    return (datetime.now() - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")


@router.get("/alerts")
def alerts(
    scenic_id: str | None = None,
    window_hours: float = 24,
    threshold: int = 3,
    min_rate: float = 0.3,
):
    """
    实时负面情绪预警：统计时间窗口内的负面情绪（empathetic/apologetic）。
    当负面对话数 ≥ threshold 且负面占比 ≥ min_rate 时触发告警。

    scenic_id 为空时扫描全部景区。返回告警状态 + 负面对话样本（供管理员定位）。
    """
    since = _hours_ago(window_hours)
    conditions = ["created_at >= ?"]
    params: list = [since]
    if scenic_id:
        conditions.append("scenic_id = ?")
        params.append(scenic_id)
    where = " AND ".join(conditions)

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT scenic_id, user_message, ai_reply, emotion, created_at "
            f"FROM conversations WHERE {where} ORDER BY created_at DESC",
            params,
        ).fetchall()

    total = len(rows)
    negatives = [r for r in rows if r["emotion"] in _NEGATIVE]
    neg_count = len(negatives)
    neg_rate = round(neg_count / total, 3) if total else 0.0

    triggered = neg_count >= threshold and neg_rate >= min_rate

    # 负面情绪集中在哪些景区
    by_scenic = Counter(r["scenic_id"] for r in negatives)

    samples = [
        {
            "scenic_id":  r["scenic_id"],
            "question":   r["user_message"],
            "emotion":    r["emotion"],
            "asked_at":   r["created_at"],
        }
        for r in negatives[:10]
    ]

    return {
        "scenic_id":        scenic_id or "all",
        "window_hours":     window_hours,
        "alert_triggered":  triggered,
        "total_in_window":  total,
        "negative_count":   neg_count,
        "negative_rate":    neg_rate,
        "threshold":        threshold,
        "min_rate":         min_rate,
        "negative_by_scenic": dict(by_scenic),
        "samples":          samples,
    }


# ── 7. LLM 生成游客感受度报告（按需，会消耗 API） ─────────────────
class ReportRequest(BaseModel):
    scenic_id: str = "lingshan"
    days: int = 7


@router.post("/report")
def generate_report(req: ReportRequest):
    since = _date_range(req.days)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT user_message, ai_reply, emotion FROM conversations "
            "WHERE scenic_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 100",
            (req.scenic_id, since),
        ).fetchall()

    if not rows:
        return {"report": "暂无数据，无法生成报告。"}

    sample = "\n".join(
        f"游客：{r['user_message']}\n导游：{r['ai_reply'][:60]}…（情绪:{r['emotion']}）"
        for r in rows[:30]
    )
    emotion_dist = Counter(r["emotion"] for r in rows)

    prompt = f"""你是景区数字化运营分析师。以下是{req.scenic_id}景区近{req.days}天的游客对话样本（共{len(rows)}条），请生成一份简洁的游客感受度报告。

【对话样本】
{sample}

【情绪分布】
{dict(emotion_dist)}

请输出以下内容（用 Markdown 格式）：
1. **总体满意度评估**（一句话）
2. **游客最关注的3-5个话题**
3. **高频问题举例**（2-3条）
4. **运营改进建议**（2-3条）

报告须简洁，适合管理人员快速阅读。"""

    report = chat(prompt, [], "请生成报告")
    return {"scenic_id": req.scenic_id, "period_days": req.days, "report": report}
