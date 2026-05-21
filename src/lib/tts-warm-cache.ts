import { generateTtsMpegBuffer, isTtsConfigured } from '@/lib/generate-tts'
import { prepareTtsText } from '@/lib/tts-text'

const MAX_CACHE = 24
const inflight = new Map<string, Promise<ArrayBuffer>>()

function trimCache() {
  while (inflight.size > MAX_CACHE) {
    const first = inflight.keys().next().value
    if (first) inflight.delete(first)
  }
}

/** GPT 完了直後に TTS 生成を始める（クライアントの /api/tts が待ち時間短縮できる） */
export function warmTtsFromChatContent(rawContent: string): void {
  if (!isTtsConfigured()) return
  const key = prepareTtsText(rawContent)
  if (!key || inflight.has(key)) return
  trimCache()
  inflight.set(
    key,
    generateTtsMpegBuffer(key).catch((err) => {
      inflight.delete(key)
      throw err
    })
  )
}

/** 選択肢マーカーが出たら全文完了前に TTS を開始（テキスト表示と並行生成） */
export function maybeWarmTtsDuringChatStream(rawContent: string): void {
  if (!/\[\[(?:次の質問|選択肢):/.test(rawContent)) return
  warmTtsFromChatContent(rawContent)
}

export function getInflightTts(key: string): Promise<ArrayBuffer> | undefined {
  return inflight.get(key)
}

export function ensureTtsInflight(key: string): Promise<ArrayBuffer> {
  const existing = inflight.get(key)
  if (existing) return existing
  trimCache()
  const promise = generateTtsMpegBuffer(key).catch((err) => {
    inflight.delete(key)
    throw err
  })
  inflight.set(key, promise)
  return promise
}
