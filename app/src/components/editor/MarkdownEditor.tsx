import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from '@codemirror/language'
import type { Editor } from '@milkdown/core'
import type { EditorView } from '@milkdown/prose/view'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

import { compressImage } from '../../utils/imageCompress'
import { createAssetFromFile } from '../../db/assets'
import { imageAssetPlugin } from './imageAssetView'
import { wikiLinkPlugin } from './wikiLinkPlugin'

let mermaidCounter = 0

const plainLanguage = (name: string, alias: string[] = []) =>
  LanguageDescription.of({
    name,
    alias,
    load: async () =>
      new LanguageSupport(StreamLanguage.define({ token: () => null })),
  })

const imageAssetFeature = (editor: Editor) => {
  editor.use(imageAssetPlugin)
}

/** Imperative handle expuesto al padre para insertar wiki-links en el cursor. */
export interface MarkdownEditorHandle {
  insertAtCursor(text: string): void
  focus(): void
}

interface MarkdownEditorProps {
  defaultValue: string
  onChange: (markdown: string) => void
  onWikiLinkClick: (uuid: string) => void
  editorRef?: React.MutableRefObject<MarkdownEditorHandle | null>
}

export function MarkdownEditor({
  defaultValue,
  onChange,
  onWikiLinkClick,
  editorRef,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onWikiClickRef = useRef(onWikiLinkClick)
  onChangeRef.current = onChange
  onWikiClickRef.current = onWikiLinkClick

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
          onUpload: async (file: File) => {
            const compressed = await compressImage(file)
            const { id } = await createAssetFromFile(compressed)
            return `asset://${id}`
          },
        },
      },
    })
      .addFeature(imageAssetFeature)
      .addFeature((editor) => editor.use(wikiLinkPlugin(onWikiClickRef.current)))

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md) => onChangeRef.current(md))
    })

    crepe.create().then(() => {
      if (!editorRef) return
      // El Editor de Milkdown no expone `view` en su tipo público pero
      // guarda el EditorView de ProseMirror en este getter.
      const milkdownEditor = (crepe as unknown as { editor: Editor & { view?: EditorView } })
        .editor
      const view: EditorView | undefined = milkdownEditor.view
      editorRef.current = {
        insertAtCursor: (text: string) => {
          if (!view) return
          const tr = view.state.tr.insertText(text)
          view.dispatch(tr)
          view.focus()
        },
        focus: () => view?.focus(),
      }
    })

    return () => {
      if (editorRef) editorRef.current = null
      crepe.destroy()
    }
    // defaultValue es solo el valor inicial; el padre fuerza remonte con key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="editor-host" />
}