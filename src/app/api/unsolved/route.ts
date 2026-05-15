import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET: list unsolved questions
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'open'
  const mode = searchParams.get('mode')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const { data: answerRows, error: ansErr } = await supabase.from('unsolved_answers').select('question_id')
  if (ansErr) {
    return NextResponse.json({ error: ansErr.message }, { status: 500 })
  }
  const questionIdsWithAnswers = new Set(
    (answerRows || []).map((r: { question_id: string }) => r.question_id)
  )

  // 「回答あり」= コミュニティ回答が1件以上ある（DBの status がまだ open のままでも拾う）
  if (status === 'answered') {
    let q = supabase
      .from('unsolved_questions')
      .select('*')
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })

    if (mode) {
      q = q.eq('mode', mode)
    }

    const { data: rows, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtered = (rows || []).filter((row) => questionIdsWithAnswers.has(row.id))
    const total = filtered.length
    const data = filtered.slice(offset, offset + limit)

    return NextResponse.json({ data, total })
  }

  // 「未解決」= status が open かつ まだ誰も回答していない
  if (status === 'open') {
    let q = supabase
      .from('unsolved_questions')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (mode) {
      q = q.eq('mode', mode)
    }

    const { data: rows, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtered = (rows || []).filter((row) => !questionIdsWithAnswers.has(row.id))
    const total = filtered.length
    const data = filtered.slice(offset, offset + limit)

    return NextResponse.json({ data, total })
  }

  let query = supabase
    .from('unsolved_questions')
    .select('*', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (mode) {
    query = query.eq('mode', mode)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

// POST: create unsolved question from chat
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { questionText, aiAnswerText, messageId, mode } = await req.json() as {
    questionText: string
    aiAnswerText?: string
    messageId?: string
    mode: string
  }

  if (!questionText || !mode) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('unsolved_questions')
    .insert({
      user_id: user.id,
      question_text: questionText,
      ai_answer_text: aiAnswerText || null,
      message_id: messageId || null,
      mode,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}
