import React, { useEffect, useState } from 'react'
import { getAssetBlob } from '../../db/assets'

interface AssetImageProps {
  src: string
  alt?: string
  caption?: React.ReactNode
  className?: string
}

export function AssetImage({ src, alt, caption, className = '' }: AssetImageProps) {
  const assetId = src.startsWith('asset://') ? src.slice('asset://'.length) : null
  const [resolvedAsset, setResolvedAsset] = useState<{ id: string; url: string } | null>(null)

  useEffect(() => {
    if (!assetId) return
    let active = true
    let createdObjectUrl: string | null = null

    void (async () => {
      const blob = await getAssetBlob(assetId)
      if (!blob) return
      const url = URL.createObjectURL(blob)
      if (active) {
        createdObjectUrl = url
        setResolvedAsset({ id: assetId, url })
      } else {
        URL.revokeObjectURL(url)
      }
    })()

    return () => {
      active = false
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl)
      }
    }
  }, [assetId])

  const displayUrl = assetId ? (resolvedAsset?.id === assetId ? resolvedAsset.url : null) : src

  if (!displayUrl) {
    return <div className="image-placeholder">Cargando imagen…</div>
  }

  return (
    <figure className={`reader-image-figure ${className}`.trim()}>
      <img src={displayUrl} alt={alt || 'Imagen médica'} className="reader-image" />
      {caption && <figcaption className="reader-caption">{caption}</figcaption>}
    </figure>
  )
}
