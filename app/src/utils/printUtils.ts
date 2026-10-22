import { parseMarkdownBlocks, type Block } from '../components/reader/ArticleReader'
import { preloadMermaidDiagrams } from '../components/reader/MermaidViewer'

/**
 * Extrae todos los códigos de diagramas Mermaid presentes en un texto Markdown,
 * soportando estructuras complejas como columnas múltiples.
 */
export function extractMermaidFromMarkdown(markdown: string): string[] {
  if (!markdown || !markdown.trim()) return []
  const blocks = parseMarkdownBlocks(markdown)
  const results: string[] = []

  function collect(bList: Block[]) {
    for (const b of bList) {
      if (b.type === 'mermaid') {
        const trimmed = b.code.trim()
        if (trimmed) results.push(trimmed)
      } else if (b.type === 'columns') {
        for (const col of b.columns) {
          collect(col)
        }
      }
    }
  }

  collect(blocks)
  return results
}

/**
 * Precarga y renderiza en caché todos los diagramas Mermaid presentes en una lista de artículos.
 * Esto garantiza que cuando el contenedor de impresión se monte en el DOM, los SVGs
 * ya estén disponibles de forma síncrona en el primer frame de renderizado.
 */
export async function preloadMermaidInArticles(markdowns: string[]): Promise<void> {
  const allCodes = markdowns.flatMap((md) => extractMermaidFromMarkdown(md))
  const uniqueCodes = Array.from(new Set(allCodes))
  if (uniqueCodes.length === 0) return

  await preloadMermaidDiagrams(uniqueCodes)
}

/**
 * Espera de manera determinista y robusta a que el contenedor de impresión esté
 * 100% listo para ser capturado por `window.print()`:
 * 1. Fuentes tipográficas web listas (`document.fonts.ready`).
 * 2. Ningún elemento en estado de carga `.mermaid-loading` pendiente.
 * 3. Todas las imágenes `<img>` cargadas y decodificadas.
 * 4. Doble ciclo de `requestAnimationFrame` para asegurar el pintado en pantalla del DOM.
 */
export async function waitForPrintReady(
  containerId: string,
  maxWaitMs: number = 4000,
): Promise<void> {
  // 1. Fuentes tipográficas
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      // Ignorar fallo de fonts.ready
    }
  }

  // 2. Esperar a que desaparezca cualquier `.mermaid-loading` dentro del contenedor
  if (typeof document !== 'undefined') {
    const container = document.getElementById(containerId)
    if (container) {
      const startTime = performance.now()
      while (container.querySelector('.mermaid-loading')) {
        if (performance.now() - startTime >= maxWaitMs) {
          console.warn(`[printUtils] Timeout esperando esquemas en #${containerId}`)
          break
        }
        await new Promise((res) => setTimeout(res, 40))
      }

      // 3. Esperar a que las imágenes hayan cargado
      const images = Array.from(container.querySelectorAll('img'))
      if (images.length > 0) {
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve()
            return new Promise<void>((res) => {
              img.onload = () => res()
              img.onerror = () => res()
              setTimeout(res, 1200)
            })
          }),
        )
      }
    }

    // 4. Doble frame de animación para asegurar el pintado en el motor del navegador
    await new Promise((res) =>
      requestAnimationFrame(() => {
        requestAnimationFrame(() => res(null))
      }),
    )
    await new Promise((res) => setTimeout(res, 50))
  }
}
