/**
 * Cloze de Anki: `{{c1::texto}}`.
 *
 * No requiere cambios de schema: el hueco vive en el string del `front`.
 * `revealed` contiene los índices (1, 2, …) que ya se mostraron.
 */

const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)\}\}/g

export function isCloze(text: string): boolean {
  return /\{\{c\d+::/.test(text)
}

export function parseCloze(text: string): { plain: string; deletions: string[] } {
  const deletions: string[] = []
  const plain = text.replace(CLOZE_RE, (_match, _n: string, content: string) => {
    deletions.push(content)
    return '[…]'
  })
  return { plain, deletions }
}

export function renderCloze(text: string, revealed: Set<number>): string {
  return text.replace(CLOZE_RE, (_match, n: string, content: string) =>
    revealed.has(Number(n)) ? content : '[…]',
  )
}

/** Índices de todos los huecos del texto (para mostrar el contenido completo). */
export function allClozeIndices(text: string): Set<number> {
  const indices = new Set<number>()
  for (const match of text.matchAll(CLOZE_RE)) {
    indices.add(Number(match[1]))
  }
  return indices
}
