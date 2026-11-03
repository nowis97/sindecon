import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderMermaidToPngBuffer } from './mermaidPngRenderer'
import mermaid from 'mermaid'

describe('mermaidPngRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maneja errores de sintaxis de mermaid sin arrojar excepción fatal', async () => {
    vi.spyOn(mermaid, 'render').mockRejectedValueOnce(new Error('Syntax error in graph'))

    const result = await renderMermaidToPngBuffer('sintaxis invalida <<<', 2)
    expect(result).toBeNull()
  })

  it('procesa mermaid válido y extrae buffer cuando svg está disponible', async () => {
    vi.spyOn(mermaid, 'render').mockResolvedValueOnce({
      svg: '<svg width="200" height="100" viewBox="0 0 200 100"><rect/></svg>',
      diagramType: 'flowchart',
      bindFunctions: undefined,
    })

    // Mock de Image y Canvas para entorno Node / jsdom
    const mockBuffer = new ArrayBuffer(8)
    const result = await renderMermaidToPngBuffer('graph TD; A-->B', 2, {
      mockRasterize: async () => ({ buffer: mockBuffer, width: 400, height: 200 }),
    })

    expect(result).not.toBeNull()
    expect(result?.width).toBe(400)
    expect(result?.height).toBe(200)
    expect(result?.buffer).toBe(mockBuffer)
  })

  it('usa la escala por defecto de 2.5 si no se especifica', async () => {
    vi.spyOn(mermaid, 'render').mockResolvedValueOnce({
      svg: '<svg width="100" height="50"></svg>',
      diagramType: 'flowchart',
      bindFunctions: undefined,
    })

    let capturedScale = 0
    await renderMermaidToPngBuffer('graph LR; X-->Y', undefined, {
      mockRasterize: async (_svg, scale) => {
        capturedScale = scale
        return { buffer: new ArrayBuffer(4), width: 250, height: 125 }
      },
    })

    expect(capturedScale).toBe(2.5)
  })

  it('retorna null silenciosamente si rasterizeSvgToPngInBrowser falla', async () => {
    vi.spyOn(mermaid, 'render').mockResolvedValueOnce({
      svg: '<svg width="100" height="50"></svg>',
      diagramType: 'flowchart',
      bindFunctions: undefined,
    })

    const result = await renderMermaidToPngBuffer('graph LR; X-->Y', 2, {
      mockRasterize: async () => {
        throw new Error('Canvas context not available')
      },
    })

    expect(result).toBeNull()
  })
})
