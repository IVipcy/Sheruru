import { applyTtsPronunciationFixes } from '@/lib/tts-pronunciation'

/** チャット表示用マーカー・Markdown を除いた読み上げテキスト */
export function prepareTtsText(raw: string): string {
  let ttsText = applyTtsPronunciationFixes(
    raw
      .replace(/\[\[(?:選択肢|次の質問):.+?\]\]/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim()
  )
  if (ttsText.length > 2000) {
    const cutoff = ttsText.slice(0, 2000).lastIndexOf('。')
    ttsText = cutoff > 100 ? ttsText.slice(0, cutoff + 1) : ttsText.slice(0, 2000)
  }
  return ttsText
}
