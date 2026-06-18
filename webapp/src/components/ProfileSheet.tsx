import { IdentificationCard } from '@phosphor-icons/react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { GROUPS, INTERESTS } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// 可调画像：中途改「同行人 / 兴趣」。即改即生效（写偏好），关联的「为你定制」推荐随之重算。
export default function ProfileSheet({ open, onOpenChange, lang, groupType, setGroupType, interests, setInterests }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  lang: Lang
  groupType: string
  setGroupType: (g: string) => void
  interests: string[]
  setInterests: (v: string[]) => void
}) {
  const toggle = (id: string) => setInterests(interests.includes(id) ? interests.filter((x) => x !== id) : [...interests, id])
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[88vh] max-w-[480px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IdentificationCard className="size-[18px]" weight="duotone" />
            </span>
            你的画像
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">改完「为你定制」推荐会按新画像立即更新。</p>
          <div>
            <div className="mb-2 text-[13px] font-semibold">和谁一起</div>
            <div className="grid grid-cols-2 gap-2">
              {GROUPS.map((gp) => (
                <button
                  key={gp.id}
                  onClick={() => setGroupType(gp.id)}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-[14px] font-medium transition duration-200 active:scale-[0.97]',
                    groupType === gp.id ? 'border-primary bg-primary/[0.06] text-primary' : 'hover:bg-accent/40',
                  )}
                >
                  {gp.label[lang]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-semibold">感兴趣的<span className="ml-1 text-[11px] font-normal text-muted-foreground">可多选</span></div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((it) => (
                <button
                  key={it.id}
                  onClick={() => toggle(it.id)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition duration-200 active:scale-95',
                    interests.includes(it.id) ? 'border-primary bg-primary/[0.06] text-primary' : 'hover:bg-accent/40',
                  )}
                >
                  {it.label[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
