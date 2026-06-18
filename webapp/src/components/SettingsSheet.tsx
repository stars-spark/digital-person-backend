import { Globe, TextAa, Sun, Moon, CircleHalf, UserCircle, CaretRight, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { LANGS, makeT } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import type { DarkMode } from '@/lib/theme'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void
  lang: Lang; setLang: (l: Lang) => void
  elder: boolean; setElder: (e: boolean) => void
  dark: DarkMode; setDark: (m: DarkMode) => void
  onOpenAvatar: () => void
  onReplay: () => void
}

export default function SettingsSheet({ open, onOpenChange, lang, setLang, elder, setElder, dark, setDark, onOpenAvatar, onReplay }: Props) {
  const t = makeT(lang)
  const MODES: { id: DarkMode; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: t('mode_light'), icon: <Sun className="size-4" weight="duotone" /> },
    { id: 'dark', label: t('mode_dark'), icon: <Moon className="size-4" weight="duotone" /> },
    { id: 'system', label: t('mode_system'), icon: <CircleHalf className="size-4" weight="duotone" /> },
  ]
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[480px]">
        <DrawerHeader>
          <DrawerTitle>{t('set_title')}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-5 px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          {/* 数字人形象（管理端默认 + 游客精调） */}
          <button
            onClick={() => { onOpenChange(false); onOpenAvatar() }}
            className="flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition duration-200 ease-[var(--ease-out)] hover:border-primary/30 active:scale-[0.99]"
          >
            <UserCircle className="size-5 text-primary" weight="duotone" />
            <span className="flex-1">
              <span className="block text-sm font-medium">{t('set_avatar')}</span>
              <span className="block text-[12px] text-muted-foreground">{t('set_avatar_sub')}</span>
            </span>
            <CaretRight className="size-4 text-muted-foreground" />
          </button>

          {/* 重看开场（重新选景区与偏好） */}
          <button
            onClick={() => { onOpenChange(false); onReplay() }}
            className="flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition duration-200 ease-[var(--ease-out)] hover:border-primary/30 active:scale-[0.99]"
          >
            <ArrowCounterClockwise className="size-5 text-primary" weight="duotone" />
            <span className="flex-1">
              <span className="block text-sm font-medium">{t('ob_replay')}</span>
              <span className="block text-[12px] text-muted-foreground">{t('ob_replay_sub')}</span>
            </span>
            <CaretRight className="size-4 text-muted-foreground" />
          </button>

          {/* 语言 */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <Globe className="size-4" /> {t('set_lang')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={cn('rounded-xl border px-4 py-3 text-sm font-medium transition duration-200 ease-[var(--ease-out)] active:scale-[0.98]',
                    lang === l.id ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25' : 'bg-card hover:border-primary/30')}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* 外观（深色模式） */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <CircleHalf className="size-4" /> {t('set_appearance')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDark(m.id)}
                  className={cn('flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[13px] font-medium transition duration-200 ease-[var(--ease-out)] active:scale-[0.97]',
                    dark === m.id ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25' : 'bg-card hover:border-primary/30')}
                >
                  {m.icon}{m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 适老模式 */}
          <button
            onClick={() => setElder(!elder)}
            className="flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left active:scale-[0.99]"
          >
            <TextAa className="size-5 text-primary" weight="duotone" />
            <span className="flex-1 text-sm font-medium">{t('set_elder')}</span>
            <span className={cn('relative h-6 w-11 rounded-full transition duration-200 ease-[var(--ease-out)]', elder ? 'bg-primary' : 'bg-muted')}>
              <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200 ease-[var(--ease-out)]', elder ? 'left-[22px]' : 'left-0.5')} />
            </span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
