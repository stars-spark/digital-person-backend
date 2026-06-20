# 景区导览服务AI数字人 — 项目工作档案

## 赛事信息

- **赛事**：第十五届中国软件杯大赛（A组）
- **赛题**：景区导览服务AI数字人
- **出题企业**：锐捷网络（苏州）有限公司
- **答疑QQ群**：1093135039
- **示范景区**：灵山胜境（无锡）+ 拈花湾禅意小镇

---

## 团队与分工

| 成员 | 职责（2026-06-13 更新） |
|---|---|
| **本用户（我）** | 主体全栈：RAG/LLM + 数字人引擎 + 游客端手机网页/**APK** + **管理端手机 web** + 交付材料 |
| **队友** | 游客端**大屏 web**（景区立屏）+ 管理端**数据大屏 web**（我方提供接口联调：analytics 11 条 + dashboard.html 可交接）；另有队友 TTS 服务（CosyVoice :8001，曾接入） |

**Claude Code 角色**：技术导师 + 协作编程伙伴（随时在线）；窗口①兼 PM 事务（用户=产品 Owner/需求源；新想法走窗口① plan mode 评审；每次开工可问"今天最值得做什么"）

---

## 多窗口协作协议（2026-06-12 定稿：常态 2 窗，冲刺最多 3 窗）

> 划分依据：①GPU 11.6G 任务必须串行 → 后端+数字人引擎不可拆窗；②RAG↔桥接↔LiveTalking
> 联调是一条链，拆窗要人肉传话；③文档与代码零文件冲突且是当前最大剩余工作量 → 唯一无摩擦并行；
> ④瓶颈是用户的审查/决策带宽（盲评、口径、取舍都需人定），并行对话 2-3 个为上限。

> **作品总纲 = `docs/作品蓝图与冲刺路线.md`**（2026-06-13 头脑风暴定稿）：定位「游客扫码遇见金牌导游；
> 景区点击拥有数字员工」双面叙事；三幕演示视频结构；端侧环境感知引擎；2-3 周冲刺路线。各窗口优先级以它为准。

| 窗口 | 状态 | 地盘 | 当前优先（详见作品蓝图） |
|---|---|---|---|
| **① 全栈主力** | 常开 | `backend/ bridge/ scripts/ tests/ deploy/` + `~/Desktop/LiveTalking` 引擎改造；**唯一服务/GPU 管理者**；前端（`webapp/ miniprogram/`）**默认也归它** | W1: emotion→Ditto 表情条件、扫码即聊公网部署（ECS+HTTPS+FAQ 引导气泡）；W2: context snapshot 感知协议、家庭同游（同 session 二维码）、FAQ 真片（GPU）、APK（Capacitor 套壳）、tour/theme 补至 8 景区；W3: 真机 <5s 实测+压测 |
| **② 文档交付** | 常开 | `docs/` + PPT/演示视频脚本（**代码只读**） | W1: **三幕分镜脚本+台词最高优先**（逐镜头核对功能可录性，缺口反馈窗口①）+ 设计文档剩余章节；W3: 文档定稿→PPT→录制剪辑（≤7min） |
| **③ 前端细磨** | 按需（W2 启用） | `webapp/ miniprogram/ talk.html` + 管理端手机 web | W2: **管理端手机 web**（知识库管理/数字人配置/轻量洞察——「景区店长的口袋工作台」，重型大屏归队友）、罗盘指向性指路 overlay、地理围栏主动开讲+天气×位置便利。启用登记 `【前端窗口启用中】`，期间窗口①不碰前端；关闭删行 |

**铁律**：
1. 本「当前进度」日志 = 窗口间公告板，**只追加不改写别人条目**，干完一块立刻写；
2. 跨窗口需求写 `- [ ] 【需XX窗口】…` 留言，或由用户人肉粘贴一句话交接；
3. 服务（RAG :8000 / 桥接 :9000 / LiveTalking / SRS / ComfyUI）启停**只归窗口①**，GPU 任务必须串行；
4. 小步 commit 当通信，开工先 `git status + git log -5` 同步；
5. **想并行先派子 agent，不是开新窗**（同窗口内后台跑生成/下载/测试，协调成本为零）；
   开新窗只留给需要独立长期上下文的工作。大重构/实验用 `git worktree` 隔离。

各目录的域规范（**谁动该目录谁遵守，与窗口身份无关**）：`webapp/CLAUDE.md`、`backend/CLAUDE.md`、`docs/CLAUDE.md`。

---

## 系统核心设计原则

> 系统不绑定灵山景区，而是**插拔式知识库架构**：  
> 导入任意景区的知识库后，问答准确率须同样满足 ≥90% 的硬性指标。
>
> **品牌定位（2026-06-11 认知修正）**：产品 = 通用智能景区管理方案，游客端品牌「**智游·导览**」（logo 字「游」）。
> **UI 不得硬编码任何具体景区/导游名**——景区名、导游名（慧昭=灵山示例，西湖婉清/故宫瑾瑜…）、主题色、
> 路线、设施全部按 scenic_id 从后端动态取（`/scenic/theme` 已带 `guide_name`，文案用 `{guide}` 占位）。

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

## 阿里云 ECS 服务器（⚠️ 已弃用 2026-06-14）

> **⚠️ 阿里云 ECS `116.62.136.211` 已弃用**（用户 2026-06-14 明确）。**以后不再使用、不再引用该 IP、不建议部署到 ECS、不做 ECS 开关机/成本提醒。**
> 所有公网部署一律走 **AutoDL 单网关**：`ssh autodl`（免密，公钥 `digital_person`），公网 `https://u891802-x4xd-7f8146e7.bjb2.seetacloud.com:8443`，启动用 `/root/autodl-tmp/start_all.sh`。详见 `docs/部署手册.md` §3 与记忆 [[deployment-strategy-autodl]]。
> 本节及下方「云端服务维护手册」为 ECS 历史记录，不再执行。

<details><summary>（历史·ECS 配置，已弃用）</summary>

| 项 | 值 |
|---|---|
| 公网 IP | `116.62.136.211`（已弃用） |
| 规格 | ecs.c7.xlarge（4 vCPU / 8GB RAM，无 GPU） |
| 部署模式 | `DEPLOY_MODE=cloud`（DashScope 嵌入，无需 GPU） |

**SSH 访问**（免密，私钥 `~/.ssh/digital_person`）：
```bash
ssh -i ~/.ssh/digital_person root@116.62.136.211
```

</details>

---

## 云端服务维护手册（⚠️ ECS 已弃用，本节为历史，公网运维走 AutoDL）

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

**【前端窗口启用中】**（2026-06-13 起，用户指定：本窗口=窗口③前端细磨，长期负责 `webapp/ miniprogram/ talk.html`；窗口①不碰前端。服务启停仍归窗口①，端口不通在此留言。）

- [x] **数字人去人名化 → 「<景区简称>AI智能导览数字人」+ 万相新身份库归档（2026-06-19，窗口①，含借动前端已登记）**：用户拍板数字人**不叫拟人名（慧昭/婉清…）、统一叫「<景区简称>AI智能导览数字人」**（灵山AI智能导览数字人/西湖AI智能导览数字人…）。**后端早已去人名化**（系统模板已禁人名自称、trip 迎宾说"专属AI导览数字人"、`{guide_name}` 模板其实未引用），人名只剩两处残留并已修：①`backend/rag/pipeline.py` `SCENIC_CONFIG.guide_name` 8 景区全改为 AI 名 + fallback「AI智能导览数字人」；②**前端 `webapp/src/lib/theme.ts` 原把 guide 写死「智能导览」丢弃后端值（违品牌铁律"动态取 guide_name"）→ 改 `return t.guide_name`**（明信片落款/思考提示/开场"在这里等你"现按景区显真名）；③`scripts/gen_tts_wav.py` 默认旁白去慧昭。后端 import + 前端 tsc+build 双过。⚠️**借动前端**（`theme.ts` 一行，与窗口③ AvatarSheet 等无文件冲突）。**另**：万相抽奖出的**新甜美女导览身份库**归档 `assets/avatar_candidates/sb16x9_keep/`（6 张=6 不同身份，万相不锁脸）+ `library.json` 真值源：keep_01→`dh_lingshan`(主)，其余 5 张按"脸气质↔导游调性"绑拈花湾/西湖/莫高窟/张家界/兵马俑（黄山云松山岳安全管家·故宫瑾瑜学者型保留现有身份库脸，不强塞甜妹）。**待办**：①把 6 张注册进 ditto_avatars + 桥接 AVATAR_MAP + `_AVATAR_PRESETS`（Ditto 不烘录、直拿 PNG 驱动，~0 GPU；各景区带景底板走 `gen_avatar_background.py` 或复用 6-19 的"人景一体"custom 生成端点，GPU 走 AutoDL）；②换装轴单独从 `dh_lingshan` 走 InstantID 锁脸出旗袍/汉服等。
  ↳ **回帖（2026-06-19，待办①完成·AutoDL 端到端实测绿）**：6 身份注册进直播栈跑通。**底板**=6 张 keep 降采样 640×360（命名 `dh_<scenic>__<scenic>__16x9`，候选链 #1，只服务 16:9 主流不撕裂；本地+AutoDL `ditto_avatars/` 双落）。**三处代码**：桥接 `AVATAR_MAP`、后端 `_DITTO_BASE`、`_AVATAR_PRESETS`（6 条 preset 带 `scenic` 字段，preview `/avatars/dh_<scenic>.jpg` 缩略图已出）。**部署**：scp 底板+2 代码文件→AutoDL，clean-ssh 重启桥接(370159)+RAG(371218)。**实测**：`/live/avatar` 切 dh_lingshan→`resolved:dh_lingshan__lingshan__16x9 switched:true`、抓帧=keep_01 脸**干净无撕裂**(`assets/ui_shots/dh_lingshan_live.jpg`)；切 dh_xihu 同样通+keep_03 脸；`/live/say` 驱动音频 **mean −30.1dB/max −14.2dB 清晰语音**；presets 全 6 `ready:true`(文件系统真值)。直播态已恢复 dh_lingshan。**未做(下一步)**：⒜**9:16 竖版底板**(lottery 是 16:9，大屏 portrait/8011 暂回落默认，需补 720×1280)；⒝**景区带景底板**(现 grey studio；要"人在景里"走 `gen_avatar_background` compose，0-GPU 但用户曾嫌 rembg 抠图感→待定 studio 还是上景)；⒞**设 dh_lingshan 为 lingshan 永久默认**(现仅 live session 态，新连接经 config 解析会回落旧默认→需 PUT 景区默认或 `persist`)；⒟前端画廊缩略图未进 AutoDL dist(选项可选但 preview 404，待 dist 重建)。⒠代码改动**未 commit**(等用户发话)。
- [x] **数字人形象配置三缺口全补 + AI 定制真生成（2026-06-19，窗口①全栈，AutoDL 闭环实测）**：用户问"赛题要求的形象配置做到哪一步"→盘点两端(管理端 `AdminView.vue` 形象管理 tab 已含库/换装/音色/背景/实时预览热切/设默认；游客端 `AvatarSheet` 五段工坊全活)，定位**3 个缺口全部补齐**：①**竖版实例**：起 `livestream2`(:8011,9:16,720×1280)→管理端实时预览热切恢复(此前 `ConnectError`)。②**音色样音**：`scripts/gen_tts_wav.py` 出 5 段 Qwen-TTS 导览口播(Serena/Cherry/Jada吴语/Ethan/Dylan京腔)→转 mp3 落 `webapp/public/voice_samples/`+写 `manifest.json`→试听键全亮。③**AI 定制真生成(头条)**：新 `POST /digital-human/generate`(`backend/api/digital_human.py`)——万相 t2i「人景一体」**同 seed 双比例生图**(16:9+9:16)→落 `ditto_avatars/<custom_id>__<scenic>__<aspect>.png`→**即时入库 ready 可 4.7 热切**(Ditto 驱动源图、无需烘录)；`custom_avatars.json` 动态库 + `/avatar-preview/<id>` 绝对 URL 跨前端可达 + 桥接 `_live_avatar_candidates` 对 `custom_*` 直透不回落甜妹。**闭环实测**：curl 生成 `custom_…170212`(米色针织衫女导游/灵山佛境，**源板观感佳**)→直连 set_avatar `switched:true`→抓帧**干净驱动**。**顺带挖出并修复 6-17 遗留回归**：主流 360p 但身份库底板全 720p→热切**撕裂过曝**(F1 实测花屏)→批量降 87 张 `__16x9` 底板到 640×360(带备份 `bak_720_16x9/`)+生成端点按流分辨率落盘(16:9→640×360/9:16→720×1280)→重测 custom+F1 热切干净。**两端接通**：游客端 `AvatarSheet`「AI 定制」从"敬请期待"接 `api.generateAvatar`→新形象入库+热切上身(tsc+build 过,dist 已部署)；管理端 `AdminView.handleGenerate` 重指 `generateAvatarAI`→`/cloud/digital-human/generate`+刷新库+热切(teammate code 授权改+vite build 已部署)。API_DOC 4.8 新增 + 同步 AutoDL。⚠️测试形象 `custom_…170212` 留库作 demo。
- [x] **POI 级客流接上两端前端（2026-06-19，队友授权，闭环验证）**：①**webapp 跟我游 `RouteMapSheet`**——`api.ts` 加 `crowdLive()`、`routeData.ts` 扩 `Crowd` 到 4 档(空闲/适中/较多/繁忙=绿/黄/橙/红)+`LEVEL_TO_CROWD`；地图 pin 颜色 + 列表档位由 `/analytics/crowd` 按 `poi_id` 覆盖静态值(拉不到回落静态)，加趋势箭头(↑↓)、演出 pill、"实时客流·HH:MM"徽章，开抽屉拉一次+45s 轮询。tsc+build+Impeccable(0) 过。**Playwright 闭环**：受控载荷→7 站全部正确映射档位/演出 pill/趋势；真实网关浏览器可达(CORS)返 `granularity:poi` 实时值（截图 `assets/ui_shots/routemap_live_crowd.png`）。已部署公网 dist(仅推 assets+index.html，不碰 faq 真片)。②**游客大屏 `CongestionPanel.vue`**(队友 visitor_web，授权改)——删全部 `Math.random` 假数据，`api/index.js` 加 `getCrowd()`，`crowdData` 真值 join(`dafou→dafo` 别名修 id 不一致)、`peakSlots` 改确定性 `_HOUR_CURVE`、演出聚集进数字人播报+行内演出/趋势标。**闭环**：`vite build ✓` + 真实端点 join 全 4 命中(九龙灌浴 较多↑+演出11:40、五印坛城 空闲↓)；dev :5173 HMR 生效。⚠️ visitor_web 在 AutoDL 队友仓库(非我 git)、改动直接落盘。
- [x] **POI 级实时客流（2026-06-19，治"客流只覆盖 2 个点 + 看着像假数据"）**：游客大屏 `CongestionPanel` 想在地图每个点位标红黄绿，但旧 `/analytics/crowd` 的 `SCENIC_ATTRACTIONS` 只覆盖灵山 2 个名字（且"灵山胜境"=整景区名），地图 7 个 POI 缺 5 个。**重写 `backend/analytics/crowd.py`**：灵山走 **POI 级模型**（7 点，id/坐标与 `webapp/src/lib/routeData.ts`、`checkin._FEATURES` 一致），其余景区保留旧景点级路径。**"真·活不假"靠 6 层、零 `random`**：①每点真实基线（routeData 的 crowd 档/停留/室内派生）②真实季节因子（xlsx 月度，6月×1.11）③分钟级平滑时段曲线（整点插值）④**演出聚集潮**（九龙灌浴/梵宫圣坛公示场次：开演前 30min 渐聚→演中满→散场骤空，拥挤随真实时刻表移动）⑤**实时天气耦合**（调 `_fetch_weather`，雨→室外×0.62 室内×1.30；实测今日无锡下雨，室外全压、梵宫升顶=铁证）⑥确定性微动（hash 相位正弦、可复现非随机）+ **趋势箭头**（now vs +12min→上升/平稳/下降）。新增字段 `granularity/poi_id/lng/lat/trend/next_show/minutes_to_show/in_show/hint/factors`，顶层 `next_show`=最近一场。**向后兼容**：保 `attractions[]`(降序)+`attraction`+`crowd_level`+`season`/`quiet_hours`/`has_data`，旧消费方(`/trip/today`、`crowd_brief` prompt 注入)全过；`crowd_brief` 增"X 分钟后有演出、人群将聚集、可提前/错峰"一句。本地全消费方导入+调用通过、API_DOC §3.8 更新。**已部署 AutoDL**（scp + 字面 PID 240405 重启 RAG :8000，clean-ssh setsid/exit0；公网 `/rag/analytics/crowd` + 桥接 `/rag` 代理实测 granularity=poi 通）。⚠️**【需前端/队友】** 游客大屏 `CongestionPanel` + webapp「跟我游」地图改读 `granularity:poi` 的 `attractions[]`：按 `poi_id` join 地图标记、`crowd_level`→绿/黄/橙/红、画 `trend` 箭头、演出点位显 `next_show`/`minutes_to_show`+`hint`；建议 30~60s 轮询。当前后端真值已就绪，前端接上即"每个点都亮、随演出/天气/时段自然变"。
- [x] **卡拉OK式同步字幕 + 延迟徽章口径修正（2026-06-18，窗口①借动前端，已登记）**：用户要"文字回答像歌词一样与数字人说话每个词同步流式吐出"；顺带查清 IMG_2116 的"9.4s延迟"。**根因（实测分解）**：9.4s 徽章量的是**整段 RAG 故事生成完**（`/live/ask` 要等全句派发完才返回；AutoDL 实测 RAG 整段 6.89s/7句），**不是数字人开口**——RAG **首句仅 1.52s**(数字人此刻已开口)、路线类整段才 2.05s。即开口一直很快，徽章在数生成总时长=测量 bug。**做法**：①**桥接** `bridge/server.py` 重构出共享核心 `_run_ask(body, emit)`，加 `POST /live/ask_stream`（SSE：每把一句送 `/human` 开口就 `emit("sentence")` 下发 + `first_sentence_ms`；老 `/live/ask` JSON 保留兼容/降级回退；`X-Accel-Buffering:no` 防杭州 nginx 缓冲）。②**前端** `api.ts` 加 `liveAskStream`(fetch+ReadableStream 读 SSE)；`useGuide.ts` `ask` 改流式——字幕按**说话速率** `CPS_SPEAK=5.0` 逐字吐、延后 `START_DELAY_MS=1500`(≈音频经 TTS→Ditto→北京→杭州中继→WebRTC→抖动缓冲抵达 iPhone 的下游耗时)再开吐以对齐语音；**延迟徽章改用"首字出现时刻"≈真开口(~3.8s<5s)**，不再数整段生成。③`App.tsx` `AssistantBody` 加 `streaming` 态(外部递增 text+闪烁光标，meta 待收尾再显)；`Msg.streaming` 字段。**验证**：SSE 首句 2.39s/`first_sentence_ms=2336`、经杭州公网网关增量到达不被缓冲（curl 实测 sentence 间 ~200ms 间隔）、tsc+build 双过、bundle index-Bd8z9jIq.js 已部署 AutoDL（served 与本地哈希一致）。**⚠️本地无法跑浏览器 e2e**（自签证书 Playwright 拒；SSH `-L` 端口转发被沙箱挡 exit144）→ **字幕与语音同步手感 + 调参(`CPS_SPEAK`/`START_DELAY_MS`)待用户 iPhone 实测**：字幕领先语音→调大 START_DELAY，落后→调小。详见 [[digital-human-open-todos]]。⚠️嘴型对不上吐字(issue②)是另一回事，仍待办。
- [x] **数字人形象库·热拔插切换（2026-06-15，窗口①全栈，AutoDL 实测通过）**：选一下形象/换装→**正在直播的数字人当场换人/换装 ~1s、不重连不断流**（治此前"形象=下次唤醒生效"进程级约束）。①**引擎** `~/Desktop/LiveTalking/avatars/ditto_avatar.py` 加 `set_source()`：Ditto 把身份存成逐帧 numpy 列表(appearance/motion/putback)、不绑 TRT → 重跑 `avatar_registrar` 后原子替换 `source_info` + 复刻 condition_handler/audio2motion/motion_stitch 三处 setup（仿 set_emotion 热切；⚠️绝不能整体重调 `SDK.setup()`→它 L222 重置 writer 毁帧队列）。②**路由** `server/routes.py` 加 `/set_avatar`（重活丢线程池不阻塞事件循环）+ 顺手补回 AutoDL 漏掉的 emotion→set_emotion 分发。③**桥接** `bridge/server.py` 加 `POST /live/avatar`：双命名方案解析(身份库 `<id>__<scenic>__<aspect>` + sweet 传统 `<base>_bg_<scenic>`)+存在性校验+缺失回落；AVATAR_MAP 接入 10 身份库+6 换装。④**诚实目录** `backend/api/digital_human.py` `_ditto_ready` 由文件系统派生 ready/coming_soon（根治"撒谎目录"：列了却没烘→选了静默回落甜妹；guofeng/male_casual 无底板自动 coming_soon），**17 个 ready**(10 身份+sweet+6 换装)。⑤**素材**：6 套换装(face16 InstantID 锁脸)经 `compose_tencent_bg.py` 合成 16:9/9:16 灵山带景底板——**原 832×1216 竖版塞 16:9 流会撕裂(实测花屏)→热拔插底板必须匹配流分辨率 1280×720 / 720×1280**。**实测**(AutoDL 公网)：sweet→F2汉服→旗袍 直播抓帧全干净、音频跨切换始终在线(−24.6dB)、流不断。契约见 API_DOC 4.7+4.1。**⚠️AutoDL 运维坑**：start_all.sh 的 `pgrep -f` 守卫会被"正在死的旧进程/我手动起的瞬时进程"误判→跳过重启；重启服务要先确认旧进程真死(字面 PID kill)，bridge 没起来查 `ss 6006`；kill pattern `livestream$` 经多层 ssh 引号会被吞→一律用字面 PID。lt_run.sh 里 DASHSCOPE key 明文硬编码（应改读 .env，待清理）。
- [ ] 【需窗口③】**形象库接热拔插（窗口① 2026-06-15 交接，契约 API_DOC 4.7 已就绪）**：游客端 `AvatarSheet` 换装衣橱/形象库选 `ready:true` 形象 → 调 `POST {BASE}/live/avatar {avatar_id, scenic_id, sessionid:"0", screen:"main"}` → 直播当场热切（原"试穿预览"现可变"真切换"，桥接 AVATAR_MAP 已接 10 身份+6 换装、不再回落甜妹）。presets 现带 `ready` 字段(文件系统真值)：**只对 `ready:true` 的开放提交**，coming_soon 仍只预览。管理端手机 web「形象配置」同理(选→热切实时预览 + 另调 PUT /config 存景区默认)。`screen` 决定 16:9/9:16，前端只传不算比例。⚠️非 lingshan 景区的换装暂回落 lingshan 带景版（身份库覆盖全 8 景区、换装仅烘了灵山，按需补）。
  ↳ **窗口① 回帖（2026-06-15，用户直接报 bug 要求修，故本窗口越界动了前端，已登记）**：用户手机选形象后无反应（旧 `pick` 只 `setAvatarPref`+显"下次唤醒生效"、从不调热切端点）。已在 `webapp/src/lib/api.ts` 加 `liveSetAvatar()`、`AvatarSheet.tsx` 的 `pick` 改为「已烘形象 → setAvatarPref + **立即调 `POST /live/avatar` 热切**」+ 舞台状态语改"正在为你换上…/已换上·直播画面已切换"（删"下次唤醒"）。tsc+build 过，dist 已部署 AutoDL（公网 bundle 实测含 `live/avatar`）。**选即所见、无需保存键**（同音色"点选即刻生效"）。⚠️单流共享架构：换形象是服务端进程态、所有观看者同时变（演示无碍）。窗口③后续若重做 AvatarSheet 注意此改动。
- [ ] 【需窗口①】**丰富管理端依赖的后端数据（窗口③ 2026-06-15 接口对齐审计后留单）**：队友管理端 web（AutoDL `/root/digital-human/`，:6008，纯前端代理 `/cloud/*`→我们 RAG）依赖的 **15 个 analytics/kb 端点全部 200、对齐 OK**，但有 5 处数据空壳/破损，使管理端板块显空或显乱码——需后端补数据（前端只读这些接口，数据厚了管理端立刻丰富）：

  > **① `analytics/hot-topics` 返回 n-gram 碎片垃圾**（管理端「游客关注点」显示「位置/暂时/时无/法获/获取/取您/置信」乱码词，用户截图 IMG_1980 实锤）。**窗口③ 2026-06-15 已查实根因（两层）**：
  >   - **(主因·数据污染)** 线上 `/root/autodl-tmp/Digital_Person/conversations.db` 里，灵山「最高频用户问题」竟是 **GPS 兜底回复被误记进 `user_message` 字段、重复 14 次**：`"暂时无法获取您的位置信号，您可以尝试移到开阔处，或者拍摄周边景观，我来帮您识别所在位置，继续为您导览。"`（真实问题如"灵山大佛有多高"仅 6 次）。→ **埋点 bug：某分支把数字人/系统回复当成 user_message 落库**（定位/拍照失败那条链路最可疑）。先 **清污染行**（删或排除这类系统回复），再修埋点防再污染。
  >   - **(放大器·算法)** `backend/api/analytics.py:96-117` `hot_topics` 用**字符 2–4 字滑窗 n-gram、无真正分词**，任一长句都碎成无意义词。**最佳解=让管理端「游客关注点」改调已就绪的 `/analytics/topic-intents`（LLM 语义意图分类，实测干净：景点介绍/设施服务/其他…）**——这是 api/index.js 已封装的 `getTopicIntents`，前端切一行即可（前端归队友）；或后端把 hot_topics 内部改成意图聚合 + 过滤系统回复/长句。
  > **② `kb/faq` 空 `{items:[]}`** → 管理端「问答管理」整块空。给 8 景区各**播种若干条 FAQ 问答对**（落 `faq_items` 表 + `upsert_item` 同步进 RAG 向量库，游客问答即可命中）。
  > **③ `kb/docs` 空 `{docs:[]}`**（但 `kb/list` 显示 lingshan 41 分块=已入库）→ 「文档管理」空列表。把**已 ingest 的文档登记进 `uploaded_docs` 表**（文件名/景区/分块数/状态），告别"有索引却无文档列表"。
  > **④ `analytics/profile` 的 `interests:{}` 空、访客仅 10** → 「游客画像」稀疏。补厚 analytics 行为/事件数据，让 interests 分布、访客量真实（可复用 `gen_synthetic_behavior` 思路造会话级画像）。
  > **⑤ `analytics/knowledge-gaps` 仅 1 条**（真实但偏薄，非阻塞，随会话增长自然变厚）。
  >
  > 已厚实无需动：dashboard / bi/overview / sentiment-trend / topic-intents / crowd / conversations / feature-usage / kb/list / scenic/theme / digital-human/config。落地后在此回帖，窗口③核对管理端各板块变丰富。

- [x] 【窗口③】**中文字体三端统一 → HarmonyOS Sans SC（2026-06-15）**：原本英文 Geist✅但**中文走系统兜底**（iOS 苹方/安卓思源/桌面雅黑→三端字形不一致）。改为自托管华为鸿蒙 `HarmonyOS Sans SC`（免费商用）：官方 TTF（7.8MB/档）经 `pyftsubset`（`uvx fonttools[woff]`）按 **GB2312（~7543 字，覆盖几乎所有真实中文+地名）子集化 + 转 woff2** → 3 档（400/500/700）共 **2.8MB** 落 `webapp/public/fonts/`。`index.css` 加 3 条 `@font-face`（带 `unicode-range` 限 CJK 码位 + `font-display:swap` 不挡首屏），字体栈改 **Latin 优先** `'Geist Variable','HarmonyOS Sans SC',sans-serif`（英文/数字仍 Geist 科技感、中文落鸿蒙）。tsc+build 双过、woff2 进 dist/fonts。**Playwright 真机像素级验证**：3 档 `document.fonts` status=loaded、中文节点 computed 字体栈正确、鸿蒙字形 vs 系统兜底像素差 1019（≠0=鸿蒙真在绘制）。截图 `assets/ui_shots/font_harmonyos_sc.png`。⚠️**窗口②**：全站中文字体已变，9 章若引用旧 UI 截图，中文观感以此版为准（字形更统一商务），需要可重截。⚠️ talk.html/legacy 未改（已弃用回退页）。

- [x] **AutoDL 4090D 数字人全栈打通（2026-06-14）**：四服务全部跑通并端到端实测出声。SSH 免密已配（`ssh autodl` 别名，公钥 `digital_person`）。①RAG(base py3.12 cloud :8000)+BI+客流(传了 xlsx) ②LiveTalking Ditto **TRT 实时**(单建 `lt` py3.10 环境，`online_mode=True`，RTMP 720x1280，GPU 仅 2.7G) ③SRS(源码编，FLV+HLS) ④桥接 :6006(单入口反代 /rag /live /stream.flv + 托管 dist)。公网 `https://u891802-x4xd-7f8146e7.bjb2.seetacloud.com:8443`：BI(`/rag/analytics/bi/*`)+数字人 FLV(`/stream.flv`) 均从外网实测可达+CORS 全开。**端到端驱动实测**：桥接 `/live/ask`(sessionid="0") → RAG SSE → 逐句 /human → QwenTTS 合成 → Ditto 驱动 → FLV 音频 **mean -31.5dB/max -11.1dB 清晰语音**。**踩坑(详见部署手册§4)**：torch 走 SJTU 镜像(官方源/学术代理 0.77MB/s→10MB/s)；TRT 8.6.1 meta 包须 `--no-build-isolation`+学术代理拉 nvidia 组件；漏装 `cuda-python==12.4.0`(SDK 报 No module 'cuda')；TRT 引擎集缺 `motion_extractor_fp32.engine`(从本机 scp，Ampere_Plus 跨 4080/4090D 通用)；**sessionid 必须 "0"**(webapp 常量，传别的→session not found 静默静音)；`pgrep -f` 自杀坑(杀进程用字面 PID)；QwenTTS 空闲 300s 超时断连→需重连兜底。验语音必 `volumedetect` 查 dB。**ECS 暂时弃用**(见 [[deployment-strategy-autodl]])。
- [~] 【历史·已完成】AutoDL 4090D 数字人全栈部署（窗口②文档线 2026-06-14 SSH 实测验证）

  > **机器**：`ssh -p 53169 root@connect.bjb2.seetacloud.com`（密码用户私下给，bjb2 北京机房）。规格 **RTX 4090D 24G / 147 TFLOPS FP16 实测 / torch 2.7+cu128 / Ubuntu 22.04 / 128 核 503G 内存 / 数据盘 `/root/autodl-tmp` 50G（系统盘 `/` 仅 30G，大模型务必放数据盘）**。实例上已有 `/root/setup_ditto.sh`（窗口①似乎预置过，可基于它部署）；python 在 `/root/miniconda3/bin/python`。
  >
  > **验证结论 = 适合部署、<5s 可达但偏紧**：①GPU 渲染绝非瓶颈（4090D ≈ 本地 4080 的 3 倍，Ditto 只要 2.7G）；②端到端「说完→开口」估 **≈4.5–5.0s**——本地是同 WiFi 推流≈0，换 AutoDL 多出"推流网络"段（RTT ~130ms + 播放缓冲），4090D 更快的渲染基本抵消。
  >
  > **最大的坑已实测排除**：AutoDL「自定义服务」HTTP 代理**完全支持长连接 chunked 直播流**——分块流逐块透传无缓冲（每块经代理 ~100–130ms）、真 FLV 经公网 URL 实测合法可播（FLV 魔数/ffprobe 确认）。所以 **HTTP-FLV 推公网没问题**。
  >
  > **部署要点**：⑴AutoDL **只对外映射 6006/6008** 两端口 → 公网 `https://u<id>-<token>.bjb2.seetacloud.com:8443`（控制台「自定义服务」拿 URL）。故**浏览器拉 HTTP-FLV 的端点必须落在 6006**：改 SRS `http_server.listen=6006`，或让桥接 `/stream.flv` 反代监听 6006；RTMP 1935、SRS 内部可留 localhost。⑵**用 FLV 不用 HLS**（HLS 分段缓冲 +1–3s 会爆 5s）。⑶守 5s 还需前端开 `liveBufferLatencyChasing` 追直播边缘（前端已有此 TODO，把缓冲 0.8s→0.2–0.3s）。
  >
  > **运维提醒**：SSH 无密码可用 `sshpass` 或 `.venv` 已装的 `paramiko`；⚠️坑：`pkill -f <名>` 会匹配执行命令自身的 shell（命令行含该名）→ 自杀，杀进程要用字面 PID。

- [x] 【窗口③】**数字人舞台横屏取景（2026-06-13，三轮收敛：16:9裁→4:3裁→16:9模糊填充）**：用户要竖屏网页里数字人框横置。①改 16:9 `object-cover` 裁切→真机头被裁顶无脖肩（几何：Ditto 流 720×1280 竖版，16:9 只露 31% 高带卡脸上）；②改 4:3 多 33% 纵向能容整头+肩，但用户仍嫌"裁竖图=凑近镜头、头偏大难看"；③**定稿=16:9「模糊填充」**（`aspect-video w-full`）：前景视频 `object-contain` 居中（完整竖版、头不偏大、**零裁切**），背景=同流抽帧画进 384×216 canvas→CSS `scale-[1.18] blur-2xl` 铺满两侧（单条 mpegts 流无法复制到第二 `<video>`，故走 canvas rAF ~11fps 抽帧，跨域只显示不读取安全），连接态叠暗 scrim。**z 层修复**：前景 video 需 `relative z-10` 压住 canvas/scrim→连带遮住连接按钮，故状态徽章/未连接遮罩/meta pills 全提到 `z-20`、L1 成片 `z-30`。L1 缓存成片同改 object-contain。真直播流连 `开始导览` Playwright 实测：人物自然居中、模糊侧栏、头大小正常。tsc+build+detect 0；截图 `assets/ui_shots/stage_blurfill_16x9.png`、未连接 `stage_landscape_idle.png`。**⚠️这是临时方案**——根治见下条【需窗口①】横版底板（到位后前景改回 `object-cover` 即满幅无模糊边）
- [ ] 【需窗口①】**生成横版数字人底板 + 重烘 Ditto avatar（窗口③ 2026-06-13 工单，根治"裁竖图头偏大"）**

  > **背景**：游客端主页数字人框已改 16:9 横屏。但现有 Ditto 底板 `~/Desktop/LiveTalking/data/ditto_avatars/sweet_bob_ditto*.png` 全是 **720×1280 竖版**，塞进横框只能裁（头偏大、丑）或模糊填充（人偏窄，前端现用的临时方案）。根治 = 做**横版构图底板**，让直播流本身就是横的，前端满幅 `object-cover` 即可。
  >
  > **规格**：
  > 1. **尺寸**：16:9 横版，**1280×720**（配 2× 超采样可到 2560×1440 更清晰）。
  > 2. **同一张脸（硬约束）**：必须用 InstantID 锁 **face16 甜美脸**，否则换了个人。源：`assets/avatar_candidates/16_sweet_bob_retouched.png`（主图）或 `assets/avatar_facelock/face16_*.png`。
  > 3. **构图**：人物**中景半身**——头占画面高 **~30–40%**（不要大头特写）、居中略偏上、左右留景区环境；背景中上部避免直线结构（同 `gen_avatar_background.py` 既有约束）。
  > 4. **推荐实现路径（比 outpaint 干净）**：`scripts/gen_avatar_background.py` 本就把背景与人物抠像**分离**（`gen` 出景区背景 + `compose` 用 rembg 抠像粘贴）。只需：把脚本里 `W, H = 720, 1280` 改成 `1280, 720`；`gen` 出**横版景区背景**；`compose` 时把人物抠像**缩小到 ~画高 35%、居中偏上**粘贴（而非现在的满高）→ 即得中景半身横版底板。
  > 5. **重烘 Ditto avatar**：走现有 `genavatar`/ditto 流程，**确认 Ditto 对横版里的"小脸"face crop 检测正常**（唯一需验证的风险点）→ 产物落 `~/Desktop/LiveTalking/data/ditto_avatars/`，命名延续 `sweet_bob_ditto_bg_<scenic>.png`。
  > 6. **范围**：先出 **lingshan 一张验证全流程跑通**，OK 再批量补齐 8 景区。
  >
  > **注意**：需**停掉当前直播流** + 占 GPU（ComfyUI InstantID ~7G 与 LiveTalking 互斥，必须串行）。
  >
  > **完成后回帖**：窗口③ 把 `webapp/src/App.tsx` 前景视频从 `object-contain`+canvas 模糊背景改回 `object-cover`（满幅、无模糊边、零裁切，可删 canvas 抽帧那段），约 5 分钟切换上线。
  >
  > ↳ **窗口① 回帖（2026-06-13 夜）：核心风险已验证通过，灵山首版已出，等用户判取景后批量。**
  >   - **方案验证 ✅**：`scripts/gen_avatar_background.py` 加 `landscape` 子命令（横版景区背景 1280×720 + 竖版肖像抠像缩到中景半身居中合成，复用现有甜美脸、未跑 InstantID）。产物 `~/Desktop/LiveTalking/data/ditto_avatars/sweet_bob_ditto_ls_bg_lingshan.png`。
  >   - **唯一风险点（Ditto 能否检测横版小脸）已实测排除**：起流加载该底板，日志 `RTMP output started ... resolution 1280x720` + publish active + frames 在涨；`/human` 驱动一句抓帧 → **人物居中、嘴张开正在说话、脸自然身份保留**（Ditto 按人脸 crop 自动重新取景，故输出比静态合成图更居中）。抓帧存档 `assets/ui_shots/landscape_lingshan_driven.jpg`。
  >   - **待用户拍板取景参数**后批量：`landscape --scenic X --person-h 0.92 --top 0.05 --xc 0.5`（三参可调人物大小/位置）；OK 后输出名改回 canonical `sweet_bob_ditto_bg_<scenic>`（覆盖竖版变体）+ 补齐 8 景区。⚠️**当前测试用名 `_ls_bg_` 未覆盖线上竖版变体**，线上仍是竖版+你的模糊填充，安全。
  >   - 给窗口③：批量定版后我回帖，届时你 App.tsx 切 `object-cover`（横版底板本就 16:9，**即便不切、现 object-contain 在 16:9 容器里也是满幅无黑边**）。
  >
  > ↳ **窗口① 二次回帖（2026-06-13 深夜，思路转向）：抠图合成路线作废，改 InstantID「人景一体生成」。**
  >   - **用户否决抠图合成**："人物要完整，不要像抠图贴在背景上"。抠像(rembg)合成本质=光照/景深不统一+边是抠的→永远"贴上去"；加羽化反而成鬼魂。`gen_avatar_background.py` 的 `landscape` 子命令(scrim/vignette/羽化)**弃用**，留作历史。
  >   - **新方案 `scripts/gen_avatar_inscene.py`（已验证观感成立）**：ComfyUI InstantID 锁 face16 身份 + **人与景区场景一次性协调生成成一张 1344×768 图**（非合成）→ 人物完整、光照统一、零抠图边、自然站在场景里。关键参数：InstantID `weight=0.85`(锁紧身份=仍是 sweet_bob，低了会漂成长发别人)、prompt 带 `short bob haircut`(匹配波波头)+ `medium shot waist up`+ 场景描述、FaceDetailer 修脸、`cfg 4.5`。灵山首版 `assets/ui_shots/inscene_lingshan.png` 已交用户判（观感远胜抠图版）。
  >   - **待用户确认**：①身份够不够"还是那个导游"(InstantID 同一人但非旧图像素级一致) ②场景是生成的、地标精度不如 万相(要的话加 ControlNet depth 引导结构)。OK 后：批量 8 景区 + **验证 Ditto 驱动**(⚠️ ComfyUI 与 LiveTalking 显存互斥须串行；in-scene 图人脸清晰、头后是软雾→putback 形变风险低，但未实测)。备选 IC-Light(保 万相 地标+重打光融合，但需下 SD1.5 底模+iclight 模型+装节点)。
- [x] 【窗口③】**数字人形象配置库 → 「形象工坊」重构（2026-06-13）**：联网调研同行（HeyGen/Synthesia 150–230+ 形象+分面浏览+avatar detail 大图预览；腾讯智影 形象+换装+背景可配+形象克隆）→ 把扁平的 `AvatarSheet.tsx` 重构成**分层「形象工坊」五段**：①**实时预览舞台**（聚焦形象立绘+景区背景合成+呼吸光环+人设/音色/表情 chips，对标 avatar detail）②**形象库·身份为主轴**（风格 tab×性别筛，`fit` 命中本景区风格者浮顶+「为本景区推荐」徽章，启发式 `SCENIC_STYLE_HINT` 零后端依赖）③**换装衣橱**（**关键卖点**：把原本散在网格当"即将上线"的 6 套 outfit〔旗袍/汉服/职业装/民族/马甲/冬装〕收编成**同一张甜美脸的服装条**，坐实赛题「形象可配置服装」；前端约定常量 `SWEET_OUTFIT_IDS` 分组，**未烘形象点击只做"试穿预览"不提交 `avatarPref`**→守住桥接 AVATAR_MAP 不回落〔已 Playwright 实证 localStorage 不写入〕）④**AI 定制入口**（行内展开讲 InstantID 锁脸换装自研流程+6 套成果预览，答辩亮点，"敬请期待"）⑤**音色试听**（每音色加播放键，读 `public/voice_samples/manifest.json` 决定显隐→**零 404 噪音、无死按钮**，沿用 faq/manifest 约定）。**契约零改动**（复用 `dhPresets/dhConfig`、`avatarPref/voiceId`、背景预览图、`EMO_META`，Props 签名不变）。tsc+build 过、Impeccable detect 0、Playwright @390×844 浅/深色全验（试穿/AI展开/智能推荐浮顶/0 console error）。截图 `assets/ui_shots/avatar_studio{,_wardrobe,_tryon,_ai,_dark}.png`（⚠️窗口② 9 章「形象 gallery」可升级用 `avatar_studio.png` 替旧 `avatar_gallery.png`，工坊版信息量更足）
- [ ] 【需窗口①】**形象工坊三件真资产**（窗口③ 2026-06-13 留言，均非阻塞，前端已用现有素材+占位交付完整 UI）：①**预渲染 5 段音色样音** → `webapp/public/voice_samples/<voice_id>.mp3`（各 2–3s 一句导览口播，CosyVoice/Qwen-TTS 均可；契约+命名见 `webapp/public/voice_samples/README.md`），再把已就位 id 填进同目录 `manifest.json`〔现为 `[]`〕→ 试听键自动出现；②**烘 6 套 outfit avatar**（face16 换装：旗袍/汉服/职业装/民族/马甲/冬装，源图在 `assets/avatar_facelock/face16_*.png`）解掉 presets 的 `coming_soon`→换装即可真生效（届时前端"试穿"自动变"提交"，无需改码）；③（可选）presets 加 `base`/`identity` 字段做干净身份分组，替掉前端约定常量 `SWEET_OUTFIT_IDS`；④（可选）AI 定制真生成接口（文生图+InstantID），接管"生成你的专属向导"入口。
- [x] 【窗口②】**已接收文档移交**（2026-06-13）：汇编残留清理完成——删 meta 头注；全文编号统一（4.1 段 50 处 `X.n`→`4.1.n`、评测详版降为「附录 4-A」、4.2/4.5/4.6/4.7 段内裸编号/中文编号全部规整为 `4.x.y` 层级、L2 调度详稿升格 **4.8**、第 1 章背景三节→`1.2.x`）；图号去冲突（图 X-1/X-2→4-1/4-2，4.6 段图 2-1/3-1→**4-3/4-4**，不再与第 2/3 章撞号）。剩余待办接续：界面截图入第 9 章（开场 4 张已有）、竞品对比表（10.2）、4.3/4.4 要点稿扩写、转 .docx。
- [ ] 【需窗口①】**管理端接口鉴权**（窗口② 2026-06-13 留言，用户拍板"先实现再写文档"）：给管理端改状态接口（`/kb/upload`、`DELETE /kb/{id}`、`PUT /digital-human/config` 等）加最简 API-Key 鉴权——`X-Admin-Key` 请求头 + `.env` 配 `ADMIN_API_KEY`，FastAPI dependency 一个函数即可；游客端只读接口不动。落地后在此回帖，窗口②补设计文档 8.4 鉴权节 + API_DOC 同步。背景：学长国一文档有"接口鉴权设计"专节，我们目前为零，评委看工程严谨性会查。
- [x] 【窗口③】**全局图标体系去 emoji 化（2026-06-13）**：联网调研 2026 图标趋势（笔画体系+权重变体为主流，Phosphor duotone 被旅行/消费 App 用于"视觉温度"）→ 全站迁移 `@phosphor-icons/react`——语义图标（同行人/兴趣/足迹徽章/设施/情绪）duotone+色调容器、功能图标 regular；中央注册表 `src/lib/icons.tsx`；i18n/trace 去 emoji 字段；后端 facilities 的 emoji 字段前端弃用（按 id 查 FACILITY_ICONS，API 契约未动）；明信片 Canvas 徽章改文字胶囊；「陪伴长辈」用 PersonSimpleTaiChi（太极）替缺失的拐杖图标。lucide 仅留 shadcn 原语。tsc+build 过、Playwright 浅/深色验收、Impeccable 0 反模式；截图 `assets/ui_shots/icons_*.png`（⚠️窗口② 9 章如已引用旧 UI 截图，新图标版以 icons_*.png 为准）
- [x] 【需窗口③】**设计文档第 9 章缺 3 张截图**（窗口② 2026-06-13 留言，存 `assets/ui_shots/`，竖屏即可）：①主交互页**对话进行中**（数字人舞台+实时字幕+输入坞可见）→ 命名 `main_chat.png`；②形象 gallery 页（分面筛选可见）→ `avatar_gallery.png`；③电子明信片成品页 → `postcard.png`。开场 4 张已用（图 9-1~9-4）。
  ↳ 窗口③ 2026-06-13 完成：3 张已出（390×844 竖屏，新 Phosphor 图标体系）。`main_chat.png` 含真实 RAG 回答+意图/情绪/耗时 pills+今日游园卡+输入坞；⚠️数字人舞台为**封面态**（LiveTalking 未运行，窗口③不启服务）——若 9 章必须真人脸画面，请窗口①起流后在此留言，我重截。`avatar_gallery.png` 含分面 tabs+性别筛选+景区默认徽章。`postcard.png` 为预置足迹的饱满成品（4 景点+5 徽章文字胶囊+慧昭落款）。⚠️开场旧 4 张（ob_*.png）是 emoji 图标时代的，建议 9-1~9-4 换用 `icons_onboarding.png` 或我重截全套。
- [x] 【窗口③】**明信片三轮重做 → 满版水墨明信片定稿（2026-06-13）**：三轮迭代（居中版被否→实体冲印版被否→满版定稿）。**根因链**：①最初白字压风景照=廉价；②冲印版把竖图塞矮窗口 cover **裁成横带、主体被拦腰斩断**=廉价（用户精准点出）；③更深问题：现有 `public/postcard/*.jpg` 是**万相生成的"伪明信片插画"，自带 AIGC 乱码标题**（西湖图竟印"杭南墨瓷"）、非纯风景，叠前端文字打架。**定稿方案**（`Postcard.tsx`）：满版完整图铺入实体白边内（IMG 与原图近乎同比例→零裁切、风景完整不斩断）+ 底部影院渐变信息区（景区大标题→暖金短线→祝福衬线斜体→途经`ellipsize`/统计→暖金斜体落款含日期）+ 右上邮戳（`drawPostmark`+`arcText` 环形）。**关键决策 `USE_AIGC_BG=false`**：因图素材带乱码，暂用**程序化背景**（`drawLandscape`，按景区分 4 套色板 warm/cyan/cool/gold→8 景区辨识度），干净零乱码、不依赖图素材。**第四轮（用户反馈"分辨率低 + 要动漫风真实风景"）**：①canvas 升 **2× 超采样**（物理 1440×2560，`ctx.setTransform(SCALE,...)`，逻辑坐标不变，文字/图锐利）；②`drawLandscape` 从简笔三层山升级为**动漫风氛围插画**——晨昏天空渐变 + 太阳径向光晕 + 蓬松云团（多圆叠加）+ 五层雾山（空气透视雾气过渡）+ 水面太阳倒影光带/波光 + 飞鸟剪影；加 `withAlpha/blend/parseColor` 颜色工具。Playwright 验灵山(暖)/西湖(青)/故宫(金) + 真图对照，tsc+build 过、detect 0。**第五轮（用户："每个景区应有标志性元素各有特色"）**：`drawLandscape` 加 `scenic` 参数 + `LANDMARKS` 注册表，每景区一个**标志性地标剪影**立于中景雾山脊（逆光剪影、落日左上/地标右中错开文字区）：灵山大佛(头光+立佛+莲座)/拈花湾禅塔(五重塔)/西湖雷峰塔+断桥/黄山奇峰+迎客松(横向扁伞华盖)/故宫太和殿(三层汉白玉台基+重檐庑殿顶凹曲飞檐)；另备张家界石柱/兵马俑军阵/莫高窟九层楼（前端 `SCENICS` 当前仅 5 景区，这 3 个待前端扩景区时启用）。复用 `flyingRoof`/`pagoda` 基元。Playwright 验 5 景区地标识别度，tsc+build 过、detect 0。`assets/ui_shots/postcard{,_lingshan,_nihuawan,_xihu,_huangshan,_gugong,_aigc_issue}.png`（窗口② 9 章用 `postcard.png`）。⚠️真 AIGC 动漫风景图到位后切 `USE_AIGC_BG=true`，届时地标剪影可关闭（真图自带地标）或保留作叠加。
- [ ] 【需窗口①】**重新生成 8 景区纯风景 postcard 背景图**（窗口③ 2026-06-13 留言）：现 `webapp/public/postcard/*.jpg`（`scripts/gen_postcard_bg.py` 生成）是**伪明信片插画、自带 AIGC 乱码标题**（如西湖图印"杭南墨瓷"、灵山图顶部乱码竖排），前端叠文字打架，已暂时弃用改走程序化水墨（见上条）。需调 `gen_postcard_bg.py` 的 prompt：**动漫风/新海诚风的真实感风景插画（用户 2026-06-13 明确要"动漫风真实风景图"）、纯山水风光、无任何文字/标题/印章、高分辨率（≥1440 宽，配 2× 画布）、竖版 720×1280 比例、构图上疏下密**（顶部天空留白给品牌字标/邮戳、底部前景给信息区渐变）。8 景区各一张（lingshan/nihuawan/xihu/huangshan/gugong/zhangjiajie/bingmayong/mogaoku）。出图后在此回帖，窗口③把 `Postcard.tsx` 的 `USE_AIGC_BG` 改 true 即用真景区图（参考 `assets/ui_shots/postcard_aigc_issue.png` 看旧图乱码问题）。当前已用程序化动漫氛围背景兜底（2× 高清），非阻塞。
- [ ] 【移交窗口②】**文档工作移交**（2026-06-13，原全栈线遗留）：①`docs/总体设计文档.md`（129KB/1978行/11章汇编稿）= 唯一交付稿，归窗口②继续——遗留待办：清理各章并入时的 meta 头注、补界面截图、竞品对比表、转 .docx；②章节专稿（并发与成本规模化/L2多GPU调度等）已并入汇编稿，按 docs/CLAUDE.md 视为历史底稿勿双改；③**界面截图素材已备**：开场界面 `assets/ui_shots/ob_*.png`（浅色/深色/英文/滚底 4 张，2026-06-12 重设计后的最新 UI），形象管理/明信片等其它页面截图需要哪张在此写 `【需窗口③】` 留言，前端窗口出图；④事实口径提醒：准确率 97.1%（105题）为准、97.7% 仅限标注"44题"语境（docs/CLAUDE.md 已有此纪律）。

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
- [x] **再扩 3 个异构景区（2026-06-10，验证"换库不换码"）**：`scripts/gen_scenic_docs.py` 仿题目版式生成真实知识库文档（游览指南 + 11 列结构化数据集），主题刻意分散——张家界(自然地质)/兵马俑(考古)/莫高窟(石窟艺术)。cloud 模式入库（DashScope text-embedding-v3，与现有同向量空间）：`scenic_zhangjiajie`(19)/`scenic_bingmayong`(18)/`scenic_mogaoku`(19)。仅加数据 + `SCENIC_CONFIG`(导游 岚溪/秦韵/妙音) + `env_context.SCENIC_CITY`(张家界/西安/敦煌)两处配置项，**零新代码路径**，现有 `/chat` 全链路直接支持。抽测 **15/15=100%**。客流数据不在行为 xlsx 中→`crowd_brief` 优雅返回空（不编假客流）。**景区总数 5→8**

### 接口层
- [x] **AutoDL 全栈上线 + 一波队友需求（2026-06-14 综合）**：①**双路数字人**——16:9(8010/livestream,手机端)+9:16(8011/livestream2,大屏立屏),桥接 `/live/ask|say` 加 `screen` 参数路由(main/portrait),state 按 `screen:sessionid` 命名空间隔离;竖版流 `/stream_portrait.flv` + `/hls/livestream2.m3u8`。②**16:9 完整头「腾讯会议式」虚拟背景形象**(`scripts/compose_tencent_bg.py` = rembg 抠 sweet_bob + 万相生成灵山场景背景合成;**手势功能放弃**——EchoMimicV2 离线/SDXL 半身露手必大头娃娃/万相比例好但丢身份)。③**前端聊天流重构**(气泡一问一答 + 打字机流式 + 快问 chips 吸附输入坞)。④**英文语音**:AutoDL 装 faster-whisper(CPU,模型已下),webapp `api.asr` 传 UI 语言,英文跳中文热词,QwenTTS Serena 说英文(RAG lang=en 本就支持)。⑤队友接口:BI(3.12)/topic-intents(3.13)/kb_manage CRUD/theme hex 双格式/xlsx 全 159 景点。⑥**桥接 `/api-doc`** 渲染 API_DOC.md 给队友(no-cache 永远最新,`scripts/sync_apidoc.sh` 同步)。⑦**ECS 116.62.136.211 已弃用**,全栈公网走 AutoDL。**运维铁律**:进程非常驻(实例重置全死→`start_all.sh`)、启动服务的 ssh 必须 `setsid+disown+exit 0` 防 SIGTERM 级联、`pgrep -f` 自杀坑用字面 PID。详见 [[deployment-strategy-autodl]] + API_DOC §6。
- [x] **文旅 BI 分析接口（2026-06-14，给队友数据大屏）**：新增 `backend/api/analytics_bi.py` 5 端点 `/analytics/bi/{scenics,overview,spending,demographics,attractions}`——数据源=**游客行为数据库**（赛题 xlsx + 8 景区合成补充数据，造数脚本 `scripts/gen_synthetic_behavior.py` 出 2 万行 `示范景区公开资料包/synthetic_behavior.csv`，与会话类 analytics 的 SQLite 数据源互补）。挖人口画像/消费结构/景点热度/满意度，`scenic_id` 可选 8 景区或 `all`，`@lru_cache` 缓存，未知 id 优雅降级。`/attractions?managed_only=true` 仅本产品 8 景区（演示用）。契约写进 **API_DOC 3.12**，roundtrip `tests/test_analytics_bi.py` **20/20 过**。**已部署 AutoDL**：传 csv+模块、patch main.py 注册路由、重启 RAG(:8000 base env py3.12)；并起**桥接 :6006**（base env，`/rag/*` 代理 GPU 无关）→ BI 经公网 `https://<autodl>:8443/rag/analytics/bi/*` 可达，队友数据大屏直接 fetch（CORS 全开）。AutoDL 只有 csv 故各景区均 2500 样本、`all`=2 万；ECS/本地有 xlsx 则 `all` 含全域景点。
- [x] **管理端前端三项需求落地（2026-06-14，队友 claude code 反馈）**：①**时间范围** BI `overview/spending/demographics` 加 `days`（1今日/7本周/30本月，按数据集最新日期相对；analytics 其余端点本就有 days）；②**热门话题改意图分类** 新增 `/analytics/topic-intents`（qwen 把游客提问归 9 类+计数，缓存 10min，替代 hot-topics 的 n-gram 碎片）；③**FAQ/文本/文档持久化** 新 `backend/api/kb_manage.py`：`/kb/faq`+`/kb/text` 逐条 CRUD（落 SQLite 三新表 faq_items/text_items/uploaded_docs）+ **新增/编辑即以稳定 id `upsert_item` 同步进 RAG 向量库、删除即移除**（游客问答立即可检索）；`/kb/upload` 自动登记 `/kb/docs` 真实文档列表（告别假文件名），并**扩格式 docx→docx/pdf/txt/md**（`loader.load_file_as_chunks` 按后缀分派，pdf 用 pymupdf 抽文本层、逐文件返回 chunks/status，无文本层 PDF 标 `unsupported`）。roundtrip `tests/test_kb_manage.py` **11/11**。**xlsx 全景区暴露**：`/scenics` 改列数据集全部 **159 景点**（8 我方+151 xlsx，带 managed 标记），`scenic_id` 同时接受我方 id 与 xlsx 景点名（如 `同里古镇`）→ 赛题表格所有景区数据可查。**修桥接 `/rag` 代理只放行 GET/POST 的坑**→加 PUT/DELETE/PATCH（否则 FAQ 编辑/删除过不了网关）。全部已部署 AutoDL，公网 `…:8443/rag/*` 实测 CRUD 全通。契约见 API_DOC（kb 管理节 + 3.12/3.13）。
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
- [x] **认知修正·去灵山化（2026-06-11）**：品牌改「智游·导览」（logo「游」），UI 全量去硬编码——`/scenic/theme` 加 `guide_name`（复用 SCENIC_CONFIG），i18n 4 语言 `thinking` 改 `{guide}` 占位动态替换（西湖=「婉清正在思考」）、明信片落款/下载名/favicon/title 全改；未知景区回落中立主题+「小导」。PRODUCT.md/记忆已落档铁律
- [x] **并发与成本规模化设计 + L3/L2 落地（2026-06-11）**：回应"多并发+保证人人<5s+成本低于真人导游"。架构=**三层漏斗**（L1 高频问答视频缓存 0GPU/L2 GPU池按发话共享/L3 满载降级转文字）。核心理念=GPU 按"发话瞬间"共享非"会话"独占（duty-cycle ~12.5%→一卡服务~8倍人）。**桥接已落地 L3+L2 容量池**：`AvatarPool`(`AVATAR_POOL_SIZE`)+ `/live/ask` 容量决策(满载/离线→`mode:text,degraded:true`,答案照出)+ `/live/capacity` 观测 + 前端「文字模式」提示。实测：池=1 并发2人→1驱动1降级**人人有答案**；延迟软件1.61s+TTS0.35s<5s。成本测算 <¥1/游客 vs 真人¥15-25。设计文档章节 `docs/并发与成本规模化设计.md`（对标国一范式，可折进总体设计文档）。
- [x] **L2 多GPU池调度算法研究+设计（2026-06-11）**：联网研究工业界(Triton/vLLM/Ray)+学术界后出 `docs/L2多GPU池调度算法设计.md`（算法章级深度）。核心：分发=**CHBL(一致性哈希有界负载,保avatar亲和省冷启动)+Po2C(防热点)**；容量=**Erlang-C/M-G-c**精算(算例:L1缓存50%命中把GPU数~20→~10)；伸缩=**用客流数据预测式预热**(我们独有优势);诚实指出**实时数字人不能跨用户拼批**(增益=时分复用非batching,与LLM serving本质区别)。已落地 `AvatarPool`=c=1特例,多节点只需换池级状态(Redis)+套分发层。7条参考文献
- [x] **L1 高频问答视频缓存落地（2026-06-11，成本杀手）**：清单 `webapp/public/faq/manifest.json`(触发短语+答案+情绪+clip) + 桥接 `/live/ask` 入口命中短路(归一化子串匹配→`{mode:clip,clip_url,cached:true}`,不调RAG不占槽) + 前端舞台播成品片(`clipUrl`,播完回归,「⚡秒回·缓存」pill) + 预渲染脚本 `scripts/prerender_faq.py`(GPU box:ffmpeg抓SRS流+/live/say驱动→mp4→回写清单→`/live/faq/reload`热生效) + 种子占位片。**实测命中 0.001-0.004s vs 走RAG 8.9s（快~2000-9000倍,0 GPU/LLM）**，浏览器网络证实播片(206)。顺带**放开"先连数字人才能问"**：未连接也能问，答案以文字/缓存片返回(实时人脸=增强非必需)。真·会说话片待 GPU 跑 prerender 替换占位
- [x] **逻辑后端部署 ECS（2026-06-11）**：本轮所有新接口(theme/digital-human/tour/trip/analytics events·profile·feature-usage)同步部署到 `116.62.136.211`，装 pandas/openpyxl(补 CLAUDE.md 早标注的坑)，41 路由公网验证通过。ECS 规格要求：4核8G/40G ESSD/无GPU/Py3.11+/出网调DashScope/放行8000·443(手机要HTTPS)；规模化再上8核16G+RDS PostgreSQL+SLB
- [x] **数字人形象管理互通（2026-06-11）**：管理端 `PUT /digital-human/config` 配景区默认 ↔ 游客端 AvatarSheet（设置→数字人形象）精调。presets 扩真实资产+元数据（gender/style/outfit/preview/coming_soon：3 可用形象+6 款 InstantID 换装预览，预览图压缩进 `webapp/public/avatars/` 236K）；音色 5 款分男女（Serena/Cherry/**Jada 吴语**/Ethan/**Dylan 京腔**）。**音色=消息级即时生效**：`/live/ask|say` 加 `voice_id` 覆盖→桥接 VOICE_MAP 译 `tts.ref_file`（mock 实测 Serena/Cherry/Jada/Dylan 全对）；**形象=进程级**→存偏好「下次唤醒生效」。互通契约写进 API_DOC 第 4 章
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
- [x] **Ditto 替换 MuseTalk 直播引擎（2026-06-11~12，治"死脸"完成态）**：Ditto(antgroup,ACM MM 2025)=LivePortrait warp+音频运动扩散，**"驱动原图"非"重画脸"**→身份/取景/眼神全保留+全脸协同动。①TRT 实时化：预编译 Ampere_Plus 引擎+`DITTO_STEPS=25` → 4080 实测 **25.5fps 过实时线**、流式首帧 **719ms**（踩坑：TRT8.6.1 要 cuDNN8→`LD_LIBRARY_PATH=~/Desktop/cudnn8/...` 旁路注入；`cuda-python==12.4.0`；磁盘满截断 tensorrt→Bus error，软链 comfy_venv 共享）②直播集成：LiveTalking 注册 `--model ditto`+新写 `avatars/ditto_avatar.py`（feeder 6480 滑窗喂 SDK + emitter 帧/音频配对推 RTMP；**静音喂零→自生成待机微动，不再需要 idle 底座/表情底座/交叉淡化**）；肖像放 `data/ditto_avatars/<id>.png`，启动 `--avatar_id sweet_bob_ditto`，**GPU 仅 2.7G（vs MuseTalk 7.2G）**③韵律随情绪：qwentts.py `EMO_RATE`（关切0.85/平静0.90/喜悦0.93），**踩坑：Qwen-TTS session 已 start 后 update_session 必断连且表象为"静音"→改语速也须重连**；验证教训=语音链路必须 volumedetect 查 dB 不能只看日志。全链路 FLV 录像带声验证通过。详见 [[ditto-engine]] 记忆。待办：emotion→Ditto 8 类表情条件（现占位）、打断 ~1s 尾巴、/talk 真机端到端复测
- [x] **数字人延迟攻坚：讲故事"十几秒才开口"→ ~4s（2026-06-13，赛题红线）**：用户本机测网页报延迟不可接受。逐段埋点：RAG 首句 ~1.4s✅ + TTS 首音 ~1s✅ = 音频 2.5s 就生成，但要 ~8-10s 才进流。**两个真 bug**：①**Ditto 音频管线 idle 堆积（主凶）**：feeder 读 idle 帧跑在 2× 实时（BaseASR 静音注入快），灌满 SDK 内部队列（`QUEUE_MAX_SIZE=100`→可缓冲~20s），语音排后 → ~8s 延迟。**初版加固定时钟节流→错**（按 25fps 产音频 50帧/s 但 SDK 实际 ~21fps→emitter 只消费 42帧/s→音频堆 pending_audio ~400帧=8s→语音永远等不到配对视频帧 = **间歇性整段静音**！DBG 实锤 feeder 读到语音但 pending=400/fq=0/emitter 不推）。**正解=下游真实速率反压**：feeder 按 `pending_audio.qsize() > PENDING_MAX(30)` 等待，自动跟随 SDK 实际 fps。修后 pending 峰值 34、静音消失。②**情绪→语速重连占首句路径**：Qwen-TTS 改 speech_rate 必须重连 ~1.5-2s → **固定 speech_rate=0.9 不随情绪重连**（情绪主表达已在脸/Ditto emo；仅换音色/连接死亡才重连）。frame_queue 64→6。**实测**（浏览器 Web Audio glass-to-glass）：**最佳 3.86s，典型 ~4-5s**。残余方差主要是 **mpegts.js 播放器缓冲漂移**（`useGuide.ts` 无 liveBufferLatencyChasing，落后直播边缘 0.24~3s 跳）→ **【需前端窗口】mpegts createPlayer 配 liveBufferLatencyChasing 追直播边缘**，可再压 1-3s。详见 [[ditto-engine]]
- [x] **推流稳定性攻坚：直播每 5-10min 掉线 → 双向自愈（2026-06-13，演示命脉）**：测手机网页时实锤 **LiveTalking 的 RTMP 推流每 5-10 分钟掉一次**（SRS 日志 `cleanup when unpublish`，凌晨 3 点历史日志同样周期掉→**非今日改动引入**，是 `python_rtmpstream`/C++ Streamer 老毛病：连接被 SRS 断后 `stream_frame()` 继续往死管子写、不报错、零自动重连 → 画面永久卡死「正在唤醒」）。**根因双侧、必须双修**：①**服务端推流看门狗**（`streamout/rtmp.py`）：新增 daemon 线程轮询 SRS `/api/v1/streams/` 的 `publish.active`，连续 2 次(~4-6s)判掉线→置 `_reconnect_pending`，emitter 线程在 `push_video_frame` 顶部消费标志、重建 `Streamer`（**仅重连 RTMP ~1-2s，不碰 TRT/引擎**）。看门狗只置 bool、所有 `_streamer` 改动留在 emitter 单线程→零锁零竞态；init 失败不冒泡（防杀 emitter 永久黑屏）。②**客户端 mpegts.js 自愈**（`webapp/src/hooks/useGuide.ts`，⚠️**窗口①借动前端**，与窗口③ AvatarSheet 改动不同文件无冲突）：原本流中断收 `UnrecoverableEarlyEof` 后冻死不恢复→`startFlv` 挂 `mpegts.Events.ERROR`→1.5s 退避重连循环，重试到服务端把流救活、`play()` 成功为止（同时覆盖 cloudflare 524）。③**桥接 index.html no-cache**（`bridge/server.py`）：显式 `/` 路由发 `Cache-Control: no-cache`（哈希资源仍永久缓存）——否则重新构建后手机/演示机一直加载旧 bundle（实测自己踩坑：浏览器缓存旧 `mpegts-*.js` 无重连逻辑）。**验证**：SRS API `DELETE /clients/<id>` 主动踢发布端模拟掉线 → 服务端 ~10s 自动重建（日志「第 N 次重建 Streamer」+ publish.active 复活）+ 客户端 playwright 实测 video.currentTime 重置后重新流畅推进（1s/s）=**自愈闭环，不再永久黑屏**。看门狗轮询已 3s→2s 提速（待 LiveTalking 下次重启生效）。**部署结论**：演示录制走**本地直连/APK**（FLV 直连无 cloudflare 100s/524 限制、保 <5s）；隧道仅用于扫码体验（FLV 过隧道每 ~100s 被 cloudflare 524 掐、靠客户端自愈续命）。详见 [[ditto-engine]]
- [x] **iPhone 静止无声 bug 修复（2026-06-13）**：用户 iPhone 局域网测试，开场加载后提问数字人静止/无声/不响应。根因=`webapp/src/hooks/useGuide.ts` iOS 分支写死 `/hls/livestream_ios.m3u8`（MuseTalk 时代残留**孤儿流名**），当前 Ditto 推流只生成 `livestream.m3u8`→iPhone 一直播 SRS 里 6-9 的旧切片（同一路 RTMP 同时出 `.flv` 给安卓 MSE、`.m3u8` 给 iOS 原生 HLS）。诊断=`grep 手机IP /tmp/bridge.log` 见其请求 `livestream_ios.*`，而 `livestream.m3u8` MEDIA-SEQUENCE 在涨、`_ios` 冻结。修=iOS 指向 `/hls/livestream.m3u8`（ffprobe 确认 H.264 Main+AAC-LC，iPhone 原生可播）+ 补 iOS `video.error`→重载 playlist 自愈。iOS HLS 固有延迟比 FLV 高（hls_fragment 1+window 3≈4-5s）。⚠️**窗口①借动前端**（与窗口③不同文件）。详见 [[ditto-engine]]
- [x] **提问打断 barge-in + iPhone HLS 平滑 + 磁盘搬迁（2026-06-13）**：用户 iPhone 测试反馈三事。①**barge-in（回答中再提问→立即转答新问，最自然 UX）**：桥接 `/live/ask` 加"会话代号 `_ASK_GEN` + 槽归属 `_SESSION_SLOT`"——新问 `+1` 代号，旧问驱动循环每句比代号、非最新即 `break` 停推（新问首句 `interrupt` 冲掉旧音频）；渲染槽按会话归属（POOL_SIZE=1）：首问 acquire、barge-in 复用同槽不重抢（否则被自己延迟释放卡成 pool_full 误降级）、仅最新一问说完延迟释放。前端 `useGuide.ask` 去 `busy` 拦截 + 递增 `askSeqRef` 丢弃旧问异步结果；`App.tsx` 发送键/快问气泡放开 `busy` 禁用（语音/拍照仍 gated）。**curl 实测**：Q1 `superseded:true`/text 停驱动、Q2 复用槽 avatar/不降级、30s 后池归 0 无泄漏；playwright 实测回答中发 Q2→UI 终显 Q2 答案。②**iPhone HLS 卡顿/末尾卡帧**：根因=Ditto 为压延迟保持 SDK 队列near-empty→产帧微小空档，安卓 FLV 深缓冲吸收得了、iOS 浅 HLS 吸收不了。修=`srs.conf` `hls_window 3→5`（缓冲 3s→5.76s 垫平空档，代价 iOS 起播 ~6s；低延迟走安卓 FLV）。③**磁盘 /home 99%(998M)**：清纯缓存 ~4.4G + **ComfyUI/models 11G 搬 `/home/jiale/storage`(/home_extra 49G)软链回**（零重下载）→ **998M→17G**；storage 余 ~36G，下档可搬 HF 大模型(MuseTalk 3.2G 已废/bge cloud 不用)。SRS+桥接已重启验证全栈通。⚠️**窗口①借动前端**。详见 [[ditto-engine]]
- [x] **L1 FAQ 真片渲染 + 新前端端到端验证（2026-06-13）**：①**新 webapp（前端窗口产出）实测连通 Ditto 直播栈**——桥接 `:9000` 单源（托管 dist + 反代 /rag /live /stream.flv /hls /vendor），playwright 真实浏览器验证：已连接 + 灵山场景背景 + 主动迎宾 + 今日天气客流卡全部正常。**talk.html 弃用**（→ `/legacy`、`/talk` 回退页），访问入口已更正为 `:9000/`。②**灵山 3 条 FAQ 占位片→真·会说话片**（`scripts/prerender_faq.py`，自带灵山背景+excited/happy 情绪）。命中实测 **0.0007–0.001s vs 走 RAG 4.86s（~5000×，0 GPU·0 LLM）**，真片 HTTP 200/1.58MB/3ms，已同步 dist/faq。③修脚本两 bug：httpx 读系统 SOCKS 代理→`trust_env=False`；"先驱动后抓流"时序脆→改 **capture-first + 预热连接 + 保守时长 + 无声检测重试**（首条常因流水线未 settle 录空，重试必成）。④**QwenTTS 大坑三（demo 杀手）**：WS 空闲 300s 被服务端超时关闭→连接死后同语速驱动不重连→`Connection is already closed`→静音；评委读资料>5min 下一问就哑。修=`_alive` 健康标志 + 合成前死连接重连 + 合成中途死亡重连重试。详见 [[ditto-engine]]
- [x] **emotion→Ditto 原生表情条件接通（2026-06-13，W1 队首/拿奖分水岭完成态）**：`ditto_avatar.py` `set_emotion` 从占位变实装——原理=在线流水线每 80 帧 chunk 读 `condition_handler.emo_seq` 拼进 LMDM 条件（维度 1103=1024 音频+8 情绪+8 眼+63 sc），setup 后 SDK 不再改写该属性→**单属性原子赋值即热切**，零停流。映射 `EMO_TO_DITTO`（happy→3、excited→(3,6)、concerned/empathetic/apologetic→(4,5) 混合柔和版、curious→(4,6)）；**回中性=恢复 cfg 自带 600 帧真人情绪序列**（比常量 Neutral 自然）+ feeder 静音 4s 自动回默认（`DITTO_EMO_IDLE_REVERT`）。**顺手修了 QwenTTS 静音大坑**：换音色/语速重连时 close→on_close 误置 `_response_event`→wait 早返回→BaseTTS 离开 RUNNING→后续音频 delta 全被丢=**无声**（桥接多句连发会遮住此 bug，单句驱动才暴露）→`_reconnect_session()` 统一重连+`_reconnecting` 抑制置事件+完后再 clear。实测三情绪有声（合成 2.5-2.7s 真流式）+ 热切日志 + 表情可辨（happy 嘴角上扬/concerned 眉眼柔垂），三联对比片已交用户盲评。⚠️ `/human` 的 sessionid 必须是字符串 "0"（int 0 → session not found）
- [x] **作品蓝图定稿（2026-06-13，与用户头脑风暴 4 轮收敛）**：`docs/作品蓝图与冲刺路线.md` = 各窗口总纲。定位=**双面叙事**「游客扫码遇见金牌导游；景区点击拥有数字员工」；三幕视频（惊艳 30s/游客的一日 4min/景区的一日 2min，片尾**双二维码扫码即聊**=杀手锏）；**端侧环境感知引擎**（GPS 地理围栏主动开讲/罗盘指向性指路/天气×位置便利/步程入游记，context snapshot 随 /live/ask 上行与服务端 env_context+crowd 合流——也是 APK 的产品级理由）；端形态分工=队友接两块大屏 web，我方做手机网页+APK(Capacitor)+**管理端手机 web**（手机 web vs 小程序选定前者：同栈复用设计系统/免 appid/进扫码体系）；2-3 周冲刺路线按窗口分解（W1 表情条件+扫码部署+视频脚本 / W2 管理端+感知+同游+FAQ真片+APK / W3 交付）；明确不做清单（compound/真AR/CosyVoice替换/MetaHuman 等标决赛路线）。盘点修正：webapp 已有 模拟GPS/路线/游记/今日卡/设施/明信片/4语言/迎宾开场（前端窗口产出），初版路线图一半重复排期已剔除
- [x] **数字人场景背景功能（2026-06-12，治"空白背景不像在景区"）**：原理=Ditto"驱动原图"→输出帧背景=源肖像背景→**背景离线烘进源图，运行时零开销**（前端垫图不可行：FLV 无 alpha）。①流水线 `scripts/gen_avatar_background.py`：万相 t2i 按 8 景区 prompt 出背景（无人物/留站位/中上部无直线结构）→ rembg birefnet-portrait 抠像(mask 缓存) → 两级景深虚化(全图 σ6+头缘 90px 环带 σ14，**规避 putback 头动形变**) + LAB 色调对齐 → 变体 `<base>_bg_<bg_id>.png` 落 LiveTalking ditto_avatars + webapp 预览图 + 审图三联板。②配置链路：`digital_human_config` 加 background_id/name 列（`_ensure_columns` 幂等迁移）、`_BACKGROUND_PRESETS` 9 项、PUT 验证、presets 带 backgrounds；**上传自定义背景**=拉取式 4 端点(upload/pending/file/ready)+`sync` 子命令（后端可在 ECS、合成在本地）。③桥接：AVATAR_MAP 修正为 ditto 名（原指 MuseTalk 旧名）、`_resolve_avatar_variant` 变体存在性解析+缺失回落、`/live/avatar` 带 background_id；`scripts/resolve_avatar.py` 供启动命令 `$(...)` 内联。④AvatarSheet 加只读"场景背景·随景区自动"行。**实测**：8 景区背景全产出（西湖/故宫调 prompt 重生成把地标推画面上部）；API 测试 13/13；直播实测灵山背景**说话/头动时背景区帧差 0.48-0.60≈编码噪声 vs 人物区 1.57-3.53**，背景纹丝不动；FAQ 占位片无背景不一致问题（真片还没渲过）。切换语义=下次连接生效（与形象进程级一致）
- [x] **总体设计文档 4.5 整章重写为 Ditto 引擎章（2026-06-12）**：按国一范式④——根因诊断(分帧差分实锤)→横评与两个失败教训(换嘴贴回/整脸重画)→Ditto"驱动原图"原理(LMDM+warp)→TRT 实时化(原理+数据+3 踩坑)→直播集成自研(feeder/emitter+静音自驱动)→实测对照表(2.7G vs 7.2G)→诚实边界；4.5.1 神态管理同步更新（韵律按句随情绪✅）；全文 15+ 处 MuseTalk 时代表述（术语/FR-T3/NFR-2·4·7/架构图/选型表/4.6 延迟预算/4.7 并发）一并更新，端到端口径=Ditto 配置 ≈4.7s<5s

- [x] **开场界面重设计·数字人迎宾式（2026-06-12）**：`webapp` `Onboarding.tsx` 原地重写——数字人头像 hero（halo-breathe 呼吸光环 + 在线状态点）+ 打字机问候（`useTypewriter`，reduced-motion 即时全文）+ stagger 入场（`.anim-fade-up` + inline delay 0→600ms）+ 景区横滑实景卡（postcard 缩略图 + scrim + 选中 ring；卡下 `{guide} 在这里等你` 随景区实时换导游名/主色）。**偏好持久化**：`lingjing.scenic/group/interests/lang/onboarded` 五键（useGuide initializer+effect），回访直进主页；设置抽屉加「重看开场」。⚠️修老 bug：reduced-motion 全局块只清 animation-duration 不清 delay → `both` 填充 stagger 元素卡透明态，补 `animation-delay:0ms!important`。Playwright 全流程验证（换肤/持久化/重看/深色/英文/无横滚）+ Impeccable 0 反模式；截图 `assets/ui_shots/ob_*.png`

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

演示态架构（本地 4080 开发/录制；公网走 AutoDL 单网关。⚠️下图 ECS 已弃用，公网 = AutoDL `https://<实例>:8443`）：

```
手机浏览器 / 微信 H5
    ↑ WebRTC（局域网）
本地 4080 机器
  ├─ LiveTalking :8010    MuseTalk 30fps 口型同步，WebRTC 推流
  ├─ 桥接层 bridge :9000   串 RAG→数字人，读 config 切形象/音色
  └─ RAG 后端 :8000        本地 GPU 模式，检索 0.54s（也可指向 ECS）

AutoDL 公网网关 :8443  →  SRS+两路LiveTalking(16:9/9:16)+RAG+桥接，扫码即用（ECS 已弃用）
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

# ② 数字人（Ditto 全脸驱动，2026-06-12 起主引擎；RTMP 推流；TTS 用百炼 Qwen-TTS 云端实时）
#    --avatar_id 经 resolve_avatar.py 解析 = 形象 + 景区场景背景变体（管理端配 background_id 后下次启动自动换）
cd ~/Desktop/LiveTalking && unset ALL_PROXY all_proxy HTTP_PROXY http_proxy HTTPS_PROXY https_proxy
DASHSCOPE_API_KEY=$(grep DASHSCOPE_API_KEY ~/Desktop/Digital_Person/.env | cut -d= -f2) \
LD_LIBRARY_PATH=/home/jiale/Desktop/cudnn8/nvidia/cudnn/lib \
  ~/miniconda3/envs/livetalking/bin/python app.py --transport rtmp --model ditto \
  --avatar_id $(~/Desktop/Digital_Person/.venv/bin/python ~/Desktop/Digital_Person/scripts/resolve_avatar.py --scenic lingshan) \
  --tts qwentts --REF_FILE Serena --push_url 'rtmp://localhost/live/livestream'
# 注：LD_LIBRARY_PATH=cudnn8 是 Ditto TRT 必需（TRT8.6.1 要 cuDNN8，与 torch 的 cuDNN9 共存）；详见 [[ditto-engine]]
# 注：--tts qwentts 需 livetalking 环境装 dashscope>=1.25.11；音色 Serena(知性温柔女声=默认)/Cherry/Jada(吴语)/Ethan/Dylan(京腔)
# 注：MuseTalk 旧引擎仍可用：--model musetalk --avatar_id sweet_bob --batch_size 4 + PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True（情绪底座 _happy/_concerned 热切换）

# ③ RAG 后端（cloud 模式，0 显存，0.0.0.0 让手机可访问）
cd ~/Desktop/Digital_Person && DEPLOY_MODE=cloud .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
# ④ 桥接层（含 /stream.flv 反代：借桥接 CORS 让前端同源播 FLV，绕开 SRS 无 CORS 头）
cd ~/Desktop/Digital_Person && RAG_BASE=http://localhost:8000 LIVETALKING_BASE=http://localhost:8010 \
  .venv/bin/uvicorn bridge.server:app --host 0.0.0.0 --port 9000
```

验证链路：`curl localhost:1985/api/v1/streams/`（看 `active:true`）、`curl localhost:9000/live/health`。

访问（本机用 **localhost**；手机同 WiFi 用 `hostname -I` 查的 IP）：
- **`http://localhost:9000/` — 正式游客端（React 商业版 webapp，窗口③产出，唯一对外页）**：桥接当统一入口，
  托管 webapp/dist + 反代 `/rag /live /hls /stream.flv /vendor`，单源无跨域。2026-06-13 实测连通 Ditto 直播栈
  （灵山场景背景 + 主动迎宾 + 今日游园天气客流卡全部正常）。
- ⚠️ `talk.html`（`GET /talk`，RAG :8000）与 `/legacy`（桥接）**已弃用**，仅作 dist 缺失时的回退页，演示一律用 `:9000/`。
- `http://localhost:8000/m` — 后端功能测试台（开发自测用）
- ⚠️ 本机浏览器**别用局域网 IP**：系统代理(clash :12334)会劫持局域网 IP→502。用 localhost 或给代理加「绕过局域网」。

### 已排除方案

| 方案 | 排除原因 |
|---|---|
| 阿里云数字人 API | 商业计费太贵 |
| 讯飞数字人 Web SDK | 仅 PC Web，不支持移动端浏览器，卡赛题手机端要求 |
| SadTalker | 每句生成 10-30s，超 <5s 延迟红线 |
| Three.js + VRM | 动漫风格不适合景区导游，自然度输给写实方案 |

### 分工（2026-06-13 更新：主体全栈 + 队友承担两块大屏）

用户负责主体全栈：RAG 后端 + 桥接层 + LiveTalking 部署 + 形象生成 + 游客端手机网页/APK +
管理端手机 web + 交付材料；**队友承担 游客端大屏 web 与 管理端数据大屏 web**（我方供接口联调）。
Claude Code 作为协作编程伙伴全程参与。（曾一度"一人全栈"，2026-06-13 队友回归分担大屏。）

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

### 创新五：景区类型差异化画像（2026-06-12 头脑风暴定向，产品总纲）

> 立意：回答评委灵魂拷问——"换库不换码,那黄山和故宫的导游说一模一样的话,叫通用还是叫**同质化**?"
> 答案 = **泛化 ≠ 千人一面**：同一套代码,按景区类型呈现恰当的不同。`scenic_type` 管"景区是什么"、
> `group_type` 管"游客是谁",**两个正交维度**。另一来源 = 双角色头脑风暴结论：真实景区问询量大头是
> **服务性问答**（厕所/演出时间/紧急求助）而非文化问答,评委现场问"最近的厕所在哪"答含糊会砸 97% 光环。

**类型学（现有 8 景区天然覆盖 5 类）**

| scenic_type | 我们的景区 | 该类游客的根本性差异诉求 |
|---|---|---|
| 宗教人文 religious | 灵山 | 礼仪禁忌（殿内拍照/衣着）、**演出场次**（九龙灌浴）、祈福流程 |
| 自然山岳 mountain | 黄山、张家界 | **安全与体力第一**：天气突变、索道、日出时刻、装备、体力分级路线 |
| 博物馆/遗址 museum | 故宫、兵马俑、莫高窟 | **预约限流**、文物保护规则（莫高窟窟内**禁拍**）、深度讲解、动线单向 |
| 开放城市 urban_open | 西湖 | 免票无边界、**交通接驳**（地铁/船票）、夜景 |
| 度假小镇 resort_town | 拈花湾 | 住宿餐饮、夜游夜演、慢节奏"不赶景点" |

**类型差异落在 5 个杠杆**：①导游人格侧重（山岳=安全管家/博物馆=学者型/小镇=生活方式主理人）
②路线推荐的预算变量（体力预算 vs 时间+场次预算 vs 交通串联）③安全规则的**主动提醒**（莫高窟拍照
定位后应主动提"窟内禁拍"；黄山问日出附"山顶 5℃带外套"）④emergency SOP 按类型配模板（山上失温
≠馆内走散≠开放景区落水）⑤客流模型驱动因子（山岳=天气驱动；博物馆=预约配额,满了该建议"约后天"
而非"错峰"）。

**落地铁律：类型差异必须是配置+数据,不许 if-else 代码分支**（守住"换库不换码"）：
`SCENIC_CONFIG` 加 `scenic_type` 字段 + 新增 `TYPE_PROFILES` 纯数据表（人格侧重指令片段/推荐准则/
主动提醒规则/emergency SOP 模板/客流驱动因子），注入点 = 现有 `_directive_with_context`（与客流/
天气同一个口子）。新景区接入成本 = 数据 + 3 行配置（多选一个类型），零新代码路径。

**施工顺序（演示惊艳 ÷ 工作量,类型画像是 2/3/5 的承载底座）**：
1. [ ] `TYPE_PROFILES` + `scenic_type` 配置注入（~半天,底座）
2. [ ] `emergency` 意图 + 按类型 SOP 兜底模板（~2h,**防扣分必做**：游客喊救命不能回共情话术,要给广播站电话+最近服务点）
3. [ ] 演出时刻表问答（~半天,灵山/拈花湾先做）：结构化数据加场次字段,时间感知已有→"现在14:20,下一场九龙灌浴14:30,从大佛广场走过去约8分钟,建议现在出发"（KB+时间+空间一句话串起,演示视频天然镜头）
4. [ ] 管理端「知识库自检评测」（~1天,可并行）：产品化 `tests/eval_kb.py` 派生题逻辑为 `POST /kb/self-test`,上传新库→自动生成测试题→出准确率报告,直接回应"换库后还能90%吗"
5. [ ] 就近设施指引（~半天）：结构化数据位置字段+当前位置→最近厕所/餐厅/医务室（景区问询量第一名）
6. [ ] （可选）管理端「高频问询点位」洞察视图——撑起"数字人=景区传感器"叙事（很多人问厕所→该处指示牌不足）；应急广播推送（`/live/say` 已能说任意话,管理端加公告输入框即通）

**演示杀手镜头**：同一句"帮我推荐半天路线"三连切——黄山→体力分配+索道,故宫→中轴线+预约,
拈花湾→"别赶,傍晚看灯"。30 秒让评委直观看到"通用但不同质"。
**文档收口**：创新综述新增维度「插拔式知识库（换库不换码）× 景区类型画像（换库不同人格）」；
eval 按类型加特征题（黄山问装备/莫高窟问拍照规则）证差异化真生效。

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
