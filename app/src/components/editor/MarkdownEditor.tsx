import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from '@codemirror/language'
import type { Editor } from '@milkdown/core'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

import { compressImage } from '../../utils/imageCompress'
import { createAssetFromFile } from '../../db/assets'
import { imageAssetPlugin } from './imageAssetView'

let mermaidCounter = 0

// Fix del spike: LanguageDescription.of exige load/support.
// Tokenizer vacío: solo nos importa el nombre del lenguaje en el fence.
const plainLanguage = (name: string, alias: string[] = []) =>
  LanguageDescription.of({
    name,
    alias,
    load: async () =>
      new LanguageSupport(StreamLanguage.define({ token: () => null })),
  })

// Feature de Crepe que registra el view de imagen (override del nodo image).
// Se añade DESPUÉS de las features por defecto (ImageBlock crea el nodo image).
const imageAssetFeature = (editor: Editor) => {
  editor.use(imageAssetPlugin)
}

interface MarkdownEditorProps {
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
          renderPreview: (language, content, applyPreview) => {
            if (language !== 'mermaid' || !content.trim()) return null
            // Mermaid se carga bajo demanda (V0.3: bundle inicial sin mermaid).
            void (async () => {
              try {
                const { default: mermaid } = await import('mermaid')
                const { svg } = await mermaid.render(
                  `mmd-${++mermaidCounter}`,
                  content,
                )
                applyPreview(svg)
              } catch {
                applyPreview('<p>Error de sintaxis mermaid</p>')
              }
            })()
          },
        },
        [Crepe.Feature.ImageBlock]: {
          // Pipeline spec: comprimir → blob en IndexedDB → referencia asset://<id>.
          onUpload: async (file: File) => {
            const compressed = await compressImage(file)
            const { id } = await createAssetFromFile(compressed)
            return `asset://${id}`
          },
        },
      },
    }).addFeature(imageAssetFeature)

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md) => onChangeRef.current(md))
    })

    crepe.create()
    return () => {
      crepe.destroy()
    }
    // defaultValue es solo el valor inicial; el padre fuerza remonte con key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="editor-host" />
}