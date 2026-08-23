import { useEffect, useState } from 'react'
import {
  useAllNodes,
  useArticle,
  useStoragePersisted,
  useTemplates,
} from './hooks/useNodes'
import { TreeView } from './components/tree/TreeView'
import { Breadcrumbs } from './components/tree/Breadcrumbs'
import { MarkdownEditor } from './components/editor/MarkdownEditor'
import { PortabilityBar } from './components/portability/PortabilityBar'
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

  useEffect(() => {
    void ensurePersistentStorage()
    void seedTemplatesIfNeeded()
  }, [])

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const article = useArticle(selected?.kind === 'article' ? selected.id : null)

  const targetFolderId = selected
    ? selected.kind === 'folder'
      ? selected.id
      : selected.parent_id
    : null

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
          {templates.length > 0 && (
            <select
              className="template-select"
              defaultValue=""
              onChange={(e) => {
                const v = e.currentTarget.value
                e.currentTarget.value = ''
                if (v) void onCreateFromTemplate(v)
              }}
              title="Nuevo artículo desde plantilla"
            >
              <option value="" disabled>
                + desde plantilla
              </option>
              {templates.map((t) => (
                <option key={t.node.id} value={t.node.title}>
                  {t.node.title}
                </option>
              ))}
            </select>
          )}
          <button onClick={onRename} disabled={!selected}>
            Renombrar
          </button>
          <button onClick={() => setMoveMode(true)} disabled={!selected}>
            Mover
          </button>
          <button onClick={onDelete} disabled={!selected}>
            Eliminar
          </button>
          {moveMode && <button onClick={() => setMoveMode(false)}>Cancelar</button>}
        </div>
        <PortabilityBar />
        <TreeView
          nodes={nodes}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setMoveMode(false)
          }}
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
            {selected.kind === 'article' && article !== undefined && (
              <MarkdownEditor
                key={selected.id}
                defaultValue={article?.body_md ?? ''}
                onChange={(md) => saveArticle(selected.id, md)}
              />
            )}
          </div>
        ) : (
          <p className="muted">Selecciona o crea algo en el árbol ←</p>
        )}
      </main>
    </div>
  )
}

export default App