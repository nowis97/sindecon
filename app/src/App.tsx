import { useEffect, useRef, useState } from 'react'
import {
  useAllNodes,
  useArticle,
  useStoragePersisted,
  useTemplates,
} from './hooks/useNodes'
import { useBacklinks } from './hooks/useBacklinks'
import { TreeView } from './components/tree/TreeView'
import { Breadcrumbs } from './components/tree/Breadcrumbs'
import { MarkdownEditor, type MarkdownEditorHandle } from './components/editor/MarkdownEditor'
import { PortabilityBar } from './components/portability/PortabilityBar'
import { SearchBox } from './components/search/SearchBox'
import { TagInput } from './components/search/TagInput'
import { WikiLinkPicker } from './components/search/WikiLinkPicker'
import { ensurePersistentStorage } from './pwa/persistence'
import {
  createNode,
  renameNode,
  moveNode,
  deleteNodeCascade,
} from './db/nodes'
import { saveArticle } from './db/articles'
import {
  fillTitlePlaceholder,
  seedTemplatesIfNeeded,
} from './db/templates'

function App() {
  const nodes = useAllNodes()
  const templates = useTemplates()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveMode, setMoveMode] = useState(false)
  const storagePersisted = useStoragePersisted()
  const editorRef = useRef<MarkdownEditorHandle | null>(null)

  useEffect(() => {
    void ensurePersistentStorage()
    void seedTemplatesIfNeeded()
  }, [])

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const article = useArticle(selected?.kind === 'article' ? selected.id : null)
  const backlinks = useBacklinks(selected?.kind === 'article' ? selected.id : null)

  const targetFolderId = selected
    ? selected.kind === 'folder'
      ? selected.id
      : selected.parent_id
    : null

  const selectArticle = (id: string) => {
    setSelectedId(id)
    setMoveMode(false)
  }

  const onCreate = async (kind: 'folder' | 'article') => {
    const title = window.prompt(
      kind === 'folder' ? 'Nombre de la carpeta:' : 'Título del artículo:',
    )
    if (!title?.trim()) return
    const node = await createNode({
      kind,
      title: title.trim(),
      parent_id: targetFolderId,
    })
    setSelectedId(node.id)
  }

  const onCreateFromTemplate = async (templateTitle: string) => {
    const tpl = templates.find((t) => t.node.title === templateTitle)
    if (!tpl) return
    const title = window.prompt(`Título (plantilla "${templateTitle}"):`)
    if (!title?.trim()) return
    const node = await createNode({
      kind: 'article',
      title: title.trim(),
      parent_id: targetFolderId,
    })
    await saveArticle(node.id, fillTitlePlaceholder(tpl.body, title.trim()))
    setSelectedId(node.id)
  }

  const onRename = async () => {
    if (!selected) return
    const title = window.prompt('Nuevo nombre:', selected.title)
    if (!title?.trim()) return
    await renameNode(selected.id, title.trim())
  }

  const onMoveTarget = async (folderId: string | null) => {
    setMoveMode(false)
    if (!selected) return
    try {
      await moveNode(selected.id, folderId)
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  const onDelete = async () => {
    if (!selected) return
    const msg =
      selected.kind === 'folder'
        ? `¿Eliminar "${selected.title}" con TODO su contenido?`
        : `¿Eliminar "${selected.title}"?`
    if (!window.confirm(msg)) return
    await deleteNodeCascade(selected.id)
    setSelectedId(null)
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        {storagePersisted === false && (
          <div className="persistence-warning">
            ⚠ Almacenamiento no persistente: exporta backups con regularidad.
          </div>
        )}
        <div className="toolbar">
          <button onClick={() => onCreate('folder')}>+ Carpeta</button>
          <button onClick={() => onCreate('article')}>+ Artículo</button>
          <select
            className="template-select"
            defaultValue=""
            onChange={(e) => {
              const v = e.currentTarget.value
              e.currentTarget.value = ''
              if (v) void onCreateFromTemplate(v)
            }}
            title={
              templates.length > 0
                ? 'Nuevo artículo desde plantilla'
                : 'Sembrando plantillas…'
            }
          >
            <option value="" disabled>
              {templates.length > 0 ? '+ desde plantilla' : 'cargando…'}
            </option>
            {templates.map((t) => (
              <option key={t.node.id} value={t.node.title}>
                {t.node.title}
              </option>
            ))}
          </select>
          <button onClick={onRename} disabled={!selected}>
            Renombrar
          </button>
          <button onClick={() => setMoveMode(true)} disabled={!selected}>
            Mover
          </button>
          <button onClick={onDelete} disabled={!selected}>
            Eliminar
          </button>
          {moveMode && (
            <button onClick={() => setMoveMode(false)}>Cancelar</button>
          )}
        </div>
        <div className="sidebar-search">
          <SearchBox onSelect={selectArticle} />
        </div>
        <PortabilityBar />
        <TreeView
          nodes={nodes}
          selectedId={selectedId}
          onSelect={selectArticle}
          moveMode={moveMode}
          onMoveTarget={onMoveTarget}
        />
      </aside>

      <main className="content">
        <Breadcrumbs nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} />
        {selected ? (
          <div>
            <h1>{selected.title}</h1>
            {selected.kind === 'folder' && <p className="muted">Carpeta</p>}
            {selected.kind === 'article' && article && (
              <>
                <div className="article-meta">
                  <TagInput articleId={selected.id} tags={article.tags} />
                </div>
                <div className="article-toolbar">
                  <WikiLinkPicker
                    onPick={(text) => {
                      editorRef.current?.insertAtCursor(text)
                      editorRef.current?.focus()
                    }}
                  />
                </div>
                <MarkdownEditor
                  key={selected.id}
                  defaultValue={article.body_md}
                  onChange={(md) => saveArticle(selected.id, md)}
                  onWikiLinkClick={selectArticle}
                  editorRef={editorRef}
                />
                {backlinks.length > 0 && (
                  <aside className="backlinks">
                    <h3>Artículos que enlazan aquí</h3>
                    <ul>
                      {backlinks.map((b) => (
                        <li key={b.id}>
                          <button onClick={() => selectArticle(b.id)}>
                            {b.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </aside>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="muted">
            Selecciona o crea algo en el árbol, o usa la búsqueda ↑
          </p>
        )}
      </main>
    </div>
  )
}

export default App