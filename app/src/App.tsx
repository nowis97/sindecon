import { useEffect, useRef, useState } from 'react'
import {
  useAllNodes,
  useArticle,
  useStoragePersisted,
  useTemplates,
} from './hooks/useNodes'
import { useBacklinks } from './hooks/useBacklinks'
import { useTheme } from './hooks/useTheme'
import { useFavorites } from './hooks/useFavorites'
import { useGoogleSync } from './hooks/useGoogleSync'
import { TreeView } from './components/tree/TreeView'
import { Breadcrumbs } from './components/tree/Breadcrumbs'
import { MarkdownEditor, type MarkdownEditorHandle } from './components/editor/MarkdownEditor'
import { ArticleReader } from './components/reader/ArticleReader'
import { QuickCapture } from './components/capture/QuickCapture'
import { SmartImportModal } from './components/editor/SmartImportModal'
import { PortabilityBar } from './components/portability/PortabilityBar'
import { SyncIndicator } from './components/portability/SyncIndicator'
import { GoogleDriveModal } from './components/portability/GoogleDriveModal'
import { SearchBox } from './components/search/SearchBox'
import { CommandPalette } from './components/search/CommandPalette'
import { TagInput } from './components/search/TagInput'
import { WikiLinkPicker } from './components/search/WikiLinkPicker'
import { Dashboard } from './components/dashboard/Dashboard'
import { MobileBottomBar } from './components/navigation/MobileBottomBar'
import {
  PromptDialog,
  ConfirmDialog,
  AlertDialog,
} from './components/common/DialogModal'
import { ensurePersistentStorage } from './pwa/persistence'
import { childrenOf } from './domain/tree'
import { db } from './db/db'
import {
  createNode,
  renameNode,
  moveNode,
  deleteNodeCascade,
  deduplicateSystemNodes,
} from './db/nodes'
import { saveArticle } from './db/articles'
import { ensureInboxFolder } from './db/inbox'
import {
  fillTitlePlaceholder,
  seedTemplatesIfNeeded,
} from './db/templates'

type PromptState =
  | {
      type: 'create-node'
      kind: 'folder' | 'article'
      parentId: string | null
    }
  | {
      type: 'create-from-template'
      templateTitle: string
      parentId: string | null
    }
  | {
      type: 'rename-node'
      nodeId: string
      currentTitle: string
    }
  | null

type DeleteState = {
  nodeId: string
  title: string
  isFolder: boolean
} | null

function App() {
  const nodes = useAllNodes()
  const templates = useTemplates()
  const { theme, toggleTheme } = useTheme()
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const {
    isConnected: isGoogleConnected,
    syncState: googleSyncState,
    lastSyncedAt: googleLastSyncedAt,
    errorMessage: googleErrorMessage,
    userEmail: googleUserEmail,
    connectWithToken: connectGoogleToken,
    disconnect: disconnectGoogle,
    triggerSync: triggerGoogleSync,
    initiateOAuthLogin: initiateGoogleOAuth,
  } = useGoogleSync()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveMode, setMoveMode] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false)
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false)
  const [promptState, setPromptState] = useState<PromptState>(null)
  const [deleteState, setDeleteState] = useState<DeleteState>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const storagePersisted = useStoragePersisted()
  const editorRef = useRef<MarkdownEditorHandle | null>(null)

  // Para el artículo recién creado: guardamos el body en local state
  // para evitar la carrera con useLiveQuery (el editor podría montar
  // brevemente con body vacío y sobrescribir el contenido sembrado).
  const [seedBody, setSeedBody] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      await ensurePersistentStorage()
      await seedTemplatesIfNeeded()
      await ensureInboxFolder()
      await deduplicateSystemNodes()
    })()
  }, [])

  // Listener global para atajo Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const article = useArticle(selected?.kind === 'article' ? selected.id : null)
  const backlinks = useBacklinks(selected?.kind === 'article' ? selected.id : null)

  // Búsqueda de carpeta Inbox y cálculo de conteo de pendientes
  const inboxFolder = nodes.find(
    (n) => n.kind === 'folder' && n.title === 'Inbox' && n.parent_id === null,
  )
  const inboxCount = inboxFolder ? childrenOf(nodes, inboxFolder.id).length : 0
  const isArticleReady =
    selected?.kind === 'article' && (seedBody !== null || article !== undefined)
  const currentBody =
    (selected?.kind === 'article' && article?.node_id === selected.id
      ? article.body_md
      : null) ??
    seedBody ??
    ''

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

  // --- Manejo de Creación y Edición mediante Diálogos Modales ---
  const handleOpenCreatePrompt = (
    kind: 'folder' | 'article',
    parentId: string | null = targetFolderId,
  ) => {
    setPromptState({
      type: 'create-node',
      kind,
      parentId,
    })
  }

  const handleOpenTemplatePrompt = (
    templateTitle: string,
    parentId: string | null = targetFolderId,
  ) => {
    setPromptState({
      type: 'create-from-template',
      templateTitle,
      parentId,
    })
  }

  const handleOpenRenamePrompt = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setPromptState({
      type: 'rename-node',
      nodeId: node.id,
      currentTitle: node.title,
    })
  }

  const handleOpenDeleteConfirm = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setDeleteState({
      nodeId: node.id,
      title: node.title,
      isFolder: node.kind === 'folder',
    })
  }

  const handlePromptConfirm = async (value: string) => {
    if (!promptState || !value.trim()) return

    if (promptState.type === 'create-node') {
      const node = await createNode({
        kind: promptState.kind,
        title: value.trim(),
        parent_id: promptState.parentId,
      })
      setSelectedId(node.id)
      setSeedBody(null)
      setIsEditMode(true)
      setSidebarOpen(false)
    } else if (promptState.type === 'create-from-template') {
      const tpl = templates.find((t) => t.node.title === promptState.templateTitle)
      if (!tpl) return
      const finalTitle = value.trim()
      const body = fillTitlePlaceholder(tpl.body, finalTitle)
      const node = await createNode({
        kind: 'article',
        title: finalTitle,
        parent_id: promptState.parentId,
      })
      await saveArticle(node.id, body)
      setSeedBody(body)
      setSelectedId(node.id)
      setIsEditMode(true)
      setSidebarOpen(false)
    } else if (promptState.type === 'rename-node') {
      await renameNode(promptState.nodeId, value.trim())
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteState) return
    await deleteNodeCascade(deleteState.nodeId)
    if (selectedId === deleteState.nodeId) {
      setSelectedId(null)
    }
    setDeleteState(null)
  }

  const onMoveTarget = async (folderId: string | null) => {
    setMoveMode(false)
    if (!selected) return
    try {
      await moveNode(selected.id, folderId)
    } catch (e) {
      setErrorMessage((e as Error).message)
    }
  }

  // --- Handlers de Importación Inteligente (ChatGPT / Word) ---
  const handleAppendToCurrentArticle = async (articleId: string, additionalMarkdown: string) => {
    const art = await db.articles.get(articleId)
    const current = art?.body_md || ''
    const updated = current.trim()
      ? `${current.trim()}\n\n---\n\n${additionalMarkdown.trim()}`
      : additionalMarkdown.trim()
    await saveArticle(articleId, updated)
  }

  const handleReplaceCurrentArticle = async (articleId: string, newMarkdown: string) => {
    await saveArticle(articleId, newMarkdown)
  }

  const handleCreateNewArticle = async (
    title: string,
    markdown: string,
    parentId: string | null,
  ) => {
    const node = await createNode({
      kind: 'article',
      title,
      parent_id: parentId,
    })
    await saveArticle(node.id, markdown)
    setSeedBody(markdown)
    setSelectedId(node.id)
    setIsEditMode(false)
    setSidebarOpen(false)
  }

  const handleSaveToInbox = async (title: string, markdown: string) => {
    const inbox = await ensureInboxFolder()
    const node = await createNode({
      kind: 'article',
      title,
      parent_id: inbox.id,
    })
    await saveArticle(node.id, markdown)
    setSelectedId(node.id)
    setSidebarOpen(false)
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
        <SyncIndicator
          isConnected={isGoogleConnected}
          syncState={googleSyncState}
          lastSyncedAt={googleLastSyncedAt}
          onClick={() => setIsGoogleModalOpen(true)}
        />
        <button
          type="button"
          className="btn-topbar-theme"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
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
            <div className="sidebar-header-top-row">
              <h2
                className="app-title"
                onClick={() => setSelectedId(null)}
                style={{ cursor: 'pointer' }}
                title="Ir al inicio"
              >
                🩺 Cuaderno Médico
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SyncIndicator
                  isConnected={isGoogleConnected}
                  syncState={googleSyncState}
                  lastSyncedAt={googleLastSyncedAt}
                  onClick={() => setIsGoogleModalOpen(true)}
                />
                <button
                  type="button"
                  className="btn-theme-toggle"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  aria-label="Cambiar tema"
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
            <div className="sidebar-header-actions">
              <button
                type="button"
                className="btn-command-palette-trigger"
                onClick={() => setIsCommandPaletteOpen(true)}
                title="Búsqueda y Comandos (Ctrl+K)"
                aria-label="Abrir paleta de comandos"
              >
                🔍 Comandos <kbd>Ctrl+K</kbd>
              </button>
              <button
                type="button"
                className="btn-quick-capture"
                onClick={() => setIsQuickCaptureOpen(true)}
                title="Captura rápida a 1 toque (foto + nota) al Inbox"
                aria-label="Captura rápida"
              >
                📸 Captura rápida
              </button>
            </div>
          </div>

          {storagePersisted === false && (
            <div className="persistence-warning">
              ⚠ Almacenamiento no persistente: exporta backups con regularidad.
            </div>
          )}

          <div className="toolbar">
            <button
              type="button"
              onClick={() => handleOpenCreatePrompt('folder')}
              title="Crear nueva carpeta o especialidad"
            >
              + Carpeta
            </button>
            <button
              type="button"
              onClick={() => handleOpenCreatePrompt('article')}
              title="Crear nuevo artículo médico en blanco"
            >
              + Artículo
            </button>
            <select
              className="template-select"
              defaultValue=""
              onChange={(e) => {
                const v = e.currentTarget.value
                e.currentTarget.value = ''
                if (v) handleOpenTemplatePrompt(v)
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
          </div>

          {moveMode && (
            <div className="move-mode-banner">
              <span>Moviendo "{selected?.title}". Selecciona la carpeta destino:</span>
              <button type="button" onClick={() => setMoveMode(false)}>
                Cancelar
              </button>
            </div>
          )}

          <div className="sidebar-search desktop-only-search">
            <SearchBox onSelect={selectArticle} />
          </div>

          <PortabilityBar
            onOpenGoogleDriveSync={() => setIsGoogleModalOpen(true)}
          />

          <TreeView
            nodes={nodes}
            selectedId={selectedId}
            onSelect={selectArticle}
            moveMode={moveMode}
            onMoveTarget={onMoveTarget}
            onRenameNode={handleOpenRenamePrompt}
            onMoveNode={(id) => {
              setSelectedId(id)
              setMoveMode(true)
            }}
            onDeleteNode={handleOpenDeleteConfirm}
            onCreateChild={(parentId, kind) =>
              handleOpenCreatePrompt(kind, parentId)
            }
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
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
                <div className="article-title-wrapper">
                  <h1 className="article-title">{selected.title}</h1>
                  {selected.kind === 'article' && (
                    <button
                      type="button"
                      className={`btn-fav-star ${isFavorite(selected.id) ? 'active' : ''}`}
                      onClick={() => toggleFavorite(selected.id)}
                      title={
                        isFavorite(selected.id)
                          ? 'Quitar de favoritos / anclados'
                          : 'Anclar a favoritos'
                      }
                      aria-label="Favorito"
                    >
                      {isFavorite(selected.id) ? '⭐' : '☆'}
                    </button>
                  )}
                </div>

                {selected.kind === 'article' && (
                  <div className="article-header-actions-group">
                    <button
                      type="button"
                      className="btn-smart-import-trigger"
                      onClick={() => setIsSmartImportOpen(true)}
                      title="Importar contenido desde ChatGPT, IA o Word (.docx)"
                    >
                      🪄 Importar
                    </button>

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
                  </div>
                )}
              </div>

              {selected.kind === 'folder' && (
                <div className="folder-view-card">
                  <p className="folder-lead">
                    📁 Carpeta / Especialidad: <strong>{selected.title}</strong>
                  </p>
                  <div className="folder-actions-row">
                    <button
                      type="button"
                      className="btn-dialog-primary"
                      onClick={() => handleOpenCreatePrompt('article', selected.id)}
                    >
                      ➕ Nuevo artículo aquí
                    </button>
                    <button
                      type="button"
                      className="btn-dialog-secondary"
                      onClick={() => handleOpenCreatePrompt('folder', selected.id)}
                    >
                      📁 Nueva subcarpeta
                    </button>
                    <button
                      type="button"
                      className="btn-dialog-secondary"
                      onClick={() => setIsSmartImportOpen(true)}
                    >
                      🪄 Importar texto/Word aquí
                    </button>
                  </div>
                </div>
              )}

              {selected.kind === 'article' && isArticleReady && (
                <>
                  <div className="article-meta">
                    <TagInput
                      articleId={selected.id}
                      tags={article?.node_id === selected.id ? (article?.tags ?? []) : []}
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
                            <button
                              type="button"
                              onClick={() => selectArticle(b.id)}
                            >
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
            <Dashboard
              nodes={nodes}
              templates={templates}
              onSelectArticle={selectArticle}
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
              onOpenSmartImport={() => setIsSmartImportOpen(true)}
              onCreateNode={(kind) => handleOpenCreatePrompt(kind)}
              onCreateFromTemplate={(tplTitle) =>
                handleOpenTemplatePrompt(tplTitle)
              }
            />
          )}
        </main>
      </div>

      {/* Barra de Navegación Inferior Móvil (zona del pulgar) */}
      <MobileBottomBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        isSidebarOpen={sidebarOpen}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        onOpenInbox={() => inboxFolder && selectArticle(inboxFolder.id)}
        inboxCount={inboxCount}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Modal de Paleta de Comandos Global (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        nodes={nodes}
        favoriteIds={favoriteIds}
        onSelectArticle={selectArticle}
        onOpenCreatePrompt={(kind) => handleOpenCreatePrompt(kind)}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        onOpenSmartImport={() => setIsSmartImportOpen(true)}
        onToggleTheme={toggleTheme}
        onGoHome={() => setSelectedId(null)}
        onGoInbox={() => inboxFolder && selectArticle(inboxFolder.id)}
      />

      {/* Modal de Asistente de Importación Inteligente (ChatGPT, Word, Rich Text) */}
      <SmartImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        currentArticle={
          selected?.kind === 'article'
            ? { id: selected.id, title: selected.title, body: currentBody }
            : null
        }
        nodes={nodes}
        onAppendToCurrentArticle={handleAppendToCurrentArticle}
        onReplaceCurrentArticle={handleReplaceCurrentArticle}
        onCreateNewArticle={handleCreateNewArticle}
        onSaveToInbox={handleSaveToInbox}
      />

      {/* Modal de Configuración y Estado de Google Drive */}
      <GoogleDriveModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        isConnected={isGoogleConnected}
        syncState={googleSyncState}
        lastSyncedAt={googleLastSyncedAt}
        userEmail={googleUserEmail}
        errorMessage={googleErrorMessage}
        onTriggerSync={() => void triggerGoogleSync()}
        onDisconnect={disconnectGoogle}
        onConnectToken={connectGoogleToken}
        onInitiateOAuth={initiateGoogleOAuth}
      />

      {/* Modal de Captura Rápida Global */}
      <QuickCapture
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onCaptureSaved={selectArticle}
        hideLauncher
      />

      {/* Diálogo Prompt unificado (Crear Carpeta, Crear Artículo, Crear desde Plantilla, Renombrar) */}
      {promptState && (
        <PromptDialog
          isOpen={true}
          title={
            promptState.type === 'create-node'
              ? promptState.kind === 'folder'
                ? '📁 Nueva Carpeta'
                : '📝 Nuevo Artículo'
              : promptState.type === 'create-from-template'
                ? `📋 Nuevo desde "${promptState.templateTitle}"`
                : '✏️ Renombrar'
          }
          label={
            promptState.type === 'create-node'
              ? promptState.kind === 'folder'
                ? 'Nombre de la carpeta:'
                : 'Título del artículo:'
              : promptState.type === 'create-from-template'
                ? 'Título del artículo a crear:'
                : 'Nuevo nombre:'
          }
          placeholder={
            promptState.type === 'create-node'
              ? promptState.kind === 'folder'
                ? 'ej. Cardiología, Urgencias, Farmacología'
                : 'ej. Cetoacidosis Diabética, Ficha Fármaco'
              : promptState.type === 'create-from-template'
                ? `ej. ${promptState.templateTitle}`
                : ''
          }
          initialValue={
            promptState.type === 'rename-node' ? promptState.currentTitle : ''
          }
          confirmText={
            promptState.type === 'rename-node' ? 'Renombrar' : 'Crear'
          }
          onConfirm={handlePromptConfirm}
          onClose={() => setPromptState(null)}
        />
      )}

      {/* Diálogo de Confirmación para Eliminación */}
      {deleteState && (
        <ConfirmDialog
          isOpen={true}
          title={
            deleteState.isFolder
              ? '¿Eliminar carpeta y su contenido?'
              : '¿Eliminar artículo?'
          }
          message={
            deleteState.isFolder
              ? `¿Estás seguro de que deseas eliminar la carpeta "${deleteState.title}" y TODO su contenido? Esta acción no se puede deshacer.`
              : `¿Estás seguro de que deseas eliminar el artículo "${deleteState.title}"?`
          }
          confirmText="Eliminar definitivamente"
          cancelText="Cancelar"
          isDestructive={true}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteState(null)}
        />
      )}

      {/* Diálogo de Alerta de Error */}
      {errorMessage && (
        <AlertDialog
          isOpen={true}
          title="⚠️ Notificación"
          content={<p className="dialog-error-text">{errorMessage}</p>}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  )
}

export default App