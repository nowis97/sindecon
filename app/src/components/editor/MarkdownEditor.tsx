import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from '@codemirror/language'
import mermaid from 'mermaid'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

mermaid.initialize({ startOnLoad: false })

// Fix del spike: LanguageDescription.of exige load/support.
// Tokenizer vacío: solo nos importa el nombre del lenguaje en el fence.
const plainLanguage = (name: string, alias: string[] = []) =>
  LanguageDescription.of({
    name,
    alias,
    load: async () =>
      new LanguageSupport(StreamLanguage.define({ token: () => null })),
  })

let mermaidCounter = 0

interface MarkdownEditorProps {
  /** Valor inicial. El padre remonta con key={nodeId} al cambiar de artículo. */
  defaultValue: string
  onChange: (markdown: string) => void
}

export function MarkdownEditor({ defaultValue, onChange }: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return

    const crepe = new Crepe({
      root: hostRef.current,
      defaultValue,
      features: {
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.Latex]: false,
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          languages: [
            plainLanguage('mermaid'),
            plainLanguage('JavaScript', ['js']),
            plainLanguage('TypeScript', ['ts']),
            plainLanguage('Python', ['py']),
            plainLanguage('Bash', ['sh']),
          ],
          // Fix del spike: devolver undefined y entregar el SVG por
          // applyPreview (async); rellenar un elemento a posteriori no funciona.
          renderPreview: (language, content, applyPreview) => {
            if (language !== 'mermaid' || !content.trim()) return null
            mermaid
              .render(`mmd-${++mermaidCounter}`, content)
              .then(({ svg }) => applyPreview(svg))
              .catch(() =>
                applyPreview('<p>Error de sintaxis mermaid</p>'),
              )
          },
        },
        [Crepe.Feature.ImageBlock]: {
          // V0.1: data URL. En 3.2 pasa a blob en IndexedDB (assets/).
          onUpload: (file: File) =>
            new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(file)
            }),
        },
      },
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md) => onChangeRef.current(md))
    })

    crepe.create()
    return () => {
      crepe.destroy()
    }
    // defaultValue es solo el valor inicial: el padre fuerza remonte con key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="editor-host" />
}
