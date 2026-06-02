"""
多模态聊天接口：游客上传图片提问，用 qwen-vl-max 回答。
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.llm.multimodal import answer_with_image
from backend.db.database import save_conversation
from backend.rag.pipeline import get_scenic_config

router = APIRouter(prefix="/chat", tags=["multimodal"])


class ImageChatRequest(BaseModel):
    session_id: str = "anonymous"
    scenic_id: str = "lingshan"
    image_b64: str              # base64 编码的图片
    image_format: str = "jpeg"  # jpeg / png / webp
    question: str = "请介绍一下图片里的内容"


class ImageChatResponse(BaseModel):
    reply: str
    emotion: str
    model_used: str = "qwen-vl-max"


@router.post("/image", response_model=ImageChatResponse)
async def image_chat_endpoint(req: ImageChatRequest):
    if not req.image_b64:
        raise HTTPException(status_code=400, detail="image_b64 不能为空")

    cfg = get_scenic_config(req.scenic_id)

    try:
        reply, emotion = answer_with_image(
            image_b64=req.image_b64,
            question=req.question,
            scenic_name=cfg["name"],
            image_format=req.image_format,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"多模态模型调用失败: {e}")

    save_conversation(
        session_id=req.session_id,
        scenic_id=req.scenic_id,
        user_message=f"[图片] {req.question}",
        ai_reply=reply,
        emotion=emotion,
        context_used=False,
    )

    return ImageChatResponse(reply=reply, emotion=emotion)
