import { useEffect, useState } from 'react'
import { getAssetBlob } from '../../db/assets'

interface AssetImageProps {
  src: string
  alt?: string
}

export function AssetImage({ src, alt }: AssetImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

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
    <figure className="reader-image-figure">
      <img src={blobUrl} alt={alt || 'Imagen médica'} className="reader-image" />
    </figure>
  )
}
