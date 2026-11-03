import mermaid from 'mermaid'

export interface RasterizeOptions {
  mockRasterize?: (
    svg: string,
    scale: number
  ) => Promise<{ buffer: ArrayBuffer; width: number; height: number }>
}

let mermaidInitialized = false

function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      fontFamily: 'Inter, sans-serif',
      securityLevel: 'loose',
    })
    mermaidInitialized = true
  }
}

export async function renderMermaidToPngBuffer(
  mermaidCode: string,
  scale: number = 2.5,
  options?: RasterizeOptions
): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  ensureMermaidInit()

  try {
    const id = `mermaid-gdocs-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const { svg } = await mermaid.render(id, mermaidCode)

    if (options?.mockRasterize) {
      return await options.mockRasterize(svg, scale)
    }

    return await rasterizeSvgToPngInBrowser(svg, scale)
  } catch (error) {
    console.warn('Advertencia clínica: Error al renderizar diagrama Mermaid para Docs:', error)
    return null
  }
}

function rasterizeSvgToPngInBrowser(
  svgString: string,
  scale: number
): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      try {
        const baseWidth = img.naturalWidth || 600
        const baseHeight = img.naturalHeight || 300
        const targetWidth = Math.round(baseWidth * scale)
        const targetHeight = Math.round(baseHeight * scale)

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          return reject(new Error('No se pudo obtener el contexto 2D del Canvas'))
        }

        // Fondo blanco para legibilidad en Google Docs
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, targetWidth, targetHeight)
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        canvas.toBlob(
          async (blobResult) => {
            URL.revokeObjectURL(url)
            if (!blobResult) {
              return reject(new Error('Fallo al convertir Canvas a Blob PNG'))
            }
            const buffer = await blobResult.arrayBuffer()
            resolve({
              buffer,
              width: targetWidth,
              height: targetHeight,
            })
          },
          'image/png',
          0.95
        )
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Fallo al cargar imagen SVG en el navegador para rasterización'))
    }

    img.src = url
  })
}
