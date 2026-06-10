# 景区导览服务AI数字人 — 项目工作档案

## 赛事信息

- **赛事**：第十五届中国软件杯大赛（A组）
- **赛题**：景区导览服务AI数字人
- **出题企业**：锐捷网络（苏州）有限公司
- **答疑QQ群**：1093135039
- **示范景区**：灵山胜境（无锡）+ 拈花湾禅意小镇

---

## 团队与分工

| 成员 | 职责 |
|---|---|
| **本用户（我）** | LLM + RAG + 知识库 + Prompt Engineering |
| **队友 A** | 数字人渲染 + 语音链路（ASR/TTS + SadTalker/MuseTalk） |
| **队友 B** | 前端界面 + 管理后台 + 数据大屏 |

**Claude Code 角色**：技术导师 + 协作编程伙伴（随时在线）

---

## 系统核心设计原则

> 系统不绑定灵山景区，而是**插拔式知识库架构**：  
> 导入任意景区的知识库后，问答准确率须同样满足 ≥90% 的硬性指标。

---

## 硬性指标（评审红线）

> ⚠️ 注意区分指标性质（按赛题原文精确措辞，勿拔高）：
> - **唯一带明确数值+测评方式的硬红线 = 准确率**："事实性问答的准确率**不低于90%**，由评审专家基于标准测试集评测"。
> - **延迟是"合理范围"的体验性要求，非定值红线**：赛题原文"系统稳定，**交互响应延迟应控制在合理范围内（如语音问答延迟<5秒）**，保证用户体验流畅"——归属**稳定性/流畅体验**维度（与"系统不应崩溃或长时间无响应"并列），"<5秒"是**举例（"如"）非评定值**，且主语是"交互响应延迟"泛指、非仅语音。我们把"语音问答<5秒"当**自定工程目标**对标即可，端到端度量口径（用户说完→数字人开口）亦为我方自定义。

- 问答准确率 **≥ 90%**（硬红线·专家基于标准测试集评测）
- 语音问答延迟 **< 5 秒**（赛题示例的"合理响应范围"，自定工程目标，非硬性定值）
- 口型同步 + 表情自然度（专家评估演示视频）
- 必须使用 **≥ 1 个多模态大模型**

---

## 技术架构概览

```
游客交互端
  语音输入 (Whisper)  ─┐
  文本输入             ├──► FastAPI 后端 ──► RAG 问答引擎 ──► LLM (Claude/Qwen)
  数字人渲染窗口      ◄─┘         │              │
  (SadTalker/MuseTalk)            │         ChromaDB (知识库)
  TTS 语音输出                    │
                                  ▼
                           管理后台 (React)
                    知识库管理 | 数字人配置 | 情感分析 | 数据大屏
```

---

## 我的职责范围（LLM 负责人）

```
知识库工程
  ├── 文档解析 → 分块 → 向量化 → ChromaDB 存储
  ├── 检索策略（稠密检索 + 关键词混合）
  └── 多景区命名空间/collection 隔离设计

RAG 问答引擎
  ├── 检索-增强-生成全链路
  ├── 幻觉控制（召回为空时的兜底策略）
  └── 准确率保证工程

Prompt Engineering
  ├── 数字人导游人格设定
  ├── 个性化路线推荐逻辑
  └── 景区切换时 Prompt 自动适配

对外接口（给队友用）
  POST /chat       { session_id, message, scenic_id } → { reply, emotion }
  POST /kb/upload  上传文档，触发重新入库
  GET  /kb/list    查询当前知识库状态
```

---

## 技术选型（已确认）

| 模块 | 选型 | 说明 |
|---|---|---|
| **文本 LLM** | `qwen-max`（DashScope） | 中文理解最强国产商业模型。⚠️ 当前 key 对所有 `-latest` 滚动版无访问权限（403 AccessDenied），必须用稳定版 |
| **多模态 LLM** | `qwen-vl-max`（DashScope） | 满足赛题多模态硬性要求；图文问答。同样禁用 `-latest`，用稳定版 |
| **向量嵌入** | `BAAI/bge-m3`（本地，4080运行） | 中英双语，检索质量高，无API费用 |
| **重排序** | `BAAI/bge-reranker-v2-m3`（本地） | 提升召回精度，是90%准确率的关键 |
| **向量数据库** | ChromaDB（本地） | 多 collection 实现景区命名空间隔离 |
| **稀疏检索** | rank_bm25 | 与稠密检索混合，覆盖关键词精确匹配 |
| **语音识别** | faster-whisper **small**（本地 CPU int8） | ⚠️ large-v3 与数字人争显存装不下 → 改 small 跑 CPU：0 显存、~1.1s/句；自研景区术语热词增强 |
| **语音合成** | CosyVoice2（本地） | 音色自然，可克隆景区专属声音 |
| **数字人驱动** | **LiveTalking + MuseTalk V1.5**（本地4080） | 实时 WebRTC 流，30fps 口型同步；`/human` 外部文字驱动接入 RAG。已在 4080 跑通 demo |
| **后端框架** | FastAPI（Python） | 用户已有基础 |
| **前端框架** | React + Ant Design + ECharts | 数据大屏用ECharts |
| **数据库** | SQLite（会话/分析） + ChromaDB（向量） | 初赛阶段足够 |

## 硬件配置（已确认）

- 设备：ROG 幻16
- GPU：RTX 4080 Laptop，11.6GB 显存
- 驱动：580.159.03，CUDA 13.0
- 本地可运行：BGE-M3、BGE-Reranker、faster-whisper large-v3、CosyVoice2、LiveTalking+MuseTalk（约 10.9GB 显存）

---

## 数据资产

| 文件 | 内容 | 用途 |
|---|---|---|
| `示范景区公开资料包/灵山胜境：历史、文化、景点特色与个性化游览指南.docx` | 历史、文化、6条路线、贴士 | RAG 主文档 |
| `示范景区公开资料包/灵山胜境 景点结构化数据集.docx` | 灵山+拈花湾景点结构化表（ID/位置/文化内涵/游玩亮点） | 精准问答知识 |
| `示范景区公开资料包/景点景区旅游数据行为分析数据.xlsx` | 游客行为数据（年龄/满意度/花费等） | 数据大屏 + 情感分析 |

---

## 开发路线（4周）

### Week 1：RAG 基础 + 灵山数据跑通
- 学习：向量嵌入、余弦相似度、RAG三步原理
- 实践：LangChain 把灵山文档入库，能回答一个问题

### Week 2：准确率工程 + Prompt 打磨
- 学习：RAG 出错的原因，分块策略，检索召回率
- 实践：手工构建 20 道测试题，准确率提到 90%+

### Week 3：景区泛化 + 管理接口
- 学习：多租户知识库设计
- 实践：能切换到另一个景区知识库，接口不变

### Week 4：联调 + 压测 + 演示视频
- 与队友全链路联调
- 优化延迟目标：整体 < 3 秒

---

## 初赛提交清单

- [ ] 产品源代码或可执行文件
- [ ] 部署和使用手册
- [ ] 总体设计文档
- [ ] 方案介绍 PPT（需求分析、方案设计、核心技术、创新点、演示、测试数据、团队介绍）
- [ ] 演示视频（≤7分钟，.avi/.mp4/.wmv）

---

## 本地开发环境

- **虚拟环境**：`.venv`（Python 3.11.11，Miniconda 来源）
- **激活**：`source /home/jiale/Desktop/Digital_Person/.venv/bin/activate`
- **安装依赖**：`~/.local/bin/uv pip install -r requirements.txt --index-url https://pypi.tuna.tsinghua.edu.cn/simple`
- **注意**：FlagEmbedding 须锁定 `==1.2.11` + `transformers==4.44.2`，高版本有 API 不兼容问题

## 阿里云 ECS 服务器

| 项 | 值 |
|---|---|
| 公网 IP | `116.62.136.211` |
| 规格 | ecs.c7.xlarge（4 vCPU / 8GB RAM，无 GPU） |
| 部署模式 | `DEPLOY_MODE=cloud`（DashScope 嵌入，无需 GPU） |

**SSH 访问**（免密，私钥 `~/.ssh/digital_person`）：
```bash
ssh -i ~/.ssh/digital_person root@116.62.136.211
```

---

## 云端服务维护手册

### 服务状态管理
```bash
# 查看运行状态
ssh -i ~/.ssh/digital_person root@116.62.136.211 "systemctl status digital-person"

# 实时查看日志
ssh -i ~/.ssh/digital_person root@116.62.136.211 "journalctl -u digital-person -f"

# 重启服务
ssh -i ~/.ssh/digital_person root@116.62.136.211 "systemctl restart digital-person"
```

### 更新代码（最常用）
```bash
# 1. 本地修改代码后，打包上传
cd /home/jiale/Desktop/Digital_Person
tar czf /tmp/digital-person.tar.gz \
    --exclude="__pycache__" --exclude="*.pyc" \
    --exclude=".venv" --exclude="*.DS_Store" \
    backend/ scripts/ tests/ 示范景区公开资料包/ \
    requirements.cloud.txt requirements.txt .env.example Dockerfile
scp -i ~/.ssh/digital_person /tmp/digital-person.tar.gz root@116.62.136.211:/root/

# 2. 服务器上解压并重启
ssh -i ~/.ssh/digital_person root@116.62.136.211 \
    "cd /root/digital-person && tar xzf /root/digital-person.tar.gz --overwrite && systemctl restart digital-person"
```

### 重新入库知识库
```bash
ssh -i ~/.ssh/digital_person root@116.62.136.211 \
    "cd /root/digital-person && .venv/bin/python scripts/ingest_lingshan.py"
```

### 安装新 Python 依赖
```bash
# 先更新 requirements.cloud.txt，再在服务器上安装
ssh -i ~/.ssh/digital_person root@116.62.136.211 \
    "cd /root/digital-person && .venv/bin/python -m uv pip install -r requirements.cloud.txt \
     --index-url https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com"
```

### 接口验证
```bash
# 健康检查
curl http://116.62.136.211:8000/health

# 问答测试
curl -X POST http://116.62.136.211:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"灵山大佛有多高","scenic_id":"lingshan"}'

# 接口文档
open http://116.62.136.211:8000/docs
```

### 重要路径（服务器上）
| 路径 | 说明 |
|---|---|
| `/root/digital-person/` | 项目根目录 |
| `/root/digital-person/.env` | 环境变量（API Key 在这） |
| `/root/digital-person/.venv/` | Python 虚拟环境 |
| `/root/digital-person/vector_store/` | ChromaDB 向量数据库 |
| `/etc/systemd/system/digital-person.service` | systemd 服务配置 |

---

## 赛题需求对照（对标评审标准）

### 基本功能需求

| 赛题要求 | 实现状态 | 说明 |
|---|---|---|
| 语音输入 | ✅ | 本地自研 ASR `POST /asr`（faster-whisper small CPU int8 + 景区热词，~1.1s/句） |
| 文本输入 | ✅ | `POST /chat` |
| 数字人语音/表情/口型同步回答 | 🔜 队友A/B | TTS+SadTalker，后端 SSE 事件已就绪 |
| 智能问答（历史/文化/景点特色） | ✅ | RAG，准确率 97.7% |
| 个性化路线推荐 | ✅ | Prompt 内含 6 条灵山路线推荐逻辑 |
| 知识库管理（上传/更新/维护） | ✅ | `POST /kb/upload`、`GET /kb/list`、`DELETE /kb/{id}` |
| **数字人形象管理**（外观/声音配置） | ❌ 缺后端 | 需增加 `GET/PUT /digital-human/config` 接口 |
| 游客感受度报告 | ✅ | `POST /analytics/report`（LLM生成） |
| 数据大屏概览 | ✅ | `/analytics/dashboard`、`hot-topics`、`sentiment-trend` |

### 非功能性需求

| 赛题要求 | 实现状态 | 实测数据 |
|---|---|---|
| ≥1个多模态大模型 | ✅ | qwen-vl-max（`POST /chat/image`） |
| 问答准确率 ≥ 90% | ✅ | 97.7%（44题，5景区） |
| 语音问答延迟 < 5秒 | 🔜 联调中 | 后端首句 ~2s，TTS+渲染待测 |
| 系统不崩溃/长时无响应 | ✅ | systemd 托管，ECS 云端常驻 |
| (可选) GPS/位置感知 | ❌ 未实现 | 可作为加分项考虑 |

---

## 当前进度

### 后端基础设施
- [x] 赛题研读完成
- [x] 技术架构设计完成
- [x] 三人分工职责确认
- [x] Python 3.11 虚拟环境搭建完成（`.venv/`，基于 miniconda）
- [x] 依赖安装完成（150 个包，含 torch、FlagEmbedding、chromadb 等）
- [x] 配置 DashScope API Key（`.env` 文件）
- [x] 阿里云 ECS 购买（ecs.c7.xlarge，116.62.136.211）
- [x] ECS 部署成功（systemd 常驻，`/health` + `/chat` 验证通过）
- [x] GitHub 仓库创建（`stars-spark/digital-person-backend`，私有）

### RAG 问答引擎
- [x] 灵山/拈花湾文档入库
- [x] GPU 加速启用（RAG 检索从 30s → 0.54s）
- [x] 混合检索（BGE-M3 稠密 + BM25 稀疏）
- [x] BGE-Reranker-v2-m3 重排序
- [x] Query Rewrite（含指代词时自动改写）
- [x] LRU 答案缓存（热门问题 <5ms，实测 4713ms→238ms）
- [x] 并行异步检索（asyncio.gather，云端节省 ~50ms）
- [x] fast 模式（qwen-turbo，首 token ~150ms）
- [x] 3 个扩展景区数据文档生成（西湖/黄山/故宫）
- [x] 5 个景区全部入库（lingshan/nihuawan/xihu/huangshan/gugong）
- [x] **准确率测试：97.7%**（44题；灵山90%，西湖/黄山/故宫各100%）

### 接口层
- [x] `POST /chat`（同步 + SSE 流式，含 emotion/sentence/end 事件）
- [x] `POST /chat/image`（qwen-vl-max 多模态）
- [x] `POST /kb/upload` / `GET /kb/list` / `DELETE /kb/{id}`
- [x] Analytics 全套（dashboard / hot-topics / sentiment-trend / conversations / report）
- [x] SQLite 会话存储（session_id / emotion / created_at）
- [x] SSE 流式 bug 修复（pipeline.py 遗留 `yield` 字符串导致 TypeError，commit bf21d88）
- [x] 后端托管测试面板（`GET /test` → `test_ui.html`）
- [x] **数字人形象配置接口**（`GET/PUT /digital-human/config`，commit 0883899）
- [x] **知识盲区接口**（`GET /analytics/knowledge-gaps`，commit e9662b1）
- [x] **负面情绪预警接口**（`GET /analytics/alerts`，commit 08d31ba）
- [x] **多语言问答**（`lang` 参数，支持 auto/en/ja/ko/fr/de/es/ru/zh，commit e5877fc）
- [x] **DashScope 模型修复**：`-latest` 滚动版全部 403 AccessDenied → 切稳定版 `qwen-max`/`qwen-vl-max`；LLM 调用加 `status_code` 防御（不再 NoneType 崩溃）
- [x] **桥接层 `bridge/server.py`**（本地 :9000）：`/live/ask` 串 RAG→数字人、`/live/avatar` 切形象、`/live/health`（RAG 半边已联调通过）
- [x] **桥接层流式改造**：`/live/ask` 改为订阅 RAG 句子级 SSE 流，每出一句立即驱动数字人（首句 ~0.8s 即开口，不等整段），实测正确解析 5 句、逐句驱动逻辑就绪
- [x] **本地自研 ASR**（`POST /asr`，`backend/asr/transcriber.py`）：faster-whisper small + CPU int8（0 显存，把 4080 整块留给数字人）；自研改造点=景区术语热词增强 + VAD + 中文空格后处理；实测 ~1.1s/句、生僻专名"九龙灌浴"准确识别。模型懒加载，ECS 无依赖也不崩
- [x] **SSE 伪流式修复（重要）**：`_raw_token_stream` 用同步 DashScope generator 在 async 里迭代，阻塞 asyncio 事件循环，使 FastAPI 整段才 flush SSE（伪流式，连带让桥接「首句抢跑」失效）；改为同步迭代放线程 + `asyncio.Queue` 异步交回 token。实测首句 8.27s→2.58s，逐句真流式（commit 88e4660）
- [x] **移动测试前端**（`GET /m` → `test_mobile.html`）：移动优先，覆盖 chat(流式逐字+计时)/asr/拍照/形象配置/大屏/知识库；流式用 XHR `onprogress` 增量解析（兼容微信等移动浏览器，优于 fetch streaming）
- [x] **数字人交互页**（`GET /talk` → `talk.html`）：显示数字人 + 问答走桥接 `/live/ask`，地址按访问 hostname 自动推断；游客端端到端页面
- [x] **交互页改 RTMP→FLV + 修黑屏**：本机 aiortc 双轨 ICE 必失败→黑屏，改 LiveTalking `--transport rtmp` 推 SRS、mpegts.js 播 HTTP-FLV；SRS 无 CORS→画框转圈，桥接加 `/stream.flv` 反代借 CORS 同源播放，画面正常
- [x] **MuseTalk OOM 修复（关键）**：默认 `batch_size=16` 在 11.6G 4080 Laptop 空闲占 11.3G、一说话 VAE decode 峰值 +512M 直接 CUDA OOM→推流死→转圈；降 `--batch_size 4` + `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`，空闲降 7.2G、留 4.6G 余量，实测 0 OOM
- [x] **游客端语音输入 + VAD 自动断句**（`talk.html`）：点麦克风→Web Audio 实时 RMS 能量检测→说完静音 0.8s 自动停录→`/asr` 转写→自动发问；零依赖离线可用（对标 OpenAvatarChat 的 Silero-VAD 角色，能量版）。⚠️ getUserMedia 需 localhost/HTTPS，手机走 http 局域网 IP 会被禁麦
- [x] **古风女导游形象生成**（任务 #5-7 完成）：`scripts/gen_avatar_asset.py` 用通义万相 文生图(wanx2.1-t2i-plus 竖版720x1280)→图生视频(wanx2.1-i2v-turbo 5s微动)→`genavatar.py` 烘成 MuseTalk avatar `guofeng_female`；素材在 `assets/avatar_src/guofeng_female/`。桥接 `AVATAR_MAP` 已把 `female_elegant/female_young`→`guofeng_female`
- [x] **OpenAvatarChat 吸收方案**（`docs/OpenAvatarChat吸收方案.md`）：逐模块对照 + 落地排序（①模块化叙事 ②VAD✅ ③TTS换CosyVoice ④LiteAvatar暂缓）
- [x] **数字人自然度诊断 + 选型报告**（`docs/数字人自然度诊断与选型.md`）：恐怖谷根因=MuseTalk 只换嘴、整脸复制底座（"死脸"）；横评 Ditto/EchoMimic/Sonic/LivePortrait/InteractAvatar（实时 vs 离线取舍）；ComfyUI=离线工具非直播引擎
- [x] **S2 治"死脸"：LivePortrait 活底座**（已落地）：clone `~/Desktop/LivePortrait`（隔离 venv `~/Desktop/lp_venv`，`--system-site-packages` 共享 torch）；`inference.py -s 古风肖像 -d 驱动片段` 把真人眨眼/微表情迁到肖像→活底座 `assets/avatar_src/guofeng_female/idle_liveportrait.mp4`→烘成 `guofeng_lp`。底座生成脚本思路可写进设计文档
- [x] **S3 MuseTalk 调参**：`genavatar.py` 的 `bbox_shift`（嘴框上下偏移，焊进 coords/latents，重烘~2min）。烘了 `guofeng_lp`(bs=0)/`guofeng_lp_bs5`(+5)；bs=-5 运行时人脸框出界起不来，跳过。对比片 `/tmp/s3_clips/cmp_s2_deathface.mp4`(改前/改后)、`cmp_s3_bbox.mp4`(bbox 0/+5)，**待用户盲评选定版**
- [x] **录对比片流水线**（`/tmp/capture_talk.sh`）：起 LiveTalking→ffmpeg 抓 SRS 的 FLV→`/human` 驱动同台词→杀进程，逐 avatar 录同句对比。⚠️教训：GPU 任务必须串行（同跑烘录+LiveTalking 会 OOM）、每轮确认进程清零再启下一个
- [x] **创新三/AR-lite 视觉定位导游**（`/chat/image` v2 两段式）：① qwen-vl 只认地标（出 `[位置:X]`→`location` 字段）② RAG 接地讲解+指路（事实由知识库约束、走 navigation 意图、复用 group_type 人格）。桥接 `/live/say`（数字人说任意文字）+ talk.html 📷 拍照闭环。实测大佛→📍大佛广场+真实典故+真景点指路；负向优雅引导
- [x] **人流感知分流**（`backend/analytics/crowd.py` + `GET /analytics/crowd`）：用真实行为数据（14万行；灵山/拈花湾/西湖在数据中）算 热门度+月度季节性，叠时段模型→拥挤档位（空闲/适中/较多/繁忙）+ 旺淡季+错峰时段。接入导游：navigation/recommend 意图自动注入客流上下文→自然给"避开人流高峰/傍晚错峰"建议（含实时客流故不缓存）。⚠️ECS 部署需 pandas+openpyxl + 上传该 xlsx
- [x] **口播格式修复（重要）**：`SYSTEM_PROMPT_TEMPLATE` 加全局口播规则——回答会被数字人朗读，禁 Markdown（#、**、-、编号清单），改"先…再…最后…"口语过渡。一处修复覆盖所有意图，解决路线/推荐回复念出"井号一二三"的问题
- [x] **时间天气感知**（`backend/analytics/env_context.py`）：scenic→城市，wttr.in 免费无 key 查实时天气（30min 缓存+超时+优雅降级，取不到只用时间不影响主流程），时段（清晨/上午/…/夜晚）永远可用。与客流一起经 `_directive_with_context` 注入 navigation/recommend→导游自然给"午后日晒先逛室内/下雨带伞/傍晚看日落"建议
- [x] **行程总结/电子游记**（`backend/api/trip.py`，`GET /trip/summary?session_id=&scenic_id=`）：读本次会话历史（含拍照定位记录），LLM 生成温暖游记回顾（提去过的景点+聊过的话题+祝福，口语无 markdown），体现导游"收尾关怀"。空会话优雅降级
- [x] **重组覆盖测试**（`/tmp/test_all.py`）：14 项全过——口播无 markdown、客流+天气融入、视觉定位 v2、行程总结引用拍照点、无数据/空会话优雅降级
- [x] **主动迎宾**（`GET /trip/greeting?scenic_id=&group_type=`）：游客一连接，数字人**主动**微笑打招呼+自我介绍+邀请提问/拍照（按景区 guide_name + 人格差异化，口语无 markdown）。talk.html 连接成功后自动 `/trip/greeting`→`/live/say` 驱动开口。这是"开场画面"，演示视频第一幕。实测：灵山小慧/西湖小雨各自迎宾、亲子版提小朋友
- [x] **数字人自然度反馈（2026-06-04）**：LivePortrait idle 仍有发型穿模+面部抖（2D 扭曲天花板）。根因+铁三角（真实/身体动作/实时 取二）见 `docs/数字人自然度诊断与选型.md`。决策：idle 改图生视频（可灵/万相，无穿模）；身体动作放演示视频离线英雄镜头
- [x] **TTS 换百炼 Qwen-TTS（commit 5b217e7）**：edge-TTS 偏机械 → LiveTalking 内置 `qwentts`（百炼 Qwen3-TTS-Flash-Realtime WebSocket，0 本地 GPU、用现有 key）。桥接 VOICE_MAP 改 Qwen 音色（Cherry 女/Ethan 男，可按消息切）。启动加 `DASHSCOPE_API_KEY ... --tts qwentts --REF_FILE Cherry`；livetalking 环境需 dashscope>=1.25.11（已装）
- [x] **接入队友 CosyVoice 语音服务（2026-06-07，自然度升级）**：队友仓库 `Tsing-ran/Digital-person_tts_backend` clone 到 `~/Desktop/Digital-person_tts_backend`（独立 venv，:8001）= DashScope CosyVoice TTS（14 音色+5 景区专属：灵山`longjing`/拈花湾`longxiaoxia`/西湖`longyuan`/黄山`longfei`/故宫`longmiao`）+ Paraformer ASR。⚠️**修了她一个 bug**：`main.py` 只检查 key 存在却没 `dashscope.api_key=...` 赋值→tts_v2 全报 `apikey is required`（已加一行修复，待她 upstream 修）。⚠️`.env` 放 key（gitignore）、`LLM_BACKEND_URL` 指我们 RAG。**接入数字人**：新写 LiveTalking provider `tts/ttsbackend.py`（POST 她 `/api/speech/tts`→16kHz WAV→喂 MuseTalk）+ `base_avatar.py` 注册 `ttsbackend` + 桥接 `/human` tts 字段加 `scenic_id`（她服务按景区选专属音色）。启动改 `--tts ttsbackend --TTS_SERVER http://127.0.0.1:8001`（替代 `--tts qwentts --REF_FILE`）。各件已单测通过，整链口型同步待联调(#20)。她服务启动：`cd ~/Desktop/Digital-person_tts_backend/backend && .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8001`
- [x] **统一 ASR 改用队友 Paraformer（2026-06-07）**：小程序 `config.js` 加 `TTS_BACKEND=:8001`；`utils/api.js` 的 `asr()` 改调 `TTS_BACKEND/api/speech/asr`（字段名 `audio`，`language=auto`，删 `scenic_id` 参数—她服务景区术语纠错已内置）。Paraformer 比 faster-whisper-small 精度更高，生僻景区专名（九龙灌浴、梵宫等）无需热词工程。H5 `talk.html` 仍走 `backend.main /asr`（CPU faster-whisper），两条路并存，互不影响。
- [x] **形象素材库（20 候选）**：`scripts/gen_avatar_candidates.py` 通义万相批量出 20 张候选 → `assets/avatar_candidates/`（竖版 720x1280）。**用户选定 16 号波波头为主形象**（甜美/清纯/亲和系，12/15/17/18/19 备选）。审美偏好见 [[avatar-aesthetic-preference]] 记忆
- [x] **16 号 idle + avatar（穿模问题解决）**：`scripts/make_idle_from_image.py` 本地图 → DashScope OSS 自动上传 → 万相 i2v（**真·视频生成，头发跟头动、无穿模**，取代 LivePortrait 2D 扭曲）→ `assets/avatar_src/sweet_bob/idle*.mp4` → 烘成 avatar `sweet_bob`。已配 Qwen-TTS 录通端到端。⚠️i2v 动作靠 prompt 引导、随机性，眨眼/头发幅度要调 1-2 版；待最终定脸定装后重做 idle
- [x] **ComfyUI 自研形象生成 · InstantID 锁脸换装（已跑通！）**：本地 `~/Desktop/ComfyUI`（venv `~/Desktop/comfy_venv` 共享 livetalking torch，:8188）+ RealVisXL V5.0 + `custom_nodes/ComfyUI_InstantID` + antelopev2 + insightface。`scripts/comfy_face_swap.py` 经 ComfyUI `/prompt` API 跑工作流：**锁定 16 号的脸 → 6 套服装（职业装/汉服/马甲/旗袍/民族/冬装）+ 去黑眼袋 + 提颜值**，产物 `assets/avatar_facelock/`。这就是赛题「形象可配置服装」现场演示 + 自研亮点（答辩可展示工作流图）。模型在 ComfyUI/models（instantid/controlnet/checkpoints/insightface）。⚠️ ComfyUI 占显存 ~7G，跑 MuseTalk 前要先停；onnxruntime 仅 CPU provider（人脸分析够用）；后续：发型锁波波头（prompt 加 bob）、接管理端「AI生成新形象」按钮
- [x] **主形象定脸 + 眨嘴节奏修复**：用户美图秀秀手修 16 号（淡眼袋/缩鼻孔）= `assets/avatar_candidates/16_sweet_bob_retouched.png`（InstantID 转身份非几何，修不了鼻孔，故手修后**直接用图**，InstantID 只留作换装 demo）→ `make_idle_from_image.py` 出 idle → 烘成主 avatar `sweet_bob`。**演示反馈"眨眼慢+嘴快=谄媚"** 根因：MuseTalk 脸快慢（idle 慢）与嘴快慢（音频快）解耦 → 修：①`qwentts.py` 两处 `speech_rate=0.9` 放慢语速 ②idle MOTION prompt 改"明快眨眼、绝不慢镜头"重生成。`make_idle_from_image.py` 第 3 参数可覆盖 MOTION（用于表情底座）
- [x] **面部情绪/表情管理（#14，拿奖分水岭）**：RAG 已出 `[情绪:X]`（开心/兴奋/平静/好奇/关切/抱歉），现把它**外化到脸**。三套表情底座（同图不同 MOTION i2v）：`sweet_bob`(平静)/`sweet_bob_happy`(喜悦)/`sweet_bob_concerned`(关切)，源在 `assets/avatar_src/sweet_bob{,_happy,_concerned}/idle.mp4`。LiveTalking 改造（`avatars/musetalk_avatar.py`）：__init__ 按命名约定 `<id>_happy/_concerned` 加载多套 5-cycle 底座、**截断到公共最短长度**（使 inference 线程 length 不越界，零侵入 base_avatar）；`set_emotion()` 登记待切→`inference_batch` 起始（inference 线程安全点）原子换 5 个 cycle 引用。`server/routes.py` 的 `/human` 读 `tts.emotion`→`set_emotion`。`EMO_TO_BASE` 把 6 类情绪并到 3 套（兴奋→happy、好奇/平静→neutral、关切/抱歉→concerned）。桥接 `/live/ask` 已透传 emotion，`/live/say` 新增 emotion 字段
- [x] **待机↔说话过渡（消除硬切）**：上一版从待机到张嘴是一瞬硬切，真人没有突变。LiveTalking `base_avatar.py:374` 内置交叉淡入淡出（`cv2.addWeighted` 整帧 alpha 混合）默认 **关闭**→改 `enable_transition=True` + `_transition_duration=0.18`(≈5帧软过渡)。⚠️诚实天花板：这是**帧级交叉淡化**，非"真人发声前的嘴型预备(articulatory anticipation)"——MuseTalk 逐帧音频驱动、无预启动，只能软化突变不能造预备动作。要更真需换架构（离线扩散类，见自然度诊断报告）
- [x] **神态管理对标文档**（`docs/神态管理对标与应用.md`）：对标播音主持专业方法论（对象感/眼神微表情/不刻意笑/情感=备稿+停连节奏），逐条映射到我们的杠杆（i2v MOTION/speech_rate/`[情绪:X]`=备稿/表情底座=情感外化）+ 后续完善方向。答辩可证"表情管理对标专业播音非拍脑袋"
- [x] **主形象 idle 定版 TAKE4 + 三套情绪底座对齐重烘（2026-06-07）**：用户盲评在 take1/3/4 里选 TAKE4（端正头+从容眨眼，治"眨巴眼"）→ 烘成主 avatar `sweet_bob`；happy/concerned 用**同款端正头 MOTION 只换表情**重生成重烘，三套均 161 帧对齐（切情绪不跳）。全栈终验录像确认 neutral→happy→concerned 真切换。`make_idle_from_image.py` 的 MOTION 已是对标女主播版（第 3 参数可覆盖表情）
- [x] **EchoMimic V3 离线全脸扩散英雄镜头（2026-06-07，本地 4080 跑通）**：分帧差分**实锤** MuseTalk"活嘴死脸"是架构天花板（整脸只有嘴部一小块动）→ 决策：**直播保 MuseTalk（<5s 实时硬指标），演示视频改用 EchoMimic V3 flash 离线渲染英雄镜头**（单图+音频→整脸都动、无死脸）。本地 `~/Desktop/ComfyUI`+`comfy_venv` 跑通：512×768/4.5s/256s/无 OOM；差分图证整脸轮廓全动。**关键配方/踩坑见 [[echomimic-hero-pipeline]] 记忆**（模型 15.8G 放 AI_Local symlink 进 ComfyUI；依赖地狱修复 mediapipe残缺wheel/transformers4.49/diffusers0.33/补dist模块/mmgp/config键；务必 `use_mmgp=None`+`block_offload` 避开 inference_mode 量化冲突；`partial_video_length=65`；ComfyUI 重启用精确 kill 非 pkill）。脚本 `scripts/run_echomimic.py`（驱动）+`scripts/gen_tts_wav.py`（Qwen-TTS 出旁白 wav）。⚠️离线非实时，只用于演示视频固定台词，不替直播
- [ ] **EchoMimic 后续**：出完整 10.5s 慧昭开场白 + 多套金句镜头 → 剪进 7 分钟演示视频；可选试 768×768 提画质

### 游客端微信小程序（2026-06-07 起，用户拍板：用户端用小程序做）
- [~] **个人号原生小程序**（`miniprogram/`，纯自研 WXSS、零构建）：坐实赛题「小程序」形态 + 原生 `wx.getRecorderManager`/`wx.chooseMedia` 解决 H5「局域网 http 禁麦」。设计思想见 [[miniprogram-design]] 记忆 + 计划 `~/.claude/plans/distributed-popping-steele.md`。
  - **数字人画面 = HLS `<video>`**（个人号禁 web-view/live-player，唯一可用直播路径）：复用现有 LiveTalking(RTMP)→SRS，**后端唯一改动 = `deploy/srs.conf` 开 HLS**；桥接/RAG 零改动。`wx.request` 无 SSE 正好契合（`/live/ask` 返回整段 JSON）。native 无 CORS，同 WiFi 直连 LAN IP，三 base 在 `config.js` 一处配（8000/9000/8080）。
  - **放弃 TDesign**（本机无 Node、对 beginner 构建友好性差、与沉浸式 hero 冲突）→ 纯自研 WXSS + 微信官方设计规范。"成熟非 demo" = 设计 token（`app.wxss`）+ 完成度清单（自定义沉浸导航/骨架屏/三态降级/触感/安全区/过渡/打字机）。
  - Linux 跑 DevTools 用 `msojocs/wechat-web-devtools-linux`。⚠️ `project.config.json` 的 appid 现为 `touristappid` 占位，真机+录音需换**用户个人号 AppID**。
  - 进度：脚手架✅（config/app/api/设计token）；待做：主交互页(封面/hero/输入坞/字幕)、三模态接线、迎宾/游记、SRS HLS 联调真机验证。

### 联调 & 交付材料
- [~] LiveTalking 端到端联调：**本地全栈跑通**（LiveTalking RTMP:8010 + SRS docker + RAG cloud:8000(0显存) + 桥接:9000 + 交互页 /talk），黑屏/OOM 均已修。**待亲眼验证**古风导游开口 + 手机真机「问→开口」<5s（任务 #9，停在"加载中"未等到画面）
- [ ] 把占位 avatar/voice ID 接到真实资源：avatar 已接（guofeng_female），voice 仍 edge-TTS 占位，待换 CosyVoice
- [ ] 端到端延迟实测（目标 < 5 秒）
- [ ] 部署和使用手册
- [ ] **总体设计文档**（底稿已有：`新idea景区导览AI数字人.docx`，需补充实测数据）
- [ ] 方案介绍 PPT
- [ ] 演示视频（≤7分钟，.avi/.mp4/.wmv）

---

## 数字人选型决策（2026-06-01 定稿，取代 5-23 的阿里云方案）

### 最终方案：本地 LiveTalking + MuseTalk V1.5 + 自研 RAG 后端

演示态架构（全栈本地，手机同 WiFi 访问；ECS 仅作公网 API 展示）：

```
手机浏览器 / 微信 H5
    ↑ WebRTC（局域网）
本地 4080 机器
  ├─ LiveTalking :8010    MuseTalk 30fps 口型同步，WebRTC 推流
  ├─ 桥接层 bridge :9000   串 RAG→数字人，读 config 切形象/音色
  └─ RAG 后端 :8000        本地 GPU 模式，检索 0.54s（也可指向 ECS）

ECS 116.62.136.211:8000   保留为「7×24 公网 API」，供评审自助测 /chat、/docs
```

**形象方案：AI 生成写实数字人（形象通用 / 可配置，非锁定古风）**
文生图生成写实导游肖像 → 图生视频做 5-10s 微动待机片段 → MuseTalk 生成 avatar。
零真人出镜。**形象是通用的**：链路 `文生图 prompt→图生视频→烘 avatar` 改 prompt 即可换**任意风格**
（现代讲解员/古风/男女/不同景区），正好坐实赛题「形象管理可配置」。
⚠️ 当前的古风女 `guofeng_female` 只是**一个 demo 预设**，不是唯一形态；演示时当场换几套最能证明"可配置"。
**关键技术事实**：MuseTalk 只重生成嘴部、贴回原帧，∴ 自然度 ≈ 底座视频自然度 →
底座必须写实真人风格，卡通/CG 反而暴露口型违和。
**idle 底座决策（2026-06-04）**：LivePortrait（2D 扭曲）会让发型穿模+逐帧抖 → 改用**图生视频（可灵/万相，真·视频生成）**
做 idle，头一动头发自然跟随、时序连贯、无穿模。身体动作（转头/转身/手势）属铁三角取舍，初赛靠
「待机片段切换 + 演示视频离线英雄镜头」制造观感，MetaHuman 标决赛路线（详见 [[autodl-gpu-aware]] 记忆 & 选型报告）。

**选型理由**：阿里云数字人「太贵」放弃；讯飞 Web SDK 仅 PC、不支持移动端浏览器（卡手机端要求）。
LiveTalking 本地零成本、WebRTC 流任意浏览器（含手机/微信 H5）可播、`/human` 外部文字驱动直接接 RAG，
单路演示不涉并发压力。视觉自然度由「写实底座 + MuseTalk」保证。

### 桥接层（已完成，`bridge/server.py`，本地 :9000）

| 端点 | 作用 |
|---|---|
| `POST /live/ask` | 游客问 → **订阅 RAG 句子级 SSE 流** → 每出一句立即 `/human`(echo) 驱动数字人开口（首句抢跑，压 <5s 延迟）；首句 `interrupt` 打断上轮、后续排队 |
| `GET /live/avatar` | 建 WebRTC 连接前取该景区真实 avatar_id + 音色（实现形象切换） |
| `GET /live/health` | 联调探活（RAG + LiveTalking 是否都在线） |

- 读 `digital-human/config`，把占位 `avatar_id`/`voice_id` 翻译成真实 MuseTalk avatar + edge-TTS 音色（代码内 `VOICE_MAP`/`AVATAR_MAP`，生成新形象后改这两张表）
- avatar 是「连接级」参数（`/offer` 时定），voice 是「消息级」（`/human` 的 `tts.ref_file`）
- 启动：`RAG_BASE=http://localhost:8000 LIVETALKING_BASE=http://localhost:8010 .venv/bin/uvicorn bridge.server:app --host 0.0.0.0 --port 9000`

### 本地全栈启动顺序（开发/演示，已跑通 — RTMP 方案）

> **传输方案：RTMP→FLV（不是 WebRTC）**。本机 aiortc 双轨（音+视频）ICE 必失败→数字人黑屏，
> 单视频轨才通。故改走 LiveTalking `--transport rtmp` 推 SRS，浏览器用 mpegts.js 播 HTTP-FLV。
>
> **两个必须的关键参数（否则必崩）：**
> 1. `--batch_size 4`：默认 16 在 11.6G 的 4080 Laptop 上，空闲就占 11.3G，一说话 MuseTalk
>    VAE decode 峰值 +512M 直接 **CUDA OOM**→推流线程死→前端转圈。降到 4 后空闲仅 7.2G、
>    留 4.6G 余量，说话不再爆（实测 0 OOM）。
> 2. `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`：治显存碎片，辅助。
>
> RAG 用 **`DEPLOY_MODE=cloud`**（DashScope embedding，0 显存），ASR 走 CPU（0 显存），
> 把 4080 整块留给数字人。**全程不需要 ECS。**

```bash
# ① SRS 媒体服务器（docker，收 RTMP 转 HTTP-FLV；只需启一次，会常驻）
docker start srs   # 端口 1935(RTMP) 1985(API) 8080(HTTP-FLV)

# ② 数字人（RTMP 模式，batch4 防 OOM；TTS 用百炼 Qwen-TTS 云端实时，0 本地显存）
cd ~/Desktop/LiveTalking && unset ALL_PROXY all_proxy HTTP_PROXY http_proxy HTTPS_PROXY https_proxy
DASHSCOPE_API_KEY=$(grep DASHSCOPE_API_KEY ~/Desktop/Digital_Person/.env | cut -d= -f2) \
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
  ~/miniconda3/envs/livetalking/bin/python app.py --transport rtmp --model musetalk \
  --avatar_id sweet_bob --batch_size 4 --tts qwentts --REF_FILE Serena \
  --push_url 'rtmp://localhost/live/livestream'
# 注：--tts qwentts 需 livetalking 环境装 dashscope>=1.25.11；音色 Serena(知性温柔女声=慧昭默认，Cherry 偏嫩已弃)/Ethan(男)等 Qwen 系统音色
# 注：主 avatar 为 sweet_bob（含情绪底座 sweet_bob_happy/_concerned，按 [情绪:X] 热切换）

# ③ RAG 后端（cloud 模式，0 显存，0.0.0.0 让手机可访问）
cd ~/Desktop/Digital_Person && DEPLOY_MODE=cloud .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
# ④ 桥接层（含 /stream.flv 反代：借桥接 CORS 让前端同源播 FLV，绕开 SRS 无 CORS 头）
cd ~/Desktop/Digital_Person && RAG_BASE=http://localhost:8000 LIVETALKING_BASE=http://localhost:8010 \
  .venv/bin/uvicorn bridge.server:app --host 0.0.0.0 --port 9000
```

验证链路：`curl localhost:1985/api/v1/streams/`（看 `active:true`）、`curl localhost:9000/live/health`。

访问（本机用 **localhost**；手机同 WiFi 用 `hostname -I` 查的 IP）：
- `http://localhost:8000/talk` — 数字人交互页（连接 → 提问 → 看 TA 开口）
- `http://localhost:8000/m` — 后端功能测试台
- ⚠️ 本机浏览器**别用局域网 IP**：系统代理(clash :12334)会劫持局域网 IP→502。用 localhost 或给代理加「绕过局域网」。

### 已排除方案

| 方案 | 排除原因 |
|---|---|
| 阿里云数字人 API | 商业计费太贵 |
| 讯飞数字人 Web SDK | 仅 PC Web，不支持移动端浏览器，卡赛题手机端要求 |
| SadTalker | 每句生成 10-30s，超 <5s 延迟红线 |
| Three.js + VRM | 动漫风格不适合景区导游，自然度输给写实方案 |

### 分工（一人全栈）

用户独自负责全栈：RAG 后端 + 桥接层 + LiveTalking 部署 + 形象生成 + 前端 + 交付材料。
原「队友 A/B」分工作废，Claude Code 作为协作编程伙伴全程参与。

---

---

## 「灵境·导览」升级任务清单（来自新idea文档）

### 创新一：多智能体 Orchestrator（已完成 MVP，commit 6d96376）

- [x] **意图分类器**（`backend/agent/orchestrator.py`）
  - 五类：`qa` / `navigation` / `recommend` / `empathy` / `chitchat`
  - 混合策略：规则快筛命中即路由（0ms），模糊才 qwen-turbo 兜底
- [x] **意图处理器**（`backend/agent/handlers.py`）
  - 每类意图注入差异化任务指令到 system prompt（统一链路，无需独立模型）
  - 闲聊跳过 RAG 检索
- [x] **接入 `/chat` 主链路**（`pipeline.py` 入口分派，qa 分支零改动保住 97.7%）
- [x] **SSE 新增 `intent` 事件**（最早下发，供前端展示当前意图）
- [ ] **compound 复合请求拆解**（第二步：把"带孩子去厕所路上讲故事"拆成子任务串行执行）

### 创新二：同行人格切换（已完成，待 commit）

- [x] **`group_type` 参数**（ChatRequest，默认 `adult`）
  - `adult` / `family_kids` / `senior` / `couple`
- [x] **叙事人格指令**（`backend/llm/prompts.py` `_build_persona_directive`）
  - 亲子：讲故事+互动提问+亲子设施；老年：慢节奏+无障碍+休息点；情侣：浪漫+机位+祈福
  - 缓存键升级 `group_type::lang::query`，隔离不同人格
- [ ] **同步到 API_DOC.md**（`/chat` 补充 `group_type` + `intent` 字段说明）

> 设计思路详见 `docs/多智能体与人格切换设计.md`（答辩/总体设计文档用）

### 创新三：视觉辅助定位（简化版，加分项）

- [ ] **增强 `POST /chat/image` 的定位能力**
  - system prompt 加入：若图片中有景区地标，优先识别当前位置后再作答
  - 测试：拍灵山大佛照片 → 自动回答"您正在大佛广场，……"

- [ ] **景点图片特征库**（可选，如有时间）
  - 每个景点 2-3 张参考图存入知识库，用 qwen-vl 做图文匹配

### 创新四：空间感知「主动导游」（2026-06-04 讨论定向，产品总纲）

> 立意：把产品从「会说话的问答框」升级为**真正的导游**。真实导游职责实证（来源：导游岗位职责、
> "what makes a great tour guide"）= **讲故事的人 + 带路的人 + 随机应变的人**。
> 用户直觉「会说话还不够」精准命中后两项——也正是当前最缺的。

**真实导游职责 → 我们的功能映射**

| 真实导游职责 | 我们的功能 | 现状 |
|---|---|---|
| 讲解/讲故事（灵魂：事实→愿意听的体验） | RAG + 叙事人格 | ✅ 有，偏"报事实"，可调更"讲故事" |
| 带路/行程组织/控制节奏 | 路线推荐 + 逐段指路 | 路线推荐✅；**逐段指路缺** |
| 答疑 | RAG 问答 | ✅ 97.7% |
| 随机应变（天气/人流→改行程） | 时间/天气/人流上下文感知 | ❌ **缺** |
| 安全 & 关怀 & 微笑服务 | empathy 意图 + 主动关怀 | empathy✅；主动性缺 |
| 因人而异（老人/孩子/情侣） | `group_type` 人格 | ✅ 有 |
| 会看地图、会用导航（导游硬技能） | 视觉定位 + 指路 | ❌ **缺（创新三）** |

**核心差别 = 主动**：触发源从「提问」扩展到「位置/时间/上下文」。多智能体已有
`navigation`/`recommend`/`empathy` 意图，缺的是由空间/上下文触发，而非提问触发。

**AR 的诚实拆解（关键认知）**：
- ✅ **AR-lite（做，初赛能落地）**：相机拍一帧 → qwen-vl 认地标 → 定位 + 口语指路。
  复用 `/chat/image`，体验上"开相机它就懂我在哪、给我指路"，**用户感觉到的 AR 80% 来自这里**。
- ⚠️ **真 AR（实景叠加 3D 箭头）= 深坑**：需 SLAM/ARCore/8thWall 空间定位+姿态追踪，
  一人几周必误交付。**标为赛后/决赛拉伸项**，答辩说"已规划"即可。

**落地优先级（演示惊艳 ÷ 工作量）**：
1. GPS 位置感知 + 主动讲解（`navigator.geolocation`，可加"模拟我在X点"下拉做演示）
2. 拍照视觉定位（= 创新三，坐实多模态硬指标）
3. 文字/语音逐段指路（景点结构化数据建关系图 + RAG）
4. 时间/天气感知推荐（天气 API + 当前时间，低成本高"贴心感"）

**演示叙事线**：打开 App→数字人微笑打招呼→开相机拍大佛→视觉定位"您在大佛广场"→
按 group_type 主动"带孩子我用讲故事方式"→指路→看天气"午后日晒强，先去室内梵宫"→边走边讲解。
（一条线串起 多模态+多智能体+空间感知+主动性+人格）

### 初赛交付材料（硬性）

- [ ] **总体设计文档**：以 `新idea景区导览AI数字人.docx` 为底稿，补充：
  - 实测准确率 97.7%（44题，5景区）
  - 真实延迟数据（后端首句 ~2s）
  - 各接口实现截图/示例
  - 多智能体架构图（可用文档中现有图）

#### 撰写规范 · 对标学长国一文档（`docs/两年前学长做的另一个赛题的详细设计文档.docx`）

> 学长拿**国一**的设计文档（11章81标题15表）。写我们文档时套这套范式，方法论记忆见 [[design-doc-methodology]]。

**11 章骨架**：引言(编写目的+**项目背景痛点**)→需求分析(按角色+用例图；算法需求用"预期输入/输出"契约)→总体设计(技术选型+系统架构)→**算法设计【重头戏·最大篇幅·深入原理】**→功能模块设计(讲数据流转)→数据库设计→数据交互设计→接口/权限/异常→界面设计(截图)→特色综述→结语。

**评委买账的 10 条写法**：
1. 背景从**行业痛点**切入（3个加粗痛点→我们解决），不直接堆技术
2. 需求分析**高度结构化**（角色拆分+用例图；算法需求 I/O 契约）
3. 技术选型=**组件+理由配对**（"用X做Y"），架构先给一句**设计理念**统领
4. **算法章是灵魂**：框架图→基座/方案选型（**对比+带数字**）→底层原理逐层（敢写到公式）→工程化（数据集/指标/后处理）。选型套路=「是什么→为何适合本任务→数据佐证」，证明**真懂非调包**
5. 用**数据与对比**说话（对标商用/SOTA/基线）
6. 功能模块讲**数据流转**（前端→后端→存储/算法→流式推回）+流程图，不堆界面
7. **诚实写"踩坑→解法"**——最显真实工作量与深度
8. 写**工程严谨细节**（隔离/鉴权/缓存/降级）体现成熟度
9. **图表密集**，几乎每功能配图
10. 特色综述用 **N 个加粗维度**收口 + 结语**回扣应用价值**

**我们的差异化发力点**：算法章主打 RAG 全链路（混合检索+重排+QueryRewrite）、多智能体 Orchestrator、数字人自然度/表情管理、**语音<5s 延迟优化**（埋点定位→生成吞吐瓶颈→四项优化→实测，天然符合范式④的"原理+数据+踩坑"）。踩坑素材直接从本进度日志取（SSE 伪流式 / MuseTalk OOM / 死脸 / 依赖地狱 / 客流冷加载尖峰）。

- [ ] **部署和使用手册**（参考 CLAUDE.md 云端维护章节扩写）

- [ ] **方案介绍 PPT**（对照文档第7章评分项覆盖表，每分都有对应实现）

- [ ] **演示视频**（≤7分钟）：建议叙事线——提问→多Agent分派→流式回复→数字人说话→管理后台实时大屏

---

## 最紧迫待办（按优先级）

1. ✅ ~~生成写实古风导游形象~~（已完成：`guofeng_female`，通义万相生成 → 烘成 avatar）
2. **亲眼验证古风导游开口**：重启全栈（SRS→数字人 batch4→RAG→桥接）→ `localhost:8000/talk` 连接提问，确认 guofeng_female 开口 + 延迟<5s（上次停在"加载中"未等到画面）
3. **TTS 换 CosyVoice**（OpenAvatarChat 吸收 ③，走百炼 API 0 显存）：edge-TTS→CosyVoice 提自然度，命中赛题"自然度"红线
4. **手机 H5 真机验证**：需解决 getUserMedia 麦克风的 HTTPS 问题（局域网 http 禁麦）
5. **游客端前端 + 管理后台**（问答交互页✅、知识库管理、数字人配置、数据大屏）
6. **总体设计文档**：补充实测数据（97.7% 准确率、延迟、桥接架构图、形象生成链路）后可提交

### 产品化（可选加分，赛后/有余力）

- [ ] **打包成 Android APK**（Capacitor 套壳现有 H5，~1 天）：APK 是「壳客户端」，RAG/LLM 走云、数字人渲染留 GPU 服务器推流给 App（手机带不动 MuseTalk，不变）。
  - **顺带好处**：App 是安全本地源（`capacitor://`），**直接解决「手机 http 局域网 getUserMedia 禁麦」问题**，相机/麦克风免折腾 HTTPS。
  - 赛题最终形态要「小程序/H5」，APK 是合法加分项但非必须；**核心功能稳了再做**，别让打包拖延初赛交付。
  - 成本提醒：公开发布需常驻云 GPU 跑数字人；初赛演示用本地 4080 + 同 WiFi 即可。
