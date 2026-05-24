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
| **文本 LLM** | `qwen-max-latest`（DashScope） | 中文理解最强国产商业模型 |
| **多模态 LLM** | `qwen-vl-max-latest`（DashScope） | 满足赛题多模态硬性要求；图文问答 |
| **向量嵌入** | `BAAI/bge-m3`（本地，4080运行） | 中英双语，检索质量高，无API费用 |
| **重排序** | `BAAI/bge-reranker-v2-m3`（本地） | 提升召回精度，是90%准确率的关键 |
| **向量数据库** | ChromaDB（本地） | 多 collection 实现景区命名空间隔离 |
| **稀疏检索** | rank_bm25 | 与稠密检索混合，覆盖关键词精确匹配 |
| **语音识别** | faster-whisper large-v3（本地） | 4080可实时推理，中文准确率高 |
| **语音合成** | CosyVoice2（本地） | 音色自然，可克隆景区专属声音 |
| **数字人驱动** | SadTalker / MuseTalk（本地） | 4080 12GB可流畅运行 |
| **后端框架** | FastAPI（Python） | 用户已有基础 |
| **前端框架** | React + Ant Design + ECharts | 数据大屏用ECharts |
| **数据库** | SQLite（会话/分析） + ChromaDB（向量） | 初赛阶段足够 |

## 硬件配置（已确认）

- 设备：ROG 幻16
- GPU：RTX 4080 Laptop，11.6GB 显存
- 驱动：580.159.03，CUDA 13.0
- 本地可运行：BGE-M3、BGE-Reranker、faster-whisper large-v3、CosyVoice2、SadTalker

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
| 语音输入 | 🔜 队友A | faster-whisper，接口已预留 |
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
| ≥1个多模态大模型 | ✅ | qwen-vl-max-latest（`POST /chat/image`） |
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
- [x] `POST /chat/image`（qwen-vl-max-latest 多模态）
- [x] `POST /kb/upload` / `GET /kb/list` / `DELETE /kb/{id}`
- [x] Analytics 全套（dashboard / hot-topics / sentiment-trend / conversations / report）
- [x] SQLite 会话存储（session_id / emotion / created_at）
- [x] SSE 流式 bug 修复（pipeline.py 遗留 `yield` 字符串导致 TypeError，commit bf21d88）
- [x] 后端托管测试面板（`GET /test` → `test_ui.html`）
- [ ] **数字人形象配置接口**（`GET/PUT /digital-human/config`）——待开发

### 联调 & 交付材料
- [ ] 队友 A 对接：SSE 流式接口联调（emotion/sentence 事件驱动 TTS + 口型）
- [ ] 队友 B 对接：前端调用 `/chat`、知识库管理页、数据大屏
- [ ] 端到端延迟实测（目标 < 5 秒）
- [ ] 部署和使用手册
- [ ] 总体设计文档
- [ ] 方案介绍 PPT
- [ ] 演示视频（≤7分钟，.avi/.mp4/.wmv）

---

## 数字人选型决策（2026-05-23 定稿）

### 最终方案：阿里云数字人 API + 自研 RAG 后端

```
手机浏览器
    ↑ WebRTC / H5 SDK（阿里云托管，商业级口型+表情）
阿里云数字人服务
    ↑ 外部文字驱动（自定义对话模式）
我们的 FastAPI 后端（RAG + SSE，完整保留）
```

**选型理由**：赛题要求手机端运行 + 评审重点是视觉质量，商业 API 质量远超自建渲染；
RAG 后端已是满分（97.7%），差距在视觉层，应把有限时间投在高回报点上。

### 已排除方案

| 方案 | 排除原因 |
|---|---|
| MuseTalk / SadTalker | 需要 GPU，手机端无法本地运行；SadTalker 每句 10-30s 超延迟红线 |
| Three.js + VRM | 动漫风格不适合景区导游形象，视觉质量输给商业产品 |
| 服务器渲染视频流到手机 | 并发压力大，WebRTC 搭建复杂，链路过长 |

**备选**：如阿里云不支持外部 LLM 接入，改用**讯飞数字人**（H5 SDK，支持文字驱动）。

### 分工变化

| 队友 | 职责调整 |
|---|---|
| **队友A** | 只需对接阿里云数字人 SDK + ASR（移除 MuseTalk/CosyVoice2 本地部署） |
| **队友B** | 嵌入阿里云 H5 SDK + React 管理后台（不需要写 WebGL 渲染器） |
| **我** | 补写 `POST /tts` 接口 + `GET/PUT /digital-human/config` 接口 |

### 本周最高优先级

验证阿里云数字人是否支持**外部文字驱动**（自定义对话模式）：
1. 阿里云控制台 → 搜索"智能数字人" → 开通试用
2. 找"自定义对话"或"第三方 LLM 接入"文档
3. POST 一句文字，确认数字人能说出来 + 测延迟

---

## 最紧迫待办（按优先级）

1. **验证阿里云数字人外部文字驱动**（本周内，决定整个技术路线）
2. **开发数字人形象配置接口** `GET/PUT /digital-human/config`（赛题要求，后端缺失）
3. **与队友A/B 同步选型结论**，调整各自任务计划
4. **与队友B联调前端**：数据大屏、知识库管理页需要真实数据联通
5. **撰写部署手册**：初赛必交材料，API_DOC.md 已有基础
