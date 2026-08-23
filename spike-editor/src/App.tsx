import { useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from '@codemirror/language'
import mermaid from 'mermaid'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import './App.css'
import { SAMPLE } from './sample'

mermaid.initialize({ startOnLoad: false })

const STORAGE_KEY = 'spike-kb-markdown'

// LanguageDescription.of exige 'load' o 'support'.
// Para el spike basta un tokenizer vacío (sin highlight);
// lo importante es que el nombre del lenguaje llegue al fence del markdown.
const plainLanguage = (name: string, alias: string[] = []) =>
  LanguageDescription.of({
    name,
    alias,
    load: async () =>
      new LanguageSupport(StreamLanguage.define({ token: () => null })),
  })

let editorMmdCounter = 0
let readerMmdCounter = 0

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const id = `mmd-reader-${++readerMmdCounter}`
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      })
      .catch(() => {
        if (!cancelled && ref.current)
          ref.current.textContent = 'Error de sintaxis mermaid'
      })
    return () => {
      cancelled = true
    }
  }, [code])

  return <div ref={ref} className="mermaid-reader" />
}

function App() {
  const editorHostRef = useRef<HTMLDivElement>(null)
  const [markdown, setMarkdown] = useState('')

  useEffect(() => {
    if (!editorHostRef.current) return

    const saved = localStorage.getItem(STORAGE_KEY) ?? SAMPLE

    const crepe = new Crepe({
      root: editorHostRef.current,
      defaultValue: saved,
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
            // Modo async: devolvemos undefined y entregamos el SVG
            // vía applyPreview (reactivo). Devolver un elemento y
            // rellenarlo después NO funciona: el componente copia
            // su innerHTML de inmediato.
            const id = `mmd-editor-${++editorMmdCounter}`
            mermaid
              .render(id, content)
              .then(({ svg }) => applyPreview(svg))
              .catch(() =>
                applyPreview('<p>Error de sintaxis mermaid</p>'),
              )
          },
        },
        [Crepe.Feature.ImageBlock]: {
          // Spike: data URL. En la app real: blob en IndexedDB.
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
      listener.markdownUpdated((_ctx, md) => {
        localStorage.setItem(STORAGE_KEY, md)
        setMarkdown(md)
      })
    })

    crepe.create().then(() => setMarkdown(crepe.getMarkdown()))

    return () => {
      crepe.destroy()
    }
  }, [])

  const mermaidBlocks = [...markdown.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map(
    (m) => m[1],
  )

  return (
    <div className="spike">
      <header className="spike-header">
        <h1>Spike: round-trip WYSIWYG ↔ Markdown</h1>
        <p>
          Prueba de fuego: <strong>edita algo → recarga (F5) → todo debe verse
          igual</strong>. Si persiste, el markdown es fuente de verdad sin
          pérdidas. Prueba también: crear una tabla (botón +), insertar bloque
          de código con lenguaje <code>mermaid</code> y ver su preview, y pegar
          una imagen.
        </p>
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY)
            location.reload()
          }}
        >
          Restaurar ejemplo
        </button>
      </header>

      <main className="spike-grid">
        <section className="panel">
          <h2>Editor (WYSIWYG)</h2>
          <div ref={editorHostRef} className="editor-host" />
        </section>

        <section className="panel side">
          <h2>Markdown guardado (localStorage)</h2>
          <pre className="markdown-out">{markdown}</pre>

          <h2>Vista lector: esquemas renderizados</h2>
          {mermaidBlocks.length === 0 && <p>(sin bloques mermaid)</p>}
          {mermaidBlocks.map((code, i) => (
            <MermaidDiagram key={i} code={code} />
          ))}
        </section>
      </main>
    </div>
  )
}

export default App
