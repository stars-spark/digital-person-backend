import { useEffect, useState } from 'react'
import { MapPin, Crosshair, SpeakerHigh, CircleNotch, NavigationArrow } from '@phosphor-icons/react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import * as api from '@/lib/api'
import type { NearbyItem, SimSpot } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void
  scenic: string
  onAsk: (stationName: string) => void
}

export default function GpsSheet({ open, onOpenChange, scenic, onAsk }: Props) {
  const [items, setItems] = useState<NearbyItem[]>([])
  const [sims, setSims] = useState<SimSpot[]>([])
  const [origin, setOrigin] = useState('')      // 当前定位来源描述
  const [locating, setLocating] = useState(false)
  const [err, setErr] = useState('')

  // 抽屉打开时拉模拟点（即使没真实 GPS 也能演示）
  useEffect(() => {
    if (!open) return
    api.nearby(scenic).then((r) => setSims(r.sim_spots)).catch(() => setSims([]))
  }, [open, scenic])

  const resolve = async (lat: number, lng: number, label: string) => {
    setErr('')
    const r = await api.nearby(scenic, lat, lng)
    setItems(r.items)
    setOrigin(label)
    if (!r.items.length) setErr('该景区暂未配置坐标')
  }

  const useRealGps = () => {
    setErr(''); setLocating(true)
    if (!navigator.geolocation) { setErr('设备不支持定位'); setLocating(false); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); resolve(pos.coords.latitude, pos.coords.longitude, '你的真实位置') },
      (e) => { setLocating(false); setErr('定位失败（需 HTTPS 授权）：' + e.message) },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const speak = (name: string) => { onAsk(name); onOpenChange(false) }

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setItems([]); setOrigin(''); setErr('') } }}>
      <DrawerContent className="mx-auto max-h-[88vh] max-w-[480px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <NavigationArrow className="size-[18px]" weight="duotone" />
            </span>
            定位讲解
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
          {/* 真实定位 */}
          <button
            onClick={useRealGps}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition duration-200 ease-[var(--ease-out)] hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-60"
          >
            {locating ? <CircleNotch className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
            {locating ? '定位中…' : '用我的真实位置'}
          </button>

          {/* 模拟位置（室内/异地演示） */}
          {sims.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[13px] font-semibold text-muted-foreground">或选个位置演示</div>
              <div className="flex flex-wrap gap-2">
                {sims.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => resolve(s.lat, s.lng, s.label)}
                    className={cn('rounded-full border px-3.5 py-2 text-[13px] font-medium transition duration-200 ease-[var(--ease-out)] active:scale-95',
                      origin === s.label ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25' : 'bg-card hover:border-primary/30')}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{err}</p>}

          {/* 结果：最近景点 */}
          {items.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <MapPin className="size-3.5 text-primary" weight="duotone" />
                <span>从「{origin}」出发，离你最近的</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((it, i) => (
                  <div key={it.name}
                    className={cn('flex items-center gap-3 rounded-2xl border p-3.5 transition duration-200 ease-[var(--ease-out)]',
                      i === 0 ? 'border-sweet/40 bg-sweet/[0.07]' : 'bg-card')}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        {it.name}
                        {i === 0 && <span className="rounded-full bg-sweet px-1.5 py-0.5 text-[10px] font-medium text-sweet-foreground shadow-sm">最近</span>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">约 {it.distance} 米</div>
                    </div>
                    <button
                      onClick={() => speak(it.name)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[13px] font-medium text-primary transition duration-200 ease-[var(--ease-out)] hover:bg-primary/15 active:scale-95"
                    >
                      <SpeakerHigh className="size-3.5" /> 听讲解
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
