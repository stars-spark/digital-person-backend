"""Flux Kontext 图驱动编辑：keep 脸 + 指令"放进景区场景，保持脸/衣服不变" → 整体重绘，无合成缝。"""
import sys, time, uuid, httpx
COMFY = "http://127.0.0.1:8188"
scenic = sys.argv[1] if len(sys.argv) > 1 else "lingshan"
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 20260619
INPUT = sys.argv[3] if len(sys.argv) > 3 else "flux_in.png"
OUT = f"/root/autodl-tmp/flux_out_{scenic}.png"
SCENE = {
 "lingshan": "standing on a wide stone terrace plaza at the Lingshan scenic area in Wuxi, behind her are lush green forested rolling hills and soft misty mountains, an elegant traditional Chinese pavilion with upturned eaves on a distant hillside, calm hazy daylight, the misty expanse of Taihu lake in the far distance, serene peaceful Buddhist holy land natural scenery, tranquil garden landscape",
 "nihuawan": "standing on a clean stone-paved lane in the Nihuawan Zen town near Wuxi at dusk, behind her are elegant Tang-dynasty style wooden buildings with gracefully upturned eaves and softly glowing warm lanterns, a slender four-square five-tier wooden pagoda rising in the misty distance, a calm lake reflecting the warm twilight lights, serene Jiangnan water town atmosphere, soft warm evening glow, softly blurred background",
 "xihu": "standing on the willow-lined Su causeway beside the misty West Lake in Hangzhou, behind her are graceful weeping willow branches, calm silver lake water, a distant ancient pagoda and soft rolling green hills veiled in light spring mist, gentle overcast daylight, tranquil classical Chinese lakescape, softly blurred background",
 "mogaoku": "standing on the plaza before the Mogao Grottoes at Dunhuang, behind her rises the tall earth-red nine-story wooden temple built against the honeycombed ochre sandstone cliff of Mingsha mountain, rows of dark cave openings dotting the warm cliff face, clear dry desert daylight, ancient Silk Road grotto scenery, softly blurred background",
 "zhangjiajie": "standing on a railed viewing platform at Yuanjiajie in Zhangjiajie, behind her tower dramatic quartzite sandstone pillars rising straight from a deep misty green forested valley, drifting clouds and a sea of soft mist weaving between the stone peaks, cool diffused daylight, majestic natural wonder scenery, softly blurred background",
 "bingmayong": "standing on the elevated visitor walkway inside the Terracotta Army Pit One hall in Xian, far below the railing behind her are long earthen corridors of motionless terracotta warrior statues separated by rammed-earth walls, a vast steel-arched museum roof overhead, warm ambient indoor lighting, grand archaeological excavation scenery, softly blurred background",
}
GUIDANCE = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
PROMPT = (f"Place this same young Chinese woman, a friendly tour guide, {SCENE[scenic]}, "
          f"photorealistic, natural soft lighting on her face. "
          f"Keep her face, hairstyle, gentle smile and cream high-neck knit sweater exactly identical, do not change her appearance. "
          f"She looks youthful and baby-faced like a sweet 20-year-old, with very smooth soft flawless skin, "
          f"no wrinkles, no harsh skin texture, no visible muscle lines or skin folds on her face, "
          f"keep her youthful smooth tender complexion, do not age her.")
G = {
 "1": {"class_type":"UNETLoader","inputs":{"unet_name":"flux1-dev-kontext_fp8_scaled.safetensors","weight_dtype":"fp8_e4m3fn"}},
 "2": {"class_type":"DualCLIPLoader","inputs":{"clip_name1":"clip_l.safetensors","clip_name2":"t5xxl_fp8_e4m3fn.safetensors","type":"flux"}},
 "3": {"class_type":"VAELoader","inputs":{"vae_name":"ae.safetensors"}},
 "4": {"class_type":"LoadImage","inputs":{"image":INPUT}},
 "5": {"class_type":"FluxKontextImageScale","inputs":{"image":["4",0]}},
 "6": {"class_type":"VAEEncode","inputs":{"pixels":["5",0],"vae":["3",0]}},
 "7": {"class_type":"CLIPTextEncode","inputs":{"text":PROMPT,"clip":["2",0]}},
 "8": {"class_type":"FluxGuidance","inputs":{"conditioning":["7",0],"guidance":GUIDANCE}},
 "9": {"class_type":"ReferenceLatent","inputs":{"conditioning":["8",0],"latent":["6",0]}},
 "10":{"class_type":"ConditioningZeroOut","inputs":{"conditioning":["7",0]}},
 "11":{"class_type":"KSampler","inputs":{"seed":seed,"steps":20,"cfg":1.0,"sampler_name":"euler","scheduler":"simple","denoise":1.0,"model":["1",0],"positive":["9",0],"negative":["10",0],"latent_image":["6",0]}},
 "12":{"class_type":"VAEDecode","inputs":{"samples":["11",0],"vae":["3",0]}},
 "13":{"class_type":"SaveImage","inputs":{"filename_prefix":f"flux_{scenic}","images":["12",0]}},
}
c = httpx.Client(trust_env=False, timeout=30)
r = c.post(f"{COMFY}/prompt", json={"prompt":G,"client_id":uuid.uuid4().hex})
if r.status_code!=200: sys.exit(f"提交失败 {r.status_code}: {r.text[:500]}")
pid=r.json()["prompt_id"]; print(f"[flux] {scenic} pid={pid} 跑中…")
t0=time.time(); imgs=[]
while time.time()-t0<420:
    h=c.get(f"{COMFY}/history/{pid}").json()
    if pid in h:
        st=h[pid].get("status",{})
        if st.get("status_str")=="error": sys.exit(f"执行报错: {st}")
        for n in h[pid].get("outputs",{}).values(): imgs+=n.get("images",[])
        if imgs: break
    time.sleep(3)
if not imgs: sys.exit("超时无输出")
im=imgs[-1]
raw=c.get(f"{COMFY}/view",params={"filename":im["filename"],"subfolder":im.get("subfolder",""),"type":im.get("type","output")}).content
open(OUT,"wb").write(raw); print(f"✅ 输出 {OUT} ({len(raw)} bytes)")
