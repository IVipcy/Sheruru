import { generateTtsMpegBuffer, isTtsConfigured } from '@/lib/generate-tts'
import { prepareTtsText } from '@/lib/tts-text'

const MAX_CACHE = 16

type InflightEntry = {
  abort: AbortController
  promise: Promise<ArrayBuffer>
}

const inflight = new Map<string, InflightEntry>()

function trimCache() {
  while (inflight.size > MAX_CACHE) {
    const first = inflight.keys().next().value
    if (first) {
      inflight.get(first)?.abort.abort()
      inflight.delete(first)
    }
  }
}

/** 別テキストの進行中 TTS を止め、同時リクエスト数を抑える */
function cancelOtherInflight(keepKey: string) {
  for (const [key, entry] of inflight) {
    if (key !== keepKey) {
      entry.abort.abort()
      inflight.delete(key)
    }
  }
}

/**
 * 回答 1 件につき 1 回だけ呼ぶ（ストリーム途中の warm はしない）
 */
export function warmTtsFromChatContent(rawContent: string): void {
  if (!isTtsConfigured()) return
  const key = prepareTtsText(rawContent)
  if (!key) return
  if (inflight.has(key)) return

  cancelOtherInflight(key)
  trimCache()

  const abort = new AbortController()
  const promise = generateTtsMpegBuffer(key, abort.signal).catch((err) => {
    if (inflight.get(key)?.promise === promise) {
      inflight.delete(key)
    }
    throw err
  })

  inflight.set(key, { abort, promise })
}

export function getInflightTts(key: string): Promise<ArrayBuffer> | undefined {
  return inflight.get(key)?.promise
}

/** キャッシュに無いときだけ 1 本生成（通常は warm 済み） */
export function ensureTtsInflight(key: string): Promise<ArrayBuffer> {
  const existing = inflight.get(key)
  if (existing) return existing.promise

  warmTtsFromChatContent(key)
  const started = inflight.get(key)
  if (started) return started.promise

  const abort = new AbortController()
  const promise = generateTtsMpegBuffer(key, abort.signal).catch((err) => {
    inflight.delete(key)
    throw err
  })
  inflight.set(key, { abort, promise })
  return promise
}
