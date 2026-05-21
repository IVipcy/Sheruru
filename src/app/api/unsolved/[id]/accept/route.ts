import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendNotification } from '@/lib/send-notification'
import { ingestUnsolvedBestAnswer } from '@/lib/ingest-unsolved-knowledge'

// POST: accept an answer as best answer
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
  const { answerId } = await req.json() as { answerId: string }

  // Verify the user is the question author
  const { data: question } = await supabase
    .from('unsolved_questions')
    .select('user_id')
    .eq('id', questionId)
    .single()

  if (!question || question.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the question author can accept answers' }, { status: 403 })
  }

  // Update answer as accepted
  const { error: answerErr } = await supabase
    .from('unsolved_answers')
    .update({ is_accepted: true })
    .eq('id', answerId)
    .eq('question_id', questionId)

  if (answerErr) {
    return NextResponse.json({ error: answerErr.message }, { status: 500 })
  }

  // Update question status to resolved
  const { error: questionErr } = await supabase
    .from('unsolved_questions')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', questionId)

  if (questionErr) {
    return NextResponse.json({ error: questionErr.message }, { status: 500 })
  }

  // Notify the answerer
  const { data: answer } = await supabase
    .from('unsolved_answers')
    .select('answerer_id, answer_text')
    .eq('id', answerId)
    .single()

  if (answer && answer.answerer_id !== user.id) {
    await sendNotification({
      user_id: answer.answerer_id,
      type: 'question_resolved',
      title: 'あなたの回答がベストアンサーに選ばれました！',
      body: '質問者がベストアンサーに選びました',
      link: `/unsolved/${questionId}`,
    })
  }

  let learned: { ok: boolean; vectorId?: string; error?: string } = { ok: false }

  const { data: fullQuestion } = await supabase
    .from('unsolved_questions')
    .select('question_text, mode')
    .eq('id', questionId)
    .single()

  if (fullQuestion && answer?.answer_text) {
    learned = await ingestUnsolvedBestAnswer({
      questionId,
      answerId,
      questionText: fullQuestion.question_text,
      answerText: answer.answer_text,
      mode: fullQuestion.mode || 'qa',
    })
    if (!learned.ok) {
      console.error('Auto-learn failed:', learned.error)
    }
  }

  return NextResponse.json({
    success: true,
    learned: learned.ok,
    learnedVectorId: learned.vectorId ?? null,
    learnedError: learned.error ?? null,
  })
}
