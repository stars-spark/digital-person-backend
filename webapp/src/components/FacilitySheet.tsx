import { useEffect, useMemo, useState } from 'react'
import { NavigationArrow, Lifebuoy, MapPin, Sparkle } from '@phosphor-icons/react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { FACILITY_ICONS } from '@/lib/icons'
import { facilityRank, facilityHint } from '@/lib/personalize'
import type { Lang } from '@/lib/i18n'
import * as api from '@/lib/api'
import type { FacilityGroup } from '@/lib/api'

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void
  scenic: string; groupType: string; lang: Lang
  onAsk: (q: string) => void
}

export default function FacilitySheet({ open, onOpenChange, scenic, groupType, lang, onAsk }: Props) {
  const [groups, setGroups] = useState<FacilityGroup[]>([])
  useEffect(() => {
    if (!open) return
    api.facilities(scenic).then(setGroups).catch(() => setGroups([]))
  }, [open, scenic])
  // 按画像把最相关的设施类别提前（亲子→母婴/卫生间，长辈→休息/医务/无障碍）
  const ordered = useMemo(() => {
    const rank = facilityRank(groupType)
    return [...groups].sort((a, b) => rank(a.id) - rank(b.id))
  }, [groups, groupType])
  const hint = facilityHint(groupType, lang)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[88vh] max-w-[480px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lifebuoy className="size-[18px]" weight="duotone" />
            </span>
            设施速查
          </DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
          {hint && groups.length > 0 && (
            <div className="mb-2.5 flex items-center gap-1.5 rounded-xl bg-primary/[0.06] px-3 py-2 text-[12.5px] font-medium text-primary">
              <Sparkle className="size-3.5 shrink-0" weight="duotone" />{hint}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2.5">
            {ordered.map((g) => {
              const FIcon = FACILITY_ICONS[g.id] || MapPin
              return (
              <div key={g.id} className="rounded-2xl border bg-card p-3.5">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FIcon className="size-[18px]" weight="duotone" />
                  </span>{g.label}
                  <span className="text-xs font-normal text-muted-foreground">· {g.points.length} 处</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.points.map((p) => (
                    <span key={p} className="rounded-lg bg-muted px-2.5 py-1 text-[12.5px] text-foreground/80">{p}</span>
                  ))}
                </div>
              </div>
            )})}
            {!groups.length && <p className="py-8 text-center text-sm text-muted-foreground">该景区暂未配置设施信息</p>}
          </div>
          <button
            onClick={() => { onAsk('最近的卫生间怎么走'); onOpenChange(false) }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/60 bg-primary/[0.04] py-3 text-[14px] font-medium text-primary transition duration-200 ease-[var(--ease-out)] hover:bg-primary/[0.08] active:scale-[0.98]"
          >
            <NavigationArrow className="size-4" /> 问数字人「离我最近的怎么走」
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
