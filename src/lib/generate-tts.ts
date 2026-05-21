const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID?.trim() || '21m00Tcm4TlvDq8ikWAM'
/** Eleven v3（UI 表記のフラッグシップモデル） */
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_v3'
/** 未設定時 1.56（従来 1.3 の約 1.2 倍速） */
export const ELEVENLABS_TTS_SPEED = Math.min(
  4,
  Math.max(0.25, Number(process.env.ELEVENLABS_TTS_SPEED) || 1.56)
)

export function isTtsConfigured(): boolean {
  return Boolean(ELEVENLABS_API_KEY)
}

export async function generateTtsMpegBuffer(ttsText: string): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('TTS not configured')
  }
  if (!ttsText) {
    throw new Error('Missing text')
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: ttsText.slice(0, 2000),
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
    const error = new Error(message) as Error & { status?: number }
    error.status = voiceMissing ? 404 : 500
    throw error
  }

  if (!response.body) {
    throw new Error('TTS stream empty')
  }

  return response.arrayBuffer()
}
