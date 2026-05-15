/**
 * knowledge_vectors から、みずほリース×MLITAD の想定スコープ外と判断した行を削除する。
 * 要: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY
 *
 * 確認のみ: node --env-file=.env.local scripts/prune-out-of-scope-knowledge.mjs
 * 実行:     node --env-file=.env.local scripts/prune-out-of-scope-knowledge.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const apply = process.argv.includes('--apply')

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が .env.local にありません。')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const UNSOLVED_CAT = '未解決BOX回答'

/** @param {string} label */
async function countRule(label, builder) {
  const q = builder(supabase.from('knowledge_vectors').select('id', { count: 'exact', head: true }))
  const { count, error } = await q
  if (error) throw new Error(`${label}: ${error.message}`)
  return count ?? 0
}

/** @param {string} label @param {(q: import('@supabase/supabase-js').PostgrestFilterBuilder<any>) => any} builder */
async function deleteRule(label, builder) {
  const q = builder(
    supabase.from('knowledge_vectors').delete().select('id')
  )
  const { data, error } = await q
  if (error) throw new Error(`${label}: ${error.message}`)
  const n = data?.length ?? 0
  console.log(apply ? `削除: ${label} … ${n} 件` : `[dry-run] ${label} … ${n} 件が対象`)
  return n
}

async function main() {
  const rules = [
    {
      label: 'mode=all かつ 未解決BOXの自動学習以外（全モードRAGに混ざる汎用チャンク）',
      count: (q) => q.eq('mode', 'all').or(`category.is.null,category.neq.${UNSOLVED_CAT}`),
      del: (q) => q.eq('mode', 'all').or(`category.is.null,category.neq.${UNSOLVED_CAT}`),
    },
    {
      label: 'カテゴリに「競合」「差別化」「市場規模」「官公庁」を含むもの',
      count: (q) =>
        q.or(
          'category.ilike.%競合%,category.ilike.%差別化%,category.ilike.%市場規模%,category.ilike.%官公庁%'
        ),
      del: (q) =>
        q.or(
          'category.ilike.%競合%,category.ilike.%差別化%,category.ilike.%市場規模%,category.ilike.%官公庁%'
        ),
    },
    {
      label: 'source_file に sales-know-how を含むもの',
      count: (q) => q.ilike('source_file', '%sales-know-how%'),
      del: (q) => q.ilike('source_file', '%sales-know-how%'),
    },
    {
      label: 'source_file / category に「収集データ」を含むもの（モード横断の生データ想定）',
      count: (q) =>
        q.or('source_file.ilike.%収集データ%,category.ilike.%収集データ%'),
      del: (q) =>
        q.or('source_file.ilike.%収集データ%,category.ilike.%収集データ%'),
    },
  ]

  console.log(apply ? '--- 削除実行 (--apply) ---' : '--- 件数確認のみ（--apply なし）---')

  for (const r of rules) {
    const n = await countRule(r.label, r.count)
    console.log(`  ${r.label}: ${n} 件`)
  }

  if (!apply) {
    console.log('\n問題なければ同じコマンドに --apply を付けて実行してください。')
    return
  }

  let total = 0
  for (const r of rules) {
    total += await deleteRule(r.label, r.del)
  }
  console.log(`\n合計削除: ${total} 件`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
