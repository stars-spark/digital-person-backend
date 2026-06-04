"""
RAG 完整流水线：query → 检索 → LLM → 回复 + 情绪 → 存库。

延迟优化层次：
  1. LRU 缓存命中 → 直接返回，<5ms
  2. 异步并行检索 → embed 与 BM25 同时跑，省 ~50ms
  3. fast=True    → 用 qwen-turbo，首 token ~150ms vs max ~600ms
  4. 流式输出     → 第一句话完成即触发 TTS，不等全文
"""

import asyncio

from backend.rag.retriever import retrieve, retrieve_async
from backend.rag.cache import answer_cache
from backend.llm.prompts import build_system_prompt, QUERY_REWRITE_PROMPT, needs_rewrite
from backend.llm.client import chat, chat_stream, extract_emotion
from backend.db.database import save_conversation
from backend.core.config import settings
from backend.agent.orchestrator import classify
from backend.agent.handlers import intent_directive, skip_retrieval
from backend.agent.intents import INTENT_LABELS, Intent
from backend.analytics.crowd import crowd_brief

# 路线/推荐意图才注入实时客流，让导游给「错峰/淡旺季」建议（随机应变职责）
_CROWD_INTENTS = {Intent.NAVIGATION, Intent.RECOMMEND}


def _directive_with_crowd(intent: Intent, scenic_id: str) -> str:
    """意图指令 +（路线/推荐时）实时客流上下文。"""
    directive = intent_directive(intent)
    if intent in _CROWD_INTENTS:
        brief = crowd_brief(scenic_id)
        if brief:
            directive += (
                "\n\n" + brief +
                "\n请把错峰/淡旺季提示自然融入推荐或路线里，口吻像贴心导游，"
                "不要生硬罗列数据，也不要提及“模型/数据/系统”等字样。"
            )
    return directive

SCENIC_CONFIG: dict[str, dict] = {
    "lingshan":  {"name": "灵山胜境",   "guide_name": "灵山小慧"},
    "nihuawan":  {"name": "拈花湾",     "guide_name": "拈花小语"},
    "xihu":      {"name": "西湖",       "guide_name": "西湖小雨"},
    "huangshan": {"name": "黄山",       "guide_name": "黄山小峰"},
    "gugong":    {"name": "故宫博物院", "guide_name": "故宫小明"},
}


def get_scenic_config(scenic_id: str) -> dict:
    return SCENIC_CONFIG.get(scenic_id, {"name": scenic_id, "guide_name": "小导"})


def rewrite_query(query: str, history: list[dict]) -> str:
    """
    用 qwen-turbo 把口语/含指代的问题改写为检索友好形式。
    只在必要时触发（含指代词或历史有上下文），避免浪费 API。
    """
    if not needs_rewrite(query, history):
        return query
    history_text = "\n".join(
        f"{'游客' if m['role']=='user' else '导游'}：{m['content'][:60]}"
        for m in history[-4:]  # 只看最近两轮
    ) or "（无历史）"
    prompt = QUERY_REWRITE_PROMPT.format(history=history_text, query=query)
    rewritten = chat(prompt, [], "", fast=True).strip()
    # 安全回退：改写失败或过长时用原始 query
    return rewritten if rewritten and len(rewritten) < 100 else query


def answer(
    query: str,
    scenic_id: str,
    history: list[dict] | None = None,
    session_id: str = "anonymous",
    fast: bool = False,
    lang: str = "auto",
    group_type: str = "adult",
) -> dict:
    """
    同步问答。fast=True 使用 qwen-turbo（延迟减半，适合简单问答）。
    lang: "auto"（跟随提问语言）或语言代码（en/ja/ko…）强制指定回答语言。
    group_type: 同行关系（adult/family_kids/senior/couple），切换叙事人格。
    返回: { reply, emotion, sources, context_used, intent }
    """
    history = history or []
    # 按 人格 + 语言 隔离缓存，避免跨人格/跨语种串答
    cache_query = f"{group_type}::{lang}::{query}"
    intent = classify(query, history)  # Orchestrator 分派：决定走哪条处理链路
    # 路线/推荐含实时客流（随时段变），不缓存，避免冻结错峰建议
    cacheable = not history and intent not in _CROWD_INTENTS

    # ── 缓存命中：无历史时才缓存（历史对话有上下文，不能复用） ──────
    if cacheable:
        cached = answer_cache.get(scenic_id, cache_query)
        if cached:
            save_conversation(session_id, scenic_id, query,
                              cached["reply"], cached["emotion"], cached["context_used"])
            return {**cached, "from_cache": True}

    cfg = get_scenic_config(scenic_id)

    if skip_retrieval(intent):         # 闲聊无需检索知识库，省一次检索延迟
        context_chunks = []
    else:
        retrieval_query = rewrite_query(query, history)  # 改写后用于检索，原 query 用于 LLM
        context_chunks = retrieve(retrieval_query, scenic_id)
    context_used = len(context_chunks) > 0

    system_prompt = build_system_prompt(
        cfg["name"], cfg["guide_name"], context_chunks, lang,
        _directive_with_crowd(intent, scenic_id), group_type,
    )
    raw_reply = chat(system_prompt, history, query, fast=fast)
    reply, emotion = extract_emotion(raw_reply)

    result = {
        "reply": reply,
        "emotion": emotion,
        "sources": list({c.split("|")[0].strip() for c in context_chunks}),
        "context_used": context_used,
        "intent": intent.value,
        "scenic_id": scenic_id,
        "from_cache": False,
    }

    if cacheable:
        answer_cache.set(scenic_id, cache_query, result)

    save_conversation(session_id, scenic_id, query, reply, emotion, context_used)
    return result


def _split_to_sentences(text: str) -> list[str]:
    """把纯文本按中文句子结束符切分，用于缓存命中时的流式模拟。"""
    enders = frozenset("。！？…!?")
    sentences, current = [], ""
    for ch in text:
        current += ch
        if ch in enders:
            if current.strip():
                sentences.append(current.strip())
            current = ""
    if current.strip():
        sentences.append(current.strip())
    return sentences or [text]


async def answer_stream(
    query: str,
    scenic_id: str,
    history: list[dict] | None = None,
    session_id: str = "anonymous",
    fast: bool = False,
    lang: str = "auto",
    group_type: str = "adult",
):
    """
    分句流式版本，yield 结构化事件 dict（供 SSE 下发给数字人驱动端）：
      {"type": "emotion",  "value": "happy"}
      {"type": "sentence", "text": "...", "index": N}
      {"type": "end",      "full_text": "..."}

    第一个事件（emotion）在 LLM 输出第一个 token 后毫秒级下发，
    数字人表情无需等待全文生成完毕。
    lang: "auto"（跟随提问语言）或语言代码（en/ja/ko…）强制指定回答语言。
    """
    history = history or []
    cache_query = f"{group_type}::{lang}::{query}"  # 按 人格+语言 隔离缓存
    intent = classify(query, history)  # 先分派；无历史时纯规则匹配，0ms
    cacheable = not history and intent not in _CROWD_INTENTS  # 含实时客流的不缓存

    def _intent_event() -> dict:
        return {"type": "intent", "value": intent.value, "label": INTENT_LABELS[intent]}

    # ── 缓存命中：模拟分句流，接口与正常流保持一致 ────────────────────
    if cacheable:
        cached = answer_cache.get(scenic_id, cache_query)
        if cached:
            save_conversation(session_id, scenic_id, query,
                              cached["reply"], cached["emotion"], cached["context_used"])
            yield _intent_event()
            yield {"type": "emotion", "value": cached["emotion"]}
            for i, s in enumerate(_split_to_sentences(cached["reply"])):
                yield {"type": "sentence", "text": s, "index": i}
            yield {"type": "end", "full_text": cached["reply"]}
            return

    cfg = get_scenic_config(scenic_id)

    if skip_retrieval(intent):         # 闲聊跳过检索
        context_chunks = []
    else:
        retrieval_query = await asyncio.to_thread(rewrite_query, query, history)
        if settings.deploy_mode == "cloud":
            context_chunks = await retrieve_async(retrieval_query, scenic_id)
        else:
            context_chunks = await asyncio.to_thread(retrieve, retrieval_query, scenic_id)

    context_used = len(context_chunks) > 0
    directive = await asyncio.to_thread(_directive_with_crowd, intent, scenic_id)
    system_prompt = build_system_prompt(
        cfg["name"], cfg["guide_name"], context_chunks, lang,
        directive, group_type,
    )

    yield _intent_event()  # intent 在 LLM 调用前即可下发，比 emotion 更早

    full_text = ""
    emotion = "neutral"

    async for event in chat_stream(system_prompt, history, query, fast=fast):
        if event["type"] == "emotion":
            emotion = event["value"]
        elif event["type"] == "end":
            full_text = event["full_text"]
        yield event  # 原样透传给 API 层

    reply, _ = extract_emotion(full_text)

    if cacheable:
        answer_cache.set(scenic_id, cache_query, {
            "reply": reply, "emotion": emotion,
            "sources": list({c.split("|")[0].strip() for c in context_chunks}),
            "context_used": context_used, "intent": intent.value, "scenic_id": scenic_id,
        })

    save_conversation(session_id, scenic_id, query, reply, emotion, context_used)
