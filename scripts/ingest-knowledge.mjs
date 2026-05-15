import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error('Missing env vars. Need: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

const EMBEDDING_MODEL = 'text-embedding-3-small'
const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100

function splitIntoChunks(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = []
  const lines = text.split('\n')
  let currentChunk = ''
  let chunkStart = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if ((currentChunk + '\n' + line).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      const overlapLines = currentChunk.split('\n').slice(-3).join('\n')
      currentChunk = overlapLines.length < overlap ? overlapLines + '\n' + line : line
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  return chunks
}

async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })
  return res.data[0].embedding
}

async function ingestFile(filePath, sourceFile, mode, category) {
  console.log(`\n📄 Processing: ${sourceFile} (mode: ${mode})`)
  const text = readFileSync(filePath, 'utf-8')
  const chunks = splitIntoChunks(text)
  console.log(`   Chunks: ${chunks.length}`)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (chunk.length < 20) continue

    console.log(`   [${i + 1}/${chunks.length}] Embedding (${chunk.length} chars)...`)
    const embedding = await getEmbedding(chunk)

    const { error } = await supabase.from('knowledge_vectors').insert({
      content: chunk,
      category: category,
      mode: mode,
      source_file: sourceFile,
      chunk_index: i,
      metadata: { char_count: chunk.length },
      embedding: embedding,
    })

    if (error) {
      console.error(`   ❌ Error inserting chunk ${i}:`, error.message)
    } else {
      console.log(`   ✅ Chunk ${i + 1} inserted`)
    }

    await new Promise(r => setTimeout(r, 200))
  }
}

async function main() {
  console.log('🚀 Starting knowledge ingestion...\n')

  const { count } = await supabase
    .from('knowledge_vectors')
    .select('*', { count: 'exact', head: true })
  console.log(`Current vectors in DB: ${count || 0}`)

  await ingestFile(
    'data/mizuho_flow.txt',
    'みずほリース_業務ヒアリングシート_想定フロー.xlsx',
    'procedure',
    'SFA・案件管理'
  )

  await ingestFile(
    'data/data_collection.txt',
    '収集データ整理一覧_v02.docx',
    'all',
    '商品・サービス知識'
  )

  await ingestFile(
    'data/itad_textbook.txt',
    '日本ITAD協会_ITADの実務教本.pdf',
    'qa',
    'ITAD基礎・法規'
  )

  const { count: finalCount } = await supabase
    .from('knowledge_vectors')
    .select('*', { count: 'exact', head: true })
  console.log(`\n🎉 Done! Total vectors in DB: ${finalCount}`)
}

main().catch(console.error)
