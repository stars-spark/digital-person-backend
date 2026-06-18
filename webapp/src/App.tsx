import { useEffect, useRef, useState } from 'react'
import {
  Microphone, Camera, ArrowUp, Sparkle, MapPin, Clock, CircleNotch, GearSix,
  Compass, Lifebuoy, Medal, NavigationArrow, FlowerLotus, Lightning, ChatCircleDots,
} from '@phosphor-icons/react'
import { EMO_META } from '@/lib/icons'
import { useGuide, SCENICS } from '@/hooks/useGuide'
import type { Meta, Msg } from '@/hooks/useGuide'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { makeT } from '@/lib/i18n'
import Onboarding from '@/components/Onboarding'
import TodayCard from '@/components/TodayCard'
import SettingsSheet from '@/components/SettingsSheet'
import TourSheet from '@/components/TourSheet'
import FacilitySheet from '@/components/FacilitySheet'
import TraceSheet from '@/components/TraceSheet'
import GpsSheet from '@/components/GpsSheet'
import AvatarSheet from '@/components/AvatarSheet'
import Postcard from '@/components/Postcard'
import { load as loadTrace } from '@/lib/trace'
import { loadDarkMode, applyDarkMode } from '@/lib/theme'
import type { DarkMode } from '@/lib/theme'

const SUGGESTIONS = [
  { t: '必看景点', q: '这个景区有哪些必看的景点？' },
  { t: '推荐路线', q: '帮我推荐一条游览路线' },
  { t: '讲个故事', q: '给我讲一个这里的历史故事' },
  { t: '现在人多吗', q: '现在景区人多吗？怎么错峰？' },
  { t: '附近吃什么', q: '附近有什么特色美食？' },
]


export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const g = useGuide(videoRef)
  const [draft, setDraft] = useState('')
  const [vstall, setVstall] = useState(false)
  const [onboarded, setOnboarded] = useState(() => { try { return localStorage.getItem('lingjing.onboarded') === '1' } catch { return false } })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [elder, setElder] = useState(false)
  const [dark, setDarkState] = useState<DarkMode>(() => loadDarkMode())
  const setDark = (m: DarkMode) => { setDarkState(m); applyDarkMode(m) }
  const [tourOpen, setTourOpen] = useState(false)
  const [facOpen, setFacOpen] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)
  const [gpsOpen, setGpsOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [postcardOpen, setPostcardOpen] = useState(false)
  const connected = g.status === 'connected'
  const t = makeT(g.lang)
  const scenicName = SCENICS.find((s) => s.id === g.scenic)?.name || g.scenic

  const submit = () => { if (draft.trim()) { g.ask(draft); setDraft('') } }
  const askStation = (name: string) => { g.recordVisit(name); g.ask(`请讲讲${name}的故事`) }
  // 埋点：进入功能（同时打开对应面板）
  const openFeature = (feature: string, setter: (b: boolean) => void) => { g.track('feature_open', { feature }); setter(true) }
  // 埋点：到访某站（区分来源 tour / gps）
  const askStationVia = (via: string) => (name: string) => { g.track('station_visit', { name, via }); askStation(name) }

  // 埋点：会话开始（进入导览）/ 结束（页面卸载用 sendBeacon）
  const enterApp = () => {
    setOnboarded(true)
    try { localStorage.setItem('lingjing.onboarded', '1') } catch { /* ignore */ }
    g.track('session_start', { interests: g.interests, device: g.isIOS ? 'ios' : 'web' })
  }
  // 重看开场（设置入口；保留已选偏好，重看时呈现记忆值）
  const replayOnboarding = () => {
    try { localStorage.removeItem('lingjing.onboarded') } catch { /* ignore */ }
    setSettingsOpen(false)
    setOnboarded(false)
  }
  useEffect(() => {
    if (!onboarded) return
    const startedAt = Date.now()
    const onLeave = () => {
      const tr = loadTrace()
      g.track('session_end', {
        duration_s: Math.round((Date.now() - startedAt) / 1000),
        asks: tr.asks, photos: tr.photos, visited: tr.visited.length,
      })
    }
    window.addEventListener('pagehide', onLeave)
    return () => window.removeEventListener('pagehide', onLeave)
  }, [onboarded, g])

  // 舞台背景模糊填充：把竖版数字人流按 cover 画进小 canvas → CSS 放大模糊，铺满 16:9 横框两侧
  // （单条 mpegts 流无法复制到第二个 <video>，故走 canvas 抽帧；前景视频 object-contain 居中、头不偏大）
  useEffect(() => {
    const v = videoRef.current, c = bgCanvasRef.current
    if (!v || !c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    let raf = 0, last = 0
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick)
      if (ts - last < 90) return                 // ~11fps：背景够用、省电
      last = ts
      const vw = v.videoWidth, vh = v.videoHeight
      const cw = c.width, ch = c.height
      if (v.readyState < 2 || !vw) { ctx.clearRect(0, 0, cw, ch); return }  // 无帧→透明，露出渐变兜底
      const s = Math.max(cw / vw, ch / vh)
      const w = vw * s, h = vh * s
      try { ctx.drawImage(v, (cw - w) / 2, (ch - h) / 2, w, h) } catch { /* 跨域只显示不读取，安全 */ }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 深色模式：挂载即套用，system 模式跟随系统切换
  useEffect(() => {
    applyDarkMode(dark)
    if (dark !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyDarkMode('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [dark])

  if (!onboarded) {
    return (
      <Onboarding
        lang={g.lang} setLang={g.setLang}
        scenic={g.scenic} setScenic={g.setScenic}
        groupType={g.groupType} setGroupType={g.setGroupType}
        interests={g.interests} setInterests={g.setInterests}
        guideName={g.guideName} avatarPref={g.avatarPref}
        onEnter={enterApp}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-background"
      style={{ zoom: elder ? 1.12 : 1 } as React.CSSProperties}>
      {/* 顶栏 */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-base font-semibold text-primary-foreground shadow-sm">
          途
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">途叨叨</div>
          <div className="text-[11px] text-muted-foreground">{t('subtitle')}</div>
        </div>
        <Select value={g.scenic} onValueChange={g.setScenic}>
          <SelectTrigger size="sm" className="ml-auto rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SCENICS.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          aria-label="settings"
          onClick={() => setSettingsOpen(true)}
          className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition active:scale-90"
        >
          <GearSix className="size-[18px]" />
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-4">
        {/* 数字人舞台 */}
        <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-[1.5rem] border bg-gradient-to-br from-primary/10 via-background to-sweet/10 shadow-[0_12px_44px_-14px_oklch(0.575_0.2_268_/_0.35)]">
          {/* 数字人流为 720×1280 竖版；16:9 横框用「模糊填充」：背景=同画面 cover 放大模糊铺满两侧，
              前景=完整竖版 object-contain 居中（头不偏大、零裁切）。⚠️横版底板就绪后改回 object-cover 即可 */}
          <canvas ref={bgCanvasRef} width={384} height={216} aria-hidden
            className="absolute inset-0 size-full scale-[1.18] object-cover blur-2xl" />
          {connected && <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-black/10" />}
          <video
            ref={videoRef}
            playsInline
            webkit-playsinline="true"
            className="relative z-10 size-full object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.42)]"
            onWaiting={() => setVstall(true)}
            onPlaying={() => setVstall(false)}
          />

          {/* L1 缓存命中：成品视频在舞台直接播（0 GPU·秒回），播完回归 */}
          {g.clipUrl && (
            <video
              key={g.clipUrl}
              src={g.clipUrl}
              autoPlay
              playsInline
              webkit-playsinline="true"
              onEnded={g.clearClip}
              className="absolute inset-0 z-30 size-full object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.42)]"
            />
          )}

          <div className="absolute left-3 top-3 z-20">
            <StatusBadge status={g.status} stalled={vstall} t={t} />
          </div>

          {g.status !== 'connected' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-7 text-center">
              {/* 友好的"导游已就位"焦点 */}
              <div className="relative flex size-20 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-primary/15 blur-xl motion-safe:animate-[pulse_2.6s_var(--ease-out)_infinite]" />
                <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/75 text-2xl font-semibold text-primary-foreground shadow-lg shadow-primary/30">
                  游
                </span>
              </div>
              <p className="text-[13px] font-medium leading-relaxed text-foreground/70">{t('stage_hint')}</p>
              <button
                onClick={g.connect}
                disabled={g.status === 'connecting'}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition duration-200 ease-[var(--ease-out)] hover:shadow-xl hover:shadow-primary/35 active:scale-95 disabled:opacity-60"
              >
                {g.status === 'connecting'
                  ? (<><CircleNotch className="size-4 animate-spin" /> {t('waking')}</>)
                  : (<><Sparkle className="size-4" weight="duotone" /> {t('start')}</>)}
              </button>
            </div>
          )}

          {(g.meta.intent || g.meta.location || g.meta.greet || g.meta.degraded) && (
            <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap gap-1.5">
              {g.meta.greet && <Pill><FlowerLotus className="size-3" weight="duotone" /> 主动迎宾</Pill>}
              {g.meta.cached && <Pill><Lightning className="size-3" weight="duotone" /> 秒回·缓存</Pill>}
              {g.meta.degraded && <Pill tone="amber"><ChatCircleDots className="size-3" weight="duotone" /> 文字模式·繁忙</Pill>}
              {g.meta.location && <Pill><MapPin className="size-3" /> {g.meta.location}</Pill>}
              {g.meta.intent && <Pill>{intentLabel(g.meta.intent)}</Pill>}
              {g.meta.emotion && <EmotionPill emotion={g.meta.emotion} />}
              {g.meta.timing && <Pill tone="muted"><Clock className="size-3" /> {g.meta.timing}s</Pill>}
            </div>
          )}
        </div>

        {/* 今日游园建议卡 */}
        <TodayCard scenic={g.scenic} label={{ today: t('today'), tip: t('today_tip') }} />

        {/* 快捷功能 */}
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={<Compass className="size-[18px]" weight="duotone" />} label={t('qf_tour')} onClick={() => openFeature('tour', setTourOpen)} />
          <QuickAction icon={<NavigationArrow className="size-[18px]" weight="duotone" />} label={t('qf_gps')} onClick={() => openFeature('gps', setGpsOpen)} />
          <QuickAction icon={<Lifebuoy className="size-[18px]" weight="duotone" />} label={t('qf_facility')} onClick={() => openFeature('facility', setFacOpen)} />
          <QuickAction icon={<Medal className="size-[18px]" weight="duotone" />} label={t('qf_trace')} onClick={() => openFeature('trace', setTraceOpen)} badge={g.trace.visited.length || undefined} />
        </div>

        {/* 对话流（一问一答气泡，新消息自动滚到底） */}
        <Conversation
          messages={g.messages}
          intro={t('intro')}
          thinkingLabel={t('thinking', { guide: g.guideName })}
        />
      </main>

      {/* 底部固定区：建议快问 chips（始终可见，吸附在输入坞正上方）+ 输入坞 */}
      <footer className="sticky bottom-0 z-20 border-t bg-background/85 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
        {/* 建议快问 */}
        <ScrollArea className="-mx-4 mb-2.5 w-[calc(100%+2rem)] whitespace-nowrap px-4">
          <div className="flex gap-2 pb-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.t}
                onClick={() => g.ask(s.q)}
                className="shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition duration-200 ease-[var(--ease-out)] hover:border-primary/30 hover:text-primary active:scale-95"
              >
                {s.t}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="opacity-0" />
        </ScrollArea>
        <div className="flex items-center gap-2 rounded-full border bg-card p-1.5 pl-2 shadow-sm">
          <IconButton label="语音" onClick={() => { if (g.mic === 'idle') g.track('feature_open', { feature: 'voice' }); g.toggleVoice() }} disabled={!connected || g.busy} state={g.mic}>
            {g.mic === 'recognizing' ? <CircleNotch className="size-5 animate-spin" /> : <Microphone className="size-5" />}
          </IconButton>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder={t('placeholderOn')}
            className="min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <IconButton label="拍照" onClick={() => { g.track('feature_open', { feature: 'photo' }); fileRef.current?.click() }} disabled={!connected || g.busy}>
            <Camera className="size-5" />
          </IconButton>
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition duration-200 ease-[var(--ease-out)] active:scale-90 disabled:opacity-40 disabled:shadow-none"
          >
            <ArrowUp className="size-5" />
          </button>
        </div>
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) g.photo(f); e.target.value = '' }}
        />
      </footer>

      <SettingsSheet
        open={settingsOpen} onOpenChange={setSettingsOpen}
        lang={g.lang} setLang={g.setLang} elder={elder} setElder={setElder}
        dark={dark} setDark={setDark}
        onOpenAvatar={() => { g.track('feature_open', { feature: 'avatar' }); setAvatarOpen(true) }}
        onReplay={replayOnboarding}
      />
      <AvatarSheet
        open={avatarOpen} onOpenChange={setAvatarOpen} scenic={g.scenic}
        voiceId={g.voiceId} setVoiceId={(v) => { g.track('milestone', { kind: 'voice_change', voice: v }); g.setVoiceId(v) }}
        avatarPref={g.avatarPref} setAvatarPref={g.setAvatarPref}
      />
      <TourSheet
        open={tourOpen} onOpenChange={setTourOpen}
        scenic={g.scenic} groupType={g.groupType} visited={g.trace.visited}
        onAsk={askStationVia('tour')}
        onRouteDone={(id) => { g.track('milestone', { kind: 'route', id }); g.recordRouteDone(id) }}
      />
      <FacilitySheet open={facOpen} onOpenChange={setFacOpen} scenic={g.scenic} onAsk={(q) => g.ask(q)} />
      <GpsSheet open={gpsOpen} onOpenChange={setGpsOpen} scenic={g.scenic} onAsk={askStationVia('gps')} />
      <TraceSheet
        open={traceOpen} onOpenChange={setTraceOpen} trace={g.trace}
        onPostcard={() => { g.track('milestone', { kind: 'postcard' }); setTraceOpen(false); setPostcardOpen(true) }}
        onRate={(score) => { g.track('rating', { score }); g.recordRating(score) }}
      />
      <Postcard open={postcardOpen} onClose={() => setPostcardOpen(false)} scenic={g.scenic} scenicName={scenicName} guideName={g.guideName} trace={g.trace} />
    </div>
  )
}

// ── 对话流 ───────────────────────────────────────────────
// 用户气泡（右对齐 primary 底）+ 助手气泡（左对齐 card 底），按时间排列；新消息/打字时自动滚到底。
function Conversation({ messages, intro, thinkingLabel }: {
  messages: Msg[]; intro: string; thinkingLabel: string
}) {
  const endRef = useRef<HTMLDivElement | null>(null)
  // 打字进度变化时也要跟随滚动 → 用一个递增 tick 触发 effect
  const [tick, setTick] = useState(0)
  const bump = () => setTick((n) => n + 1)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, tick])

  return (
    <div className="flex flex-col gap-3 pt-1">
      {messages.length === 0 && (
        <div className="rounded-2xl border bg-card p-4 text-[15px] leading-relaxed text-muted-foreground">
          {intro}
        </div>
      )}
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[15px] leading-relaxed text-primary-foreground shadow-sm shadow-primary/20">
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex justify-start">
            <div className="max-w-[86%] rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-[15px] leading-relaxed text-card-foreground shadow-sm">
              {m.thinking ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  {thinkingLabel}
                  <span className="flex gap-1"><Dot /> <Dot d={150} /> <Dot d={300} /></span>
                </div>
              ) : (
                <AssistantBody text={m.text} animate={!!m.animate} streaming={!!m.streaming} meta={m.meta} onReveal={bump} />
              )}
            </div>
          </div>
        ),
      )}
      <div ref={endRef} />
    </div>
  )
}

// 助手气泡正文：
//  - streaming（卡拉OK字幕）：text 由 useGuide 按说话速率外部递增，直接渲染当前片段 + 闪烁光标，
//    meta 待收尾（streaming=false）再显；
//  - animate（拍照/迎宾等非流式）：本地打字机逐字（reduced-motion 直接全文），完成后显 meta。
function AssistantBody({ text, animate, streaming, meta, onReveal }: {
  text: string; animate: boolean; streaming?: boolean; meta?: Meta; onReveal: () => void
}) {
  const { typed, done } = useTypewriter(text, animate && !streaming, onReveal)
  const body = streaming ? text : typed
  const showCaret = streaming || !done
  const showMeta = !streaming && done && meta
  return (
    <>
      <p className="whitespace-pre-wrap break-words">
        {body}
        {showCaret && (
          <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-primary/70 motion-safe:animate-[caret-blink_1s_steps(1)_infinite]" />
        )}
      </p>
      {showMeta && <BubbleMeta meta={meta} />}
    </>
  )
}

// 气泡内 meta pills（intent/emotion/timing/cached/degraded/location/greet），复用舞台同款 Pill。
function BubbleMeta({ meta }: { meta: Meta }) {
  const has = meta.intent || meta.emotion || meta.timing || meta.cached || meta.degraded || meta.location || meta.greet
  if (!has) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {meta.greet && <Pill><FlowerLotus className="size-3" weight="duotone" /> 主动迎宾</Pill>}
      {meta.cached && <Pill><Lightning className="size-3" weight="duotone" /> 秒回·缓存</Pill>}
      {meta.degraded && <Pill tone="amber"><ChatCircleDots className="size-3" weight="duotone" /> 文字模式·繁忙</Pill>}
      {meta.location && <Pill><MapPin className="size-3" /> {meta.location}</Pill>}
      {meta.intent && <Pill>{intentLabel(meta.intent)}</Pill>}
      {meta.emotion && <EmotionPill emotion={meta.emotion} />}
      {meta.timing && <Pill tone="muted"><Clock className="size-3" /> {meta.timing}s</Pill>}
    </div>
  )
}

// 打字机：animate=true 时逐字 reveal；reduced-motion 或 animate=false 直接全文。
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
function useTypewriter(text: string, animate: boolean, onReveal?: () => void) {
  const [n, setN] = useState(() => (animate && !prefersReduced() ? 0 : text.length))
  const revealRef = useRef(onReveal)
  useEffect(() => { revealRef.current = onReveal })
  useEffect(() => {
    if (!animate || prefersReduced()) { setN(text.length); return }
    setN(0)
    const id = window.setInterval(() => {
      setN((p) => {
        if (p >= text.length) { window.clearInterval(id); return p }
        revealRef.current?.()
        return p + 2   // 每 tick 2 字：中文长答更顺滑、不拖沓
      })
    }, 28)
    return () => window.clearInterval(id)
  }, [text, animate])
  return { typed: text.slice(0, n), done: n >= text.length }
}

function QuickAction({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-1.5 rounded-2xl border bg-card py-3 transition duration-200 ease-[var(--ease-out)] hover:border-primary/30 hover:bg-accent/40 active:scale-[0.96]"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary/15">{icon}</span>
      <span className="text-[12px] font-medium text-foreground">{label}</span>
      {badge ? (
        <span className="absolute right-1.5 top-1.5 flex min-w-[17px] items-center justify-center rounded-full bg-sweet px-1 text-[10px] font-semibold text-sweet-foreground shadow-sm">{badge}</span>
      ) : null}
    </button>
  )
}

function StatusBadge({ status, stalled, t }: { status: string; stalled: boolean; t: (k: string) => string }) {
  const map: Record<string, { t: string; c: string }> = {
    idle: { t: t('st_idle'), c: 'text-muted-foreground' },
    connecting: { t: t('st_connecting'), c: 'text-amber-600' },
    buffering: { t: t('st_buffering'), c: 'text-amber-600' },
    connected: { t: stalled ? t('st_buffering') : t('st_connected'), c: stalled ? 'text-amber-600' : 'text-emerald-600' },
    error: { t: t('st_error'), c: 'text-red-600' },
  }
  const s = map[status] || map.idle
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur', s.c)}>
      <span className="size-1.5 rounded-full bg-current" />
      {s.t}
    </span>
  )
}

function EmotionPill({ emotion }: { emotion: string }) {
  const meta = EMO_META[emotion]
  if (!meta) return <Pill tone="amber">{emotion}</Pill>
  return <Pill tone="amber"><meta.Icon className="size-3" weight="duotone" /> {meta.label}</Pill>
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'amber' | 'muted' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur',
      tone === 'amber' ? 'text-amber-600' : tone === 'muted' ? 'text-muted-foreground' : 'text-primary',
    )}>
      {children}
    </span>
  )
}

function IconButton({ children, onClick, disabled, label, state }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; state?: string
}) {
  return (
    <button
      aria-label={label} onClick={onClick} disabled={disabled}
      className={cn(
        'flex size-10 items-center justify-center rounded-full text-foreground transition duration-200 ease-[var(--ease-out)] active:scale-90 disabled:opacity-40',
        state === 'recording' ? 'animate-pulse bg-red-500 text-white' :
        state === 'listening' ? 'bg-blue-100 text-blue-600' :
        state === 'recognizing' ? 'bg-amber-100 text-amber-600' : 'bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function Dot({ d = 0 }: { d?: number }) {
  return <span className="size-1.5 animate-[pulse_1.1s_ease-in-out_infinite] rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}ms` }} />
}

function intentLabel(i: string) {
  return ({ qa: '问答', navigation: '指路', recommend: '推荐', empathy: '关怀', chitchat: '闲聊' } as Record<string, string>)[i] || '问答'
}
