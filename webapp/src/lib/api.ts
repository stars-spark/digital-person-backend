// 与桥接(:9000)同源的端点封装。契约对照 talk_mobile.html（即行为规格）。
// 全部相对路径：dev 经 vite proxy、生产经桥接反代，单源无 mixed-content。

export const SESSION_ID = '0' // RTMP 单路固定 sessionid

export interface GreetResp { text?: string; emotion?: string }
export interface AskResp { reply?: string; intent?: string; emotion?: string; detail?: string; mode?: string; degraded?: boolean; clip_url?: string; cached?: boolean }
export interface ImageResp { reply?: string; location?: string; emotion?: string; detail?: string }

export async function greeting(scenic: string, groupType = 'adult'): Promise<GreetResp> {
  const r = await fetch(`/rag/trip/greeting?scenic_id=${scenic}&group_type=${groupType}`)
  return r.json()
}

export interface TodayResp { weather?: string; period?: string; crowd?: string; tip?: string }
export async function today(scenic: string): Promise<TodayResp> {
  const r = await fetch(`/rag/trip/today?scenic_id=${scenic}`)
  if (!r.ok) return {}
  return r.json()
}

export interface Station { name: string; hint: string }
export interface Route { id: string; title: string; duration: string; tag: string; group: string; stations: Station[] }
export async function routes(scenic: string): Promise<Route[]> {
  const r = await fetch(`/rag/tour/routes?scenic_id=${scenic}`)
  if (!r.ok) return []
  return (await r.json()).routes || []
}

export interface FacilityGroup { id: string; label: string; emoji: string; points: string[] }
export async function facilities(scenic: string): Promise<FacilityGroup[]> {
  const r = await fetch(`/rag/tour/facilities?scenic_id=${scenic}`)
  if (!r.ok) return []
  return (await r.json()).groups || []
}

export interface ScenicTheme { scenic_id: string; name: string; primary: string; sweet: string; guide_name: string }

// —— 数字人形象管理（管理端配默认，游客端精调）——
export interface AvatarPreset {
  id: string; name: string; gender: 'female' | 'male'; style: string
  persona?: string; outfit?: string; age?: string; fit?: string
  preview?: string; recommended?: boolean; coming_soon?: boolean; legacy?: boolean
}
export interface VoicePreset { id: string; name: string; gender: 'female' | 'male'; tone: string }
export interface BackgroundPreset { id: string; name: string; scenic?: string | null; preview?: string | null; source?: string; status?: string }
export async function dhPresets(): Promise<{ avatars: AvatarPreset[]; voices: VoicePreset[]; backgrounds?: BackgroundPreset[] }> {
  const r = await fetch('/rag/digital-human/presets')
  if (!r.ok) return { avatars: [], voices: [] }
  return r.json()
}
export interface DhConfig {
  scenic_id: string; avatar_id: string; avatar_name: string; voice_id: string; voice_name: string
  background_id?: string; background_name?: string
}
export async function dhConfig(scenic: string): Promise<DhConfig | null> {
  const r = await fetch(`/rag/digital-human/config?scenic_id=${scenic}`)
  if (!r.ok) return null
  return r.json()
}
export async function getTheme(scenic: string): Promise<ScenicTheme> {
  const r = await fetch(`/rag/scenic/theme?scenic_id=${scenic}`)
  return r.json()
}

export interface NearbyItem { name: string; distance: number }
export interface SimSpot { label: string; lat: number; lng: number }
export interface NearbyResp { nearest: NearbyItem | null; items: NearbyItem[]; sim_spots: SimSpot[] }
export async function nearby(scenic: string, lat?: number, lng?: number): Promise<NearbyResp> {
  const q = lat != null && lng != null ? `&lat=${lat}&lng=${lng}` : ''
  const r = await fetch(`/rag/tour/nearby?scenic_id=${scenic}${q}`)
  if (!r.ok) return { nearest: null, items: [], sim_spots: [] }
  return r.json()
}

export function liveSay(text: string, scenic: string, emotion = 'happy', voiceId?: string) {
  return fetch('/live/say', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionid: SESSION_ID, text, scenic_id: scenic, emotion,
      ...(voiceId ? { voice_id: voiceId } : {}),
    }),
  }).catch(() => {})
}

export async function liveAsk(
  message: string, scenic: string, groupType = 'adult', lang = 'auto', voiceId?: string,
): Promise<{ ok: boolean; data: AskResp }> {
  const r = await fetch('/live/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionid: SESSION_ID, message, scenic_id: scenic, group_type: groupType, lang,
      ...(voiceId ? { voice_id: voiceId } : {}),
    }),
  })
  return { ok: r.ok, data: await r.json() }
}

// SSE 字幕流版：桥接每把一句送数字人开口就下发该句，前端据此按说话速率逐字吐字（与语音同步）。
// 回调：onOpen(本轮是否真开口) / onSentence(逐句到达) / onDone(完整结果，含 meta)。
// 返回 ok=false 时 data.detail 含错误信息。AskResp 同 liveAsk。
export interface AskStreamHandlers {
  onOpen?: (driveEnabled: boolean) => void
  onSentence?: (text: string, index: number, emotion?: string) => void
}
export async function liveAskStream(
  message: string, scenic: string, groupType = 'adult', lang = 'auto', voiceId: string | undefined,
  h: AskStreamHandlers, signal?: AbortSignal,
): Promise<{ ok: boolean; data: AskResp }> {
  const r = await fetch('/live/ask_stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionid: SESSION_ID, message, scenic_id: scenic, group_type: groupType, lang,
      ...(voiceId ? { voice_id: voiceId } : {}),
    }),
    signal,
  })
  if (!r.ok || !r.body) return { ok: false, data: { detail: `HTTP ${r.status}` } }
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let done: AskResp | null = null
  let err: AskResp | null = null
  for (;;) {
    const { value, done: streamDone } = await reader.read()
    if (streamDone) break
    buf += dec.decode(value, { stream: true })
    // 按行切分；每个 data: 行是一个 JSON 事件
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      let evt: Record<string, unknown>
      try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }
      const type = evt.type as string
      if (type === 'open') h.onOpen?.(!!evt.drive_enabled)
      else if (type === 'sentence') h.onSentence?.(String(evt.text ?? ''), Number(evt.index ?? 0), evt.emotion as string | undefined)
      else if (type === 'done') done = evt as AskResp
      else if (type === 'error') err = { detail: String(evt.detail ?? '请求失败') }
    }
  }
  if (err) return { ok: false, data: err }
  return { ok: !!done, data: done ?? { detail: '流式中断' } }
}

// 热拔插换形象：把正在直播的数字人当场换成 avatarId（~1s，不重连）。见 API_DOC 4.7。
export async function liveSetAvatar(avatarId: string, scenic: string): Promise<{ ok: boolean }> {
  try {
    const r = await fetch('/live/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_id: avatarId, scenic_id: scenic, sessionid: SESSION_ID, screen: 'main' }),
    })
    const d = await r.json().catch(() => ({}))
    return { ok: Boolean(d?.ok) }
  } catch { return { ok: false } }
}

export async function asr(blob: Blob, scenic: string, lang = 'auto'): Promise<{ text?: string }> {
  const fd = new FormData()
  fd.append('file', blob, 'voice.webm')
  fd.append('scenic_id', scenic)
  fd.append('language', lang)   // 跟随 UI 语言：en→识别英文、zh→中文+景区热词、auto→自动检测
  const r = await fetch('/rag/asr', { method: 'POST', body: fd })
  return r.json()
}

export async function chatImage(b64: string, fmt: string, scenic: string): Promise<{ ok: boolean; data: ImageResp }> {
  const r = await fetch('/rag/chat/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: 'talk', scenic_id: scenic, image_b64: b64, image_format: fmt,
      question: '我面前是什么？帮我定位、讲解，并指引我接下来去哪。',
    }),
  })
  return { ok: r.ok, data: await r.json() }
}

// 拍照打卡核验：闭集 VL + 位置软门 + 融合决策（后端 /checkin）
export interface CheckinCand { id: string; name: string; lng?: number; lat?: number }
export interface CheckinResult {
  decision: 'confirmed' | 'wrong_stop' | 'uncertain'
  matched_id?: string | null
  matched_name?: string | null
  confidence: number
  evidence: string[]
  distance_m?: number | null
  reason: string
  alt_id?: string | null
}
export async function checkin(body: {
  scenic: string; b64: string; fmt: string; targetId: string; candidates: CheckinCand[]; gps?: [number, number] | null
}): Promise<{ ok: boolean; data: CheckinResult }> {
  const r = await fetch('/rag/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenic_id: body.scenic, image_b64: body.b64, image_format: body.fmt,
      target_id: body.targetId, candidates: body.candidates, gps: body.gps ?? null,
    }),
  })
  return { ok: r.ok, data: await r.json() }
}
