import { $prose } from '@milkdown/utils'
import { Plugin } from '@milkdown/prose/state'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { getAssetBlob } from '../../db/assets'

/**
 * Plugin de respaldo (envuelto vía $prose) que rinde nodos de imagen (`image`,
 * `image-block`, `image-inline`) cuando su src es `asset://<id>`, resolviendo
 * el blob de IndexedDB y mostrando un Object URL.
 * Si el src no es asset:// (URL externa o data URL), se asigna directo al <img>.
 */
function createImageView(node: ProseNode) {
  const dom = document.createElement('img')
  const src = (node.attrs.src as string) ?? ''
  const alt = (node.attrs.alt as string) ?? ''
  dom.alt = alt
  dom.style.maxWidth = '100%'

  let active = true
  let currentObjectUrl: string | null = null

  if (src.startsWith('asset://')) {
    const id = src.slice('asset://'.length)
    void (async () => {
      const blob = await getAssetBlob(id)
      if (blob && active) {
        currentObjectUrl = URL.createObjectURL(blob)
        dom.src = currentObjectUrl
      }
    })()
  } else {
    dom.src = src
  }

  return {
    dom,
    destroy() {
      active = false
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
        currentObjectUrl = null
      }
    },
  }
}

export const imageAssetPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        image: (node) => createImageView(node),
        'image-block': (node) => createImageView(node),
        'image-inline': (node) => createImageView(node),
      },
    },
  })
})