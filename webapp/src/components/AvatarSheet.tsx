import { useEffect, useMemo, useRef, useState } from 'react'
import {
  UserCircle, SpeakerHigh, ArrowCounterClockwise, Clock, Mountains,
  MagicWand, TShirt, Play, Pause, CaretRight, CheckCircle, Sparkle,
} from '@phosphor-icons/react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import * as api from '@/lib/api'
import type { AvatarPreset, VoicePreset, BackgroundPreset, DhConfig } from '@/lib/api'
import { EMO_META } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void
  scenic: string
  voiceId: string; setVoiceId: (v: string) => void
  avatarPref: string; setAvatarPref: (a: string) => void
}

type GenderFilter = 'all' | 'female' | 'male'
type StyleTab = '推荐' | '现代' | '古风' | '民族'
const STYLE_TABS: StyleTab[] = ['推荐', '现代', '古风', '民族']

// face16 甜美脸的换装变体——后端 presets 暂无 identity 分组字段，前端按约定把这批 id 归入
// 甜美脸的「衣橱」（移出形象库网格）。后端日后加 base/identity 字段可平滑替换此常量（已留【需窗口①】）。
const SWEET_BASE_ID = 'female_sweet'
const SWEET_OUTFIT_IDS = ['outfit_qipao', 'outfit_hanfu', 'outfit_blazer', 'outfit_ethnic', 'outfit_vest', 'outfit_coat']
const SWEET_FAMILY = new Set([SWEET_BASE_ID, ...SWEET_OUTFIT_IDS])

// 景区风格倾向（启发式：给「为本景区推荐」浮顶/徽章用，零后端依赖）
const SCENIC_STYLE_HINT: Record<string, StyleTab> = {
  lingshan: '古风', nihuawan: '古风', gugong: '古风', xihu: '古风', huangshan: '现代',
}
// 舞台底部「会随对话切换表情」提示用的三态（呼应 RAG [情绪:X] → Ditto 表情条件）
const STAGE_EMOS: (keyof typeof EMO_META)[] = ['neutral', 'happy', 'concerned']

export default function AvatarSheet({ open, onOpenChange, scenic, voiceId, setVoiceId, avatarPref, setAvatarPref }: Props) {
  const [avatars, setAvatars] = useState<AvatarPreset[]>([])
  const [voices, setVoices] = useState<VoicePreset[]>([])
  const [backgrounds, setBackgrounds] = useState<BackgroundPreset[]>([])
  const [cfg, setCfg] = useState<DhConfig | null>(null)
  const [styleTab, setStyleTab] = useState<StyleTab>('推荐')
  const [gender, setGender] = useState<GenderFilter>('all')
  const [focusId, setFocusId] = useState('')      // 舞台聚焦的形象（默认=当前生效，点卡/试穿即变）
  const [aiOpen, setAiOpen] = useState(false)     // AI 定制面板展开
  const [playing, setPlaying] = useState('')      // 正在试听的音色 id
  const [switching, setSwitching] = useState('')  // 正在热切的形象 id（直播换形象中）
  const [sampleIds, setSampleIds] = useState<Set<string>>(new Set())  // 已就位的样音（manifest 列出，控制播放键显隐）
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // AI 定制：描述 → 万相人景一体生成 → 即时入库可驱动
  const [genPrompt, setGenPrompt] = useState('')
  const [genGender, setGenGender] = useState<'female' | 'male'>('female')
  const [genBusy, setGenBusy] = useState(false)
  const [genErr, setGenErr] = useState('')

  // 当前生效：游客精调优先，否则管理端景区默认
  const activeAvatar = avatarPref || cfg?.avatar_id || ''
  const activeVoice = voiceId || cfg?.voice_id || ''
  const customized = Boolean(avatarPref || voiceId)
  const recoStyle = SCENIC_STYLE_HINT[scenic]

  useEffect(() => {
    if (!open) return
    api.dhPresets()
      .then((p) => { setAvatars(p.avatars.filter((a) => !a.legacy)); setVoices(p.voices); setBackgrounds(p.backgrounds ?? []) })
      .catch(() => {})
    api.dhConfig(scenic).then(setCfg).catch(() => {})
  }, [open, scenic])

  // 开抽屉 / 生效形象变化 → 舞台聚焦回到当前生效形象（试穿不改 activeAvatar，故不会被打断）
  useEffect(() => { if (open) setFocusId(activeAvatar) }, [open, activeAvatar])

  // 样音清单（窗口①异步交付）：读 manifest 决定哪些音色显示播放键。manifest 缺失/为空 → 无播放键，
  // 界面干净不留死按钮、零 404 噪音（沿用项目 faq/manifest.json 约定）。窗口①补样音时更新此清单即生效。
  useEffect(() => {
    if (!open) return
    let alive = true
    fetch('/voice_samples/manifest.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: string[]) => { if (alive) setSampleIds(new Set(Array.isArray(ids) ? ids : [])) })
      .catch(() => {})
    return () => { alive = false }
  }, [open])

  // 形象库网格只放「独立身份」（甜美换装移交衣橱）；按风格 tab + 性别筛，命中本景区风格者浮顶
  const identities = useMemo(
    () => avatars.filter((a) => !SWEET_OUTFIT_IDS.includes(a.id)),
    [avatars],
  )
  const shown = useMemo(() => {
    const list = identities.filter((a) =>
      (styleTab === '推荐' ? a.recommended : a.style === styleTab) &&
      (gender === 'all' || a.gender === gender),
    )
    // 「为本景区推荐」（风格命中）浮顶
    return [...list].sort((a, b) => Number(b.style === recoStyle) - Number(a.style === recoStyle))
  }, [identities, styleTab, gender, recoStyle])

  // 甜美脸衣橱：base + 6 套换装（按 SWEET_OUTFIT_IDS 顺序）
  const sweetWardrobe = useMemo(() => {
    const byId = new Map(avatars.map((a) => [a.id, a]))
    return [SWEET_BASE_ID, ...SWEET_OUTFIT_IDS].map((id) => byId.get(id)).filter(Boolean) as AvatarPreset[]
  }, [avatars])

  const focus = useMemo(() => avatars.find((a) => a.id === focusId), [avatars, focusId])
  const focusIsSweet = SWEET_FAMILY.has(focusId)
  const bg = backgrounds.find((b) => b.id === (cfg?.background_id || '')) || null

  // 提交一个形象：未烘（coming_soon）只更新舞台做「试穿」；已烘 → 落 avatarPref +
  // **热拔插**立即换上直播形象（不重连，~1s）。失败也保留偏好（下次唤醒兜底）。
  const pick = (a: AvatarPreset) => {
    setFocusId(a.id)
    if (a.coming_soon) return
    setAvatarPref(a.id)
    setSwitching(a.id)
    api.liveSetAvatar(a.id, scenic).finally(() => setSwitching((s) => (s === a.id ? '' : s)))
  }
  const reset = () => { setAvatarPref(''); setVoiceId(''); setPlaying(''); audioRef.current?.pause() }

  // AI 定制：生成 → 新形象加入库 + 聚焦 + 热切上身（生成端点已落双比例底板，ready 即可驱动）
  const handleGenerate = async () => {
    if (genBusy) return
    setGenBusy(true); setGenErr('')
    const r = await api.generateAvatar({
      prompt: genPrompt.trim(), scenic_id: scenic, gender: genGender,
      style: recoStyle && recoStyle !== '推荐' ? recoStyle : '现代',
    })
    setGenBusy(false)
    if (!r.ok || !r.avatar) { setGenErr(r.detail || '生成失败，请稍后重试'); return }
    setAvatars((prev) => [r.avatar!, ...prev])
    setGenPrompt('')
    pick(r.avatar)   // 落 avatarPref + 热切上身
  }

  const toggleSample = (id: string) => {
    const el = audioRef.current
    if (!el) return
    if (playing === id) { el.pause(); setPlaying(''); return }
    el.src = `/voice_samples/${id}.mp3`
    el.play().then(() => setPlaying(id)).catch(() => {
      setSampleIds((p) => { const n = new Set(p); n.delete(id); return n }); setPlaying('')
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-[480px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserCircle className="size-[18px]" weight="duotone" />
            </span>
            形象工坊
            {customized && (
              <button onClick={reset} className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground active:scale-95">
                <ArrowCounterClockwise className="size-3" /> 恢复景区默认
              </button>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
          {/* —— A. 实时预览舞台 —— */}
          <div className="relative overflow-hidden rounded-3xl border bg-card">
            {/* 背景层：景区场景预览（轻虚化 + 压暗）；缺图回落主色柔光 */}
            <div className="absolute inset-0">
              {bg?.preview
                ? <img src={bg.preview} alt="" className="size-full scale-110 object-cover blur-[2px]" />
                : <div className="size-full bg-gradient-to-br from-primary/25 to-primary/5" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />
            </div>
            {/* 前景：聚焦形象立绘 + 呼吸光环 */}
            <div className="relative flex items-end gap-3.5 px-4 pb-3.5 pt-6">
              <div className="relative shrink-0">
                <div className="absolute -inset-2 rounded-[1.6rem] bg-primary/30 blur-2xl motion-safe:animate-[halo-breathe_3.6s_var(--ease-out)_infinite]" />
                {focus?.preview && (
                  <img
                    src={focus.preview} alt={focus.name}
                    className="relative h-32 w-[104px] rounded-[1.4rem] object-cover object-top shadow-lg shadow-black/30 ring-1 ring-white/35"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-0.5 text-white">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[17px] font-semibold tracking-tight drop-shadow">{focus?.name || '选择你的向导'}</span>
                  {focus?.age && <span className="shrink-0 rounded bg-white/20 px-1.5 text-[10px] backdrop-blur-sm">{focus.age}</span>}
                </div>
                {focus?.persona && <div className="mt-0.5 text-[12.5px] text-white/85 drop-shadow">{focus.persona}</div>}
                {/* 音色 + 表情条 */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] backdrop-blur-sm">
                    <SpeakerHigh className="size-3" weight="duotone" />
                    {voices.find((v) => v.id === activeVoice)?.name || '默认音色'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] backdrop-blur-sm">
                    {STAGE_EMOS.map((e) => { const M = EMO_META[e]; const I = M.Icon; return <I key={e} className="size-3" weight="duotone" /> })}
                    随对话切换表情
                  </span>
                </div>
              </div>
              {/* 右上徽章 */}
              <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
                {focus && focus.style === recoStyle && !focus.coming_soon && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow">为本景区推荐</span>
                )}
                {focus && focus.id === cfg?.avatar_id && (
                  <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-foreground shadow">景区默认</span>
                )}
              </div>
            </div>
          </div>
          {/* 舞台状态语 */}
          {focus?.coming_soon
            ? <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
                <Clock className="size-3.5 shrink-0" /> 试穿预览 · 此造型即将上线，正在烘焙中
              </p>
            : switching && switching === focus?.id
              ? <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-primary/[0.07] px-3 py-2 text-[12.5px] text-primary">
                  <Sparkle className="size-3.5 shrink-0 motion-safe:animate-pulse" weight="duotone" /> 正在为你换上「{focus?.name}」…
                </p>
              : avatarPref && focus?.id === avatarPref
                ? <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-primary/[0.07] px-3 py-2 text-[12.5px] text-primary">
                    <CheckCircle className="size-3.5 shrink-0" weight="duotone" /> 已换上 · 直播画面已切换为此形象
                  </p>
                : null}

          {/* —— B. 形象库（身份为主轴）—— */}
          <div className="mb-2 mt-5 text-[13px] font-semibold text-muted-foreground">形象 · 身份</div>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {STYLE_TABS.map((s) => (
              <button key={s} onClick={() => setStyleTab(s)}
                className={cn('flex-1 rounded-full py-1.5 text-[12.5px] font-medium transition duration-200 ease-[var(--ease-out)]',
                  styleTab === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                {s}
              </button>
            ))}
          </div>
          <div className="mb-2.5 mt-2 flex gap-1.5">
            {([['all', '全部'], ['female', '女'], ['male', '男']] as [GenderFilter, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setGender(id)}
                className={cn('rounded-full border px-3 py-1 text-[12px] font-medium transition duration-200 ease-[var(--ease-out)] active:scale-95',
                  gender === id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {shown.map((a) => {
              const active = a.id === activeAvatar
              const focused = a.id === focusId
              const isDefault = a.id === cfg?.avatar_id
              const isReco = a.style === recoStyle && !a.coming_soon
              return (
                <button
                  key={a.id}
                  onClick={() => pick(a)}
                  className={cn('group relative overflow-hidden rounded-2xl border text-left transition duration-200 ease-[var(--ease-out)] active:scale-[0.98]',
                    active ? 'border-primary ring-2 ring-primary' : focused ? 'border-primary/60 ring-1 ring-primary/40' : 'bg-card hover:border-primary/35')}
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-secondary">
                    {a.preview && (
                      <img src={a.preview} alt={a.name} loading="lazy"
                        className={cn('size-full object-cover object-top', a.coming_soon && 'grayscale-[0.3]')} />
                    )}
                    {a.persona && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">{a.persona}</span>
                    )}
                    {isReco && <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9.5px] font-medium text-primary-foreground shadow-sm">为本景区推荐</span>}
                    {!isReco && isDefault && !a.coming_soon && <span className="absolute left-1.5 top-1.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[9.5px] font-medium text-foreground shadow-sm backdrop-blur">景区默认</span>}
                    {a.coming_soon && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                        <Clock className="size-2.5" /> 即将上线
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold">{a.name}</span>
                      {a.age && <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">{a.age}</span>}
                    </div>
                    {a.fit && <div className="mt-1 truncate text-[10.5px] text-muted-foreground">适配 · {a.fit}</div>}
                  </div>
                </button>
              )
            })}
            {!shown.length && <p className="col-span-2 py-6 text-center text-[13px] text-muted-foreground">该分类下暂无形象</p>}
          </div>

          {/* —— C. 换装衣橱（聚焦甜美脸时出现，坐实「形象可配置服装」）—— */}
          {focusIsSweet && sweetWardrobe.length > 1 && (
            <>
              <div className="mb-1 mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                <TShirt className="size-4" weight="duotone" /> 换装衣橱
              </div>
              <p className="mb-2 text-[11.5px] text-muted-foreground">同一位向导，多套服装 · 一键切换造型</p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sweetWardrobe.map((a) => {
                  const focused = a.id === focusId
                  return (
                    <button key={a.id} onClick={() => pick(a)}
                      className={cn('group relative w-16 shrink-0 snap-start overflow-hidden rounded-xl border transition duration-200 ease-[var(--ease-out)] active:scale-95',
                        focused ? 'border-primary ring-2 ring-primary' : 'bg-card hover:border-primary/40')}>
                      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                        {a.preview && <img src={a.preview} alt={a.outfit || a.name} loading="lazy" className={cn('size-full object-cover object-top', a.coming_soon && 'grayscale-[0.3]')} />}
                        {a.coming_soon && <span className="absolute right-1 top-1 inline-flex items-center justify-center rounded-full bg-background/90 p-0.5 text-muted-foreground shadow-sm backdrop-blur"><Clock className="size-2.5" /></span>}
                      </div>
                      <div className="truncate px-1 py-1 text-center text-[10.5px] font-medium">{a.outfit || a.name}</div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* —— D. AI 定制形象入口（自研亮点）—— */}
          <button onClick={() => setAiOpen((v) => !v)}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-3.5 text-left transition duration-200 ease-[var(--ease-out)] hover:bg-primary/[0.07] active:scale-[0.99]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <MagicWand className="size-5" weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">生成你的专属向导</span>
              <span className="block truncate text-[12px] text-muted-foreground">一句话描述 · AI 当场生成「人景一体」形象，即刻上身</span>
            </span>
            <CaretRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', aiOpen && 'rotate-90')} />
          </button>
          {aiOpen && (
            <div className="mt-2 rounded-2xl border bg-card p-3.5">
              <p className="mb-2.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                <Sparkle className="mt-0.5 size-3.5 shrink-0 text-primary" weight="duotone" />
                <span>自研流程：<span className="text-foreground">描述向导形象 → 万相文生图「人景一体」生成 → 落盘可驱动底板</span>，生成后立即加入形象库并上身直播。</span>
              </p>
              {/* 性别 */}
              <div className="mb-2 flex gap-1.5">
                {(['female', 'male'] as const).map((gd) => (
                  <button key={gd} onClick={() => setGenGender(gd)} disabled={genBusy}
                    className={cn('flex-1 rounded-lg border py-1.5 text-[12.5px] transition active:scale-[0.99] disabled:opacity-50',
                      genGender === gd ? 'border-primary bg-primary/[0.06] text-primary' : 'text-muted-foreground')}>
                    {gd === 'female' ? '女向导' : '男向导'}
                  </button>
                ))}
              </div>
              <textarea value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} disabled={genBusy}
                rows={2} maxLength={60}
                placeholder="如：身着米色针织衫、温柔亲切的年轻女导游"
                className="w-full resize-none rounded-lg border bg-background px-2.5 py-2 text-[13px] outline-none transition focus:border-primary/50 disabled:opacity-50" />
              <button onClick={handleGenerate} disabled={genBusy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13.5px] font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60">
                {genBusy
                  ? <><span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" /> 生成中 · 约 30 秒…</>
                  : <><MagicWand className="size-4" weight="duotone" /> 生成并加入形象库</>}
              </button>
              {genErr && <p className="mt-1.5 text-[11.5px] text-destructive">{genErr}</p>}
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">生成后将出现在「形象库 · 推荐」中，可随时切换；同一句描述会生成一位全新的向导。</p>
            </div>
          )}

          {/* —— 场景背景（按景区自动，只读展示）—— */}
          {bg?.id && (
            <>
              <div className="mb-2 mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                <Mountains className="size-4" weight="duotone" /> 场景背景
              </div>
              <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                {bg.preview && <img src={bg.preview} alt={bg.name} loading="lazy" className="h-12 w-9 shrink-0 rounded-lg object-cover" />}
                <span className="text-[14px] font-medium">{bg.name}</span>
                <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">随景区自动</span>
              </div>
            </>
          )}

          {/* —— E. 音色试听 —— */}
          <div className="mb-2 mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <SpeakerHigh className="size-4" weight="duotone" /> 声音
            <span className="font-normal">· 点选即刻生效</span>
          </div>
          {(['female', 'male'] as const).map((gd) => {
            const list = voices.filter((v) => v.gender === gd)
            if (!list.length) return null
            return (
              <div key={gd} className="mb-2.5">
                <div className="mb-1.5 text-[11.5px] text-muted-foreground">{gd === 'female' ? '女声' : '男声'}</div>
                <div className="flex flex-col gap-1.5">
                  {list.map((v) => {
                    const active = v.id === activeVoice
                    const isDefault = v.id === cfg?.voice_id
                    const canPlay = sampleIds.has(v.id)
                    return (
                      <div key={v.id}
                        className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition duration-200 ease-[var(--ease-out)]',
                          active ? 'border-primary bg-primary/[0.05] ring-1 ring-primary/30' : 'bg-card')}>
                        {canPlay && (
                          <button onClick={() => toggleSample(v.id)} aria-label={playing === v.id ? '暂停试听' : '试听'}
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition active:scale-90">
                            {playing === v.id ? <Pause className="size-3.5" weight="fill" /> : <Play className="size-3.5" weight="fill" />}
                          </button>
                        )}
                        <button onClick={() => setVoiceId(v.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:scale-[0.99]">
                          <span className={cn('size-2 shrink-0 rounded-full', active ? 'bg-primary' : 'bg-muted-foreground/25')} />
                          <span className="shrink-0 text-[14px] font-medium">{v.name}</span>
                          <span className="truncate text-[12px] text-muted-foreground">{v.tone}</span>
                          {isDefault && <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">景区默认</span>}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <audio ref={audioRef} className="hidden" onEnded={() => setPlaying('')} onError={() => setPlaying('')} />
      </DrawerContent>
    </Drawer>
  )
}
