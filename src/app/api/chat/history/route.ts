import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = req.nextUrl.searchParams.get('mode')
  if (!mode) {
    return Response.json({ error: 'Missing mode' }, { status: 400 })
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .order('started_at', { ascending: false })
    .limit(1)

  const conversation = conversations?.[0]
  if (!conversation) {
    return Response.json({ conversationId: null, messages: [] })
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(50)

  messages?.reverse()

  return Response.json({
    conversationId: conversation.id,
    messages: (messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
  })
}
