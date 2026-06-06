"""
RAG → 数字人 桥接层（本地运行，串联问答与口型驱动）

部署位置：本地 4080 机器，与 LiveTalking 同机（内部 localhost 调用，零公网暴露）。

职责（把两条孤立的服务接成一条链）：
  游客提问 → 本桥接 /live/ask
    1) 调 RAG_BASE/chat        拿 reply / emotion / intent
    2) 读 digital-human/config 把占位 avatar_id/voice_id 翻译成
       「真实的 LiveTalking avatar」与「真实的 edge-TTS 音色」
    3) 调 LIVETALKING_BASE/human(echo) 让数字人用该音色把 reply 说出来

  形象切换：avatar 是「连接级」参数（在 LiveTalking /offer 建连时指定），
  所以前端连接前先调 /live/avatar 拿到该景区当前 avatar_id，再传给 /offer。

启动：
  cd /home/jiale/Desktop/Digital_Person
  .venv/bin/uvicorn bridge.server:app --host 0.0.0.0 --port 9000

可用环境变量覆盖后端地址（演示时 RAG 可指向本地 GPU 实例以求最低延迟，
也可指向 ECS 公网 http://116.62.136.211:8000）：
  RAG_BASE=http://localhost:8000  LIVETALKING_BASE=http://localhost:8010
"""
import json
import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

RAG_BASE = os.environ.get("RAG_BASE", "http://localhost:8000").rstrip("/")
LIVETALKING_BASE = os.environ.get("LIVETALKING_BASE", "http://localhost:8010").rstrip("/")
# SRS 的 HTTP-FLV 直播流地址（RTMP 模式下 LiveTalking 推到 SRS，浏览器从这里拉）
SRS_FLV = os.environ.get("SRS_FLV", "http://localhost:8080/live/livestream.flv").rstrip("/")

# ── 占位 ID → 真实资源的映射 ──────────────────────────────────────────
# digital-human/config 里存的是业务占位 ID（female_elegant / voice_gentle_f…），
# 这里把它们翻译成下游真正认识的资源名。生成新形象/接入新音色后只改这两张表。

# voice_id → 百炼 Qwen-TTS 音色名（LiveTalking --tts qwentts 读 tts.ref_file）
# Qwen3-TTS-Flash-Realtime：云端实时合成、0 本地 GPU、用现有 DASHSCOPE_API_KEY，
# 自然度远胜 edge-TTS。音色按消息可切（qwentts 检测到 ref_file 变化即重连换音色）。
VOICE_MAP = {
    "voice_gentle_f": "Cherry",   # 温柔女声（默认）
    "voice_lively_f": "Cherry",   # 活泼女声（暂同，Qwen 音色库可再细分）
    "voice_calm_m":   "Ethan",    # 沉稳男声
    "voice_bright_m": "Ethan",    # 明朗男声
}
DEFAULT_VOICE = "Cherry"

# avatar_id → 真实 LiveTalking avatar 目录名（data/avatars/<id>）
# 古风女导游 guofeng_female 由通义万相生成（scripts/gen_avatar_asset.py）→ genavatar 烘成。
AVATAR_MAP = {
    "female_elegant": "sweet_bob",   # 主形象：美图精修的甜美波波头(眼袋淡/鼻孔小/无穿模)
    "female_young":   "sweet_bob",
    "male_mature":    "musetalk_avatar1",  # TODO: 生成男导游后改这里
    "male_young":     "musetalk_avatar1",
}
DEFAULT_AVATAR = "sweet_bob"

app = FastAPI(title="数字人桥接层", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskIn(BaseModel):
    sessionid: str                 # LiveTalking WebRTC 会话 ID（/offer 返回的那个）
    message: str
    session_id: str = "anonymous"  # RAG 业务会话 ID（用于历史/分析，与上面不是一回事）
    scenic_id: str = "lingshan"
    group_type: str = "adult"      # adult / family_kids / senior / couple
    lang: str = "auto"
    fast: bool = False
    interrupt: bool = True         # 新提问默认打断数字人上一句未播完的话


async def _resolve_config(client: httpx.AsyncClient, scenic_id: str) -> tuple[str, str]:
    """读 digital-human/config，翻译成 (真实 avatar, 真实 voice)。任何失败回落默认。"""
    try:
        r = await client.get(
            f"{RAG_BASE}/digital-human/config",
            params={"scenic_id": scenic_id},
            timeout=5,
        )
        cfg = r.json()
        avatar = AVATAR_MAP.get(cfg.get("avatar_id"), DEFAULT_AVATAR)
        voice = VOICE_MAP.get(cfg.get("voice_id"), DEFAULT_VOICE)
        return avatar, voice
    except Exception:
        return DEFAULT_AVATAR, DEFAULT_VOICE


@app.post("/live/ask")
async def live_ask(body: AskIn):
    """游客问一句 → 订阅 RAG 句子级流式 → 每出一句立即驱动数字人开口。

    关键时序（压住 <5s 端到端延迟的核心）：
      RAG 第 1 句生成完(~0.8s) → 立刻送 LiveTalking 说出来 → 数字人即刻开口，
      与此同时 RAG 继续生成后面的句子并排队播放，而不是等整段答案。
    """
    # trust_env=False：桥接只调 localhost/内网/ECS，绕开环境里的 SOCKS 代理
    # read 超时给到 60s，容纳 LLM 整段流式生成的时长
    timeout = httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=5.0)
    async with httpx.AsyncClient(trust_env=False, timeout=timeout) as client:
        # 1) 流式开始前先确定音色（第一句就要用）
        _, voice = await _resolve_config(client, body.scenic_id)

        intent = "qa"
        emotion = "neutral"
        sentences: list[str] = []
        drive_failures = 0
        first = True

        async def _drive(text: str, interrupt: bool):
            """把一句话送数字人说出来。单句失败不中断整条流，只计数。"""
            nonlocal drive_failures
            try:
                await client.post(
                    f"{LIVETALKING_BASE}/human",
                    json={
                        "sessionid": body.sessionid,
                        "text": text,
                        "type": "echo",
                        "interrupt": interrupt,
                        # emotion 透传：edge-TTS 暂不读，换 CosyVoice/Azure 后可用于情感语调
                        "tts": {"ref_file": voice, "emotion": emotion},
                    },
                    timeout=10,
                )
            except Exception:
                drive_failures += 1

        # 2) 订阅 RAG SSE 流，逐句驱动数字人
        try:
            async with client.stream(
                "POST",
                f"{RAG_BASE}/chat",
                json={
                    "session_id": body.session_id,
                    "message": body.message,
                    "scenic_id": body.scenic_id,
                    "group_type": body.group_type,
                    "lang": body.lang,
                    "fast": body.fast,
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    try:
                        evt = json.loads(line[5:].strip())
                    except json.JSONDecodeError:
                        continue
                    etype = evt.get("type")
                    if etype == "intent":
                        intent = evt.get("value", intent)
                    elif etype == "emotion":
                        # emotion 事件在第一个 sentence 之前下发，第一句即可带上正确情绪
                        emotion = evt.get("value", emotion)
                    elif etype == "sentence":
                        text = (evt.get("text") or "").strip()
                        if not text:
                            continue
                        sentences.append(text)
                        # 第一句打断上一轮残留，后续句排队顺序播放
                        await _drive(text, interrupt=(body.interrupt and first))
                        first = False
                    # end 事件无需特殊处理
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"RAG 流式调用失败: {type(e).__name__}: {e}",
            )

        if not sentences:
            raise HTTPException(status_code=502, detail="RAG 未产出任何句子")
        if drive_failures == len(sentences):
            raise HTTPException(
                status_code=502,
                detail=f"LiveTalking 驱动失败：{len(sentences)} 句均未送达",
            )

        return {
            "ok": drive_failures == 0,
            "reply": "".join(sentences),
            "emotion": emotion,
            "intent": intent,
            "voice": voice,
            "sentence_count": len(sentences),
            "drive_failures": drive_failures,
        }


class SayIn(BaseModel):
    sessionid: str                 # LiveTalking WebRTC/RTMP 会话 ID
    text: str                      # 直接要数字人说出来的文字（如拍照定位讲解的结果）
    scenic_id: str = "lingshan"    # 决定音色
    interrupt: bool = True


@app.post("/live/say")
async def live_say(body: SayIn):
    """让数字人直接说出一段给定文字（不走 RAG）。

    用于「拍照视觉定位」闭环：游客拍照 → /chat/image 出定位+讲解+指路文字 →
    本端点把这段文字按景区音色送 LiveTalking /human，让数字人开口说。
    """
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")
    async with httpx.AsyncClient(trust_env=False, timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)) as client:
        _, voice = await _resolve_config(client, body.scenic_id)
        try:
            await client.post(
                f"{LIVETALKING_BASE}/human",
                json={
                    "sessionid": body.sessionid,
                    "text": text,
                    "type": "echo",
                    "interrupt": body.interrupt,
                    "tts": {"ref_file": voice},
                },
                timeout=15,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"驱动数字人失败: {type(e).__name__}: {e}")
    return {"ok": True, "voice": voice, "chars": len(text)}


@app.get("/stream.flv")
async def stream_flv():
    """反代 SRS 的 HTTP-FLV 直播流。

    为什么要反代：SRS 的 FLV 响应不带 Access-Control-Allow-Origin，
    而交互页是从 :8000 (或别的源) 打开的，浏览器跨源拉 :8080 的流会被拦 → 画框转圈/黑屏。
    桥接层(:9000)有 CORS allow *，前端改拉 :9000/stream.flv 即同源放行，绕开 SRS 无 CORS。
    用 StreamingResponse 边收边吐，不缓冲整段（直播流是无限长的）。
    """
    client = httpx.AsyncClient(trust_env=False, timeout=httpx.Timeout(connect=5.0, read=None, write=10.0, pool=5.0))
    req = client.build_request("GET", SRS_FLV)
    upstream = await client.send(req, stream=True)
    if upstream.status_code != 200:
        await upstream.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"SRS 流不可用: HTTP {upstream.status_code}（确认 LiveTalking 正在推流、SRS 在跑）")

    async def gen():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(gen(), media_type="video/x-flv")


@app.get("/live/avatar")
async def live_avatar(scenic_id: str = "lingshan"):
    """前端建立 WebRTC 连接前调用：返回该景区当前应使用的真实 avatar_id 与音色。
    把返回的 avatar_id 作为 LiveTalking /offer 的 `avatar` 参数即可实现形象切换。"""
    async with httpx.AsyncClient(trust_env=False) as client:
        avatar, voice = await _resolve_config(client, scenic_id)
    return {"avatar_id": avatar, "voice": voice, "scenic_id": scenic_id}


@app.get("/live/health")
async def live_health():
    """探测 RAG 与 LiveTalking 是否都在线（联调时先打这个）。"""
    out = {
        "rag": False,
        "livetalking": False,
        "rag_base": RAG_BASE,
        "livetalking_base": LIVETALKING_BASE,
    }
    async with httpx.AsyncClient(trust_env=False) as client:
        try:
            r = await client.get(f"{RAG_BASE}/health", timeout=3)
            out["rag"] = r.status_code == 200
        except Exception:
            pass
        try:
            # LiveTalking 无 /health，用首页探活
            r = await client.get(f"{LIVETALKING_BASE}/index.html", timeout=3)
            out["livetalking"] = r.status_code == 200
        except Exception:
            pass
    return out
