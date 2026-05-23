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
) -> dict:
    """
    同步问答。fast=True 使用 qwen-turbo（延迟减半，适合简单问答）。
    返回: { reply, emotion, sources, context_used }
    """
    history = history or []

    # ── 缓存命中：无历史时才缓存（历史对话有上下文，不能复用） ──────
    if not history:
        cached = answer_cache.get(scenic_id, query)
        if cached:
            save_conversation(session_id, scenic_id, query,
                              cached["reply"], cached["emotion"], cached["context_used"])
            return {**cached, "from_cache": True}

    cfg = get_scenic_config(scenic_id)
    retrieval_query = rewrite_query(query, history)  # 改写后用于检索，原 query 用于 LLM
    context_chunks = retrieve(retrieval_query, scenic_id)
    context_used = len(context_chunks) > 0

    system_prompt = build_system_prompt(cfg["name"], cfg["guide_name"], context_chunks)
    raw_reply = chat(system_prompt, history, query, fast=fast)
    reply, emotion = extract_emotion(raw_reply)

    result = {
        "reply": reply,
        "emotion": emotion,
        "sources": list({c.split("|")[0].strip() for c in context_chunks}),
        "context_used": context_used,
        "scenic_id": scenic_id,
        "from_cache": False,
    }

    if not history:
        answer_cache.set(scenic_id, query, result)

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
):
    """
    分句流式版本，yield 结构化事件 dict（供 SSE 下发给数字人驱动端）：
      {"type": "emotion",  "value": "happy"}
      {"type": "sentence", "text": "...", "index": N}
      {"type": "end",      "full_text": "..."}

    第一个事件（emotion）在 LLM 输出第一个 token 后毫秒级下发，
    数字人表情无需等待全文生成完毕。
    """
    history = history or []

    # ── 缓存命中：模拟分句流，接口与正常流保持一致 ────────────────────
    if not history:
        cached = answer_cache.get(scenic_id, query)
        if cached:
            save_conversation(session_id, scenic_id, query,
                              cached["reply"], cached["emotion"], cached["context_used"])
            yield {"type": "emotion", "value": cached["emotion"]}
            for i, s in enumerate(_split_to_sentences(cached["reply"])):
                yield {"type": "sentence", "text": s, "index": i}
            yield {"type": "end", "full_text": cached["reply"]}
            return

    cfg = get_scenic_config(scenic_id)
    retrieval_query = await asyncio.to_thread(rewrite_query, query, history)

    if settings.deploy_mode == "cloud":
        context_chunks = await retrieve_async(retrieval_query, scenic_id)
    else:
        context_chunks = await asyncio.to_thread(retrieve, retrieval_query, scenic_id)

    context_used = len(context_chunks) > 0
    system_prompt = build_system_prompt(cfg["name"], cfg["guide_name"], context_chunks)

    full_text = ""
    emotion = "neutral"

    async for event in chat_stream(system_prompt, history, query, fast=fast):
        if event["type"] == "emotion":
            emotion = event["value"]
        elif event["type"] == "end":
            full_text = event["full_text"]
        yield event  # 原样透传给 API 层

    reply, _ = extract_emotion(full_text)

    if not history:
        answer_cache.set(scenic_id, query, {
            "reply": reply, "emotion": emotion,
            "sources": list({c.split("|")[0].strip() for c in context_chunks}),
            "context_used": context_used, "scenic_id": scenic_id,
        })

    save_conversation(session_id, scenic_id, query, reply, emotion, context_used)
