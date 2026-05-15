import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { openai, EMBEDDING_MODEL } from '@/lib/openai'

// POST: ingest knowledge text into vector store
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { texts, mode, category, sourceFile } = await req.json() as {
    texts: string[]
    mode: string
    category?: string
    sourceFile?: string
  }

  if (!texts?.length || !mode) {
    return NextResponse.json({ error: 'Missing texts or mode' }, { status: 400 })
  }

  // Chunk texts (split long ones)
  const chunks = texts.flatMap((text) => splitIntoChunks(text, 800, 100))

  // Generate embeddings in batches of 100
  const batchSize = 100
  let inserted = 0

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)

    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    })

    const rows = embeddingRes.data.map((item, idx) => ({
      content: batch[idx],
      category: category || null,
      mode,
      source_file: sourceFile || null,
      chunk_index: i + idx,
      embedding: item.embedding,
    }))

    const { error } = await supabase.from('knowledge_vectors').insert(rows)
    if (error) {
      return NextResponse.json(
        { error: error.message, inserted },
        { status: 500 }
      )
    }
    inserted += rows.length
  }

  return NextResponse.json({ success: true, inserted, totalChunks: chunks.length })
}

function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n{2,}/)
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > chunkSize && current) {
      chunks.push(current.trim())
      // Keep overlap from end of previous chunk
      const words = current.split('')
      current = words.slice(-overlap).join('') + '\n\n' + para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) {
    chunks.push(current.trim())
  }

  // Fallback: if no paragraphs split, do character-based splitting
  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.slice(i, i + chunkSize))
    }
  }

  return chunks
}
