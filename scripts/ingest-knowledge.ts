/**
 * ナレッジ投入スクリプト
 * 
 * 使い方:
 *   npx tsx scripts/ingest-knowledge.ts <ファイルパス> <モード> [カテゴリ]
 * 
 * 例:
 *   npx tsx scripts/ingest-knowledge.ts ../docs/knowledge.txt qa "商品・サービス知識"
 *   npx tsx scripts/ingest-knowledge.ts ../docs/itad-textbook.txt qa "ITAD基礎・法規"
 *   npx tsx scripts/ingest-knowledge.ts ../docs/sales-know-how.txt consultation "接客・提案"
 * 
 * 環境変数 (.env.local) が必要:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const OPENAI_KEY = process.env.OPENAI_API_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_KEY })

const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100
const EMBEDDING_MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 50

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n{2,}/)
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > CHUNK_SIZE && current) {
      chunks.push(current.trim())
      const chars = current.split('')
      current = chars.slice(-CHUNK_OVERLAP).join('') + '\n\n' + para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) {
    chunks.push(current.trim())
  }

  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      chunks.push(text.slice(i, i + CHUNK_SIZE))
    }
  }

  return chunks.filter((c) => c.length > 20)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/ingest-knowledge.ts <file> <mode> [category]')
    console.error('Modes: qa, consultation, procedure, all')
    process.exit(1)
  }

  const filePath = path.resolve(args[0])
  const mode = args[1]
  const category = args[2] || null

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  console.log(`📄 Reading: ${filePath}`)
  const text = fs.readFileSync(filePath, 'utf-8')
  console.log(`   Total characters: ${text.length}`)

  const chunks = splitIntoChunks(text)
  console.log(`✂️  Split into ${chunks.length} chunks`)

  let inserted = 0
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    console.log(`🔄 Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batch.length} chunks)...`)

    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    })

    const rows = embeddingRes.data.map((item, idx) => ({
      content: batch[idx],
      category,
      mode,
      source_file: path.basename(filePath),
      chunk_index: i + idx,
      embedding: item.embedding,
    }))

    const { error } = await supabase.from('knowledge_vectors').insert(rows)
    if (error) {
      console.error(`❌ Insert error at batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      process.exit(1)
    }

    inserted += rows.length
    console.log(`   ✅ Inserted ${inserted}/${chunks.length}`)
  }

  console.log(`\n🎉 Done! Inserted ${inserted} vectors into knowledge_vectors.`)
  console.log(`   Mode: ${mode}`)
  console.log(`   Category: ${category || '(none)'}`)
  console.log(`   Source: ${path.basename(filePath)}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
