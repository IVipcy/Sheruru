import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // User stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_conversations, total_good_count, total_bad_count, sherpa_solve_count')
    .eq('id', user.id)
    .single()

  // This month's question count
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: monthlyQuestions } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('started_at', startOfMonth.toISOString())

  // Unsolved BOX counts
  const { count: unsolvedOpen } = await supabase
    .from('unsolved_questions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  const { count: unsolvedResolved } = await supabase
    .from('unsolved_questions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'resolved')

  // Recent conversations
  const { data: recentConversations } = await supabase
    .from('conversations')
    .select('id, mode, started_at, message_count')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(5)

  // Good leaderboard (Top 10)
  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('id, display_name, department, total_good_count, good_badge_rank, is_sherpa')
    .order('total_good_count', { ascending: false })
    .limit(10)

  // Sherpa leaderboard (Top 10)
  const { data: sherpaLeaderboard } = await supabase
    .from('profiles')
    .select('id, display_name, department, sherpa_solve_count, is_sherpa')
    .eq('is_sherpa', true)
    .order('sherpa_solve_count', { ascending: false })
    .limit(10)

  // Popular topics - recent user messages grouped by mode
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('content, conversation_id')
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(50)

  const topicCounts: Record<string, number> = {}
  recentMessages?.forEach((msg: { content: string }) => {
    const keywords = extractKeywords(msg.content)
    keywords.forEach((kw) => {
      topicCounts[kw] = (topicCounts[kw] || 0) + 1
    })
  })

  const popularTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }))

  return NextResponse.json({
    profile,
    monthlyQuestions: monthlyQuestions || 0,
    unsolvedOpen: unsolvedOpen || 0,
    unsolvedResolved: unsolvedResolved || 0,
    recentConversations,
    leaderboard,
    sherpaLeaderboard,
    popularTopics,
  })
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = []
  const patterns = [
    /データ消去/g, /回収/g, /見積/g, /提案/g, /SFA/g,
    /リース/g, /ITAD/g, /セキュリティ/g, /証明書/g,
    /買取/g, /PC/gi, /サーバ/g, /プリンタ/g,
    /コスト/g, /費用/g, /納期/g, /手続き/g,
    /ヒアリング/g, /アプローチ/g, /受注/g, /失注/g,
    /競合/g, /金融機関/g, /製造業/g, /官公庁/g,
  ]
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      keywords.push(pattern.source.replace(/\\g$/, '').replace(/\\/g, ''))
    }
    pattern.lastIndex = 0
  }
  return keywords
}
