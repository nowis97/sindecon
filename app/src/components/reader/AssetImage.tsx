import { useEffect, useState } from 'react'
import { getAssetBlob } from '../../db/assets'

interface AssetImageProps {
  src: string
  alt?: string
}

export function AssetImage({ src, alt }: AssetImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    let active = true
    if (src.startsWith('asset://')) {
      const id = src.slice('asset://'.length)
      void (async () => {
        const blob = await getAssetBlob(id)
        if (blob && active) {
          const url = URL.createObjectURL(blob)
          setBlobUrl(url)
        }
      })()
    } else {
      setBlobUrl(src)
    }

    return () => {
      active = false
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [src])

  if (!blobUrl) {
    return <div className="image-placeholder">Cargando imagen…</div>
  }

  return (
    <>
      <div className="reader-image-wrapper" onClick={() => setIsZoomed(true)}>
        <img src={blobUrl} alt={alt || 'Imagen médica'} className="reader-image" />
        <span className="image-zoom-hint">🔍 Toca para ampliar</span>
      </div>

      {isZoomed && (
        <div className="image-zoom-modal" onClick={() => setIsZoomed(false)}>
          <div className="image-zoom-content" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-zoom" onClick={() => setIsZoomed(false)}>
              ✕
            </button>
            <img src={blobUrl} alt={alt || 'Imagen médica ampliada'} className="zoomed-full-image" />
            {alt && <p className="image-caption">{alt}</p>}
          </div>
        </div>
      )}
    </>
  )
}
