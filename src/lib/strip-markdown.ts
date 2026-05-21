/** チャット表示用：Markdown 装飾を除去（太字の ** などを出さない） */
export function stripMarkdownForDisplay(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/(?<!\*)\*(?!\*)/g, '')
}
