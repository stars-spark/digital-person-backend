import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import * as api from '@/lib/api'
import type { Lang } from '@/lib/i18n'
import { GROUPS, INTERESTS, LANGS } from '@/lib/i18n'
import * as trace from '@/lib/trace'
import type { Trace } from '@/lib/trace'
import { track as trackEvent } from '@/lib/track'
import { applyScenicTheme } from '@/lib/theme'

// iOS Safari 原生播 HLS、不支持 MSE/FLV；安卓 Chromium 反之。
const isIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1)
// macOS/桌面 Safari 同样无稳定 FLV/MSE、原生 HLS 也卡（队友 macOS 实测）→ 与 iOS 一起走 hls.js 深缓冲。
const isSafari =
  /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent)

export type MicState = 'idle' | 'listening' | 'recording' | 'recognizing'
export type Status = 'idle' | 'connecting' | 'connected' | 'buffering' | 'error'
export interface Meta { intent?: string; emotion?: string; location?: string; timing?: string; greet?: boolean; degraded?: boolean; cached?: boolean }
// 对话流消息：用户气泡 / 助手气泡。assistant 在等待时 thinking=true（显思考态），
// 拿到回答后填 text + meta，置 animate=true 触发打字机逐字显示（reduced-motion 直接全文）。
export interface Msg { id: string; role: 'user' | 'assistant'; text: string; meta?: Meta; thinking?: boolean; animate?: boolean; streaming?: boolean }
let _msgSeq = 0
const newId = () => `m${++_msgSeq}_${Date.now()}`

export const SCENICS = [
  { id: 'lingshan', name: '灵山胜境' },
  { id: 'nihuawan', name: '拈花湾' },
  { id: 'xihu', name: '西湖' },
  { id: 'huangshan', name: '黄山' },
  { id: 'gugong', name: '故宫' },
]

// localStorage 读取（带合法性校验，坏值回落默认）
function loadPref(key: string, valid: string[], fallback: string) {
  try {
    const v = localStorage.getItem(key)
    return v && valid.includes(v) ? v : fallback
  } catch { return fallback }
}
function loadInterests() {
  try {
    const raw = JSON.parse(localStorage.getItem('lingjing.interests') || '[]')
    const ids = INTERESTS.map((i) => i.id)
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && ids.includes(x)) : []
  } catch { return [] }
}
const savePref = (key: string, val: string) => { try { localStorage.setItem(key, val) } catch { /* ignore */ } }

export function useGuide(videoRef: RefObject<HTMLVideoElement | null>) {
  // 开场偏好持久化：记住景区/同行人/兴趣/语言，回访免开场
  const [scenic, setScenic] = useState(() => loadPref('lingjing.scenic', SCENICS.map((s) => s.id), 'lingshan'))
  const [groupType, setGroupType] = useState(() => loadPref('lingjing.group', GROUPS.map((g) => g.id), 'adult'))
  const [interests, setInterests] = useState<string[]>(loadInterests)
  const [lang, setLang] = useState<Lang>(() => loadPref('lingjing.lang', LANGS.map((l) => l.id), 'zh') as Lang)
  useEffect(() => { savePref('lingjing.scenic', scenic) }, [scenic])
  useEffect(() => { savePref('lingjing.group', groupType) }, [groupType])
  useEffect(() => { savePref('lingjing.interests', JSON.stringify(interests)) }, [interests])
  useEffect(() => { savePref('lingjing.lang', lang) }, [lang])
  const [status, setStatus] = useState<Status>('idle')
  const [thinking, setThinking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')          // 兼容：最后一条助手文本（Postcard/trace 等如有依赖）
  const [meta, setMeta] = useState<Meta>({})       // 兼容：最后一条助手 meta（舞台 pills 仍读它）
  const [messages, setMessages] = useState<Msg[]>([])  // 对话流（一问一答气泡）
  // 推一条消息，返回其 id
  const pushMsg = useCallback((m: Omit<Msg, 'id'>) => {
    const id = newId()
    setMessages((prev) => [...prev, { ...m, id }])
    return id
  }, [])
  // 按 id 局部更新某条消息
  const patchMsg = useCallback((id: string, patch: Partial<Msg>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])
  const [mic, setMicState] = useState<MicState>('idle')
  const [traceState, setTraceState] = useState<Trace>(() => trace.load())
  const [clipUrl, setClipUrl] = useState('')   // L1 命中：高频问答成品视频，在舞台直接播

  const [guideName, setGuideName] = useState('智能导览')
  // 游客形象精调偏好（空 = 跟随管理端景区默认）；音色消息级即时生效，形象下次唤醒生效
  const [voiceId, setVoiceIdState] = useState<string>(() => { try { return localStorage.getItem('lingjing.voice') || '' } catch { return '' } })
  const [avatarPref, setAvatarPrefState] = useState<string>(() => { try { return localStorage.getItem('lingjing.avatar') || '' } catch { return '' } })
  const setVoiceId = useCallback((v: string) => { setVoiceIdState(v); try { localStorage.setItem('lingjing.voice', v) } catch { /* ignore */ } }, [])
  const setAvatarPref = useCallback((a: string) => { setAvatarPrefState(a); try { localStorage.setItem('lingjing.avatar', a) } catch { /* ignore */ } }, [])
  const voiceRef = useRef(voiceId)
  useEffect(() => { voiceRef.current = voiceId }, [voiceId])
  const scenicRef = useRef(scenic)
  useEffect(() => { scenicRef.current = scenic }, [scenic])
  // 切景区 → 套用该景区主题色（整站换肤）+ 拿到该景区导游名（文案动态化）
  useEffect(() => {
    let alive = true
    applyScenicTheme(scenic).then((n) => { if (alive) setGuideName(n) })
    return () => { alive = false }
  }, [scenic])
  const groupRef = useRef(groupType)
  useEffect(() => { groupRef.current = groupType }, [groupType])
  const langRef = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])
  const backendLang = () => (LANGS.find((l) => l.id === langRef.current)?.backend || 'auto')
  // 绑定当前景区/画像的埋点上报（供 App 调用）
  const track = useCallback((type: string, payload?: Record<string, unknown>) =>
    trackEvent(type, { scenic: scenicRef.current, groupType: groupRef.current, lang: langRef.current }, payload), [])
  const startedRef = useRef(false)
  const playerRef = useRef<{ destroy: () => void } | null>(null)
  const greetedRef = useRef(false)
  // ── FLV 客户端自愈：发布端每 5-10min 掉线(python_rtmpstream 无自动重连)，服务端
  //    RTMP 看门狗(streamout/rtmp.py)会把流救活，但 mpegts.js 收到 Early-EOF 后会冻死。
  //    这里监听 ERROR → 延迟重连，与服务端看门狗闭环，消除掉线黑屏。──
  const wantStreamRef = useRef(false)        // 是否应保持直播(连上置真)
  const reconnectingRef = useRef(false)      // 重连进行中(防重入)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectFlvRef = useRef<(() => void) | null>(null)
  const startWebRTCRef = useRef<((v: HTMLVideoElement) => Promise<void>) | null>(null)  // WebRTC 自愈用
  const askSeqRef = useRef(0)               // barge-in：提问序号，旧问异步结果按此丢弃

  // ── 主动迎宾 ──────────────────────────────────────────────
  const greet = useCallback(async () => {
    if (greetedRef.current) return
    greetedRef.current = true
    setThinking(true)
    const aid = pushMsg({ role: 'assistant', text: '', thinking: true })
    try {
      const g = await api.greeting(scenicRef.current, groupRef.current)
      if (g.text) {
        const m: Meta = { greet: true }
        setReply(g.text); setThinking(false); setMeta(m)
        patchMsg(aid, { text: g.text, thinking: false, meta: m, animate: true })
        api.liveSay(g.text, scenicRef.current, g.emotion || 'happy', voiceRef.current || undefined)
      } else { setThinking(false); setMessages((prev) => prev.filter((m) => m.id !== aid)) }
    } catch { setThinking(false); setMessages((prev) => prev.filter((m) => m.id !== aid)) }
  }, [pushMsg, patchMsg])

  // 建（或重建）安卓/桌面 FLV 播放器，并挂 ERROR→重连。每次重建都销毁旧播放器。
  const startFlv = useCallback(async (v: HTMLVideoElement) => {
    const mpegts = (await import('mpegts.js')).default
    if (!mpegts.isSupported()) throw new Error('浏览器不支持 FLV(MSE)')
    if (playerRef.current) { try { playerRef.current.destroy() } catch { /* ignore */ } playerRef.current = null }
    // 低延迟直播播放：小 IO 缓冲吸收公网代理 jitter（防空缓冲卡顿/转圈），
    // 同时开 liveBufferLatencyChasing 追直播边缘——落后超 3s 即追回 ~0.8s，延迟不无限漂移。
    const p = mpegts.createPlayer(
      { type: 'flv', url: '/stream.flv', isLive: true },
      {
        enableWorker: true,
        enableStashBuffer: true,
        stashInitialSize: 384,
        liveBufferLatencyChasing: true,
        liveBufferLatencyChasingOnPaused: true,
        liveBufferLatencyMaxLatency: 3.0,
        liveBufferLatencyMinRemain: 0.8,
        autoCleanupSourceBuffer: true,
      },
    )
    // 流中断(发布端掉线/Early-EOF/网络/cloudflare 524)→ 触发重连循环
    p.on(mpegts.Events.ERROR, () => { reconnectFlvRef.current?.() })
    p.attachMediaElement(v)
    p.load()
    await p.play()
    playerRef.current = p as unknown as { destroy: () => void }
  }, [])

  // WebRTC 播放（杭州网关：亚秒延迟 + 自带抖动缓冲，根治远端长途卡顿）。SRS 原生 /rtc/v1/play，
  // 把 RTMP(H264+AAC) 转 WebRTC(H264+Opus) 推给浏览器。iOS Safari/安卓/桌面全支持。
  // AutoDL 部署无 /rtc 端点 → fetch 非 2xx 抛错，connect 回退 HLS/FLV。
  const startWebRTC = useCallback(async (v: HTMLVideoElement) => {
    if (playerRef.current) { try { playerRef.current.destroy() } catch { /* ignore */ } playerRef.current = null }
    const pc = new RTCPeerConnection()
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.ontrack = (e) => { if (e.streams[0]) v.srcObject = e.streams[0] }
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      if ((st === 'failed' || st === 'disconnected') && wantStreamRef.current && !reconnectingRef.current) {
        reconnectingRef.current = true; setStatus('buffering')
        reconnectTimerRef.current = setTimeout(async () => {
          reconnectingRef.current = false
          if (!wantStreamRef.current) return
          try { await startWebRTCRef.current?.(v); setStatus('connected') } catch { /* 下次 ice 事件再试 */ }
        }, 1500)
      }
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    const resp = await fetch('/rtc/v1/play/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api: location.origin + '/rtc/v1/play/',
        streamurl: 'webrtc://' + location.hostname + '/live/livestream',
        clientip: null, sdp: offer.sdp,
      }),
    })
    if (!resp.ok) { pc.close(); throw new Error('no-rtc ' + resp.status) }
    const data = await resp.json()
    if (data.code !== 0) { pc.close(); throw new Error('rtc-code ' + data.code) }
    await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
    // 加深接收端抖动缓冲：预存 ~0.4s 吸收路径抖动，避免 WebRTC 靠"拖慢语速"(time-stretch) 硬扛。
    // 代价 +~0.4s 延迟（仍远低于 HLS）。jitterBufferTarget 新标准 / playoutDelayHint 旧兼容，都试。
    try {
      pc.getReceivers().forEach((r) => {
        try { (r as unknown as { jitterBufferTarget: number }).jitterBufferTarget = 0.4 } catch { /* ignore */ }
        try { (r as unknown as { playoutDelayHint: number }).playoutDelayHint = 0.4 } catch { /* ignore */ }
      })
    } catch { /* ignore */ }
    await v.play().catch(() => {})
    playerRef.current = { destroy: () => { try { pc.close() } catch { /* ignore */ } try { v.srcObject = null } catch { /* ignore */ } } }
  }, [])

  useEffect(() => { startWebRTCRef.current = startWebRTC }, [startWebRTC])

  // 重连闭包（用 ref 持有以便 ERROR 回调稳定调用最新版）：1.5s 退避后重试，失败则继续，
  // 直到服务端看门狗把流救活、play() 成功。wantStream=false(未连/卸载)则停止。
  useEffect(() => {
    reconnectFlvRef.current = () => {
      if (!wantStreamRef.current || reconnectingRef.current) return
      reconnectingRef.current = true
      setStatus('buffering')
      const attempt = async () => {
        if (!wantStreamRef.current) { reconnectingRef.current = false; return }
        const v = videoRef.current
        if (!v) { reconnectingRef.current = false; return }
        try { await startFlv(v); reconnectingRef.current = false; setStatus('connected') }
        catch { reconnectTimerRef.current = setTimeout(attempt, 1500) }   // 流还没回来，继续重试
      }
      reconnectTimerRef.current = setTimeout(attempt, 1500)
    }
  }, [startFlv, videoRef])

  // 卸载清理：停重连 + 销毁播放器
  useEffect(() => () => {
    wantStreamRef.current = false
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    if (playerRef.current) { try { playerRef.current.destroy() } catch { /* ignore */ } playerRef.current = null }
  }, [])

  // ── 连接：iOS 原生 HLS / 安卓 mpegts.js FLV（用户手势内 play 允许带声）──
  const connect = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    setStatus('connecting')
    wantStreamRef.current = true
    try {
      // 优先 WebRTC（杭州网关：亚秒延迟 + 抗抖动，根治远端长途卡顿）。AutoDL 部署无 /rtc → 抛错回退。
      let usedWebRTC = false
      try { await startWebRTC(v); usedWebRTC = true } catch { /* 回退 HLS/FLV */ }
      // 回退：iOS/macOS Safari 原生 HLS；安卓/桌面 Chrome 低延迟 FLV。
      if (!usedWebRTC) {
      if (isIOS || isSafari) {
        v.src = '/hls/livestream.m3u8'
        v.load()
        await v.play().catch((err: unknown) => { if (!(err instanceof DOMException) || err.name !== 'AbortError') throw err })
        if (!v.dataset.hlsRecover) {
          v.dataset.hlsRecover = '1'
          v.addEventListener('error', () => {
            if (!wantStreamRef.current || reconnectingRef.current) return
            reconnectingRef.current = true
            setStatus('buffering')
            const retry = () => {
              if (!wantStreamRef.current) { reconnectingRef.current = false; return }
              try {
                v.src = '/hls/livestream.m3u8'; v.load()
                v.play().then(() => { reconnectingRef.current = false; setStatus('connected') })
                         .catch(() => { reconnectTimerRef.current = setTimeout(retry, 1500) })
              } catch { reconnectTimerRef.current = setTimeout(retry, 1500) }
            }
            reconnectTimerRef.current = setTimeout(retry, 1500)
          })
        }
      } else {
        await startFlv(v)
      }
      }
      startedRef.current = true
      setStatus('connected')
      setTraceState(trace.recordConnected())
      setTimeout(greet, 1500)
    } catch (e) {
      setStatus('error')
      pushMsg({ role: 'assistant', text: '画面播放失败：' + (e instanceof Error ? e.message : String(e)) })
    }
  }, [greet, videoRef, startFlv, startWebRTC, pushMsg])

  // ── 提问 → 桥接 /live/ask → 数字人开口 ──────────────────────
  // barge-in（提问打断）：回答中再次提问 → 立即转答新问题。不再因 busy 拦截；用递增序号
  // 标记"最新一问"，旧问的异步结果回来时按序号丢弃（桥接侧同步会让旧问停止驱动数字人、
  // 新问首句 interrupt 冲掉旧音频），UI 只跟随最新一问。
  const ask = useCallback(async (message: string) => {
    const msg = message.trim()
    if (!msg) return
    const seq = ++askSeqRef.current        // 本次提问序号
    // barge-in：新问到来，把上一轮仍在 thinking 的助手气泡撤掉（其异步结果会按 seq 丢弃）
    setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && m.thinking)))
    // 对话流：先推用户气泡，再推一条 pending 助手气泡（thinking 态）
    pushMsg({ role: 'user', text: msg })
    const aid = pushMsg({ role: 'assistant', text: '', thinking: true })
    // 不强制先连数字人：未连接时答案以文字/缓存片返回（实时人脸是增强项，非必需）
    setBusy(true); setThinking(true); setMeta({}); setClipUrl('')   // 立即反馈=打断
    const t0 = Date.now()

    // ── 卡拉OK式字幕：桥接逐句下发（句子已送数字人开口），前端按"说话速率"推进字符游标，
    //    让文字与数字人吐字同步流式出现（歌词跟唱）。生成完(done)后游标继续走完，不跳到结尾。──
    let full = ''                  // 已到达的完整文字（句子累积）
    let shown = 0                  // 已显示字符游标（可含小数，按速率累积）
    let lastN = -1                 // 上次 patch 的整数字数（只在变化时 patch，省渲染）
    let genDone = false            // 整段是否生成完
    let driveOn = true             // 本轮是否真开口（决定吐字速率）
    let started = false            // 揭示循环是否已启动（至少到了一句）
    let firstWordAt = 0            // 首字显示时刻（≈开口，诚实延迟口径）
    let finalText = ''; let finalMeta: Meta | undefined
    let timer: number | undefined
    const TICK = 40                // ms
    const CPS_SPEAK = 5.0          // 开口时≈中文说话速率（与 TTS 0.9 语速大致同步，略带前导=领唱感）
    const CPS_TEXT = 45            // 降级纯文字时快吐（无语音可同步）
    // 首句已生成≠iPhone 已听到：音频还要走 TTS 合成→Ditto 渲染→北京→杭州中继→WebRTC→抖动缓冲(~2s)。
    // 故字幕延后约这段时间再开吐，与语音对齐（否则字幕领先语音 ~2s）。降级纯文字无语音→不延后。
    const START_DELAY_MS = 1500

    const stop = () => { if (timer) { clearInterval(timer); timer = undefined } }
    const finalizeBubble = () => {
      patchMsg(aid, { text: finalText || full, thinking: false, streaming: false, meta: finalMeta, animate: false })
      if (finalText || full) setReply(finalText || full)
    }
    const start = () => {
      if (started) return
      started = true
      // 延后到音频大致抵达再开吐（降级无语音→立即）。延后期间句子继续累积进 full。
      window.setTimeout(() => {
        if (seq !== askSeqRef.current) return                   // 延后期间被新问取代 → 放弃
        firstWordAt = Date.now()                                // 首字出现≈开口（延迟徽章口径）
        setThinking(false)
        timer = window.setInterval(() => {
        if (seq !== askSeqRef.current) { stop(); return }       // 被新问取代 → 停
        const cps = driveOn ? CPS_SPEAK : CPS_TEXT
        shown = Math.min(full.length, shown + cps * (TICK / 1000))
        const n = Math.floor(shown)
        if (n !== lastN) {
          lastN = n
          patchMsg(aid, { text: full.slice(0, n), thinking: false, streaming: true })
          setReply(full.slice(0, n))
        }
        if (genDone && n >= full.length) { stop(); finalizeBubble() }   // 走完且生成结束 → 收尾（显 meta）
        }, TICK)
      }, driveOn ? START_DELAY_MS : 0)
    }

    try {
      const { ok, data } = await api.liveAskStream(
        msg, scenicRef.current, groupRef.current, backendLang(), voiceRef.current || undefined,
        {
          onOpen: (d) => { driveOn = d },
          onSentence: (text) => { if (seq === askSeqRef.current) { full += text; start() } },
        },
      )
      if (seq !== askSeqRef.current) { stop(); setMessages((prev) => prev.filter((m) => m.id !== aid)); return }  // 被新问取代 → 撤气泡
      if (!ok) {
        stop(); setThinking(false)
        const txt = '出错：' + (data.detail || '请稍后再试')
        setReply(txt); patchMsg(aid, { text: txt, thinking: false, streaming: false, animate: false }); return
      }
      // 延迟口径 = 首字出现时刻（≈数字人开口），而非整段生成完——故事类长答案此前被误记成 9s+
      const timing = ((firstWordAt ? firstWordAt - t0 : Date.now() - t0) / 1000).toFixed(1)
      finalText = data.reply || full || '(无回答)'
      finalMeta = { intent: data.intent, emotion: data.emotion, timing, degraded: data.degraded, cached: data.cached }
      setMeta(finalMeta)
      // L1 命中：直接在舞台播成品视频（不依赖实时流/GPU）
      if (data.mode === 'clip' && data.clip_url) { setClipUrl(data.clip_url); stop(); finalizeBubble() }
      else if (!started) { finalizeBubble() }      // 没产出任何句子（异常）→ 直接补全
      else { genDone = true }                       // 让揭示循环按说话速率走完后再收尾显 meta
      setTraceState(trace.recordAsk())
    } catch (e) {
      stop()
      if (seq !== askSeqRef.current) { setMessages((prev) => prev.filter((m) => m.id !== aid)); return }  // 旧问出错也不打扰新问
      setThinking(false)
      const txt = '请求失败：' + (e instanceof Error ? e.message : String(e))
      setReply(txt); patchMsg(aid, { text: txt, thinking: false, streaming: false, animate: false })
    } finally {
      if (seq === askSeqRef.current) setBusy(false)    // 仅最新一问负责解除 busy（揭示循环仍会继续走完字幕）
    }
  }, [pushMsg, patchMsg])

  // ── 拍照视觉定位 ────────────────────────────────────────────
  const photo = useCallback(async (file: File) => {
    if (!file || busy || !startedRef.current) return
    setBusy(true); setThinking(true); setMeta({})
    // 对话流：用户气泡（拍照动作）+ pending 助手气泡
    pushMsg({ role: 'user', text: '📷 拍了一张照片' })
    const aid = pushMsg({ role: 'assistant', text: '', thinking: true })
    const t0 = Date.now()
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
      })
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const m = /data:image\/(\w+);/.exec(dataUrl)
      const fmt = m ? m[1] : 'jpeg'
      const { ok, data } = await api.chatImage(b64, fmt, scenicRef.current)
      setThinking(false)
      if (!ok) {
        const txt = '出错：' + (data.detail || '识别失败')
        setReply(txt); patchMsg(aid, { text: txt, thinking: false }); return
      }
      const txt = data.reply || '(无结果)'
      const meta: Meta = { location: data.location, emotion: data.emotion, timing: ((Date.now() - t0) / 1000).toFixed(1) }
      setReply(txt); setMeta(meta)
      patchMsg(aid, { text: txt, thinking: false, meta, animate: true })
      trace.recordPhoto()
      setTraceState(data.location ? trace.recordVisit(data.location) : trace.load())
      track('photo_locate', { location: data.location || '' })
      if (data.reply) api.liveSay(data.reply, scenicRef.current, data.emotion || 'neutral', voiceRef.current || undefined)
    } catch (e) {
      setThinking(false)
      const txt = '识别失败：' + (e instanceof Error ? e.message : String(e))
      setReply(txt); patchMsg(aid, { text: txt, thinking: false })
    } finally { setBusy(false) }
  }, [busy, pushMsg, patchMsg, track])

  // ── 语音输入 + 能量 VAD 自动断句（端点对照 talk_mobile.html）──
  const vad = useRef<{ stream?: MediaStream; mr?: MediaRecorder; chunks: Blob[]; ctx?: AudioContext; raf?: number; want: boolean }>({ chunks: [], want: false })
  const cleanupMic = () => { const s = vad.current.stream; if (s) { s.getTracks().forEach((t) => t.stop()); vad.current.stream = undefined } }

  const stopVoice = useCallback((transcribe: boolean) => {
    vad.current.want = transcribe
    if (vad.current.raf) { cancelAnimationFrame(vad.current.raf); vad.current.raf = undefined }
    if (vad.current.ctx) { vad.current.ctx.close().catch(() => {}); vad.current.ctx = undefined }
    const mr = vad.current.mr
    if (mr && mr.state !== 'inactive') mr.stop()
    else cleanupMic()
  }, [])

  const toggleVoice = useCallback(async () => {
    if (mic !== 'idle') { stopVoice(false); return }
    if (!startedRef.current) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true } })
    } catch (e) { alert('麦克风不可用（需 HTTPS）：' + (e instanceof Error ? e.message : e)); return }
    vad.current = { stream, chunks: [], want: false }
    const mr = new MediaRecorder(stream)
    vad.current.mr = mr
    mr.ondataavailable = (e) => { if (e.data.size) vad.current.chunks.push(e.data) }
    mr.onstop = async () => {
      cleanupMic()
      if (!vad.current.want || !vad.current.chunks.length) { setMicState('idle'); return }
      setMicState('recognizing')
      try {
        const d = await api.asr(new Blob(vad.current.chunks, { type: 'audio/webm' }), scenicRef.current, backendLang())
        setMicState('idle')
        const text = d.text?.trim()
        if (text) ask(text)
        else pushMsg({ role: 'assistant', text: '没听清，请再说一次' })
      } catch (e) { setMicState('idle'); pushMsg({ role: 'assistant', text: '识别失败：' + (e instanceof Error ? e.message : e) }) }
    }
    mr.start()
    setMicState('listening')

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    vad.current.ctx = ctx
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an)
    const buf = new Uint8Array(an.fftSize)
    // SILENCE_HOLD 500ms 省 ~0.3s 延迟；若说话被提前打断，调回 650~800
    const VOICE_TH = 0.018, MIN_SPEECH = 300, SILENCE_HOLD = 500, MAX_MS = 12000
    let spoke = false, speechStart = 0, lastVoice = performance.now()
    const t0 = performance.now()
    const loop = () => {
      an.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
      const rms = Math.sqrt(sum / buf.length), now = performance.now()
      if (rms > VOICE_TH) { lastVoice = now; if (!spoke) { spoke = true; speechStart = now; setMicState('recording') } }
      if (spoke && now - speechStart > MIN_SPEECH && now - lastVoice > SILENCE_HOLD) { stopVoice(true); return }
      if (now - t0 > MAX_MS) { stopVoice(spoke); return }
      vad.current.raf = requestAnimationFrame(loop)
    }
    vad.current.raf = requestAnimationFrame(loop)
  }, [mic, ask, stopVoice, pushMsg])

  const recordVisit = useCallback((name: string) => setTraceState(trace.recordVisit(name)), [])
  const recordRouteDone = useCallback((id: string) => setTraceState(trace.recordRouteDone(id)), [])
  const recordRating = useCallback((score: number) => setTraceState(trace.recordRating(score)), [])

  return {
    scenic, setScenic, groupType, setGroupType, interests, setInterests, lang, setLang, guideName,
    voiceId, setVoiceId, avatarPref, setAvatarPref,
    status, setStatus, thinking, busy, reply, meta, messages, mic,
    trace: traceState, recordVisit, recordRouteDone, recordRating, track,
    clipUrl, clearClip: () => setClipUrl(''),
    connect, ask, toggleVoice, photo, isIOS,
  }
}
