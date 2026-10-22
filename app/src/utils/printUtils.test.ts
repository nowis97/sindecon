import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractMermaidFromMarkdown,
  preloadMermaidInArticles,
  waitForPrintReady,
} from './printUtils'
import * as MermaidViewerModule from '../components/reader/MermaidViewer'

describe('printUtils - Mermaid Extraction and Print Readiness', () => {
  describe('extractMermaidFromMarkdown', () => {
    it('retorna arreglo vacío si el markdown está vacío o no tiene diagramas', () => {
      expect(extractMermaidFromMarkdown('')).toEqual([])
      expect(extractMermaidFromMarkdown('# Título sin diagramas\n\nTexto simple.')).toEqual([])
    })

    it('extrae diagramas mermaid individuales en bloques estándar', () => {
      const md = `
# Caso Clínico

\`\`\`mermaid
flowchart TD
    A[Inicio] --> B[Fin]
\`\`\`

Texto intermedio.
      `.trim()

      const codes = extractMermaidFromMarkdown(md)
      expect(codes).toHaveLength(1)
      expect(codes[0]).toBe('flowchart TD\n    A[Inicio] --> B[Fin]')
    })

    it('extrae múltiples diagramas mermaid e ignora otros bloques de código', () => {
      const md = `
\`\`\`ts
const x = 10;
\`\`\`

\`\`\`mermaid
graph TD
    X --> Y
\`\`\`

\`\`\`json
{ "key": "val" }
\`\`\`

\`\`\`mermaid
flowchart LR
    1 --> 2
\`\`\`
      `.trim()

      const codes = extractMermaidFromMarkdown(md)
      expect(codes).toHaveLength(2)
      expect(codes[0]).toBe('graph TD\n    X --> Y')
      expect(codes[1]).toBe('flowchart LR\n    1 --> 2')
    })

    it('extrae diagramas mermaid anidados dentro de bloques de columnas (:::columns)', () => {
      const md = `
:::columns
===
Columna 1 texto.
===
\`\`\`mermaid
flowchart TD
    C1 --> C2
\`\`\`
:::
      `.trim()

      const codes = extractMermaidFromMarkdown(md)
      expect(codes).toHaveLength(1)
      expect(codes[0]).toBe('flowchart TD\n    C1 --> C2')
    })
  })

  describe('preloadMermaidInArticles', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('no llama a preloadMermaidDiagrams si no hay diagramas en los artículos', async () => {
      const spy = vi.spyOn(MermaidViewerModule, 'preloadMermaidDiagrams')
      await preloadMermaidInArticles(['# Nota 1', '# Nota 2'])
      expect(spy).not.toHaveBeenCalled()
    })

    it('desduplica y precarga diagramas mermaid presentes en varios artículos', async () => {
      const spy = vi
        .spyOn(MermaidViewerModule, 'preloadMermaidDiagrams')
        .mockResolvedValue()

      const md1 = '```mermaid\nflowchart TD\n  A --> B\n```'
      const md2 = '```mermaid\nflowchart TD\n  A --> B\n```\n```mermaid\nflowchart TD\n  C --> D\n```'

      await preloadMermaidInArticles([md1, md2])
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(['flowchart TD\n  A --> B', 'flowchart TD\n  C --> D'])
    })
  })

  describe('waitForPrintReady', () => {
    it('resuelve inmediatamente si document no está definido (entorno Node/SSR)', async () => {
      await expect(waitForPrintReady('test-print-container', 1000)).resolves.toBeUndefined()
    })

    it('espera hasta que el elemento .mermaid-loading desaparece del contenedor cuando hay DOM mockeado', async () => {
      let hasLoading = true
      const mockContainer = {
        querySelector: (sel: string) => (sel === '.mermaid-loading' && hasLoading ? {} : null),
        querySelectorAll: () => [],
      }

      const originalDoc = (globalThis as unknown as { document?: unknown }).document
      const originalRaf = (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame

      ;(globalThis as unknown as { document: unknown }).document = {
        fonts: { ready: Promise.resolve() },
        getElementById: (id: string) => (id === 'test-container' ? mockContainer : null),
      }
      ;(globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: () => void) => {
        cb()
        return 1
      }

      // Desactivar loading tras 50ms
      setTimeout(() => {
        hasLoading = false
      }, 50)

      try {
        await expect(waitForPrintReady('test-container', 2000)).resolves.toBeUndefined()
        expect(hasLoading).toBe(false)
      } finally {
        if (originalDoc !== undefined) {
          ;(globalThis as unknown as { document: unknown }).document = originalDoc
        } else {
          delete (globalThis as unknown as { document?: unknown }).document
        }
        if (originalRaf !== undefined) {
          ;(globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = originalRaf
        } else {
          delete (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame
        }
      }
    })
  })
})
