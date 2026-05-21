/** ElevenLabs 等が英字を1文字ずつ読む語の、読み上げ用置換（画面表示テキストは変えない） */
const TTS_PRONUNCIATION_REPLACEMENTS: [RegExp, string][] = [
  [/MLITAD/gi, 'エムエルアイタッド'],
  [/エムエル\s*ITAD/gi, 'エムエルアイタッド'],
  [/エムエルアイティーエーディー/g, 'エムエルアイタッド'],
]

export function applyTtsPronunciationFixes(text: string): string {
  let out = text
  for (const [pattern, replacement] of TTS_PRONUNCIATION_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out
}
