import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'fE4wXeCYHSqKGMJXSr39'
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_v3'

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
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
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
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('ElevenLabs error:', err)
    return new Response(JSON.stringify({ error: 'TTS generation failed' }), { status: 500 })
  }

  const audioBuffer = await response.arrayBuffer()

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  })
}
