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

## 当前进度

- [x] 赛题研读完成
- [x] 数据资产盘点完成
- [x] 技术架构设计完成（RAG 骨架代码已写好）
- [x] 三人分工职责确认
- [x] uv 安装完成（`~/.local/bin/uv`）
- [x] **Python 3.11 虚拟环境搭建完成**（`.venv/`，基于 miniconda）
- [x] 依赖安装完成（150 个包，含 torch、FlagEmbedding、chromadb 等）
- [x] **配置 DashScope API Key**（`.env` 文件）
- [x] 灵山文档入库（`python scripts/ingest_lingshan.py`）
- [x] **第一个 RAG 问答跑通**（5/5 题全部正确，知识库命中）
- [x] **GPU 加速启用**（驱动升级到 580，RAG 检索从 30s → 0.54s）
- [x] **流式架构实现**（`streaming.py`，LLM 逐句推送 TTS，首句延迟 ~2s）
- [x] **阿里云 ECS 购买**（ecs.c7.xlarge，116.62.136.211）
- [x] **云端部署脚本编写完成**（`deploy/pack.sh` + `deploy/setup_server.sh`）
- [x] **ECS 部署成功**（服务运行中，/health + /chat 验证通过，41 个 chunk 入库）
- [x] **情绪检测上线**（LLM 自动输出 [情绪:X] 标签，/chat 返回 emotion 字段）
- [x] **SQLite 会话存储**（每轮问答自动入库，含 session_id / emotion / 时间戳）
- [x] **Analytics API 上线**（/analytics/dashboard、hot-topics、sentiment-trend、conversations、report）
- [x] **多模态接口 `/chat/image`**（qwen-vl-max-latest，满足赛题硬性要求）
- [x] **拈花湾知识库入库**（6 个景点 chunk，scenic_id=nihuawan）
- [x] **LRU 答案缓存**（热门问题 <5ms，实测 4713ms→238ms）
- [x] **并行检索**（embed + BM25 asyncio.gather，云端节省 ~50ms）
- [x] **fast 模式**（qwen-turbo，`fast:true` 参数，首 token ~150ms）
- [x] **Query Rewrite 接入 pipeline**（`needs_rewrite()` 门控，含指代词时自动改写）
- [x] **3 个真实景区数据文档生成**（西湖/黄山/故宫，各 2 份 Word，共 6 文件）
- [x] **新景区入库完成**（xihu/huangshan/gugong，本地+云端各 57 chunk）
- [x] **SCENIC_CONFIG 扩展**（pipeline.py 支持 5 个景区）
- [x] **44 道准确率测试完成**（灵山 20 题 90%；西湖/黄山/故宫各 8 题 100%；综合 97.7%）
- [x] **测试报告自动保存**（`tests/accuracy_report.json`）
- [ ] 队友对接接口联调（`POST /chat`、`POST /kb/upload`）
