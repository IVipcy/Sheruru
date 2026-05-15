export interface SuggestionNode {
  label: string
  children?: SuggestionNode[]
}

// QAモードのサジェスチョン階層
const QA_SUGGESTIONS: SuggestionNode[] = [
  {
    label: '商品・サービス知識',
    children: [
      {
        label: 'データ消去',
        children: [
          { label: 'データ消去の方法は？' },
          { label: '消去証明書はいつ発行される？' },
          { label: 'SSD対応の消去方法は？' },
        ],
      },
      {
        label: '対応機器',
        children: [
          { label: '対応できる機器の範囲は？' },
          { label: 'サーバー機器も対応可能？' },
          { label: 'スマホ・タブレットは対応？' },
        ],
      },
      {
        label: '回収・物流',
        children: [
          { label: '回収の流れを教えて' },
          { label: '全国対応してる？' },
          { label: '最短何日で回収できる？' },
        ],
      },
    ],
  },
  {
    label: 'ITAD基礎・法規',
    children: [
      {
        label: 'ITADとは',
        children: [
          { label: 'ITADとは何か教えて' },
          { label: 'リース満了時にITADを紹介する流れは？' },
        ],
      },
      {
        label: '法規制',
        children: [
          { label: '個人情報保護法との関連は？' },
          { label: '環境関連法規は？' },
          { label: 'データ消去の法的要件は？' },
        ],
      },
    ],
  },
  {
    label: '料金・見積',
    children: [
      {
        label: '料金体系',
        children: [
          { label: '基本料金の仕組みは？' },
          { label: '大量台数の割引はある？' },
          { label: '見積の有効期限は？' },
        ],
      },
      {
        label: '買取',
        children: [
          { label: '買取価格の決まり方は？' },
          { label: '買取できない機器は？' },
          { label: 'リース物件の買取は可能？' },
        ],
      },
    ],
  },
]

// 案件相談モードのサジェスチョン階層
const CONSULTATION_SUGGESTIONS: SuggestionNode[] = [
  {
    label: '接客・提案',
    children: [
      {
        label: '初回アプローチ',
        children: [
          { label: '初回訪問のコツは？' },
          { label: '電話アポの取り方は？' },
          { label: '興味を引くトークは？' },
        ],
      },
      {
        label: '提案テクニック',
        children: [
          { label: 'リース先に廃棄ニーズを聞き出すには？' },
          { label: '他社廃棄業者を使っている先への切り替えトークは？' },
          { label: '製造業リース先へのアプローチは？' },
        ],
      },
    ],
  },
  {
    label: '競合・差別化',
    children: [
      {
        label: '競合対策',
        children: [
          { label: '「高い」と言われたら？' },
          { label: '競合との違いは何？' },
          { label: '他社から切り替えさせるには？' },
        ],
      },
      {
        label: '強み訴求',
        children: [
          { label: '自社の強みは何？' },
          { label: 'セキュリティ面での差別化は？' },
          { label: 'サポート体制のアピール方法は？' },
        ],
      },
    ],
  },
  {
    label: '顧客タイプ別対応',
    children: [
      {
        label: '企業規模別',
        children: [
          { label: '大企業向けの攻め方は？' },
          { label: '中小企業へのアプローチは？' },
        ],
      },
      {
        label: '状況別',
        children: [
          { label: '決裁者が出てこない時は？' },
          { label: '検討が長引いている場合は？' },
          { label: 'リプレース提案のコツは？' },
        ],
      },
    ],
  },
]

// 社内手続きモードのサジェスチョン階層
const PROCEDURE_SUGGESTIONS: SuggestionNode[] = [
  {
    label: 'SFA・案件管理',
    children: [
      {
        label: 'SFA入力',
        children: [
          { label: 'SFAの案件名ルールは？' },
          { label: 'ステージ更新のタイミングは？' },
          { label: '活動報告の書き方は？' },
        ],
      },
      {
        label: '案件管理',
        children: [
          { label: '案件のステージ定義は？' },
          { label: '失注の登録方法は？' },
          { label: '共同案件の登録方法は？' },
        ],
      },
    ],
  },
  {
    label: 'MLITAD連携（社内）',
    children: [
      {
        label: 'お客様情報の整理',
        children: [
          { label: 'MLITADに伝えるべき情報は？' },
          { label: '回収希望時期・台数の聞き方は？' },
          { label: '連携後のみずほリースのフォロー範囲は？' },
        ],
      },
      {
        label: '紹介・連携',
        children: [
          { label: 'MLITADへの紹介方法は？' },
          { label: '連携のタイミングは？' },
          { label: '紹介料の仕組みは？' },
        ],
      },
      {
        label: '案件の記録',
        children: [
          { label: '受注後の報告先は？' },
        ],
      },
    ],
  },
]

export const SUGGESTIONS_BY_MODE: Record<string, SuggestionNode[]> = {
  qa: QA_SUGGESTIONS,
  consultation: CONSULTATION_SUGGESTIONS,
  procedure: PROCEDURE_SUGGESTIONS,
}
