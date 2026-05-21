import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { generateTtsMpegBuffer, isTtsConfigured } from '@/lib/generate-tts'
import { ensureTtsInflight, getInflightTts } from '@/lib/tts-warm-cache'
import { prepareTtsText } from '@/lib/tts-text'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!isTtsConfigured()) {
    return new Response(JSON.stringify({ error: 'TTS not configured' }), { status: 503 })
  }

  const { text } = await req.json() as { text: string }

  if (!text) {
    return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 })
  }

  const ttsText = prepareTtsText(text)
  if (!ttsText) {
    return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 })
  }

  try {
    const cached = getInflightTts(ttsText)
    const buffer = await (cached ?? ensureTtsInflight(ttsText))
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS generation failed'
    const status = (err as Error & { status?: number }).status ?? 500
    const voiceMissing = status === 404
    return new Response(
      JSON.stringify({
        error: voiceMissing
          ? 'Voice ID が無効です（削除済みの可能性）。ElevenLabs で別のボイスを選び直すか、ELEVENLABS_VOICE_ID を空にしてプリセット音声を使ってください'
          : message,
      }),
      { status }
    )
  }
}
