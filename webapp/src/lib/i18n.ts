// 轻量 i18n：UI 文案多语言；数字人口播答案由后端 lang 参数驱动。
export type Lang = 'zh' | 'en' | 'ja' | 'ko'

export const LANGS: { id: Lang; label: string; backend: string }[] = [
  { id: 'zh', label: '中文', backend: 'zh' },
  { id: 'en', label: 'English', backend: 'en' },
  { id: 'ja', label: '日本語', backend: 'ja' },
  { id: 'ko', label: '한국어', backend: 'ko' },
]

type Dict = Record<string, string>
const ZH: Dict = {
  subtitle: 'AI 数字人导游',
  start: '开始导览', waking: '正在唤醒…',
  placeholderOn: '问点什么…', placeholderOff: '点「开始导览」连接',
  thinking: '{guide}正在思考', intro: '点上方「开始导览」连接数字人，TA 会主动和你打招呼，随后可语音、打字提问，或拍照让我帮你定位讲解。',
  stage_hint: '你的 AI 导游已就位，点亮和 TA 打个招呼',
  st_idle: '未连接', st_connecting: '连接中', st_buffering: '缓冲中', st_connected: '已连接', st_error: '播放失败',
  greet_pill: '主动迎宾',
  // onboarding（数字人迎宾式开场）
  ob_greet: '你好呀，我是你的 AI 导游',
  ob_greet_sub: '告诉我你想去哪、喜欢什么，这一程交给我',
  ob_guide_wait: '{guide} 在这里等你',
  ob_scenic: '想逛哪个景区', ob_who: '和谁一起', ob_interest: '感兴趣的（可多选）',
  ob_enter: '进入导览', ob_skip: '跳过，直接开始',
  ob_replay: '重看开场', ob_replay_sub: '重新选择景区与偏好',
  // today card
  today: '今日游园', today_tip: '贴心建议',
  // settings
  set_title: '设置', set_lang: '语言', set_elder: '适老模式（大字·慢语速·语音优先）',
  set_avatar: '数字人形象', set_avatar_sub: '形象·服饰·声音，在景区默认上精调',
  set_appearance: '外观', mode_light: '浅色', mode_dark: '深色', mode_system: '跟随系统',
  // quick funcs
  qf_photo: '拍照定位', qf_tour: '跟我游', qf_gps: '定位', qf_facility: '设施', qf_trace: '足迹',
}
const EN: Dict = {
  subtitle: 'AI Digital Tour Guide',
  start: 'Start Tour', waking: 'Waking up…',
  placeholderOn: 'Ask me anything…', placeholderOff: 'Tap “Start Tour” to connect',
  thinking: '{guide} is thinking', intro: 'Tap “Start Tour” to connect. Your guide will greet you, then you can ask by voice or text, or take a photo for on-site explanation.',
  stage_hint: 'Your AI guide is ready — tap to say hello',
  st_idle: 'Offline', st_connecting: 'Connecting', st_buffering: 'Buffering', st_connected: 'Live', st_error: 'Playback failed',
  greet_pill: 'Welcome',
  ob_greet: 'Hi, I’m your AI tour guide',
  ob_greet_sub: 'Tell me where you’re headed and what you love — I’ll take it from here',
  ob_guide_wait: '{guide} is waiting for you here',
  ob_scenic: 'Which scenic area', ob_who: 'Who’s with you', ob_interest: 'Your interests (multi-select)',
  ob_enter: 'Enter', ob_skip: 'Skip & start',
  ob_replay: 'Replay intro', ob_replay_sub: 'Re-pick scenic area & preferences',
  today: 'Today', today_tip: 'Tip',
  set_title: 'Settings', set_lang: 'Language', set_elder: 'Senior mode (big text · slow · voice-first)',
  set_avatar: 'Digital Guide', set_avatar_sub: 'Look · outfit · voice, fine-tune on defaults',
  set_appearance: 'Appearance', mode_light: 'Light', mode_dark: 'Dark', mode_system: 'System',
  qf_photo: 'Photo Locate', qf_tour: 'Tour', qf_gps: 'Locate', qf_facility: 'Spots', qf_trace: 'Trail',
}
const JA: Dict = {
  subtitle: 'AI デジタルガイド',
  start: 'ガイド開始', waking: '起動中…',
  placeholderOn: '何でも聞いてね…', placeholderOff: '「ガイド開始」で接続',
  thinking: '{guide}が考え中', intro: '「ガイド開始」で接続。ガイドが挨拶し、音声や文字で質問、写真で現地解説もできます。',
  stage_hint: 'AI ガイドが待機中 — タップして挨拶しよう',
  st_idle: '未接続', st_connecting: '接続中', st_buffering: 'バッファ中', st_connected: '接続済み', st_error: '再生失敗',
  greet_pill: 'ようこそ',
  ob_greet: 'こんにちは、あなたの AI ガイドです',
  ob_greet_sub: '行き先と好みを教えてね、あとは任せて',
  ob_guide_wait: '{guide}がここで待っています',
  ob_scenic: 'どの観光地', ob_who: '誰と一緒', ob_interest: '興味（複数選択可）',
  ob_enter: '入る', ob_skip: 'スキップして開始',
  ob_replay: 'オープニングを再表示', ob_replay_sub: '観光地と好みを選び直す',
  today: '本日', today_tip: 'ヒント',
  set_title: '設定', set_lang: '言語', set_elder: 'シニアモード（大文字・ゆっくり・音声優先）',
  set_avatar: 'ガイドの姿', set_avatar_sub: '姿・衣装・声をカスタマイズ',
  set_appearance: '外観', mode_light: 'ライト', mode_dark: 'ダーク', mode_system: 'システム',
  qf_photo: '写真で位置', qf_tour: '巡る', qf_gps: '位置', qf_facility: '施設', qf_trace: '足あと',
}
const KO: Dict = {
  subtitle: 'AI 디지털 가이드',
  start: '투어 시작', waking: '준비 중…',
  placeholderOn: '무엇이든 물어보세요…', placeholderOff: '“투어 시작”으로 연결',
  thinking: '{guide} 생각 중', intro: '“투어 시작”으로 연결하세요. 가이드가 인사하고, 음성·텍스트 질문이나 사진으로 현장 설명을 받을 수 있어요.',
  stage_hint: 'AI 가이드가 대기 중 — 탭하여 인사해요',
  st_idle: '미연결', st_connecting: '연결 중', st_buffering: '버퍼링', st_connected: '연결됨', st_error: '재생 실패',
  greet_pill: '환영',
  ob_greet: '안녕하세요, 당신의 AI 가이드예요',
  ob_greet_sub: '어디로 갈지, 무엇을 좋아하는지 알려주세요. 나머지는 맡겨요',
  ob_guide_wait: '{guide}가 여기서 기다려요',
  ob_scenic: '어느 관광지', ob_who: '누구와 함께', ob_interest: '관심사 (다중 선택)',
  ob_enter: '입장', ob_skip: '건너뛰고 시작',
  ob_replay: '인트로 다시 보기', ob_replay_sub: '관광지·취향 다시 선택',
  today: '오늘', today_tip: '팁',
  set_title: '설정', set_lang: '언어', set_elder: '시니어 모드 (큰 글씨·천천히·음성 우선)',
  set_avatar: '가이드 모습', set_avatar_sub: '모습·의상·목소리 맞춤 설정',
  set_appearance: '화면', mode_light: '라이트', mode_dark: '다크', mode_system: '시스템',
  qf_photo: '사진 위치', qf_tour: '투어', qf_gps: '위치', qf_facility: '시설', qf_trace: '발자취',
}
const DICTS: Record<Lang, Dict> = { zh: ZH, en: EN, ja: JA, ko: KO }

export function makeT(lang: Lang) {
  const d = DICTS[lang] || ZH
  // vars: 文案占位替换，如 t('thinking', { guide: '婉清' }) → "婉清正在思考"
  return (k: string, vars?: Record<string, string>) => {
    let s = d[k] ?? ZH[k] ?? k
    if (vars) for (const [key, val] of Object.entries(vars)) s = s.replaceAll(`{${key}}`, val)
    return s
  }
}

// 同行类型 / 兴趣：含各语言标签（图标见 lib/icons.tsx 的 GROUP_ICONS/INTEREST_ICONS）
export const GROUPS: { id: string; label: Record<Lang, string> }[] = [
  { id: 'adult', label: { zh: '独自/朋友', en: 'Solo/Friends', ja: '一人/友人', ko: '혼자/친구' } },
  { id: 'family_kids', label: { zh: '亲子同行', en: 'With Kids', ja: '親子', ko: '가족(아이)' } },
  { id: 'senior', label: { zh: '陪伴长辈', en: 'With Elders', ja: '年長者と', ko: '어르신과' } },
  { id: 'couple', label: { zh: '情侣出游', en: 'Couple', ja: 'カップル', ko: '커플' } },
]
export const INTERESTS: { id: string; label: Record<Lang, string> }[] = [
  { id: 'history', label: { zh: '历史人文', en: 'History', ja: '歴史', ko: '역사' } },
  { id: 'nature', label: { zh: '自然风光', en: 'Nature', ja: '自然', ko: '자연' } },
  { id: 'photo', label: { zh: '拍照打卡', en: 'Photo Spots', ja: '撮影', ko: '사진' } },
  { id: 'food', label: { zh: '特色美食', en: 'Food', ja: 'グルメ', ko: '음식' } },
  { id: 'culture', label: { zh: '禅意文化', en: 'Culture', ja: '文化', ko: '문화' } },
]
