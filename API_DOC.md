# 景区导览 AI 数字人 — 后端接口文档

**公网网关（AutoDL，下文 `{BASE}` 即指它）**：`https://u891802-x4xd-7f8146e7.bjb2.seetacloud.com:8443`

> **调用约定**（前端队友看这里）：
> - **RAG 后端接口**（chat / analytics / kb / theme / tour / digital-human …）：网关加 `/rag` 前缀 → `{BASE}/rag/<路径>`。例：`{BASE}/rag/chat`、`{BASE}/rag/analytics/bi/overview`。
> - **桥接接口**（数字人直播与驱动 `/live/*`、`/stream*`、`/hls/*`）：直接在网关下 → `{BASE}/live/ask`、`{BASE}/stream.flv`。
> - 全部 CORS 全开,`fetch` 直接用。本文档在线版:`{BASE}/api-doc`（永远最新）。
> - 本地开发直连 RAG 用 `http://localhost:8000`（无 `/rag` 前缀）。
>
> ⚠️ 阿里云 ECS（116.62.136.211）**已弃用**,文档里如还有该 IP 即为旧示例,一律以 `{BASE}` 为准。

**健康检查**：`GET {BASE}/rag/health` → `{"status": "ok"}`；`GET {BASE}/live/health`（含数字人直播状态）

---

## 目录

- [1. 对话接口（核心）](#1-对话接口核心)
  - [1.1 文本对话（同步）](#11-文本对话同步)
  - [1.2 文本对话（流式 SSE）](#12-文本对话流式-sse)
  - [1.3 图片对话（多模态）](#13-图片对话多模态)
  - [1.4 多语言问答](#14-多语言问答)
  - [1.5 同行人格切换](#15-同行人格切换)
- [2. 知识库管理](#2-知识库管理)
- [3. 数据分析（管理后台用）](#3-数据分析管理后台用)
  - [3.1–3.7 大屏/词云/情感/对话/报告/盲区/预警](#31-数据大屏核心数据)
  - [3.8 客流热度感知](#38-客流热度感知)
  - [3.9 游客行为事件上报 🆕](#39-游客行为事件上报-)
  - [3.10 客群画像 🆕](#310-客群画像-)
  - [3.11 功能使用率与满意度 🆕](#311-功能使用率与满意度-)
  - [3.12 文旅 BI 分析（人口/消费/景点画像）🆕](#312-文旅-bi-分析人口消费景点画像)
- [4. 数字人形象配置](#4-数字人形象配置)
- [5. 景区主题（管理端可配置换肤）](#5-景区主题管理端可配置换肤)
- [6. 数字人直播与驱动（桥接层·手机端16:9 + 大屏竖版9:16）🆕](#6-数字人直播与驱动桥接层)
- [附录：数据类型说明](#附录数据类型说明)

> 游客端导览接口（迎宾/今日卡/跟我游/设施/定位/游记）见 [`docs/数据采集与管理端对接.md`](docs/数据采集与管理端对接.md) 与各 `backend/api/{trip,tour}.py`；本文档聚焦核心对话 + 管理后台数据接口。

---

## 1. 对话接口（核心）

### 1.1 文本对话（同步）

> **队友 A**：适合调试用，生产环境推荐用流式版本。  
> **队友 B**：非流式场景（如文字展示）可用此接口。

```
POST /chat
Content-Type: application/json
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `message` | string | ✅ | 游客问题 |
| `scenic_id` | string | ✅ | 景区 ID，见下方枚举 |
| `session_id` | string | | 会话 ID，用于区分用户，默认 `"anonymous"` |
| `history` | array | | 历史对话，格式见下，默认空 |
| `fast` | bool | | `true` 用 qwen-turbo（延迟减半，适合简单问答），默认 `false` |
| `lang` | string | | 回答语言，`auto`（跟随提问语言）或 `en`/`ja`/`ko`… 强制指定，默认 `auto`，详见 1.4 节 |
| `group_type` | string | | 同行关系，切换叙事人格，默认 `adult`，详见 1.5 节 |
| `stream` | bool | | 必须为 `false`（或不填），流式用 1.2 节 |

**景区 ID 枚举**

| `scenic_id` | 景区 |
|---|---|
| `lingshan` | 灵山胜境 |
| `nihuawan` | 拈花湾禅意小镇 |
| `xihu` | 杭州西湖 |
| `huangshan` | 安徽黄山 |
| `gugong` | 北京故宫博物院 |

**`history` 格式**（最近 N 轮，用于多轮对话）

```json
[
  {"role": "user",      "content": "灵山大佛有多高"},
  {"role": "assistant", "content": "灵山大佛高88米……"}
]
```

**请求示例**

```bash
curl -X POST {BASE}/rag/chat \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "user_001",
    "message": "灵山大佛有多高？",
    "scenic_id": "lingshan"
  }'
```

**响应体**

```json
{
  "reply": "灵山大佛通高88米，相当于30层楼那么高！它是世界最高的青铜坐佛……",
  "emotion": "excited",
  "sources": ["灵山胜境 景点结构化数据集"],
  "context_used": true,
  "intent": "qa",
  "from_cache": false
}
```

| 字段 | 说明 |
|---|---|
| `reply` | 干净的回复正文（已去除内部标记） |
| `emotion` | 情绪键，见[情绪枚举](#情绪-emotion-枚举) |
| `sources` | 命中的知识库文档名（用于调试） |
| `context_used` | 是否检索到相关知识库内容 |
| `intent` | 意图分派结果，见[意图枚举](#意图-intent-枚举)（Orchestrator 判定） |
| `from_cache` | 是否命中 LRU 缓存（<5ms 返回） |

---

### 1.2 文本对话（流式 SSE）

> **队友 A（重点）**：这是驱动数字人的主接口。  
> 第一个事件是 `intent`（意图，LLM 调用前即下发），紧接着 `emotion`（在 LLM 输出第一个字前下发），数字人可以**立刻**设置表情。  
> `sentence` 事件每完成一个自然句就下发一次，**收到即可送 TTS**，无需等待全文。

```
POST /chat
Content-Type: application/json
```

请求体与同步版本相同，**额外设置** `"stream": true`。

**响应格式**：SSE（Server-Sent Events），`Content-Type: text/event-stream`

事件流结构：

```
event: intent
data: {"type":"intent","value":"qa","label":"知识问答"}

event: emotion
data: {"type":"emotion","value":"excited"}

event: sentence
data: {"type":"sentence","text":"哇，灵山大佛可真是壮观呢！","index":0}

event: sentence
data: {"type":"sentence","text":"它通高88米，相当于30层楼那么高！","index":1}

event: sentence
data: {"type":"sentence","text":"是世界最高的青铜坐佛之一哦！","index":2}

event: end
data: {"type":"end","full_text":"[情绪:兴奋]\n\n哇，灵山大佛……"}
```

**事件类型说明**

| `event` | 数据字段 | 时机 | 用途 |
|---|---|---|---|
| `intent` | `value: string`，`label: string` | **最先到达**，LLM 调用前 | 展示当前意图（可选，可忽略） |
| `emotion` | `value: string` | LLM 输出第一个 token 后 | 设置数字人面部表情 |
| `sentence` | `text: string`，`index: number` | 每完成一个自然句 | 送 TTS 合成语音 |
| `end` | `full_text: string` | 全部完成 | 关闭连接，记录日志 |

> 事件顺序：**intent → emotion → sentence… → end**。`intent` 为新增事件，老客户端忽略即可，向后兼容。

**JavaScript 接入示例（队友 A / B 均适用）**

> ⚠️ 因为是 POST 请求，不能用浏览器原生的 `EventSource`，需要用 `fetch` + `ReadableStream`。

```javascript
async function chatStream(message, scenicId, sessionId, onEmotion, onSentence, onEnd) {
  const response = await fetch('{BASE}/rag/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message: message,
      scenic_id: scenicId,
      stream: true,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // 保留未完成的行

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (currentEvent === 'intent')   onIntent?.(data.label);    // 可选，展示当前意图
        if (currentEvent === 'emotion')  onEmotion(data.value);
        if (currentEvent === 'sentence') onSentence(data.text, data.index);
        if (currentEvent === 'end')      onEnd(data.full_text);
        currentEvent = '';
      }
    }
  }
}

// 使用示例
chatStream(
  '灵山大佛有多高？',
  'lingshan',
  'user_001',
  (emotion)        => setDigitalPersonExpression(emotion),  // 立刻设置表情
  (text, index)    => sendToTTS(text),                      // 逐句送 TTS
  (fullText)       => console.log('对话结束'),
);
```

**Python 接入示例（队友 A 后端集成）**

```python
import httpx, json

def stream_chat(message: str, scenic_id: str, session_id: str):
    with httpx.stream("POST", "{BASE}/rag/chat",
                      json={"message": message, "scenic_id": scenic_id,
                            "session_id": session_id, "stream": True}) as r:
        current_event = ""
        for line in r.iter_lines():
            if line.startswith("event: "):
                current_event = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
                if current_event == "emotion":
                    print(f"[情绪] {data['value']}")          # → 数字人表情
                elif current_event == "sentence":
                    print(f"[第{data['index']}句] {data['text']}")  # → TTS
                elif current_event == "end":
                    break
```

---

### 1.3 图片对话（多模态）

> 满足赛题"至少使用 1 个多模态大模型"的硬性要求。  
> 使用 `qwen-vl-max-latest` 模型，支持游客上传景点照片提问。

```
POST /chat/image
Content-Type: application/json
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `image_b64` | string | ✅ | 图片的 Base64 编码（不含 `data:image/...` 前缀） |
| `question` | string | | 对图片的提问，默认 `"请介绍一下图片里的内容"` |
| `scenic_id` | string | | 景区 ID，用于人格设定，默认 `"lingshan"` |
| `session_id` | string | | 会话 ID，默认 `"anonymous"` |
| `image_format` | string | | `jpeg` / `png` / `webp`，默认 `"jpeg"` |

**请求示例**

```bash
# 先把图片转 base64
IMAGE_B64=$(base64 -w 0 photo.jpg)

curl -X POST {BASE}/rag/chat/image \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"user_001\",
    \"scenic_id\": \"lingshan\",
    \"image_b64\": \"$IMAGE_B64\",
    \"question\": \"这是什么建筑？有什么历史？\"
  }"
```

**JavaScript 示例**

```javascript
async function chatWithImage(file, question, scenicId) {
  // File → Base64
  const base64 = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]); // 去掉 data:...前缀
    reader.readAsDataURL(file);
  });

  const resp = await fetch('{BASE}/rag/chat/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: 'user_001',
      scenic_id: scenicId,
      image_b64: base64,
      image_format: file.type.includes('png') ? 'png' : 'jpeg',
      question: question,
    }),
  });
  return await resp.json(); // { reply, emotion, model_used }
}
```

**响应体**

```json
{
  "reply": "这是灵山梵宫，是一座融合了多种宗教艺术风格的大型佛教文化建筑……",
  "emotion": "excited",
  "model_used": "qwen-vl-max-latest"
}
```

---

### 1.4 拍照打卡核验（闭集多模态）

> 「跟我游」地图路线的拍照打卡用。**不做开放识别**（易幻觉），而是给 VL 路线候选景点 + 各自标志性特征，
> 做**闭集核验**并强制结构化输出 evidence；可选 GPS（GCJ-02，与景点坐标同基准）做位置软门；
> 融合出决策 + 可信理由。准确率高、理由可复核。

```
POST /checkin
```

**请求体**

| 字段 | 类型 | 说明 |
|---|---|---|
| `scenic_id` | string | 景区 id（默认 lingshan） |
| `image_b64` | string | base64 图片（必填） |
| `image_format` | string | jpeg/png/webp（默认 jpeg） |
| `target_id` | string? | 游客想打卡的当前站 id |
| `candidates` | array | 路线候选站 `[{id,name,lng?,lat?}]`（坐标用于位置佐证） |
| `gps` | [number,number]? | `[lng,lat]` GCJ-02（AMap 定位）；不传则纯视觉+路线，演示/室内友好 |

**响应体**

```json
{
  "decision": "confirmed | wrong_stop | uncertain",
  "matched_id": "dafo",
  "matched_name": "灵山大佛",
  "confidence": 0.98,
  "evidence": ["巨大的青铜立佛，右手施无畏印、左手与愿印，立于莲花座之上"],
  "distance_m": null,
  "reason": "到啦，确认你在「灵山大佛」——我认出了……，打卡成功！",
  "alt_id": null
}
```

- `decision`：`confirmed`（命中目标站→直接打卡）/`wrong_stop`（认出的是别的站→建议调序）/`uncertain`（没把握→提示再拍）。
- `evidence`：VL 在照片里真实看到的具体特征（可人工复核、防编造）。
- 决策阈值：默认 0.7；有近距 GPS 佐证（≤120m）放宽到 0.6；GPS 近(≤80m)加信、远(≥300m)减信。

---

### 1.4 多语言问答

> 服务外籍游客。通过 `/chat`（同步或流式）的 `lang` 参数控制回答语言，接口其余字段不变。

**两种模式**

| `lang` 取值 | 行为 | 适用场景 |
|---|---|---|
| `auto`（默认） | 自动跟随游客提问的语言（英文问 → 英文答） | 外宾直接用母语提问 |
| `en` / `ja` / `ko` / `fr` / `de` / `es` / `ru` / `zh` | 无论提问语言，强制用指定语言回答 | 前端语言切换按钮 |

**请求示例**

```bash
# 英文提问，自动英文作答
curl -X POST {BASE}/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How tall is the Grand Buddha?","scenic_id":"lingshan"}'

# 中文提问，强制英文作答
curl -X POST {BASE}/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"灵山大佛多高","scenic_id":"lingshan","lang":"en"}'
```

> **队友 A 注意**：`emotion` 事件值始终是固定的英文键（`happy`/`excited`…），不随回答语言变化，数字人表情控制逻辑无需改动。

---

### 1.5 同行人格切换

> 情境感知能力：同一段讲解，讲给带娃家庭、老人、情侣方式截然不同。通过 `/chat` 的 `group_type` 参数切换叙事人格，接口其余字段不变。

**取值**

| `group_type` | 同行关系 | 叙事风格 |
|---|---|---|
| `adult`（默认） | 通用成人 | 标准热情导游 |
| `family_kids` | 亲子家庭 | 讲故事、互动提问（“小朋友猜猜看～”）、提示亲子设施 |
| `senior` | 老年长辈 | 放慢节奏、强调无障碍/休息点、避免推荐爬山久站 |
| `couple` | 情侣出游 | 浪漫视角、推荐合影机位与祈福点 |

**请求示例**

```bash
# 亲子家庭模式
curl -X POST {BASE}/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"灵山有什么好玩的","scenic_id":"lingshan","group_type":"family_kids"}'
```

> **队友 B**：可在游客端开场用一次性选择（"和谁一起来？"）设置 `group_type`，后续请求带上即可。
> `group_type` 与 `lang`、`fast`、`stream` 可任意组合。

---

## 2. 知识库管理

> **队友 B（管理后台用）**：用于上传新景区文档、查看知识库状态。

### 上传文档并入库

```
POST /kb/upload
Content-Type: multipart/form-data
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `scenic_id` | string（form） | 景区 ID |
| `files` | file[]（form） | 文档文件，支持 `.docx / .pdf / .txt / .md`，可同时上传多个 |
| `replace` | bool（form） | `true` 时先清空该景区知识库再入库，默认 `false` |

```bash
curl -X POST <BASE>/kb/upload \
  -F "scenic_id=lingshan" \
  -F "files=@灵山胜境指南.docx" \
  -F "files=@补充说明.pdf"
```

```json
{
  "scenic_id": "lingshan", "files": 2, "chunks_indexed": 45,
  "items": [
    {"filename": "灵山胜境指南.docx", "chunks": 38, "status": "indexed"},
    {"filename": "补充说明.pdf",       "chunks": 7,  "status": "indexed"}
  ]
}
```
> 每个文件按后缀分派解析（docx 解析段落+表格；pdf 用 pymupdf 抽文本层；txt/md 直读）。
> **无文本层的 PDF**（扫描件 / 字体轮廓化）抽不出文字 → 该文件 `status: "unsupported"`、`chunks: 0`（仍存档登记，但不入 RAG，需先转可复制文本的 PDF 或 OCR）。
> 每次上传会自动登记到 `GET /kb/docs`（真实文档列表，前端上传后即可刷新看到）。

### 查看所有知识库状态

```
GET /kb/list
```

```json
{
  "lingshan": 45,
  "nihuawan": 6,
  "xihu": 18,
  "huangshan": 19,
  "gugong": 20
}
```

### 删除知识库

```
DELETE /kb/{scenic_id}
```

```json
{ "deleted": "lingshan" }
```

### 知识库内容管理 🆕（FAQ / 文本段落逐条 CRUD，持久化 + 实时同步进 RAG）

> 与整文档 `/kb/upload` 互补：管理员手填的细粒度知识条目，**新增/编辑即时以稳定 id upsert 进
> 对应景区的向量库、删除即时移除**——游客问答立刻能检索到。数据落 SQLite（刷新不丢）。
> 经公网网关调用统一加 `/rag` 前缀（如 `…:8443/rag/kb/faq`）。

**FAQ**
```
GET    /kb/faq?scenic_id=lingshan        列出（scenic_id 可省=全部）
POST   /kb/faq                            新增  body: {scenic_id, question, answer, category?}
PUT    /kb/faq/{id}                       编辑  body 同上
DELETE /kb/faq/{id}                       删除
```
新增/编辑返回 `{"id":N,"synced":true}`（synced=已写入 RAG）；列表项含 `id/scenic_id/question/answer/category/created_at/updated_at`。

**文本段落**（字段 `title/content/category`，其余同 FAQ）
```
GET /kb/text?scenic_id=   POST /kb/text   PUT /kb/text/{id}   DELETE /kb/text/{id}
```

**已上传文档列表**（真实记录，替代假文件名）
```
GET    /kb/docs?scenic_id=lingshan        列出 {filename,size_bytes,chunks,status,created_at}
DELETE /kb/docs/{id}                       移除一条列表登记
```
> `/kb/upload` 现在每次上传成功会自动登记到此列表（前端文档列表从 `/kb/docs` 查即可，上传后自动更新）。

---

## 3. 数据分析（管理后台用）

> **队友 B（数据大屏用）**：所有接口均为 `GET`，支持按景区和时间段筛选。

### 3.1 数据大屏核心数据

```
GET /analytics/dashboard?scenic_id=lingshan&days=7
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `scenic_id` | 景区 ID | `lingshan` |
| `days` | 近 N 天 | `7` |

```json
{
  "scenic_id": "lingshan",
  "period_days": 7,
  "total_conversations": 128,
  "total_sessions": 43,
  "satisfaction_rate": 0.875,
  "context_hit_rate": 0.921,
  "emotion_distribution": {
    "happy": 62, "excited": 50, "neutral": 10, "curious": 4, "apologetic": 2
  },
  "daily_stats": [
    {"date": "2026-05-17", "conversations": 18, "sessions": 6},
    {"date": "2026-05-18", "conversations": 22, "sessions": 8}
  ]
}
```

### 3.2 游客热门话题（词云数据）

```
GET /analytics/hot-topics?scenic_id=lingshan&days=7&limit=10
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `limit` | 返回词数量 | `10` |

```json
{
  "topics": ["灵山大佛", "九龙灌浴", "门票", "梵宫", "拈花湾", "开放时间", "大佛高度"]
}
```

### 3.3 满意度趋势

```
GET /analytics/sentiment-trend?scenic_id=lingshan&days=30
```

```json
{
  "overall_satisfaction": 0.875,
  "trend": [
    {
      "date": "2026-05-01",
      "total": 15,
      "happy_ratio": 0.867,
      "emotion_counts": {"happy": 8, "excited": 5, "neutral": 2}
    }
  ]
}
```

### 3.4 历史对话列表（分页）

```
GET /analytics/conversations?scenic_id=lingshan&days=7&limit=20&offset=0
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `scenic_id` | 景区筛选（可选） | 全部 |
| `session_id` | 会话筛选（可选） | 全部 |
| `days` | 近 N 天 | `7` |
| `limit` | 每页条数 | `50` |
| `offset` | 偏移量（分页用） | `0` |

```json
{
  "total": 128,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "id": 1,
      "session_id": "user_001",
      "scenic_id": "lingshan",
      "user_message": "灵山大佛有多高？",
      "ai_reply": "灵山大佛通高88米……",
      "emotion": "excited",
      "context_used": 1,
      "created_at": "2026-05-23 14:32:11"
    }
  ]
}
```

### 3.5 生成游客感受度报告（消耗 LLM API，按需调用）

```
POST /analytics/report
Content-Type: application/json
```

```json
{ "scenic_id": "lingshan", "days": 7 }
```

```json
{
  "scenic_id": "lingshan",
  "period_days": 7,
  "report": "## 游客感受度报告\n\n**总体满意度**：本期满意度较高，约87.5%……\n\n**游客最关注话题**：\n1. 灵山大佛高度与规模\n2. 九龙灌浴表演时间……"
}
```

### 3.6 知识盲区（知识库自进化闭环）

> 找出游客问过、但知识库答不上来的问题（`context_used=0`），按频次排序，
> 指导管理员针对性补充文档。`cluster=true` 时调 LLM 把盲区归纳成主题并给出补充建议。

```
GET /analytics/knowledge-gaps?scenic_id=lingshan&days=30&limit=20&cluster=false
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `scenic_id` | 景区 ID | `lingshan` |
| `days` | 近 N 天 | `30` |
| `limit` | 返回盲区条数 | `20` |
| `cluster` | `true` 时额外调 LLM 归纳主题+建议（消耗 API） | `false` |

```json
{
  "scenic_id": "lingshan",
  "period_days": 30,
  "total_conversations": 128,
  "total_unanswered": 9,
  "unanswered_rate": 0.07,
  "gaps": [
    {"question": "灵山有充电宝租借吗", "count": 3, "last_asked": "2026-05-24 11:49:35"},
    {"question": "景区内能带宠物吗", "count": 1, "last_asked": "2026-05-24 10:12:00"}
  ],
  "suggestions": "（仅 cluster=true 时返回）## 1. 便民服务\n建议补充充电宝租借点位置..."
}
```

### 3.7 实时负面情绪预警

> 在时间窗口内聚合负面情绪（`empathetic`/`apologetic`），负面数 ≥ `threshold`
> 且占比 ≥ `min_rate` 时触发告警，附负面对话样本，供管理方实时定位投诉热点。

```
GET /analytics/alerts?scenic_id=lingshan&window_hours=24&threshold=3&min_rate=0.3
```

| 参数 | 说明 | 默认 |
|---|---|---|
| `scenic_id` | 景区 ID，**留空则扫描全部景区** | 全部 |
| `window_hours` | 统计时间窗口（小时） | `24` |
| `threshold` | 触发告警所需最少负面对话数 | `3` |
| `min_rate` | 触发告警所需最低负面占比 | `0.3` |

```json
{
  "scenic_id": "all",
  "window_hours": 24,
  "alert_triggered": false,
  "total_in_window": 37,
  "negative_count": 4,
  "negative_rate": 0.108,
  "threshold": 3,
  "min_rate": 0.3,
  "negative_by_scenic": {"nihuawan": 3, "lingshan": 1},
  "samples": [
    {"scenic_id": "lingshan", "question": "排队太久了", "emotion": "apologetic", "asked_at": "2026-05-24 12:02:43"}
  ]
}
```

---

### 3.8 客流热度感知

> 用真实游客行为数据（14 万行）算热门度 + 季节性，叠时段模型 → 拥挤档位 + 旺淡季 + 错峰时段。
> 供数据大屏「客流分布」、游客端地图 **POI 级拥挤热力**、与导游错峰建议。
>
> **`granularity` 两档**：`lingshan` 返回 **POI 级**（7 个点位，含演出聚集/天气耦合/趋势）；
> 其余景区返回**景点级**（来自行为数据，黄山/故宫不在数据中 → `has_data:false`、`attractions:[]`）。
> 真实性来源：热门度/季节性=真实行为数据；九龙灌浴/梵宫演出=景区公示场次（人群随场次聚集）；
> 天气=实时查询；分钟级拥挤=时段模型估计（`note` 已如实标注）。**同一点会随时间/天气/演出临近自然变化**，前端可定时轮询（建议 30~60s）。

```
GET /analytics/crowd?scenic_id=lingshan
```

```json
{
  "scenic_id": "lingshan", "has_data": true, "granularity": "poi",
  "season": "旅游旺季", "quiet_hours": "清晨 8 点前或傍晚 17 点后",
  "as_of": "2026-06-19 14:30",
  "next_show": {"poi": "九龙灌浴", "at": "15:00", "minutes": 30},
  "attractions": [
    {
      "poi_id": "jiulong", "attraction": "九龙灌浴", "name": "九龙灌浴",
      "lng": 120.099984, "lat": 31.424601, "indoor": false,
      "crowd_level": "较多", "crowd_index": 1.18, "trend": "上升",
      "popularity": 0.92, "in_show": false,
      "next_show": "15:00", "minutes_to_show": 30,
      "hint": "15:00 有演出，人群正在聚集，想看建议提前到、避堵可错峰",
      "factors": {"base": 0.92, "season": 1.11, "hour": 0.94, "weather": 1.0, "show": 0.0, "gate": 0.0}
    }
  ]
}
```

> 字段：`crowd_level` 空闲/适中/较多/繁忙（前端可映射绿/黄/橙/红）；`trend` 上升/平稳/下降（画箭头）；
> `next_show`/`minutes_to_show` 仅演出点位有；`hint` 一句可直接展示的错峰建议；`factors` 透明化各因子供调试。
> `attraction`==`name` 为兼容旧消费方保留。非 lingshan 的景点级条目仍是旧字段（`month_factor`/`satisfaction` 等）。

---

### 3.9 游客行为事件上报 🆕

> **数据采集「主动上报」半边**：游客端把服务端从对话里看不到的信号（画像/功能/到访/满意度）
> POST 上来，落 `events` 表。**管理端无需调用**，由游客端自动埋点；列此仅供备查。
> 详见 [`docs/数据采集与管理端对接.md`](docs/数据采集与管理端对接.md)。

```
POST /analytics/event
Content-Type: application/json
```

```jsonc
{
  "session_id": "s_ab12cd",          // 客户端独立会话 id（非 RTMP 的 sessionid）
  "scenic_id": "lingshan",
  "type": "session_start",            // 见下表
  "group_type": "family_kids",        // 仅 session_start 带
  "lang": "zh",                        // 仅 session_start 带
  "payload": { "interests": ["history"], "device": "ios" }
}
```

| `type` | 触发时机 | `payload` |
|---|---|---|
| `session_start` | 进入导览 | `{interests:[], device}` |
| `feature_open` | 打开功能 | `{feature}` ∈ tour/gps/facility/trace/photo/voice/postcard |
| `station_visit` | 听某站讲解 | `{name, via}` ∈ tour/gps |
| `photo_locate` | 拍照定位成功 | `{location}` |
| `milestone` | 走完路线/生成明信片 | `{kind}` ∈ route/postcard |
| `session_end` | 退出（sendBeacon） | `{duration_s, asks, photos, visited}` |
| `rating` | 满意度评分 | `{score:1-5, comment?}` |

返回：`{"ok": true}`（容错落库，永不抛错给前端）。

---

### 3.10 客群画像 🆕

> 同行类型 / 语言 / 兴趣 分布，来自 `session_start` 事件。供数据大屏「客群画像」。

```
GET /analytics/profile?scenic_id=lingshan&days=7
```

```json
{
  "scenic_id": "lingshan", "period_days": 7,
  "total_visitors": 36,
  "group_type": {"family_kids": 12, "couple": 9, "adult": 11, "senior": 4},
  "lang": {"zh": 30, "en": 4, "ja": 2},
  "interests": {"history": 18, "nature": 12, "photo": 9, "food": 7, "culture": 6}
}
```

枚举：`group_type` ∈ adult/family_kids/senior/couple；`lang` ∈ zh/en/ja/ko；
`interests` ∈ history/nature/photo/food/culture。

---

### 3.11 功能使用率与满意度 🆕

> 各功能打开次数 + 满意度均分 + 活跃会话数，来自 `feature_open` / `rating` 事件。
> 供数据大屏「功能使用率」「满意度」面板。

```
GET /analytics/feature-usage?scenic_id=lingshan&days=7
```

```json
{
  "scenic_id": "lingshan", "period_days": 7,
  "active_sessions": 36,
  "feature_open": {"tour": 20, "voice": 15, "photo": 12, "gps": 8, "facility": 7, "trace": 6, "postcard": 4},
  "rating_count": 18, "avg_rating": 4.5
}
```

`avg_rating` 无评分时为 `null`。

---

### 3.12 文旅 BI 分析（人口/消费/景点画像）🆕

> **队友 B（数据大屏用）**：与 3.1–3.11 的会话类分析互补——本组数据源为**游客行为数据库**
> （赛题 `景点景区旅游数据行为分析数据.xlsx` + 8 景区合成补充样本，共 ~16 万行），挖**人口画像、
> 消费结构、景点热度、满意度**等传统文旅 BI 指标。全部 `GET`、CORS 全开、可直接 `fetch`。
> 数值已聚合好，前端 ECharts 直接喂。
>
> 通用参数 `scenic_id`：8 个之一（`lingshan/nihuawan/xihu/huangshan/gugong/zhangjiajie/bingmayong/mogaoku`）
> 或 `all`（全景区汇总）。未知 id 优雅降级（`visitors:0` / 空数组）。先调 `/scenics` 拿可选项。

**① 可选景区清单**（前端下拉用）
```
GET /analytics/bi/scenics                 默认列出数据集全部景点（赛题 xlsx 全部 + 我方 8 个，共 ~159）
GET /analytics/bi/scenics?managed_only=true   只列我方接入的 8 个景区
```
```json
{"count": 159, "scenics": [
  {"scenic_id": "lingshan", "name": "灵山胜境", "samples": 2736, "managed": true},
  {"scenic_id": "同里古镇", "name": "同里古镇", "samples": 5476, "managed": false}
]}
```
> `scenic_id` 既接受我方 8 个 id（`lingshan`…），也直接接受 xlsx 里的景点名（如 `同里古镇`，URL 编码即可）。
> 所以 `/scenics` 返回的任一 `scenic_id` 拿去查 `overview/spending/demographics` 都通——**赛题表格里所有景区的数据都可访问**。

> **时间范围**：`overview`/`spending`/`demographics` 均支持可选 `days`（`1`=今日 / `7`=本周 / `30`=本月，
> 相对数据集最新日期；缺省或 `0`=全部）。例：`/analytics/bi/overview?scenic_id=lingshan&days=7`。

**② 核心 KPI 概览**（顶部数字卡）
```
GET /analytics/bi/overview?scenic_id=lingshan&days=7
```
```json
{
  "scenic_id": "lingshan", "visitors": 2736,
  "avg_spend_per_capita": 1151.5,   // 客单价（元）
  "total_revenue": 3150436.0,        // 总营收（元）
  "avg_satisfaction": 4.24,          // 平均满意度（1-5）
  "avg_stay_hours": 4.5,             // 平均停留（小时）
  "avg_group_size": 2.7              // 人均同行规模
}
```

**③ 消费结构**（饼图 structure + 客单价分布直方 histogram）
```
GET /analytics/bi/spending?scenic_id=lingshan
```
```json
{
  "scenic_id": "lingshan", "avg_total": 1151.5,
  "structure": [
    {"category": "门票", "avg": 537.1, "ratio": 0.466},
    {"category": "餐饮", "avg": 157.0, "ratio": 0.136},
    {"category": "购物", "avg": 259.8, "ratio": 0.226},
    {"category": "交通", "avg": 92.0,  "ratio": 0.08},
    {"category": "娱乐", "avg": 105.7, "ratio": 0.092}
  ],
  "histogram": [{"range": "<500", "count": 214}, {"range": "500-1000", "count": 1048}, ...]
}
```

**④ 人口画像**（年龄段/性别/同行规模，柱状/饼图）
```
GET /analytics/bi/demographics?scenic_id=lingshan
```
```json
{
  "scenic_id": "lingshan",
  "age": [{"range": "<18", "count": 208}, {"range": "18-25", "count": 402}, ...],   // 7 段
  "gender": [{"gender": "女", "count": 1498}, {"gender": "男", "count": 1238}],
  "group_size": [{"size": 1, "count": 507}, {"size": 2, "count": 938}, ...]
}
```

**⑤ 景点热度排名 + 类型分布**（横向条形 ranking + 类型饼图 by_type）
```
GET /analytics/bi/attractions?limit=10&managed_only=false
```
- `managed_only=true`：仅统计本产品接入的 8 景区（名称可辨识，**演示推荐用**）；
  `false`（默认）：数据集全域景点视图。
```json
{
  "ranking": [
    {"attraction": "灵山胜境", "visitors": 2736, "avg_spend": 1151.5, "avg_satisfaction": 4.24, "avg_stay": 4.5},
    ...
  ],
  "by_type": [{"type": "自然山岳", "count": 5000}, {"type": "宗教文化", "count": 2500}, ...]
}
```

### 3.13 话题意图分类 🆕（替代 hot-topics 的 n-gram 碎片）

> `/analytics/hot-topics` 返回的是 2-4 字 n-gram 词频（"灵山/山大/大佛"碎片），适合词云但不是有意义的话题。
> 本接口用 LLM 把游客提问归入语义类别并计数，结果**缓存 10 分钟**（首次调用约 1-2s，之后秒回）。

```
GET /analytics/topic-intents?scenic_id=lingshan&days=30&limit=8
```
```json
{
  "scenic_id": "lingshan", "period_days": 30, "sample_size": 120,
  "topics": [
    {"intent": "景点介绍", "count": 72},
    {"intent": "路线推荐", "count": 9},
    {"intent": "票价咨询", "count": 3},
    {"intent": "交通方式", "count": 2}
  ],
  "cached": false
}
```
类别取自固定集合：景点介绍/票价咨询/交通方式/开放时间/餐饮推荐/路线推荐/设施服务/住宿预订/其他。
无会话数据时 `topics:[]`（前端可降级用 `/analytics/hot-topics` 词云）。

---

## 4. 数字人形象配置（管理端默认 ↔ 游客端精调，两端互通）

> **互通数据流**：
> ```
> 管理端(队友B)                    后端                          游客端
>   PUT /digital-human/config ──▶ digital_human_config 表
>   (配景区默认形象+音色)              │
>                                    ├─◀─ GET /config?scenic_id ── 进场取景区默认
>                                    └─◀─ GET /presets ─────────── 取形象/音色目录(画 gallery)
>                                                                  游客精调存 localStorage：
>                                                                  · 音色 → 每条 /live/ask|say 带
>                                                                    voice_id，消息级**即时生效**
>                                                                  · 形象 → 存偏好，「下次唤醒数字
>                                                                    人时换上」(进程级约束)
> ```
> 形象/音色 ID 由桥接层 AVATAR_MAP/VOICE_MAP 翻译成真实 Ditto avatar / Qwen-TTS 音色，接口契约稳定。
> **场景背景**（`background_id`）：按景区配一张默认背景，离线烘进 Ditto 源肖像（变体
> `<avatar>_bg_<bg_id>.png`），运行时零开销；桥接解析变体、缺失自动回落原图。详见 4.6。

### 4.1 获取可选形象与音色列表

```
GET /digital-human/presets
```

> **形象库分类法**（对标 HeyGen/Synthesia/讯飞的 faceted 多维标签，裁剪适配景区导览）：
> 主轴 `style`（前端顶部 tab：推荐由 `recommended` 派生 + 现代/古风/民族）+ 副筛 `gender`，
> 每卡片再打 `persona`(气质人设) / `outfit`(服饰) / `age`(年龄段) / `fit`(适配景区) 标签——管理端/游客按习惯浏览选对。

```jsonc
{
  "avatars": [
    {"id": "female_sweet", "name": "亲和讲解员", "gender": "female", "style": "现代",
     "persona": "亲切热忱", "outfit": "浅色活力装", "age": "青年", "fit": "现代/都市景区",
     "preview": "/avatars/female_sweet.jpg", "recommended": true},
    {"id": "female_guofeng", "name": "古典讲解员", "gender": "female", "style": "古风",
     "persona": "知性温雅", "outfit": "汉服襦裙", "age": "青年", "fit": "古镇·禅意",
     "preview": "/avatars/female_guofeng.jpg", "recommended": true},
    {"id": "male_casual", "name": "阳光讲解员", "gender": "male", "style": "现代",
     "persona": "亲切热情", "outfit": "休闲装", "age": "青年", "fit": "现代/都市景区",
     "preview": "/avatars/male_casual.jpg", "recommended": true},
    // AI 换装系列（InstantID 锁脸换装，烘录后上架；管理端不可设为默认）。name=服饰名
    {"id": "outfit_qipao", "name": "旗袍", "gender": "female", "style": "古风",
     "persona": "典雅端方", "outfit": "旗袍", "age": "青年", "fit": "古镇·民国街区",
     "preview": "/avatars/outfit_qipao.jpg", "coming_soon": true},
    // …共 6 款换装(旗袍/汉服/职业正装/民族服饰/导览马甲/冬季大衣) + 1 款 female_mature(中年)，coming_soon=true；另有 legacy:true 旧 id（UI 隐藏）
    // 身份库命名统一为「[特征]+讲解员」职务称谓（F1 知性/F2 汉服/F3 活力/F4 旗袍/F5 民族/F6 资深/M1 儒雅/M2 文士/M3 青年/M4 商务）
  ],
  "voices": [
    {"id": "voice_gentle_f", "name": "知性温柔", "gender": "female", "tone": "知性、从容（默认）"},
    {"id": "voice_lively_f", "name": "活泼亲和", "gender": "female", "tone": "明快、亲和"},
    {"id": "voice_wu_f",     "name": "吴侬软语", "gender": "female", "tone": "吴语方言、软糯（江南景区特色）"},
    {"id": "voice_calm_m",   "name": "沉稳大气", "gender": "male",   "tone": "低沉、可靠"},
    {"id": "voice_bright_m", "name": "京腔青年", "gender": "male",   "tone": "北京话、爽朗"}
  ],
  "backgrounds": [
    {"id": "",            "name": "极简灰底（原始）", "scenic": null,       "preview": null},
    {"id": "bg_lingshan", "name": "灵山·禅意佛境",   "scenic": "lingshan", "preview": "/avatar_backgrounds/bg_lingshan.jpg"},
    // …共 8 景区预设；管理端上传的自定义背景（source:"upload"）合成完(status:"ready")后也出现在此
  ]
}
```

形象字段：`style`(现代/古风/民族，**风格主轴 tab**) · `gender`(female/male，**副筛**) ·
`persona`(气质人设：活力向导/知性讲解/沉稳儒雅/亲切热情) · `outfit`(服饰) · `age`(青年/中年/长者) ·
`fit`(适配景区提示) · `preview`(预览图) · `recommended`(进"推荐"tab) · `coming_soon`(仅预览不可选) · `legacy`(旧 id 隐藏) ·
`ready`(**该形象在 ditto_avatars/ 是否真有底板**——文件系统真值，无底板者强制 `coming_soon`，杜绝"列了却没烘→选了静默回落")。
> 当前 `ready:true` = 10 身份库(F1–F6/M1–M4，各配 8 景区 × 16:9/9:16) + female_sweet + 6 同脸换装(outfit_*) = 17 个，
> 均可经 4.7 `POST /live/avatar` 直播热切。`female_guofeng`/`male_casual`(无 ditto 底板) 自动 `coming_soon`。
音色字段：`gender` + `tone`(音色描述)。

### 4.2 获取某景区配置

```
GET /digital-human/config?scenic_id=lingshan
```

未单独配置时回落到 `default`；`default` 也未配置时返回内置默认值（带 `"fallback": true`）。

```json
{
  "scenic_id": "lingshan",
  "avatar_id": "female_sweet",
  "avatar_name": "亲和讲解员",
  "voice_id": "voice_gentle_f",
  "voice_name": "知性温柔",
  "background_id": "bg_lingshan",
  "background_name": "灵山·禅意佛境",
  "updated_at": "2026-06-12 23:03:12"
}
```

### 4.3 保存/更新配置

```
PUT /digital-human/config
Content-Type: application/json
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scenic_id` | string | ✅ | 景区 ID，`default` 表示全局默认 |
| `avatar_id` | string | ✅ | 形象 ID，须来自 presets |
| `avatar_name` | string | ✅ | 形象显示名 |
| `voice_id` | string | ✅ | 音色 ID，须来自 presets |
| `voice_name` | string | ✅ | 音色显示名 |
| `background_id` | string | 可选 | 场景背景 ID，须来自 presets.backgrounds 或已 ready 的上传背景；省略/空 = 原始灰底 |
| `background_name` | string | 可选 | 背景显示名 |

```bash
curl -X PUT {BASE}/rag/digital-human/config \
  -H "Content-Type: application/json" \
  -d '{"scenic_id":"lingshan","avatar_id":"female_sweet","avatar_name":"亲和讲解员","voice_id":"voice_gentle_f","voice_name":"知性温柔","background_id":"bg_lingshan","background_name":"灵山·禅意佛境"}'
```

```json
{ "ok": true, "scenic_id": "lingshan" }
```

> 提示：可为每个景区配置不同形象+音色（灵山禅意女声、故宫古风男声），切换景区时一并切换形象，体现「插拔式」设计。

### 4.4 获取全部景区配置

```
GET /digital-human/config/all
```

返回已配置的所有景区快照数组，用于管理后台列表页。

### 4.5 游客端音色精调（桥接层，消息级即时生效）

> 游客在「数字人形象」面板选音色后，前端在每条驱动请求里带 `voice_id`，**覆盖**管理端景区默认：

```jsonc
POST {BASE}/live/ask   // 或 /live/say
{ "sessionid": "0", "message": "…", "scenic_id": "lingshan",
  "voice_id": "voice_wu_f" }    // 可选；省略 = 跟随管理端景区默认
```

桥接按 VOICE_MAP 译成 `tts.ref_file`（如 voice_wu_f→Jada），qwentts 检测到音色变化自动重连——**下一句话就换声**。
形象（外观/服饰）有两种生效方式：**即时热切**见 4.7 `POST /live/avatar`（直播当场换、不断流，推荐）；
或存为偏好走连接级（`GET /live/avatar` 解析 → /offer），下次唤醒生效。

### 4.6 场景背景（按景区自动 · 下次连接生效）

> 数字人身后不再是空白灰底——每景区配一张场景背景（灵山雾山佛光 / 西湖烟雨 / 故宫秋色…）。
> **原理**：Ditto"驱动原图"，输出帧背景 = 源肖像背景 → 背景离线烘进源图（抠像+景深虚化+色调对齐
> 合成，`scripts/gen_avatar_background.py`），**运行时零开销**，实测说话/头动时背景稳定。

**数据流**：

```
管理端 PUT /config 带 background_id ──▶ digital_human_config 表
                                          │
桥接 /live/avatar、scripts/resolve_avatar.py
   读配置 → 变体 <avatar>_bg_<bg_id>.png 存在 → 用变体；缺失 → 回落原图
   LiveTalking 启动: --avatar_id $(resolve_avatar.py --scenic <id>)   ← 下次连接生效
```

**自定义背景上传**（拉取式：后端可在 ECS，合成必须在本地 GPU 机执行）：

| 端点 | 说明 |
|---|---|
| `POST /digital-human/background/upload` | multipart：`file`(png/jpg ≤20MB) + `name` + `scenic_id`(可选)。登记为 `pending` |
| `GET /digital-human/background/pending` | 本地合成脚本轮询待办 |
| `GET /digital-human/background/file/{bg_id}` | 本地脚本下载原图 |
| `POST /digital-human/background/{bg_id}/ready` | 合成完成回调；之后才可被 PUT /config 引用 |

本地闭环命令：`scripts/gen_avatar_background.py sync --backend {BASE}/rag`
（拉 pending → 下载 → 抠像合成 → 回调 ready）。

`GET {BASE}/live/avatar?scenic_id=lingshan` 响应已带 `background_id` 字段（前端展示/排障）。

### 4.7 热拔插切换形象（直播不断流）🆕

> 选一下形象/换装，**正在直播的数字人当场换人/换装（~1s），不重连、不断流**——区别于 4.5「下次唤醒生效」的进程级约束。
> **原理**：Ditto 把"身份"存成逐帧 numpy 列表（appearance/motion/putback），不绑 TRT 引擎状态；引擎
> `set_source()` 重跑源注册后**原子替换**该列表（仿 `set_emotion` 热切），LiveTalking `/set_avatar` 路由触发。

```
POST {BASE}/live/avatar
Content-Type: application/json
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `avatar_id` | string | ✅ | 形象 ID（presets 里 `ready:true` 的，如 `F2_hanfu`/`outfit_qipao`/`female_sweet`） |
| `scenic_id` | string | 可选 | 景区（默认 lingshan）；决定取哪张带景底板 |
| `sessionid` | string | 可选 | 直播会话 ID（webapp 常量 `"0"`） |
| `screen` | string | 可选 | `main`=手机 16:9(8010) / `portrait`=大屏 9:16(8011) |

桥接按「形象 × 景区 × 屏幕比例」解析到真实底板（身份库 `<id>__<scenic>__<aspect>` 或 sweet 传统
`<base>_bg_<scenic>`），存在性校验 + 缺失优雅回落，再调 LiveTalking `/set_avatar` 原子热切。

```bash
curl -X POST {BASE}/live/avatar -H "Content-Type: application/json" \
  -d '{"avatar_id":"outfit_qipao","scenic_id":"lingshan","sessionid":"0","screen":"main"}'
```

```json
{ "ok": true, "avatar_id": "outfit_qipao",
  "resolved": "sweet_outfit_qipao__lingshan__16x9", "screen": "main",
  "detail": {"code":0,"msg":"ok","data":{"avatar_id":"sweet_outfit_qipao__lingshan__16x9","switched":true}} }
```

> **前端接法**（游客端形象库「试穿/换装」、管理端「形象配置」即时预览）：选 `ready:true` 形象 →
> `POST /live/avatar` → 直播热切。要持久化为景区默认，另调 `PUT /digital-human/config`（两者互补、互不耦合）。
> ⚠️ 底板须与当前流分辨率一致（16:9=1280×720 / 9:16=720×1280）——桥接已按 `screen` 自动取对应比例底板，前端只传 `screen`。

---

## 5. 景区主题（管理端可配置换肤）

> 每个景区一套品牌色（`primary` 主色 + `sweet` 暖点缀，OKLCH 字符串）。游客端切景区时拉
> `GET /scenic/theme` 把颜色套到 CSS 变量 → **整 App 随景区换肤**（灵山禅金 / 西湖湖青 / 故宫朱红…）。
> **管理端**可 `PUT /scenic/theme` 覆盖默认色、`GET /scenic/themes` 取全部做配色面板。
> 深色模式由游客端本地切换（浅色/深色/跟随系统），与景区主题正交叠加，无需后端。

### 5.1 获取某景区主题

```
GET /scenic/theme?scenic_id=gugong
```
```json
{"scenic_id": "gugong", "name": "故宫·朱红",
 "primary": "oklch(0.55 0.19 28)", "sweet": "oklch(0.78 0.14 82)",
 "primary_hex": "#b0392f", "sweet_hex": "#e0a84e", "guide_name": "瑾瑜"}
```
> **两种颜色格式都给** 🆕：`primary`/`sweet` 是 OKLCH（游客端 webapp 直接喂 CSS 变量）；
> `primary_hex`/`sweet_hex` 是同色的 Hex（**管理端色板直接用，无需自己做 OKLCH↔Hex 转换**）。
>
> `guide_name` = 该景区数字人导游名（游客端 UI 文案动态化用，如「瑾瑜正在思考」）；未知景区回落中立主题「智游·导览」+「小导」。

### 5.2 获取全部景区主题（管理端列表/配色面板）

```
GET /scenic/themes
```
```json
{"themes": [
  {"scenic_id": "lingshan", "name": "灵山·禅金", "primary": "oklch(0.575 0.2 268)", "sweet": "oklch(0.77 0.13 70)"},
  {"scenic_id": "gugong",  "name": "故宫·朱红", "primary": "oklch(0.55 0.19 28)",  "sweet": "oklch(0.78 0.14 82)"}
]}
```

### 5.3 覆盖某景区主题（管理端配置）

> 部分字段更新：只传想改的字段，未传的保留原值。**颜色传 Hex 或 OKLCH 都行**（自动识别），
> 也可用 `primary_hex`/`sweet_hex` 字段直传 Hex。内部统一规范成 OKLCH 落库。

```
PUT /scenic/theme
Content-Type: application/json
```
```jsonc
{ "scenic_id": "lingshan", "primary_hex": "#7c5cff", "sweet_hex": "#e0a86b" }  // 管理端色板直传 Hex
// 或 { "scenic_id": "lingshan", "primary": "oklch(0.6 0.18 30)" }              // OKLCH 也行
```
返回合并后的完整主题（同 5.1 结构，含 `primary_hex`/`sweet_hex`）。前端拿到即可实时套用。

---

## 6. 数字人直播与驱动（桥接层）🆕

> 桥接层 `:6006`（公网网关 `https://<autodl>:8443`）同时提供**两路独立数字人**，互不干扰：
>
> | 屏幕 | 比例 | 用途 | `screen` 取值 |
> |---|---|---|---|
> | 手机端 | 16:9（1280×720） | 游客端手机网页 / APK | `main`（默认） |
> | **大屏竖版** | **9:16（720×1280）** | 游客端大屏立屏 web | `portrait` |
>
> 两路共用同一套 RAG 知识库与 8 景区，问答内容一致；通过 `screen` 字段路由到对应的 LiveTalking 实例。

### 6.1 拉取数字人直播画面

| 用途 | 手机端 16:9 | 大屏竖版 9:16 |
|---|---|---|
| FLV（低延迟，安卓/桌面/Chrome） | `GET /stream.flv` | `GET /stream_portrait.flv` |
| HLS（iOS Safari） | `GET /hls/livestream.m3u8` | `GET /hls/livestream2.m3u8` |

均为同源、CORS 全开，前端 `<video>`（HLS）或 mpegts.js（FLV）直接播。

### 6.2 驱动数字人答问（游客提问 → 数字人开口）

```
POST /live/ask
Content-Type: application/json
```
| 字段 | 类型 | 说明 |
|---|---|---|
| `message` | string | 游客问题 |
| `scenic_id` | string | 8 景区之一，默认 `lingshan` |
| `sessionid` | string | LiveTalking 会话 ID，固定 `"0"` |
| `screen` | string | `main`(手机端 16:9，默认) / `portrait`(大屏竖版 9:16) 🆕 |
| `group_type` | string | `adult`/`family_kids`/`senior`/`couple`，默认 `adult` |
| `lang` | string | `auto`/`zh`/`en`/… 默认 `auto` |
| `voice_id` | string? | 精调音色（覆盖景区默认） |

```jsonc
// 大屏竖版驱动示例
{ "message": "灵山有什么好玩的", "scenic_id": "lingshan", "sessionid": "0", "screen": "portrait" }
```
```json
{
  "ok": true, "reply": "...", "emotion": "happy", "intent": "qa",
  "sentence_count": 3, "drive_failures": 0, "mode": "avatar", "degraded": false
}
```
返回后数字人随即逐句开口（首句 ~1-2s）。`mode:"avatar"` = 正常驱动；`mode:"text"` = 容量满降级为纯文字（答案照出）。
响应另含 `first_sentence_ms`（首句送达耗时 ≈ 数字人开口时刻）。⚠️ JSON 端点要等**整段答案生成完**才返回——长答案(如"讲个故事")会到 6-9s；这是生成总时长，**不是开口延迟**。要"字幕随说话逐字吐 / 拿真实开口延迟"用下面的 SSE 流式版。

#### 6.2.1 字幕流式版 `POST /live/ask_stream`（卡拉OK式同步字幕，🆕 2026-06-18）

同 `/live/ask`（请求体字段完全一致），但以 **SSE** 把字幕逐句下发——每把一句送数字人开口就立即下发该句，让前端字幕与数字人说话**同步流式吐字**。响应 `Content-Type: text/event-stream`，每个 `data:` 一行一个 JSON 事件：

| `type` | 字段 | 时机/说明 |
|---|---|---|
| `open` | `drive_enabled`(bool), `voice`(str) | 最先到：本轮是否真开口（决定字幕节奏） |
| `sentence` | `text`, `index`, `emotion` | 每句送数字人开口时下发（前端据此按说话速率逐字吐） |
| `done` | 同 `/live/ask` 完整响应 dict（`reply`/`mode`/`degraded`/`intent`/`emotion`/`first_sentence_ms`…） | 收尾 |
| `error` | `detail`, `status` | 出错 |

前端用法：累积 `sentence.text` 成完整答案，按说话速率(~5 字/秒)推进字符游标显示；首句到达 ≈ 数字人开口时刻（诚实延迟口径，~2-4s），而非整段生成。L1 命中(`mode:clip`)直接 `done` 带 `clip_url`，无 `sentence`。

### 6.3 让数字人说指定文字（迎宾/公告，不走问答）

```
POST /live/say
{ "text": "欢迎来到灵山胜境", "scenic_id": "lingshan", "sessionid": "0", "screen": "portrait", "emotion": "happy" }
```
`screen` 同 6.2；`emotion` 切换面部表情底座（见附录情绪枚举）。用于大屏主动迎宾、应急公告、拍照定位讲解等。

---

## 附录：数据类型说明

### 情绪 `emotion` 枚举

| 值 | 中文含义 | 触发场景 |
|---|---|---|
| `happy` | 开心 | 正面讲解、日常介绍 |
| `excited` | 兴奋 | 描述震撼景点或重大亮点 |
| `neutral` | 平静 | 客观陈述数据、信息 |
| `curious` | 好奇 | 引导游客互动探索 |
| `empathetic` | 关切 | 游客困惑或遇到问题时 |
| `apologetic` | 抱歉 | 知识库无相关信息时 |

### 意图 `intent` 枚举

由 Orchestrator（调度中枢）对每轮提问判定，决定走哪条处理逻辑。

| 值 | 中文含义 | 触发场景 |
|---|---|---|
| `qa` | 知识问答 | 询问历史/文化/数据等（默认，走 RAG） |
| `navigation` | 路线规划 | 询问游览路线、顺序、行程安排 |
| `recommend` | 个性推荐 | 寻求推荐（值得去的、适合的、拍照点） |
| `empathy` | 情感安抚 | 表达负面情绪、抱怨、求助 |
| `chitchat` | 闲聊互动 | 与景点无关的闲聊、问候（跳过 RAG） |

### 错误响应格式

```json
{ "detail": "错误描述" }
```

| HTTP 状态码 | 含义 |
|---|---|
| `400` | 请求参数错误（如 `image_b64` 为空） |
| `500` | 服务内部错误（如 LLM API 调用失败） |

### 多轮对话说明

后端**不保存对话上下文**，每次请求均需客户端在 `history` 字段中携带历史记录。建议前端维护最近 3-5 轮的对话，避免 prompt 过长。

```json
{
  "message": "它多高？",
  "scenic_id": "lingshan",
  "history": [
    {"role": "user",      "content": "灵山大佛是什么"},
    {"role": "assistant", "content": "灵山大佛是世界最高的青铜坐佛……"}
  ]
}
```

---

*文档版本：v0.5 | 更新日期：2026-05-26*
