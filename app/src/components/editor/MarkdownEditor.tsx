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
  /** id del nodo dueño del artículo. Se captura en mount para evitar
   *  que un markdownUpdated tardío guarde el body viejo sobre el nuevo. */
  nodeId: string
  defaultValue: string
  onChange: (nodeId: string, markdown: string) => void
  onWikiLinkClick: (uuid: string) => void
  editorRef?: React.MutableRefObject<MarkdownEditorHandle | null>
}

export function MarkdownEditor({
  nodeId,
  defaultValue,
  onChange,
  onWikiLinkClick,
  editorRef,
}: MarkdownEditorProps) {
const hostRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onWikiClickRef = useRef(onWikiLinkClick)
  // CRÍTICO: capturar nodeId UNA vez al mount. NO reasignar en cada render.
  // Si reasignáramos, el editor viejo durante el swap heredaría el nodeId
  // del nuevo artículo y un markdownUpdated tardío sobreescribiría el
  // contenido recién sembrado del nuevo (ver git blame).
  const nodeIdRef = useRef(nodeId)
  onChangeRef.current = onChange
  onWikiClickRef.current = onWikiLinkClick

  useEffect(() => {
    if (!hostRef.current) return

    const onChangeForNode = (_id: string, md: string) => {
      // Usa el nodeId de la instancia actual del editor, no el del padre.
      // El padre podría haber cambiado a otro artículo durante un swap,
      // pero ESTE editor debe seguir guardando bajo su propio nodeId.
      void _id
      onChangeRef.current(nodeIdRef.current, md)
    }

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

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md) => {
        // Usamos el nodeId capturado al mount (NO reasignado), para evitar
        // que un markdownUpdated tardío del editor viejo guarde el body viejo
        // sobre el contenido recién sembrado del nuevo artículo.
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          onChangeForNode(nodeIdRef.current, md)
        }, 150)
      })
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
      if (debounceTimer) clearTimeout(debounceTimer)
      if (editorRef) editorRef.current = null
      crepe.destroy()
    }
    // defaultValue es solo el valor inicial; el padre fuerza remonte con key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="editor-host" />
}