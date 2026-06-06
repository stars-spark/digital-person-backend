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
MOTION = (
    "人物保持端庄温和的微笑，自然地以正常频率眨眼、眨眼干脆利落真实自然不是慢动作，"
    "头部和肩膀有轻微自然的晃动，短发随之轻轻自然摆动，呼吸般的细微起伏，"
    "镜头固定，背景静止，动作幅度小而自然真实，眼神灵动有神，气质亲和"
)


def main():
    if len(sys.argv) < 3:
        sys.exit("用法: make_idle_from_image.py <输入图> <输出mp4>")
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.exists():
        sys.exit(f"输入图不存在: {src}")

    load_dotenv()
    key = os.getenv("DASHSCOPE_API_KEY")
    dashscope.api_key = key

    # 传 file:// 本地路径，SDK 自动上传到 DashScope OSS 并解析
    img = f"file://{src.resolve()}"
    print(f"[i2v] {I2V_MODEL} 自动上传本地图并生成 …（约 3-5 分钟）")
    rsp = VideoSynthesis.call(model=I2V_MODEL, prompt=MOTION, img_url=img)
    if rsp.status_code != 200:
        sys.exit(f"❌ 图生视频失败 code={rsp.code} msg={rsp.message}")
    url = rsp.output.video_url
    dst.parent.mkdir(parents=True, exist_ok=True)
    with httpx.Client(trust_env=False, timeout=180, follow_redirects=True) as c:
        dst.write_bytes(c.get(url).content)
    print(f"✅ idle 视频已存: {dst}")


if __name__ == "__main__":
    main()
