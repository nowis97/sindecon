/** Reduce la imagen a un máximo de `maxSize` en su lado mayor, re-encode WebP q=0.85. */
export async function compressImage(file: File, maxSize = 1600): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const img = await loadImage(file)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(file)
          return
        }
        const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
        resolve(new File([blob], name, { type: 'image/webp' }))
      },
      'image/webp',
      0.85,
    )
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}