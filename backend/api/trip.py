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
from backend.analytics.crowd import scenic_crowd
from backend.analytics.env_context import _period, _fetch_weather, SCENIC_CITY

import datetime as _dt

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


class TodayResponse(BaseModel):
    weather: str = ""
    period: str = ""
    crowd: str = ""
    season: str = ""
    tip: str = ""


@router.get("/today", response_model=TodayResponse)
def trip_today(scenic_id: str = "lingshan"):
    """今日游园建议卡：天气 + 时段 + 客流 + 一句贴心错峰/天气建议（轻量、不调 LLM，快）。"""
    now = _dt.datetime.now()
    period = _period(now.hour)
    city = SCENIC_CITY.get(scenic_id)
    weather = (_fetch_weather(city) if city else None) or ""

    c = scenic_crowd(scenic_id, now)
    top = c["attractions"][0] if c["has_data"] else None
    crowd = top["crowd_level"] if top else "适中"
    season = c["season"]

    # 组合一句口语贴心建议（模板，无 LLM）
    tips = []
    if top and top["crowd_level"] in ("较多", "繁忙"):
        tips.append(f"{top['attraction']}此刻人多，建议{c['quiet_hours']}错峰，或先逛相对清静处")
    if "雨" in weather:
        tips.append("有雨，记得带伞或多走廊道、室内场馆")
    elif period in ("中午", "下午") and ("晴" in weather or weather == ""):
        tips.append("午后日晒较强，可先逛室内场馆、傍晚再看日落机位")
    elif period == "傍晚":
        tips.append("傍晚光线柔和，正适合拍照打卡")
    if not tips:
        tips.append("天气与客流都不错，放心慢慢逛")
    return TodayResponse(weather=weather, period=period, crowd=crowd, season=season, tip="；".join(tips) + "。")


@router.get("/greeting", response_model=GreetingResponse)
def greeting(scenic_id: str = "lingshan", group_type: str = "adult"):
    """主动迎宾：游客一打开/连接，数字人微笑打招呼+自我介绍+邀请开始游览。

    开场画面（用户最初的愿景）。供前端连接成功后自动驱动数字人开口。
    """
    cfg = get_scenic_config(scenic_id)
    persona = _GREET_PERSONA.get(group_type, "")
    prompt = (
        f"你是{cfg['name']}的专属智能AI导览数字人（你没有人名，不要给自己起名、不要自称任何人名）。"
        f"一位游客刚打开导览页面，请你热情微笑着说一段开场白：先明确自我介绍一句"
        f"「我是您在{cfg['name']}的专属智能AI导览数字人，很高兴为您服务」，再欢迎他来到{cfg['name']}，"
        f"最后用一句话邀请他随时开口提问、或拍下眼前景物让你讲解带路。{persona}"
        f"50字以内，自然口语，绝对不要任何 Markdown 符号或编号。"
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
        f"你是{cfg['name']}的专属智能AI导览数字人（没有人名，自称『我』即可）。游客今天的游览即将结束，"
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
