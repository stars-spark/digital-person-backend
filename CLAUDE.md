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

- 问答准确率 **≥ 90%**（专家基于标准测试集评测）
- 语音问答端到端延迟 **< 5 秒**
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

### 联调 & 交付材料
- [ ] LiveTalking 端到端联调：生成古风 avatar → 启动本机全栈 → 手机 H5 验证（任务 #5-#9）
- [ ] 把占位 avatar/voice ID 接到真实资源，验证后台改 config 能真切形象/音色
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

**形象方案：AI 生成写实古风导游**
文生图生成写实古风导游肖像 → 图生视频做 5-10s 微动待机片段 → MuseTalk 生成 avatar。
零真人出镜，可生成多套形象（古风女/男/不同景区）正好演示「形象管理」可配置。
**关键技术事实**：MuseTalk 只重生成嘴部、贴回原帧，∴ 自然度 ≈ 底座视频自然度 →
底座必须写实真人风格，卡通/CG 反而暴露口型违和。

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

### 初赛交付材料（硬性）

- [ ] **总体设计文档**：以 `新idea景区导览AI数字人.docx` 为底稿，补充：
  - 实测准确率 97.7%（44题，5景区）
  - 真实延迟数据（后端首句 ~2s）
  - 各接口实现截图/示例
  - 多智能体架构图（可用文档中现有图）

- [ ] **部署和使用手册**（参考 CLAUDE.md 云端维护章节扩写）

- [ ] **方案介绍 PPT**（对照文档第7章评分项覆盖表，每分都有对应实现）

- [ ] **演示视频**（≤7分钟）：建议叙事线——提问→多Agent分派→流式回复→数字人说话→管理后台实时大屏

---

## 最紧迫待办（按优先级）

1. **生成写实古风导游形象**（文生图 → 图生视频 → MuseTalk avatar），替换样例 sun.mp4
2. **LiveTalking 端到端联调**：本机起 RAG+LiveTalking+桥接，手机 H5 验证「问答→数字人说话」<5s
3. **接通形象配置**：占位 avatar/voice ID 映射到真实资源，验证后台改 config 能真切换
4. **游客端前端 + 管理后台**（一人全栈自己做：问答交互页、知识库管理、数字人配置、数据大屏）
5. **总体设计文档**：补充实测数据（97.7% 准确率、延迟、桥接架构图）后可提交
