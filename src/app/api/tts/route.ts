import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
/** 未指定時は ElevenLabs 標準のプリセット音声（Rachel）。削除済みのカスタム Voice ID は使えない */
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID?.trim() || '21m00Tcm4TlvDq8ikWAM'
/** turbo は multilingual_v2 より生成が速い（体感レイテンシ短縮） */
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5'
const ELEVENLABS_TTS_SPEED = Math.min(4, Math.max(0.25, Number(process.env.ELEVENLABS_TTS_SPEED) || 1.3))

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: 'TTS not configured' }), { status: 503 })
  }

  const { text } = await req.json() as { text: string }

  if (!text) {
    return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400 })
  }

  // ElevenLabs v3 supports up to 5000 chars
  const ttsText = text.slice(0, 2000)

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: ttsText,
        model_id: ELEVENLABS_MODEL_ID,
        optimize_streaming_latency: 4,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
          speed: ELEVENLABS_TTS_SPEED,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('ElevenLabs error:', err)
    const voiceMissing =
      response.status === 404 ||
      /voice_not_found|does not exist|invalid.*voice/i.test(err)
    const message = voiceMissing
      ? 'Voice ID が無効です（削除済みの可能性）。ElevenLabs で別のボイスを選び直すか、ELEVENLABS_VOICE_ID を空にしてプリセット音声を使ってください'
      : 'TTS generation failed'
    return new Response(JSON.stringify({ error: message }), {
      status: voiceMissing ? 404 : 500,
    })
  }

  if (!response.body) {
    return new Response(JSON.stringify({ error: 'TTS stream empty' }), { status: 500 })
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  })
}
