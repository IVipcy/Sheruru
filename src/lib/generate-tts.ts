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

const OUTPUT_FORMAT = 'mp3_44100_128'

export function isTtsConfigured(): boolean {
  return Boolean(ELEVENLABS_API_KEY)
}

function isElevenV3Model(modelId: string): boolean {
  return modelId === 'eleven_v3' || modelId.startsWith('eleven_v3')
}

function buildVoiceSettings(modelId: string) {
  const base = {
    stability: 0.5,
    similarity_boost: 0.75,
    use_speaker_boost: true,
    speed: ELEVENLABS_TTS_SPEED,
  }
  if (isElevenV3Model(modelId)) {
    return { ...base, style: 0.3 }
  }
  return { ...base, style: 0.5 }
}

function buildRequestBody(ttsText: string) {
  return {
    text: ttsText.slice(0, 2000),
    model_id: ELEVENLABS_MODEL_ID,
    voice_settings: buildVoiceSettings(ELEVENLABS_MODEL_ID),
  }
}

function ttsUrl(stream: boolean): string {
  const path = stream
    ? `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`
    : `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`
  const url = new URL(path)
  url.searchParams.set('output_format', OUTPUT_FORMAT)
  // v3 では非対応・非推奨。クエリにも入れない（ボディに入れていたのが 422 の原因になり得る）
  if (stream && !isElevenV3Model(ELEVENLABS_MODEL_ID)) {
    url.searchParams.set('optimize_streaming_latency', '4')
  }
  return url.toString()
}

function parseElevenLabsError(status: number, raw: string): Error {
  let message = 'TTS generation failed'
  try {
    const json = JSON.parse(raw) as {
      detail?: string | { message?: string; status?: string }
      message?: string
    }
    if (typeof json.detail === 'string') {
      message = json.detail
    } else if (json.detail && typeof json.detail === 'object' && json.detail.message) {
      message = json.detail.message
    } else if (json.message) {
      message = json.message
    }
  } catch {
    if (raw.trim()) message = raw.slice(0, 300)
  }

  const voiceMissing =
    status === 404 ||
    /voice_not_found|does not exist|invalid.*voice/i.test(message)

  if (voiceMissing) {
    message =
      'Voice ID が無効です（削除済みの可能性）。ElevenLabs で別のボイスを選び直すか、ELEVENLABS_VOICE_ID を空にしてプリセット音声を使ってください'
  } else if (/model.*not.*available|does not support|invalid model/i.test(message)) {
    message = `${message}（ボイスとモデルの組み合わせを ElevenLabs で確認してください）`
  }

  const error = new Error(message) as Error & { status?: number }
  error.status = voiceMissing ? 404 : status >= 400 ? status : 500
  return error
}

async function requestTts(ttsText: string, stream: boolean): Promise<Response> {
  return fetch(ttsUrl(stream), {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(buildRequestBody(ttsText)),
  })
}

export async function generateTtsMpegBuffer(ttsText: string): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('TTS not configured')
  }
  if (!ttsText) {
    throw new Error('Missing text')
  }

  let response = await requestTts(ttsText, true)

  // v3 で stream が失敗した場合は通常エンドポイントへフォールバック
  if (!response.ok && isElevenV3Model(ELEVENLABS_MODEL_ID)) {
    const errText = await response.text()
    console.error('ElevenLabs stream error (v3):', errText)
    response = await requestTts(ttsText, false)
    if (!response.ok) {
      const err2 = await response.text()
      console.error('ElevenLabs convert error (v3):', err2)
      throw parseElevenLabsError(response.status, err2 || errText)
    }
  } else if (!response.ok) {
    const err = await response.text()
    console.error('ElevenLabs error:', err)
    throw parseElevenLabsError(response.status, err)
  }

  if (!response.body) {
    throw new Error('TTS stream empty')
  }

  return response.arrayBuffer()
}
