import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { openai, EMBEDDING_MODEL, CHAT_MODEL, SYSTEM_PROMPTS } from '@/lib/openai'
import { warmTtsFromChatContent } from '@/lib/tts-warm-cache'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { message, mode, conversationId } = await req.json() as {
    message: string
    mode: string
    conversationId: string | null
  }

  if (!message || !mode) {
    return new Response(JSON.stringify({ error: 'Missing message or mode' }), { status: 400 })
  }

  // Get or create conversation
  let convId = conversationId
  if (!convId) {
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, mode })
      .select('id')
      .single()
    convId = conv?.id
  }

  // Save user message
  await supabase.from('messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
  })

  // RAG: embed the question
  const embeddingRes = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: message,
  })
  const queryEmbedding = embeddingRes.data[0].embedding

  // RAG: search knowledge base
  const { data: knowledgeResults } = await supabase.rpc('match_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 8,
    filter_mode: mode,
  })

  const context = knowledgeResults?.length
    ? knowledgeResults.map((r: { content: string; similarity: number }) =>
        `[関連度: ${(r.similarity * 100).toFixed(0)}%] ${r.content}`
      ).join('\n\n')
    : ''

  // Build messages for GPT
  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.qa
  const contextBlock = context
    ? `\n\n【回答の情報源・口調ルール】
- 事実・手順・数値・用語の内容は、以下の参考ナレッジを最優先で使うこと。ナレッジに書かれている内容はそのまま信頼してよい。
- ナレッジに含まれない内容について回答する場合は「※この部分は一般的な知識に基づく回答です」と明記すること。
- ただし語尾・言い回しは Sheruru の口調（弱め関西弁＋丁寧語）を優先すること。ナレッジの堅い文体・教科書調をそのまま真似しないこと。

--- 参考ナレッジ ---
${context}
--- ここまで ---`
    : ''

  // 直近10件（古い順）。asc + limit だけだと会話の「最初の10件」になり、新しい質問がGPTに届かない
  const { data: recentHistory } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(10)

  const history = [...(recentHistory || [])].reverse()

  const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt + contextBlock },
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  // Stream response
  const stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: chatMessages,
    stream: true,
    temperature: 0.7,
    max_tokens: 1024,
  })

  // Analyze emotion from the question (simple keyword-based for now)
  const emotion = analyzeEmotion(message)

  const encoder = new TextEncoder()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      // Send metadata first
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'meta', conversationId: convId, emotion })}\n\n`
      ))

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          fullResponse += content
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'token', content })}\n\n`
          ))
        }
      }

      // テキスト表示完了と同時に TTS 生成を開始（クライアントの再生待ちを短縮）
      warmTtsFromChatContent(fullResponse)

      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'done' })}\n\n`
      ))

      const { data: savedMsg } = await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: fullResponse,
        emotion,
      }).select('id').single()

      void supabase
        .from('conversations')
        .update({ message_count: (history?.length || 0) + 2 })
        .eq('id', convId)

      if (savedMsg?.id) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'saved', messageId: savedMsg.id })}\n\n`
        ))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function analyzeEmotion(text: string): string {
  const patterns: [RegExp, string][] = [
    [/困|わからない|難しい|できない|失敗/u, 'sad'],
    [/怒|ふざけ|ひどい|最悪/u, 'angry'],
    [/すごい|驚|まさか|えっ/u, 'surprise'],
    [/ありがと|嬉しい|助かる|よかった|解決/u, 'happy'],
    [/急|緊急|今すぐ|至急/u, 'neutraltalking'],
  ]
  for (const [regex, emotion] of patterns) {
    if (regex.test(text)) return emotion
  }
  return 'neutral'
}
