/** Descarga un documento clínico en formato Markdown (.md) preservando sus etiquetas. */
export function downloadMarkdownFile(title: string, bodyMd: string, tags: string[] = []): void {
  const safeName = (title || 'documento-clinico').replace(/[\\/:*?"<>|]/g, '-').trim()
  const tagHeader = tags.length > 0 ? `Etiquetas: ${tags.map((t) => `#${t}`).join(' ')}\n\n` : ''
  const content = `# ${title}\n\n${tagHeader}${bodyMd || ''}`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
