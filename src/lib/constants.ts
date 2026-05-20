export const APP_NAME = 'Sheruru'

/** ヘッダー・favicon 用ロゴ */
export const APP_LOGO_PATH = '/sheruru-logo.png'

/** アシスタント吹き出し横のアイコン */
export const AVATAR_ICON_PATH = '/avatar-icon.png'

export const MODES = [
  { id: 'qa' as const, label: 'QAモード', description: '商品・サービス知識に関するQ&A', icon: '💡', color: 'bg-blue-500' },
  { id: 'consultation' as const, label: '案件相談', description: 'ベテラン視点の営業アドバイス', icon: '🤝', color: 'bg-emerald-500' },
  { id: 'procedure' as const, label: '社内手続き', description: 'SFA入力・見積・報告フロー', icon: '📋', color: 'bg-amber-500' },
] as const

export const CATEGORIES = [
  { name: '商品・サービス知識', mode: 'qa' },
  { name: '対応機器・書類', mode: 'qa' },
  { name: '料金・見積', mode: 'qa' },
  { name: 'ITAD基礎・法規', mode: 'qa' },
  { name: '接客・提案', mode: 'consultation' },
  { name: '競合・差別化', mode: 'consultation' },
  { name: '顧客タイプ別対応', mode: 'consultation' },
  { name: 'SFA・案件管理', mode: 'procedure' },
  { name: '見積・受注手続き', mode: 'procedure' },
  { name: 'MLITAD連携', mode: 'procedure' },
] as const

export const NAV_ITEMS = [
  { href: '/', label: 'モード選択' },
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/unsolved', label: '未解決BOX' },
] as const
