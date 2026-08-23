import { $prose } from '@milkdown/utils'
import { Plugin } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { WIKI_LINK_REGEX } from '../../domain/wikiLinks'

/**
 * Plugin que visualmente "enlaza" cualquier texto `[[uuid]]` o `[[uuid|alias]]`
 * y hace clickeable. Es un decoration plugin: NO modifica el documento,
 * solo decora la vista — la markdown sigue siendo texto plano portable.
 */
export function wikiLinkPlugin(onClick: (uuid: string) => void) {
  return $prose(() => {
    const re = new RegExp(WIKI_LINK_REGEX.source, 'g')
    return new Plugin({
      props: {
        decorations(state) {
          const decos: Decoration[] = []
          re.lastIndex = 0
          state.doc.descendants((node, pos) => {
            if (!node.isText) return
            const text = node.text ?? ''
            let m: RegExpExecArray | null
            while ((m = re.exec(text)) !== null) {
              const idx = m.index as number // exec al asignar sí devuelve index
              const from = pos + idx
              const to = from + m[0].length
              const uuid = m[1] ?? ''
              decos.push(
                Decoration.inline(from, to, {
                  class: 'wiki-link',
                  nodeName: 'a',
                  'data-uuid': uuid,
                }),
              )
              if (m[0].length === 0) re.lastIndex++ // seguridad ante coincidencias vacías
            }
          })
          return DecorationSet.create(state.doc, decos)
        },
        handleClick(_view, _pos, event) {
          const target = event.target as HTMLElement | null
          const link = target?.closest('.wiki-link') as HTMLElement | null
          if (!link) return false
          const uuid = link.getAttribute('data-uuid')
          if (uuid) {
            onClick(uuid)
            return true
          }
          return false
        },
      },
    })
  })
}