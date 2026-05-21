import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/** GET: 未解決BOXから RAG に取り込まれた学習データ一覧 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('knowledge_vectors')
    .select('id, content, mode, category, source_file, metadata, created_at')
    .eq('source_file', '未解決BOX（自動学習）')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    count: data?.length ?? 0,
    note: 'ベストアンサーに選ばれたときだけ自動登録されます（回答投稿だけでは登録されません）',
  })
}
