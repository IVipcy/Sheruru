import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET: get question detail with answers
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  // Fetch question
  const { data: question, error } = await supabase
    .from('unsolved_questions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const viewerId = user?.id ? String(user.id).toLowerCase() : ''
  const ownerId = question.user_id ? String(question.user_id).toLowerCase() : ''
  const canAcceptBest = Boolean(viewerId && ownerId && viewerId === ownerId)

  // Fetch author
  const { data: author } = await supabase
    .from('profiles')
    .select('display_name, department')
    .eq('id', question.user_id)
    .single()

  // Fetch answers
  const { data: answers } = await supabase
    .from('unsolved_answers')
    .select('*')
    .eq('question_id', id)
    .order('created_at', { ascending: true })

  // Fetch answerer profiles
  let answersWithProfiles = answers || []
  if (answers && answers.length > 0) {
    const answererIds = [...new Set(answers.map((a: { answerer_id: string }) => a.answerer_id))]
    const { data: answerers } = await supabase
      .from('profiles')
      .select('id, display_name, department')
      .in('id', answererIds)

    const profileMap = new Map(
      answerers?.map((p: { id: string }) => [p.id, p]) || []
    )
    answersWithProfiles = answers.map((a: { answerer_id: string }) => ({
      ...a,
      answerer: profileMap.get(a.answerer_id) || null,
    }))
  }

  return NextResponse.json({
    question: { ...question, author: author || null, can_accept_best: canAcceptBest },
    answers: answersWithProfiles,
  })
}
