# 景区导览 AI 数字人 — 后端接口文档

**Base URL（云端）**：`http://116.62.136.211:8000`  
**Base URL（本地开发）**：`http://localhost:8000`  
**接口文档（交互式）**：`http://116.62.136.211:8000/docs`  
**健康检查**：`GET /health` → `{"status": "ok"}`

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
- [4. 数字人形象配置](#4-数字人形象配置)
- [附录：数据类型说明](#附录数据类型说明)

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
curl -X POST http://116.62.136.211:8000/chat \
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
  const response = await fetch('http://116.62.136.211:8000/chat', {
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
    with httpx.stream("POST", "http://116.62.136.211:8000/chat",
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

curl -X POST http://116.62.136.211:8000/chat/image \
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

  const resp = await fetch('http://116.62.136.211:8000/chat/image', {
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
curl -X POST http://116.62.136.211:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How tall is the Grand Buddha?","scenic_id":"lingshan"}'

# 中文提问，强制英文作答
curl -X POST http://116.62.136.211:8000/chat \
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
curl -X POST http://116.62.136.211:8000/chat \
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
| `files` | file[]（form） | 文档文件，支持 `.docx`，可同时上传多个 |
| `replace` | bool（form） | `true` 时先清空该景区知识库再入库，默认 `false` |

```bash
curl -X POST http://116.62.136.211:8000/kb/upload \
  -F "scenic_id=lingshan" \
  -F "replace=true" \
  -F "files=@灵山胜境指南.docx" \
  -F "files=@灵山景点数据集.docx"
```

```json
{
  "scenic_id": "lingshan",
  "files": 2,
  "chunks_indexed": 45
}
```

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

## 4. 数字人形象配置

> **队友 B（管理后台「数字人形象管理」页用）**：配置数字人外观与音色，支持按景区分别设置。  
> **队友 A**：渲染时读取 config 的 `avatar_id` / `voice_id` 传给数字人 SDK。  
> 注：当前形象/音色 ID 为占位值，接入阿里云/讯飞数字人后替换为真实 ID，接口契约不变。

### 4.1 获取可选形象与音色列表

```
GET /digital-human/presets
```

```json
{
  "avatars": [
    {"id": "female_elegant", "name": "素雅女性", "style": "古典", "gender": "female"},
    {"id": "male_mature",    "name": "沉稳男性", "style": "古典", "gender": "male"}
  ],
  "voices": [
    {"id": "voice_gentle_f", "name": "温柔女声", "gender": "female", "style": "gentle"},
    {"id": "voice_calm_m",   "name": "沉稳男声", "gender": "male",   "style": "calm"}
  ]
}
```

### 4.2 获取某景区配置

```
GET /digital-human/config?scenic_id=lingshan
```

未单独配置时回落到 `default`；`default` 也未配置时返回内置默认值（带 `"fallback": true`）。

```json
{
  "scenic_id": "lingshan",
  "avatar_id": "female_elegant",
  "avatar_name": "素雅女性",
  "voice_id": "voice_gentle_f",
  "voice_name": "温柔女声",
  "updated_at": "2026-05-24 11:34:43"
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

```bash
curl -X PUT http://116.62.136.211:8000/digital-human/config \
  -H "Content-Type: application/json" \
  -d '{"scenic_id":"lingshan","avatar_id":"female_elegant","avatar_name":"素雅女性","voice_id":"voice_gentle_f","voice_name":"温柔女声"}'
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
