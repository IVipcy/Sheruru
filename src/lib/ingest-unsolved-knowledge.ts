import { createClient } from '@/lib/supabase-server'
import { createServiceRoleClient } from '@/lib/supabase-admin'
import { openai, EMBEDDING_MODEL } from '@/lib/openai'

export type UnsolvedLearnedRow = {
  id: string
  content: string
  mode: string
  category: string | null
  source_file: string | null
  metadata: Record<string, unknown>
  created_at: string
}

/** ベストアンサー採用時: Q&A を knowledge_vectors に登録（RLS を避けるためサービスロール優先） */
export async function ingestUnsolvedBestAnswer(params: {
  questionId: string
  answerId: string
  questionText: string
  answerText: string
  mode: string
}): Promise<{ ok: boolean; vectorId?: string; error?: string }> {
  const knowledgeContent = `【質問】${params.questionText}\n【回答】${params.answerText}`

  try {
    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: knowledgeContent,
    })

    const row = {
      content: knowledgeContent,
      category: '未解決BOX回答',
      mode: params.mode || 'all',
      source_file: '未解決BOX（自動学習）',
      chunk_index: 0,
      metadata: { question_id: params.questionId, answer_id: params.answerId },
      embedding: embeddingRes.data[0].embedding,
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createServiceRoleClient()
      const { data, error } = await admin.from('knowledge_vectors').insert(row).select('id').single()
      if (error) return { ok: false, error: error.message }
      return { ok: true, vectorId: data?.id }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.from('knowledge_vectors').insert(row).select('id').single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, vectorId: data?.id }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'embedding failed'
    return { ok: false, error: message }
  }
}
