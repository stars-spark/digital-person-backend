import { useEffect, useState } from 'react'
import { Sparkle, Check, Globe } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { GROUP_ICONS, INTEREST_ICONS } from '@/lib/icons'
import { GROUPS, INTERESTS, LANGS, makeT } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import { SCENICS } from '@/hooks/useGuide'

interface Props {
  lang: Lang; setLang: (l: Lang) => void
  scenic: string; setScenic: (s: string) => void
  groupType: string; setGroupType: (g: string) => void
  interests: string[]; setInterests: (fn: (prev: string[]) => string[]) => void
  guideName: string
  avatarPref: string
  onEnter: () => void
}

// 打字机问候：切语言自动重打；prefers-reduced-motion 下直接呈现全文
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
function useTypewriter(text: string, speed = 65) {
  const [n, setN] = useState(() => (prefersReduced() ? text.length : 0))
  useEffect(() => {
    if (prefersReduced()) { setN(text.length); return }
    setN(0)
    const id = window.setInterval(() => {
      setN((p) => {
        if (p >= text.length) { window.clearInterval(id); return p }
        return p + 1
      })
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed])
  return { typed: text.slice(0, n), done: n >= text.length }
}

const FALLBACK_AVATAR = '/avatars/female_sweet.jpg'

export default function Onboarding({ lang, setLang, scenic, setScenic, groupType, setGroupType, interests, setInterests, guideName, avatarPref, onEnter }: Props) {
  const t = makeT(lang)
  const toggleInterest = (id: string) =>
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const greeting = t('ob_greet')
  const { typed, done } = useTypewriter(greeting)
  const avatarSrc = avatarPref ? `/avatars/${avatarPref}.jpg` : FALLBACK_AVATAR

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-gradient-to-b from-primary/[0.08] via-background to-background">
      {/* 语言切换 */}
      <div className="anim-fade-up flex justify-end px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1 rounded-full border bg-card/80 p-1 shadow-sm backdrop-blur">
          <Globe className="ml-1.5 size-3.5 text-muted-foreground" />
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLang(l.id)}
              className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition',
                lang === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-4 pt-2">
        {/* 品牌（紧凑横排：头像才是主角） */}
        <div className="anim-fade-up flex items-center justify-center gap-2" style={{ animationDelay: '60ms' }}>
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/65 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25">
            途
          </div>
          <span className="text-[15px] font-semibold tracking-tight">途叨叨</span>
        </div>

        {/* 数字人迎宾 hero */}
        <div className="anim-fade-up relative self-center" style={{ animationDelay: '140ms' }}>
          <span
            aria-hidden
            className="absolute -inset-3 rounded-[2.2rem] bg-primary/25 blur-2xl motion-safe:animate-[halo-breathe_3.2s_var(--ease-out)_infinite]"
          />
          <img
            src={avatarSrc}
            alt=""
            width={360}
            height={640}
            fetchPriority="high"
            onError={(e) => { if (e.currentTarget.src !== location.origin + FALLBACK_AVATAR) e.currentTarget.src = FALLBACK_AVATAR }}
            className="relative h-[176px] w-[136px] rounded-[1.75rem] border object-cover object-top shadow-lg shadow-primary/20 ring-1 ring-primary/25"
          />
          <span className="absolute bottom-2 right-2 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
        </div>

        {/* 打字机问候 */}
        <div className="anim-fade-up min-h-[76px] text-center" style={{ animationDelay: '240ms' }}>
          <h1 aria-label={greeting} className="text-[21px] font-bold tracking-tight">
            {typed}
            {!done && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-primary motion-safe:animate-[caret-blink_1s_steps(1)_infinite]"
              />
            )}
          </h1>
          <p className="mt-1.5 px-4 text-[13px] leading-relaxed text-muted-foreground">{t('ob_greet_sub')}</p>
        </div>

        {/* 景区：横滑实景卡片 */}
        <div className="anim-fade-up flex flex-col gap-2.5" style={{ animationDelay: '340ms' }}>
          <h2 className="text-[13px] font-semibold text-muted-foreground">{t('ob_scenic')}</h2>
          <div className="-mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {SCENICS.map((s) => {
              const on = scenic === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setScenic(s.id)}
                  className={cn(
                    'relative h-[72px] w-[104px] shrink-0 snap-start overflow-hidden rounded-2xl border transition duration-200 ease-[var(--ease-out)] active:scale-[0.97]',
                    on ? 'ring-2 ring-primary' : 'opacity-90 hover:opacity-100',
                  )}
                >
                  <img
                    src={`/postcard/${s.id}.jpg`}
                    alt={s.name}
                    width={104}
                    height={72}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 text-[12px] font-medium text-white">{s.name}</span>
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-[12px] font-medium text-primary">{t('ob_guide_wait', { guide: guideName })}</p>
        </div>

        {/* 同行 */}
        <div className="anim-fade-up flex flex-col gap-2.5" style={{ animationDelay: '420ms' }}>
          <h2 className="text-[13px] font-semibold text-muted-foreground">{t('ob_who')}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {GROUPS.map((gp) => {
              const GIcon = GROUP_ICONS[gp.id]
              return (
                <button
                  key={gp.id}
                  onClick={() => setGroupType(gp.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition duration-200 ease-[var(--ease-out)] hover:border-primary/30 active:scale-[0.98]',
                    groupType === gp.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card',
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {GIcon && <GIcon className="size-[18px]" weight="duotone" />}
                  </span>
                  <span className="text-[13px] font-medium">{gp.label[lang]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 兴趣 */}
        <div className="anim-fade-up flex flex-col gap-2.5" style={{ animationDelay: '500ms' }}>
          <h2 className="text-[13px] font-semibold text-muted-foreground">{t('ob_interest')}</h2>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((it) => {
              const on = interests.includes(it.id)
              const IIcon = INTEREST_ICONS[it.id]
              return (
                <button
                  key={it.id}
                  onClick={() => toggleInterest(it.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition duration-200 ease-[var(--ease-out)] active:scale-95',
                    on ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25' : 'bg-card text-foreground hover:border-primary/30',
                  )}
                >
                  {IIcon && <IIcon className={cn('size-4', !on && 'text-primary')} weight="duotone" />}
                  {it.label[lang]}
                  {on && <Check className="size-3.5" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 底部 CTA */}
      <div className="sticky bottom-0 border-t bg-background/85 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="anim-fade-up" style={{ animationDelay: '600ms' }}>
          <button
            onClick={onEnter}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition duration-200 ease-[var(--ease-out)] hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
          >
            <Sparkle className="size-4" weight="duotone" /> {t('ob_enter')}
          </button>
          <button onClick={onEnter} className="mt-2 w-full text-center text-[13px] text-muted-foreground">
            {t('ob_skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
