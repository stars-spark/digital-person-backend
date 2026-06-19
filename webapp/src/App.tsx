import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Microphone, Camera, ArrowUp, Sparkle, MapPin, CircleNotch, GearSix,
  Compass, Lifebuoy, Medal, NavigationArrow, ChatCircleDots,
} from '@phosphor-icons/react'
import { useGuide, SCENICS } from '@/hooks/useGuide'
import type { Meta } from '@/hooks/useGuide'
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
import HistorySheet from '@/components/HistorySheet'
import RouteMapSheet from '@/components/RouteMapSheet'
import ForYouSection from '@/components/ForYouSection'
import ProfileSheet from '@/components/ProfileSheet'
import { MetaRow } from '@/components/MetaPills'
import { SCENIC_ROUTES } from '@/lib/routeData'
import { quickAsks } from '@/lib/personalize'
import type { RecoCard } from '@/lib/api'
import { load as loadTrace } from '@/lib/trace'
import { loadDarkMode, applyDarkMode } from '@/lib/theme'
import type { DarkMode } from '@/lib/theme'

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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [routeMapOpen, setRouteMapOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // 「跟我游」：有地图路线数据的景区 → 开地图版；否则回退清单版 TourSheet
  const openGuide = () => {
    if (SCENIC_ROUTES[g.scenic]) { g.track('feature_open', { feature: 'routemap' }); setRouteMapOpen(true) }
    else openFeature('tour', setTourOpen)
  }
  // 「为你定制」：进入主页 + 画像（景区/同行人/兴趣）变化时拉取个性化推荐
  useEffect(() => {
    if (onboarded) g.loadRecos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded, g.scenic, g.groupType, g.interests])
  // 推荐卡曝光埋点（两端共用：管理端大屏「推荐效果」据此聚合）
  useEffect(() => {
    if (g.recos.length > 0) g.track('reco_impression', { count: g.recos.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.recos])
  // 点推荐卡：埋点 + 按 action 路由（问导游 / 开跟我游 / 开设施）
  const handleReco = (c: RecoCard) => {
    g.track('reco_click', { title: c.title, action: c.action })
    if (c.action === 'route') openGuide()
    else if (c.action === 'facility') openFeature('facility', setFacOpen)
    else g.ask(c.query || c.title)
  }
  const connected = g.status === 'connected'
  const t = makeT(g.lang)
  // 快问 chips 按画像挑选（同行人×兴趣）：亲子看「带孩子玩什么」、长辈看「哪里能歇脚」、拍照看「拍照机位」
  const suggestions = useMemo(() => quickAsks(g.groupType, g.interests, g.lang), [g.groupType, g.interests, g.lang])
  // 舞台成片(含手势欢迎片 / L1 缓存片)→ 实时流的交叉淡出：clip 结束不硬切，~480ms 淡出露出底下实时流，
  // 把"有手→无手 / 半身→胸像 / 取景跳变"读成一次有意的过渡（手势欢迎片切实时问答的接缝平滑器）
  const [clipEnding, setClipEnding] = useState(false)
  useEffect(() => { setClipEnding(false) }, [g.clipUrl])   // 新片到来/清空 → 复位淡出态
  const fadeOutClip = () => { setClipEnding(true); window.setTimeout(() => { g.clearClip(); setClipEnding(false) }, 480) }
  const scenicName = SCENICS.find((s) => s.id === g.scenic)?.name || g.scenic
  // 舞台字幕的上下文：当前这轮的提问（思考/吐字期间显示，让「问→答」在脸边成对）
  const liveQ = (g.thinking || g.captionStreaming)
    ? [...g.messages].reverse().find((m) => m.role === 'user')?.text || ''
    : ''

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
        {/* 数字人舞台 + 字幕（成组：脸在上、话在下；字幕为独立条，不遮画面） */}
        <div className="flex flex-col gap-2">
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
              onEnded={fadeOutClip}
              className={cn(
                'absolute inset-0 z-30 size-full object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.42)] transition-opacity duration-500 ease-[var(--ease-out)]',
                clipEnding ? 'opacity-0' : 'opacity-100',
              )}
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

        </div>

          {/* 数字人字幕（独立条，紧贴画面正下方）= 唯一回答区：卡拉OK逐字 + 收尾显 meta 行 + 记录入口。
              location 走上下文小字，故传给 meta 行时剔除 location 防重复。 */}
          {connected && (g.thinking || g.captionStreaming || g.caption) && (
            <StageCaption
              text={g.caption}
              streaming={g.captionStreaming}
              thinking={g.thinking && !g.caption}
              question={liveQ}
              location={!g.captionStreaming ? g.meta.location : undefined}
              meta={!g.captionStreaming ? { ...g.meta, location: undefined } : undefined}
              hasHistory={g.messages.some((m) => m.role === 'user')}
              onOpenHistory={() => { g.track('feature_open', { feature: 'history' }); setHistoryOpen(true) }}
            />
          )}
        </div>

        {/* 今日游园建议卡 */}
        <TodayCard scenic={g.scenic} groupType={g.groupType} interests={g.interests} lang={g.lang} label={{ today: t('today'), tip: t('today_tip') }} />

        {/* 为你定制（个性化推荐区） */}
        <ForYouSection cards={g.recos} basis={g.recoBasis} loading={g.recosLoading} onCard={handleReco}
          onEditProfile={() => { g.track('feature_open', { feature: 'profile' }); setProfileOpen(true) }} />

        {/* 快捷功能 */}
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={<Compass className="size-[18px]" weight="duotone" />} label={t('qf_tour')} onClick={openGuide} />
          <QuickAction icon={<NavigationArrow className="size-[18px]" weight="duotone" />} label={t('qf_gps')} onClick={() => openFeature('gps', setGpsOpen)} />
          <QuickAction icon={<Lifebuoy className="size-[18px]" weight="duotone" />} label={t('qf_facility')} onClick={() => openFeature('facility', setFacOpen)} />
          <QuickAction icon={<Medal className="size-[18px]" weight="duotone" />} label={t('qf_trace')} onClick={() => openFeature('trace', setTraceOpen)} badge={g.trace.visited.length || undefined} />
        </div>

      </main>

      {/* 底部固定区：建议快问 chips（始终可见，吸附在输入坞正上方）+ 输入坞 */}
      <footer className="sticky bottom-0 z-20 border-t bg-background/85 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
        {/* 建议快问 */}
        <ScrollArea className="-mx-4 mb-2.5 w-[calc(100%+2rem)] whitespace-nowrap px-4">
          <div className="flex gap-2 pb-1">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => { g.track('quick_ask', { id: s.id }); g.ask(s.q) }}
                className="shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-[13px] font-medium shadow-sm transition duration-200 ease-[var(--ease-out)] hover:border-primary/30 hover:text-primary active:scale-95"
              >
                {s.label}
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
      <FacilitySheet open={facOpen} onOpenChange={setFacOpen} scenic={g.scenic} groupType={g.groupType} lang={g.lang} onAsk={(q) => g.ask(q)} />
      <GpsSheet open={gpsOpen} onOpenChange={setGpsOpen} scenic={g.scenic} onAsk={askStationVia('gps')} />
      <TraceSheet
        open={traceOpen} onOpenChange={setTraceOpen} trace={g.trace}
        onPostcard={() => { g.track('milestone', { kind: 'postcard' }); setTraceOpen(false); setPostcardOpen(true) }}
        onRate={(score) => { g.track('rating', { score }); g.recordRating(score) }}
      />
      <Postcard open={postcardOpen} onClose={() => setPostcardOpen(false)} scenic={g.scenic} scenicName={scenicName} guideName={g.guideName} groupType={g.groupType} lang={g.lang} trace={g.trace} />
      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} messages={g.messages} />
      <RouteMapSheet open={routeMapOpen} onOpenChange={setRouteMapOpen} route={SCENIC_ROUTES[g.scenic]} onAsk={(q) => g.ask(q)} />
      <ProfileSheet
        open={profileOpen} onOpenChange={setProfileOpen} lang={g.lang}
        groupType={g.groupType} setGroupType={g.setGroupType}
        interests={g.interests} setInterests={g.setInterests}
      />
    </div>
  )
}

// 舞台字幕（独立条，紧贴画面正下方）：数字人「正在说的话」卡拉OK逐字，画面零遮挡。
// 字幕有自己的卡片空间、可多行；内层小滚动容器始终吐到底、顶部 mask 渐隐 → 像真字幕只露当前一两句、
// older 向上淡出。关键：只滚自己这个小容器（programmatic），绝不碰页面滚动 → 不再被拽走。
// 左侧细竖条 + 主色微底 = 一眼看出「这是导游在说话」，与画面成「脸上·话下」一体。
function StageCaption({ text, streaming, thinking, question, location, meta, hasHistory, onOpenHistory }: {
  text: string; streaming: boolean; thinking: boolean; question?: string; location?: string
  meta?: Meta; hasHistory?: boolean; onOpenHistory?: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  // 顶部渐隐仅在内容真超高（需要内部滚动）时启用；放得下时不加遮罩，否则第一行会被淡掉=做工粗糙。
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [text])
  // 收尾态（非吐字中）才显 meta 行 + 记录入口；吐字中只留光标、专注读词
  const hasMeta = !!meta && !!(meta.intent || meta.emotion || meta.timing || meta.cached || meta.degraded || meta.greet)
  const showFooter = !streaming && (hasHistory || hasMeta)
  return (
    <div className="flex gap-2.5 rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/[0.06] to-card px-3.5 py-2.5 shadow-sm">
      <span aria-hidden className="mt-0.5 w-[3px] shrink-0 rounded-full bg-primary/60" />
      <div className="min-w-0 flex-1">
        {(location || question) && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            {location
              ? (<><MapPin className="size-3 shrink-0" /> <span className="truncate">{location}</span></>)
              : (<><ChatCircleDots className="size-3 shrink-0" weight="duotone" /> <span className="truncate">{question}</span></>)}
          </div>
        )}
        <div
          ref={ref}
          className={cn('max-h-[6em] overflow-hidden', overflowing && '[mask-image:linear-gradient(to_bottom,transparent,#000_1.4em)]')}
        >
          <p className="text-[15px] font-medium leading-relaxed text-foreground">
            {thinking
              ? (<span className="inline-flex items-center gap-1.5 text-muted-foreground">正在讲解 <span className="flex gap-1"><Dot /><Dot d={150} /><Dot d={300} /></span></span>)
              : text}
            {streaming && (
              <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-primary/70 motion-safe:animate-[caret-blink_1s_steps(1)_infinite]" />
            )}
          </p>
        </div>
        {showFooter && (
          <div className="mt-2 flex items-center gap-2">
            {hasMeta && meta && <MetaRow meta={meta} className="min-w-0 flex-1" />}
            {hasHistory && onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition duration-200 ease-[var(--ease-out)] hover:border-primary/30 hover:text-primary active:scale-95"
              >
                <ChatCircleDots className="size-3" weight="duotone" /> 记录
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
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
