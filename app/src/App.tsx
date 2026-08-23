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
import { ArticleReader } from './components/reader/ArticleReader'
import { QuickCapture } from './components/capture/QuickCapture'
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
import { ensureInboxFolder } from './db/inbox'
import {
  fillTitlePlaceholder,
  seedTemplatesIfNeeded,
} from './db/templates'

function App() {
  const nodes = useAllNodes()
  const templates = useTemplates()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveMode, setMoveMode] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const storagePersisted = useStoragePersisted()
  const editorRef = useRef<MarkdownEditorHandle | null>(null)

  // Para el artículo recién creado: guardamos el body en local state
  // para evitar la carrera con useLiveQuery (el editor podría montar
  // brevemente con body vacío y sobrescribir el contenido sembrado).
  const [seedBody, setSeedBody] = useState<string | null>(null)

  useEffect(() => {
    void ensurePersistentStorage()
    void seedTemplatesIfNeeded()
    void ensureInboxFolder()
  }, [])

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const article = useArticle(selected?.kind === 'article' ? selected.id : null)
  const backlinks = useBacklinks(selected?.kind === 'article' ? selected.id : null)

  const articleMatches =
    Boolean(article && selected?.kind === 'article' && article.node_id === selected.id)
  const isArticleReady = Boolean(
    selected?.kind === 'article' &&
      (seedBody !== null ||
        articleMatches ||
        article === null),
  )
  const currentBody = articleMatches
    ? article!.body_md
    : (selected?.kind === 'article' ? (seedBody ?? '') : '')

  const targetFolderId = selected
    ? selected.kind === 'folder'
      ? selected.id
      : selected.parent_id
    : null

  const selectArticle = (id: string) => {
    setSelectedId(id)
    setMoveMode(false)
    setSeedBody(null)
    setSidebarOpen(false)
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
    setSeedBody(null)
    setIsEditMode(true)
    setSidebarOpen(false)
  }

  const onCreateFromTemplate = async (templateTitle: string) => {
    const tpl = templates.find((t) => t.node.title === templateTitle)
    if (!tpl) return
    const title = window.prompt(`Título (plantilla "${templateTitle}"):`)
    if (!title?.trim()) return
    const finalTitle = title.trim()
    const body = fillTitlePlaceholder(tpl.body, finalTitle)
    const node = await createNode({
      kind: 'article',
      title: finalTitle,
      parent_id: targetFolderId,
    })
    await saveArticle(node.id, body)
    setSeedBody(body)
    setSelectedId(node.id)
    setIsEditMode(true)
    setSidebarOpen(false)
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
    <div className="app-container">
      <header className="mobile-topbar">
        <button
          type="button"
          className="btn-menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Abrir menú de temas"
        >
          ☰ {sidebarOpen ? 'Cerrar' : 'Temas'}
        </button>
        <div className="topbar-search">
          <SearchBox onSelect={selectArticle} />
        </div>
        <QuickCapture onCaptureSaved={selectArticle} />
      </header>

      <div className={`layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className="sidebar">
          <div className="sidebar-header-desktop">
            <h2 className="app-title">🩺 Cuaderno Médico</h2>
            <QuickCapture onCaptureSaved={selectArticle} />
          </div>

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

          <div className="sidebar-search desktop-only-search">
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
          <Breadcrumbs
            nodes={nodes}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id)
              setSidebarOpen(false)
            }}
          />

          {selected ? (
            <div className="article-container">
              <div className="article-header-row">
                <h1 className="article-title">{selected.title}</h1>
                {selected.kind === 'article' && (
                  <div className="view-mode-toggle">
                    <button
                      type="button"
                      className={`btn-mode ${!isEditMode ? 'active' : ''}`}
                      onClick={() => setIsEditMode(false)}
                    >
                      👁 Lector
                    </button>
                    <button
                      type="button"
                      className={`btn-mode ${isEditMode ? 'active' : ''}`}
                      onClick={() => setIsEditMode(true)}
                    >
                      ✏ Editor
                    </button>
                  </div>
                )}
              </div>

              {selected.kind === 'folder' && <p className="muted">Carpeta</p>}

              {selected.kind === 'article' && isArticleReady && (
                <>
                  <div className="article-meta">
                    <TagInput
                      articleId={selected.id}
                      tags={articleMatches ? (article?.tags ?? []) : []}
                    />
                  </div>

                  {isEditMode ? (
                    <>
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
                        nodeId={selected.id}
                        defaultValue={currentBody}
                        onChange={(nodeId, md) => saveArticle(nodeId, md)}
                        onWikiLinkClick={selectArticle}
                        editorRef={editorRef}
                      />
                    </>
                  ) : (
                    <ArticleReader
                      markdown={currentBody}
                      onWikiLinkClick={selectArticle}
                    />
                  )}

                  {backlinks.length > 0 && (
                    <aside className="backlinks">
                      <h3>Artículos que enlazan aquí</h3>
                      <ul>
                        {backlinks.map((b) => (
                          <li key={b.id}>
                            <button onClick={() => selectArticle(b.id)}>
                              📄 {b.title}
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
            <div className="empty-state">
              <p className="muted">
                Selecciona o crea algo en el árbol, o usa la búsqueda ↑
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App