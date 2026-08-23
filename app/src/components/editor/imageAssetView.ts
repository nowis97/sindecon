import { $prose } from '@milkdown/utils'
import { Plugin } from '@milkdown/prose/state'
import { getAssetBlob } from '../../db/assets'

/**
 * Plugin (envuelto vía $prose) que rinde el nodo `image` cuando su src es
 * `asset://<id>`, resolviendo el blob de IndexedDB y mostrando un Object URL.
 * Si el src no es asset:// (URL externa o data URL), se asigna directo al <img>.
 */
export const imageAssetPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        image: (node) => {
          const dom = document.createElement('img')
          const src = (node.attrs.src as string) ?? ''
          const alt = (node.attrs.alt as string) ?? ''
          dom.alt = alt
          dom.style.maxWidth = '100%'
          if (src.startsWith('asset://')) {
            const id = src.slice('asset://'.length)
            void (async () => {
              const blob = await getAssetBlob(id)
              if (blob) dom.src = URL.createObjectURL(blob)
            })()
          } else {
            dom.src = src
          }
          return { dom }
        },
      },
    },
  })
})