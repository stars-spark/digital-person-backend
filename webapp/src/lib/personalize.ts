// 画像驱动的轻量个性化（纯前端，0 后端依赖）：同一份「同行人×兴趣」既喂「为你定制」推荐卡，
// 也用来挑「快问 chips」、排「设施速查」、置顶「跟我游路线」——让游客在每个角落都感到"它懂我"。
import type { Lang } from '@/lib/i18n'

type L = Record<Lang, string>
interface Chip { id: string; label: L; q: string; group?: string; interests?: string[]; base?: boolean }

// 快问 chip 池：q 用中文（后端按 lang 参数出对应语言答案），label 四语本地化。
const POOL: Chip[] = [
  // —— 通用兜底（无画像信号时填充）——
  { id: 'route',   label: { zh: '推荐路线', en: 'Route', ja: 'おすすめ', ko: '추천 코스' }, q: '帮我推荐一条游览路线', base: true },
  { id: 'mustsee', label: { zh: '必看景点', en: 'Must-see', ja: '必見', ko: '필수 명소' }, q: '这个景区有哪些必看的景点？', base: true },
  { id: 'crowd',   label: { zh: '现在人多吗', en: 'Crowds?', ja: '混雑は？', ko: '혼잡도' }, q: '现在景区人多吗？怎么错峰？', base: true },
  { id: 'howto',   label: { zh: '怎么逛', en: 'How to visit', ja: '回り方', ko: '둘러보기' }, q: '第一次来，怎么逛比较好？', base: true },
  { id: 'hours',   label: { zh: '开放时间', en: 'Hours', ja: '営業時間', ko: '운영 시간' }, q: '景区的开放时间和门票信息', base: true },
  // —— 亲子 ——
  { id: 'kids_play', label: { zh: '带孩子玩什么', en: 'For kids', ja: '子供向け', ko: '아이와' }, q: '带孩子有什么好玩的？', group: 'family_kids' },
  { id: 'baby_room', label: { zh: '母婴室在哪', en: 'Baby room', ja: '授乳室', ko: '수유실' }, q: '哪里有母婴室和卫生间？', group: 'family_kids' },
  { id: 'kids_show', label: { zh: '亲子表演', en: 'Kid shows', ja: '親子ショー', ko: '아이 공연' }, q: '有适合孩子看的表演吗？', group: 'family_kids' },
  // —— 长辈 ——
  { id: 'rest_spot', label: { zh: '哪里能歇脚', en: 'Rest spots', ja: '休憩所', ko: '쉴 곳' }, q: '哪里可以坐下歇脚？', group: 'senior' },
  { id: 'accessible', label: { zh: '无障碍路线', en: 'Accessible', ja: 'バリアフリー', ko: '무장애' }, q: '有无障碍通道和轮椅路线吗？', group: 'senior' },
  { id: 'easy_route', label: { zh: '轻松慢游', en: 'Easy route', ja: 'ゆったり', ko: '여유 코스' }, q: '推荐一条轻松不累的慢游路线', group: 'senior' },
  // —— 情侣 ——
  { id: 'romantic', label: { zh: '浪漫去处', en: 'Romantic', ja: 'ロマンチック', ko: '로맨틱' }, q: '这里最浪漫的地方在哪？', group: 'couple' },
  { id: 'couple_photo', label: { zh: '情侣机位', en: 'Couple shots', ja: 'カップル撮影', ko: '커플 사진' }, q: '适合情侣拍照的机位有哪些？', group: 'couple' },
  { id: 'pray', label: { zh: '祈福求愿', en: 'Praying', ja: '祈願', ko: '기원' }, q: '哪里可以祈福求愿？', group: 'couple' },
  // —— 兴趣 ——
  { id: 'story', label: { zh: '讲个故事', en: 'A story', ja: '物語', ko: '이야기' }, q: '给我讲一个这里的历史故事', interests: ['history'] },
  { id: 'lore', label: { zh: '文化典故', en: 'Lore', ja: '文化', ko: '문화' }, q: '这里有什么文化典故？', interests: ['history', 'culture'] },
  { id: 'viewpoint', label: { zh: '最佳观景', en: 'Best views', ja: '絶景', ko: '전망' }, q: '最佳观景点在哪？', interests: ['nature'] },
  { id: 'photo_spot', label: { zh: '拍照机位', en: 'Photo spots', ja: '撮影スポット', ko: '포토존' }, q: '最佳拍照打卡机位在哪？', interests: ['photo'] },
  { id: 'food_near', label: { zh: '附近吃什么', en: 'Eats nearby', ja: '周辺グルメ', ko: '주변 맛집' }, q: '附近有什么特色美食？', interests: ['food'] },
  { id: 'zen', label: { zh: '禅意体验', en: 'Zen', ja: '禅体験', ko: '선 체험' }, q: '有哪些禅意静心的体验？', interests: ['culture'] },
]

// 挑 5 个快问 chip：推荐路线恒在 → 同行人 chip（最多 2，身份最定调）→ 命中兴趣 chip → 通用兜底。
export function quickAsks(group: string, interests: string[], lang: Lang): { id: string; label: string; q: string }[] {
  const picked: Chip[] = []
  const add = (c?: Chip) => { if (c && !picked.some((x) => x.id === c.id)) picked.push(c) }
  const byId = (id: string) => POOL.find((c) => c.id === id)

  add(byId('route'))                                          // 招牌入口，恒在
  POOL.filter((c) => c.group === group).slice(0, 2).forEach(add)
  POOL.filter((c) => c.interests?.some((i) => interests.includes(i)))
    .map((c) => ({ c, n: c.interests!.filter((i) => interests.includes(i)).length }))
    .sort((a, b) => b.n - a.n)
    .forEach(({ c }) => add(c))
  POOL.filter((c) => c.base).forEach(add)                     // 通用兜底填满
  return picked.slice(0, 5).map((c) => ({ id: c.id, label: c.label[lang] ?? c.label.zh, q: c.q }))
}

// 设施速查排序：按同行人把最相关的设施类别提前（亲子→母婴/卫生间，长辈→休息/医务/无障碍）。
const FACILITY_ORDER: Record<string, string[]> = {
  family_kids: ['baby', 'toilet', 'rest', 'food', 'medical', 'access'],
  senior: ['rest', 'medical', 'access', 'toilet', 'food', 'baby'],
  couple: ['food', 'rest', 'toilet', 'medical', 'baby', 'access'],
  adult: ['toilet', 'food', 'rest', 'medical', 'baby', 'access'],
}
export function facilityRank(group: string): (id: string) => number {
  const order = FACILITY_ORDER[group] || FACILITY_ORDER.adult
  return (id: string) => { const i = order.indexOf(id); return i < 0 ? 99 : i }
}

// ── 主动贴心提醒：画像 × 此刻时段 → 一句关怀（导游"随机应变 + 关怀"轴，非"去哪看什么"）──
// 同行人画像最定调（长辈/亲子/情侣各有牵挂），独自出游按时段给体感建议。0 后端、客户端取时。
export function careReminder(group: string, _interests: string[], lang: Lang, hour = new Date().getHours()): string {
  const G: Record<string, L> = {
    senior: { zh: '陪长辈慢慢走，沿途备了休息区与无障碍通道，累了随时招呼我', en: 'Take it slow with elders — rest areas & step-free paths are along the way; just ask me', ja: '年長者とゆっくり。休憩所・バリアフリー通路もあるので、疲れたら声をかけてね', ko: '어르신과 천천히 — 휴식 공간과 무장애 길이 있어요. 힘들면 불러 주세요' },
    family_kids: { zh: '带娃记得补水防晒，热门表演有固定场次，问我时刻表别扑空', en: 'Keep kids hydrated & sun-safe; popular shows have set times — ask me so you don’t miss them', ja: '子供の水分・日焼け対策を。人気ショーは時間が決まっているので時刻を聞いてね', ko: '아이 수분·자외선 챙기세요. 인기 공연은 시간이 정해져 있어요 — 시간표 물어보세요' },
    couple: { zh: '二人同行不赶路，傍晚的灯光与水景最适合合影', en: 'No rush, you two — evening lights and water views are best for photos together', ja: '二人で焦らずに。夕暮れの灯りと水景は記念撮影に最適', ko: '둘이 서두르지 마세요 — 해질녘 조명과 물빛이 함께 찍기 좋아요' },
  }
  if (G[group]) return G[group][lang] ?? G[group].zh
  // 独自/朋友：按时段给体感关怀
  const P: L[] =
    hour >= 5 && hour <= 10 ? [{ zh: '趁清晨人少，热门景点先去打卡', en: 'Early & uncrowded — hit the popular spots first', ja: '朝は空いてる。人気スポットを先に', ko: '아침엔 한산해요 — 인기 명소 먼저' }]
    : hour >= 11 && hour <= 13 ? [{ zh: '正午日头足，记得补水、找树荫或室内歇脚', en: 'Midday sun is strong — hydrate and rest in shade or indoors', ja: '正午は日差しが強い。水分補給と日陰・屋内で休憩を', ko: '한낮 햇볕이 강해요 — 수분 보충, 그늘·실내에서 휴식' }]
    : hour >= 14 && hour <= 17 ? [{ zh: '午后光线正柔，适合拍照与登高远眺', en: 'Soft afternoon light — great for photos and viewpoints', ja: '午後の柔らかな光。撮影や展望にぴったり', ko: '부드러운 오후 빛 — 사진과 전망에 좋아요' }]
    : hour >= 18 && hour <= 21 ? [{ zh: '夜色将至，灯光夜景别急着走', en: 'Dusk is coming — don’t rush off, the night lights are worth it', ja: '日が暮れる頃。夜景を見てから帰ってね', ko: '해질녘이에요 — 야경 보고 가세요' }]
    : [{ zh: '夜深了，注意脚下安全，按指示牌慢慢逛', en: 'It’s late — watch your step and follow the signs', ja: '夜は足元に気をつけて、案内表示に沿ってゆっくり', ko: '늦은 시간 — 발밑 조심하고 안내판 따라 천천히' }]
  return P[0][lang] ?? P[0].zh
}

// ── 游记寄语：本程足迹 × 画像 → 个性化收尾寄语（明信片落款；无足迹则回退景区通用祝福）──
export function tripBlessing(visited: string[], group: string, guideName: string, _scenicName: string, lang: Lang): string | null {
  if (!visited.length) return null
  const spots = visited.slice(0, 3)
  const list = lang === 'zh' || lang === 'ja' || lang === 'ko' ? spots.join('、') : spots.join(', ')
  const more = visited.length > spots.length
  const tail: L = {
    senior: { zh: '愿长辈一路安康，好风景常伴', en: 'May your elders stay well, with beautiful views always', ja: 'ご年長の方の健やかな旅路を', ko: '어르신의 건강한 여정을 빕니다' },
    family_kids: { zh: '愿孩子的笑声，留在这段旅程里', en: 'May your children’s laughter live on in this journey', ja: 'お子さまの笑顔がこの旅に残りますように', ko: '아이의 웃음이 이 여정에 남기를' },
    couple: { zh: '愿你们携手的此刻，被好好收藏', en: 'May this moment, hand in hand, be kept dear', ja: '手をつないだこの瞬間が大切な思い出に', ko: '손잡은 이 순간이 소중히 간직되길' },
    adult: { zh: '愿这段旅程，成为你心里的好风景', en: 'May this journey become a good view in your heart', ja: 'この旅があなたの心の風景になりますように', ko: '이 여정이 마음속 좋은 풍경이 되길' },
  }[group] || { zh: '愿这段旅程，成为你心里的好风景', en: 'May this journey become a good view in your heart', ja: 'この旅があなたの心の風景に', ko: '이 여정이 마음속 풍경이 되길' }
  const T: L = {
    zh: `这一程，你走过${list}${more ? ' 等地' : ''}，${guideName}一直在身边。${tail.zh}。`,
    en: `This trip, you visited ${list}${more ? ' and more' : ''}, with ${guideName} by your side. ${tail.en}.`,
    ja: `この旅で${list}${more ? 'などを' : 'を'}巡り、${guideName}がそばにいました。${tail.ja}。`,
    ko: `이번 여정에서 ${list}${more ? ' 등을' : '을'} 둘러보았고, ${guideName}가 함께했어요. ${tail.ko}.`,
  }
  return T[lang] ?? T.zh
}

// 「为你优先排序」的一句话说明（设施抽屉用），无个性化（adult）则不显。
export function facilityHint(group: string, lang: Lang): string | null {
  const M: Record<string, L> = {
    family_kids: { zh: '已为亲子出行把母婴室、卫生间排在前', en: 'Baby room & restrooms first for families', ja: '親子向けに授乳室・トイレを優先', ko: '가족을 위해 수유실·화장실 우선' },
    senior: { zh: '已为长辈把休息区、医务室排在前', en: 'Rest areas & first aid first for seniors', ja: '年長者向けに休憩所・医務室を優先', ko: '어르신을 위해 휴식 공간·의무실 우선' },
    couple: { zh: '已为你把餐饮、休憩点排在前', en: 'Dining & rest spots first', ja: 'グルメ・休憩を優先', ko: '식음·휴식 우선' },
  }
  return M[group] ? (M[group][lang] ?? M[group].zh) : null
}
