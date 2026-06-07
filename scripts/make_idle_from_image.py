"""本地肖像图 → 自然微动 idle 待机视频（通义万相 图生视频）。

为什么用图生视频而不是 LivePortrait：万相 i2v 是真·视频扩散生成，整帧连贯，
头一动头发自然跟随 → 不会出现 LivePortrait（2D 扭曲）那种"头动发不动"的穿模。
动作 prompt 控制成"小幅自然微动"，既破死脸又稳。

用法：
  .venv/bin/python scripts/make_idle_from_image.py <输入图.png> <输出.mp4>
"""
import os
import sys
from pathlib import Path

import dashscope
import httpx
from dashscope import VideoSynthesis
from dotenv import load_dotenv

I2V_MODEL = "wanx2.1-i2v-turbo"
# 神态对标专业女主播（见 docs/神态管理对标与应用.md）：
#   对象感=目光平视镜头；头颈端正稳定（治"头左右摇摆"）；眨眼干脆利落（治"眨眼慢"）；不刻意笑
MOTION = (
    "一位专业的女主播端坐在镜头前播报，目光始终平视前方、专注真诚地看着镜头，富有对象感；"
    "头部和肩膀保持端正稳定，几乎不左右摇摆、不前后晃动，只有极其细微的自然呼吸起伏，姿态沉稳大方；"
    "保持端庄温和的浅笑，不刻意大笑；眼睛大部分时间睁开平视，"
    "眨眼次数少而从容、每隔三到五秒才自然眨一次眼，单次眨眼干脆利落、绝不是慢动作慢镜头，"
    "切忌频繁眨眼、连续眨眼或眨巴眼；"
    "气质端庄亲和，镜头固定，背景纯净静止，整个画面稳定清晰、不抖动不漂移"
)


def main():
    if len(sys.argv) < 3:
        sys.exit("用法: make_idle_from_image.py <输入图> <输出mp4> [表情motion覆盖]")
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    motion = sys.argv[3] if len(sys.argv) > 3 else MOTION   # 可选：覆盖动作/表情 prompt
    if not src.exists():
        sys.exit(f"输入图不存在: {src}")

    load_dotenv()
    key = os.getenv("DASHSCOPE_API_KEY")
    dashscope.api_key = key

    # 传 file:// 本地路径，SDK 自动上传到 DashScope OSS 并解析
    img = f"file://{src.resolve()}"
    print(f"[i2v] {I2V_MODEL} 自动上传本地图并生成 …（约 3-5 分钟）")
    rsp = VideoSynthesis.call(model=I2V_MODEL, prompt=motion, img_url=img)
    if rsp.status_code != 200:
        sys.exit(f"❌ 图生视频失败 code={rsp.code} msg={rsp.message}")
    url = rsp.output.video_url
    dst.parent.mkdir(parents=True, exist_ok=True)
    with httpx.Client(trust_env=False, timeout=180, follow_redirects=True) as c:
        dst.write_bytes(c.get(url).content)
    print(f"✅ idle 视频已存: {dst}")


if __name__ == "__main__":
    main()
