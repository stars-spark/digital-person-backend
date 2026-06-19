"""
通义千问 API 封装（DashScope）。

两个接口：
- chat()：文本对话，用 qwen-max-latest
- chat_stream()：流式输出，前端打字机效果用
"""

import re
from typing import AsyncGenerator, List
import dashscope
from dashscope import Generation

from backend.core.config import settings

dashscope.api_key = settings.dashscope_api_key

# 中文情绪标签 → 英文 key（数字人表情控制用）
_EMOTION_MAP = {
    "开心": "happy",
    "兴奋": "excited",
    "平静": "neutral",
    "好奇": "curious",
    "关切": "empathetic",
    "抱歉": "apologetic",
}
# 不锚定位置：情绪标签现在在正文前，但也兼容在末尾的旧格式
_EMOTION_RE = re.compile(
    r'\[情绪[：:]\s*(开心|兴奋|平静|好奇|关切|抱歉)\s*\]'
)

# 中文句子结束符
_SENTENCE_ENDERS = frozenset('。！？…!?')


def extract_emotion(text: str) -> tuple[str, str]:
    """从文本中解析 [情绪:X] 标签（可在开头或结尾）。返回 (干净正文, emotion_key)。"""
    m = _EMOTION_RE.search(text)
    if m:
        clean = (text[:m.start()] + text[m.end():]).strip()
        return clean, _EMOTION_MAP[m.group(1)]
    return text.strip(), "neutral"


def _get_model(fast: bool) -> str:
    """fast=True 用 fast_model（qwen-flash，首 token ~150ms），否则 qa 主模型（qwen-plus）。"""
    return settings.fast_model if fast else settings.llm_model


def chat(
    system_prompt: str,
    history: List[dict],
    user_message: str,
    fast: bool = False,
) -> str:
    """同步调用，返回完整回复文本。fast=True 延迟减半。"""
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    response = Generation.call(
        model=_get_model(fast),
        messages=messages,
        result_format="message",
        temperature=0.7,
        max_tokens=1024,
    )
    if response.status_code != 200 or response.output is None:
        raise RuntimeError(
            f"DashScope 调用失败 [{response.status_code} {response.code}]: {response.message}"
        )
    return response.output.choices[0].message.content


async def _raw_token_stream(
    system_prompt: str,
    history: List[dict],
    user_message: str,
    fast: bool = False,
) -> AsyncGenerator[str, None]:
    """底层 token 流，供内部使用。"""
    import asyncio
    import threading

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    # DashScope 的流式是同步阻塞 generator；若直接在 async 里 for 迭代会卡住
    # 事件循环，导致 FastAPI 无法逐块 flush SSE（表现为整段答案一次性到达）。
    # 解决：同步迭代放到线程里跑，token 经 asyncio.Queue 异步交回，事件循环不被阻塞。
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def _produce():
        try:
            responses = Generation.call(
                model=_get_model(fast),
                messages=messages,
                result_format="message",
                stream=True,
                incremental_output=True,
                temperature=0.7,
                max_tokens=1024,
            )
            for resp in responses:
                if resp.status_code != 200 or resp.output is None:
                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        ("error", f"DashScope 流式失败 [{resp.status_code} {resp.code}]: {resp.message}"),
                    )
                    return
                delta = resp.output.choices[0].message.content
                if delta:
                    loop.call_soon_threadsafe(queue.put_nowait, ("token", delta))
        except Exception as e:  # noqa: BLE001
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(e)))
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))

    threading.Thread(target=_produce, daemon=True).start()

    while True:
        kind, val = await queue.get()
        if kind == "done":
            break
        if kind == "error":
            raise RuntimeError(val)
        yield val


async def chat_stream(
    system_prompt: str,
    history: List[dict],
    user_message: str,
    fast: bool = False,
) -> AsyncGenerator[dict, None]:
    """
    分句流式调用，yield 结构化事件 dict，供数字人驱动端使用：

      {"type": "emotion",  "value": "happy"}
          — 第一个事件，情绪已知，数字人立即设置表情

      {"type": "sentence", "text": "你好！欢迎来到灵山胜境～", "index": 0}
          — 每完整一句 yield 一次，TTS 收到即可开始合成

      {"type": "end",      "full_text": "...（含情绪标签的原始输出）"}
          — 流结束，pipeline 用 full_text 做缓存/存库
    """
    buffer = ""
    full_text = ""
    sentence_idx = 0
    emotion_found = False

    async for token in _raw_token_stream(system_prompt, history, user_message, fast):
        buffer += token
        full_text += token

        # ── 优先探测情绪标签（出现即立刻 yield，不等到句子结束）────────
        if not emotion_found:
            m = _EMOTION_RE.search(buffer)
            if m:
                emotion_found = True
                yield {"type": "emotion", "value": _EMOTION_MAP[m.group(1)]}
                # 从 buffer 中移除标签，剩余内容继续分句处理
                buffer = (buffer[:m.start()] + buffer[m.end():]).lstrip("\n").lstrip()

        # ── 扫描 buffer，遇句子结束符就 yield 完整一句 ────────────────
        while True:
            end_pos = next(
                (i for i, ch in enumerate(buffer) if ch in _SENTENCE_ENDERS), -1
            )
            if end_pos == -1:
                break
            sentence = buffer[: end_pos + 1].strip()
            buffer = buffer[end_pos + 1 :]
            if sentence:
                yield {"type": "sentence", "text": sentence, "index": sentence_idx}
                sentence_idx += 1

    # ── 流结束：处理 buffer 尾部 ────────────────────────────────────
    # 兜底：LLM 未遵循"在前"指令，情绪标签出现在末尾
    if not emotion_found:
        m = _EMOTION_RE.search(buffer)
        if m:
            yield {"type": "emotion", "value": _EMOTION_MAP[m.group(1)]}
            buffer = (buffer[:m.start()] + buffer[m.end():]).strip()

    # 最后一句（无结束符的尾部文字）
    if buffer.strip():
        yield {"type": "sentence", "text": buffer.strip(), "index": sentence_idx}

    yield {"type": "end", "full_text": full_text}
