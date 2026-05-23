"""
多模态问答：qwen-vl-max-latest。
满足赛题"至少使用 1 个多模态大模型"的硬性要求。

典型场景：
  - 游客拍到一个景点/雕塑，问"这是什么？有什么来历？"
  - 游客上传景区地图，问"我在哪，怎么走最近？"
  - 游客上传菜单/指示牌，问景区内的实际信息
"""

import base64
from pathlib import Path

import dashscope
from dashscope import MultiModalConversation

from backend.core.config import settings
from backend.llm.client import extract_emotion

dashscope.api_key = settings.dashscope_api_key

_VL_SYSTEM = """你是景区专属AI导游。游客发来了一张图片并提问，请结合图片内容，
用热情、生动的语言回答。如果图片展示的是景区内的景点或场景，请详细介绍其文化背景。
如果图片内容与景区无关，礼貌引导游客回到景区话题。

在回答正文结束后，另起一行，严格按格式标注情绪：
[情绪:开心] 或 [情绪:兴奋] 或 [情绪:平静] 或 [情绪:好奇] 或 [情绪:关切] 或 [情绪:抱歉]"""


def answer_with_image(
    image_b64: str,
    question: str,
    scenic_name: str = "灵山胜境",
    image_format: str = "jpeg",
) -> tuple[str, str]:
    """
    输入 base64 图片 + 文字问题，返回 (reply, emotion)。
    image_format: jpeg / png / webp / gif
    """
    image_url = f"data:image/{image_format};base64,{image_b64}"
    messages = [
        {"role": "system", "content": [{"text": _VL_SYSTEM}]},
        {
            "role": "user",
            "content": [
                {"image": image_url},
                {"text": question or "请介绍一下这张图片里的内容"},
            ],
        },
    ]
    response = MultiModalConversation.call(
        model=settings.vl_model,
        messages=messages,
    )
    raw = response.output.choices[0].message.content[0]["text"]
    return extract_emotion(raw)


def answer_with_image_file(
    image_path: str | Path,
    question: str,
    scenic_name: str = "灵山胜境",
) -> tuple[str, str]:
    """便捷函数：从本地文件读取图片。"""
    path = Path(image_path)
    fmt = path.suffix.lstrip(".").lower()
    fmt = "jpeg" if fmt in ("jpg", "jpeg") else fmt
    b64 = base64.b64encode(path.read_bytes()).decode()
    return answer_with_image(b64, question, scenic_name, fmt)
