"""行程总结 / 电子游记：游览结束时，数字人根据本次会话为游客生成一段温暖的回顾。

体现真实导游"收尾关怀"：把今天去过的景点、聊过的话题串成一段亲切游记，结尾送祝福。
数据来自 SQLite conversations（含拍照定位记录），无外部依赖。
"""
import re

from fastapi import APIRouter
from pydantic import BaseModel

from backend.db.database import get_db
from backend.llm.client import chat, extract_emotion
from backend.rag.pipeline import get_scenic_config

router = APIRouter(prefix="/trip", tags=["trip"])

# 同行人格 → 开场白侧重（主动迎宾按人群差异化）
_GREET_PERSONA = {
    "adult": "",
    "family_kids": "语气活泼亲切，提一句带着小朋友也能玩得开心。",
    "senior": "语气温和放慢，体现对长辈的关怀。",
    "couple": "语气温馨，提一句适合两人留下美好回忆。",
}


class GreetingResponse(BaseModel):
    text: str
    emotion: str = "happy"


@router.get("/greeting", response_model=GreetingResponse)
def greeting(scenic_id: str = "lingshan", group_type: str = "adult"):
    """主动迎宾：游客一打开/连接，数字人微笑打招呼+自我介绍+邀请开始游览。

    开场画面（用户最初的愿景）。供前端连接成功后自动驱动数字人开口。
    """
    cfg = get_scenic_config(scenic_id)
    persona = _GREET_PERSONA.get(group_type, "")
    prompt = (
        f"你是{cfg['name']}的AI导游，名叫{cfg['guide_name']}。一位游客刚打开导览页面，"
        f"请你热情微笑着说一段开场白：先自我介绍一句，欢迎他来到{cfg['name']}，"
        f"再用一句话邀请他随时开口提问、或拍下眼前景物让你讲解带路。{persona}"
        f"40字以内，自然口语，绝对不要任何 Markdown 符号或编号。"
        f"开头先按格式输出一个情绪标签（如 [情绪:开心]）。"
    )
    raw = chat(prompt, [], "", fast=True)
    text, emotion = extract_emotion(raw)
    return GreetingResponse(text=text, emotion=emotion)

# 拍照定位会被存成 "[拍照] ...（定位：大佛广场）"
_LOC_RE = re.compile(r"（定位：([^）]+)）")


class TripSummaryResponse(BaseModel):
    summary: str
    emotion: str = "happy"
    spots: list[str] = []     # 识别到游客去过/问过的景点
    qa_count: int = 0
    has_history: bool = True


@router.get("/summary", response_model=TripSummaryResponse)
def trip_summary(session_id: str, scenic_id: str = "lingshan"):
    """根据本次会话历史，生成个性化游记总结（供数字人口播 / 分享）。"""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT user_message, ai_reply FROM conversations "
            "WHERE session_id=? AND scenic_id=? ORDER BY created_at",
            (session_id, scenic_id),
        ).fetchall()

    cfg = get_scenic_config(scenic_id)
    if not rows:
        return TripSummaryResponse(
            summary=f"今天还没有游览记录哦，{cfg['name']}有很多精彩等您发现，随时叫我陪您逛～",
            emotion="curious", has_history=False,
        )

    # 提炼：拍照定位过的景点 + 游客问过的话题
    spots: list[str] = []
    topics: list[str] = []
    for um, _ in rows:
        for loc in _LOC_RE.findall(um or ""):
            if loc not in spots:
                spots.append(loc)
        q = re.sub(r"^\[(拍照|图片)\]\s*", "", um or "").split("（定位")[0].strip()
        if q and q not in topics:
            topics.append(q)

    digest = "；".join(topics[:12]) if topics else "（随便逛逛）"
    spots_text = "、".join(spots) if spots else "（未拍照定位）"
    prompt = (
        f"你是{cfg['name']}的导游{cfg['guide_name']}。游客今天的游览即将结束，"
        f"请根据下面的记录，为TA生成一段温暖、亲切的『今日游记回顾』：\n"
        f"- 拍照定位去过的地方：{spots_text}\n"
        f"- 聊过/问过的话题：{digest}\n"
        f"要求：像老朋友一样口语化地回顾今天的行程与亮点，自然提及去过的景点，"
        f"结尾送上一句真诚祝福并欢迎再来。控制在 150 字以内，"
        f"绝对不要用任何 Markdown 符号或分点编号，连贯成一段话。"
        f"开头先按格式输出一个情绪标签（如 [情绪:开心]）。"
    )
    raw = chat(prompt, [], "", fast=False)
    summary, emotion = extract_emotion(raw)
    return TripSummaryResponse(
        summary=summary, emotion=emotion, spots=spots,
        qa_count=len(rows), has_history=True,
    )
