import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceRoleClient } from '@/lib/supabase-admin'
import { sendNotification } from '@/lib/send-notification'

// POST: submit an answer to an unsolved question
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: questionId } = await params
  const { answerText } = await req.json() as { answerText: string }

  if (!answerText) {
    return NextResponse.json({ error: 'Missing answer text' }, { status: 400 })
  }

  // Insert answer
  const { data: answer, error } = await supabase
    .from('unsolved_answers')
    .insert({
      question_id: questionId,
      answerer_id: user.id,
      answer_text: answerText,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sync status in DB (RLS blocks non-authors from updating questions; trigger may be missing on older DBs)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createServiceRoleClient()
      const { error: upErr } = await admin
        .from('unsolved_questions')
        .update({ status: 'answered' })
        .eq('id', questionId)
        .eq('status', 'open')
      if (upErr) {
        console.error('unsolved_questions status sync:', upErr.message)
      }
    } catch (e) {
      console.error('unsolved_questions status sync:', e)
    }
  }

  // Notify the question author
  const { data: question } = await supabase
    .from('unsolved_questions')
    .select('user_id, question_text')
    .eq('id', questionId)
    .single()

  if (question && question.user_id !== user.id) {
    const preview =
      question.question_text.length > 30
        ? `${question.question_text.slice(0, 30)}…`
        : question.question_text
    await sendNotification({
      user_id: question.user_id,
      type: 'answer_posted',
      title: '未解決BOXに回答がつきました',
      body: `「${preview}」に回答が投稿されました`,
      link: `/unsolved/${questionId}`,
    })
  }

  return NextResponse.json({ success: true, data: answer })
}
