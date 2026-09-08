import React, { useMemo, useState } from 'react'
import type { NodeRow } from '../../db/db'
import { childrenOf, canMove, sortNodesBy, type SortCriteria } from '../../domain/tree'

export interface FolderExplorerViewProps {
  folderNode: NodeRow
  nodes: NodeRow[]
  onSelectNode: (id: string) => void
  onCreateArticle: (folderId: string) => void
  onCreateSubfolder: (folderId: string) => void
  onSmartImport: (folderId: string) => void
  onBulkImport?: (folderId: string) => void
  onSortFolderAlphabetically?: (folderId: string) => void
  onToggleFavorite?: (id: string) => void
  onRenameNode?: (id: string) => void
  favoriteIds?: string[]
  onMoveNodeDirect?: (nodeId: string, targetFolderId: string | null) => Promise<void>
}

export const FolderExplorerView: React.FC<FolderExplorerViewProps> = ({
  folderNode,
  nodes,
  onSelectNode,
  onCreateArticle,
  onCreateSubfolder,
  onSmartImport,
  onBulkImport,
  onSortFolderAlphabetically,
  onToggleFavorite,
  onRenameNode,
  favoriteIds = [],
  onMoveNodeDirect,
}) => {
  const [dragOverSubfolderId, setDragOverSubfolderId] = useState<string | null>(null)
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('manual')

  const directChildren = childrenOf(nodes, folderNode.id)
  const subfolders = useMemo(
    () => sortNodesBy(directChildren.filter((n) => n.kind === 'folder'), sortCriteria, false),
    [directChildren, sortCriteria]
  )
  const articles = useMemo(
    () => sortNodesBy(directChildren.filter((n) => n.kind === 'article'), sortCriteria, false),
    [directChildren, sortCriteria]
  )

  const totalFavs = directChildren.filter((a) => a.kind === 'article' && favoriteIds.includes(a.id)).length

  return (
    <div className="folder-explorer-container">
      {/* Encabezado Principal de la Carpeta */}
      <div className="folder-explorer-hero">
        <div className="folder-hero-title-group">
          <div className="folder-hero-badge-icon">📁</div>
          <div className="folder-hero-text">
            <span className="folder-hero-pretitle">Carpeta / Especialidad</span>
            <h1 className="folder-hero-title">{folderNode.title}</h1>
          </div>
        </div>

        {/* Métricas y Estadísticas de la Carpeta */}
        <div className="folder-hero-stats">
          <span className="folder-stat-pill folders" title="Subcarpetas directas">
            📁 {subfolders.length} subcarpeta{subfolders.length === 1 ? '' : 's'}
          </span>
          <span className="folder-stat-pill articles" title="Artículos y fichas clínicas">
            📄 {articles.length} artículo{articles.length === 1 ? '' : 's'}
          </span>
          {totalFavs > 0 && (
            <span className="folder-stat-pill favorites" title="Artículos anclados a favoritos">
              ⭐ {totalFavs} favorito{totalFavs === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Barra de Acciones Rápidas */}
        <div className="folder-hero-actions">
          <button
            type="button"
            className="btn-folder-action primary"
            onClick={() => onCreateArticle(folderNode.id)}
          >
            <span>➕</span>
            <span>Nuevo Artículo</span>
          </button>

          <button
            type="button"
            className="btn-folder-action secondary"
            onClick={() => onCreateSubfolder(folderNode.id)}
          >
            <span>📁</span>
            <span>Nueva Subcarpeta</span>
          </button>

          <button
            type="button"
            className="btn-folder-action secondary"
            onClick={() => onSmartImport(folderNode.id)}
          >
            <span>🪄</span>
            <span>Importar de ChatGPT/Word</span>
          </button>

          {onBulkImport && (
            <button
              type="button"
              className="btn-folder-action secondary"
              onClick={() => onBulkImport(folderNode.id)}
            >
              <span>📥</span>
              <span>Importar Archivos .md</span>
            </button>
          )}

          {onSortFolderAlphabetically && directChildren.length > 1 && (
            <button
              type="button"
              className="btn-folder-action secondary btn-sort-folder"
              onClick={() => onSortFolderAlphabetically(folderNode.id)}
              title="Reordenar permanentemente los elementos de esta carpeta en orden alfabético A-Z"
            >
              <span>🔤</span>
              <span>Ordenar A-Z</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenido: Si está vacía */}
      {subfolders.length === 0 && articles.length === 0 ? (
        <div className="folder-empty-state">
          <div className="folder-empty-bubble">📂</div>
          <h3>Esta carpeta está vacía</h3>
          <p>
            Comienza a estructurar tu conocimiento médico en <strong>{folderNode.title}</strong> creando artículos clínicos o subcarpetas para subespecialidades.
          </p>
          <div className="folder-empty-actions">
            <button
              type="button"
              className="btn-folder-action primary"
              onClick={() => onCreateArticle(folderNode.id)}
            >
              ➕ Crear Primer Artículo
            </button>
            <button
              type="button"
              className="btn-folder-action secondary"
              onClick={() => onCreateSubfolder(folderNode.id)}
            >
              📁 Crear Primera Subcarpeta
            </button>
            {onBulkImport && (
              <button
                type="button"
                className="btn-folder-action secondary"
                onClick={() => onBulkImport(folderNode.id)}
              >
                📥 Importar Archivos .md
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="folder-explorer-content-sections">
          {/* Barra de opciones de ordenamiento de vista */}
          <div
            className="folder-sort-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <label
              htmlFor="folder-sort-select"
              style={{
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
              }}
            >
              <span>Vista:</span>
              <select
                id="folder-sort-select"
                value={sortCriteria}
                onChange={(e) => setSortCriteria(e.target.value as SortCriteria)}
                className="folder-sort-select"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  width: 'auto',
                }}
              >
                <option value="manual">Personalizado (Árbol)</option>
                <option value="alpha-asc">Alfabético (A-Z)</option>
                <option value="alpha-desc">Alfabético (Z-A)</option>
                <option value="recent">Más recientes</option>
              </select>
            </label>
          </div>
          {/* Sección de Subcarpetas */}
          {subfolders.length > 0 && (
            <section className="folder-explorer-section">
              <div className="section-header-line">
                <span className="section-icon">📁</span>
                <h2 className="section-title">Subcarpetas ({subfolders.length})</h2>
              </div>

              <div className="subfolders-grid">
                {subfolders.map((sub) => {
                  const count = childrenOf(nodes, sub.id).length
                  const isDragTarget = dragOverSubfolderId === sub.id
                  return (
                    <div
                      key={sub.id}
                      className={`subfolder-card ${isDragTarget ? 'drag-over' : ''}`}
                      onClick={() => onSelectNode(sub.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectNode(sub.id)
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverSubfolderId !== sub.id) {
                          setDragOverSubfolderId(sub.id)
                        }
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation()
                        if (dragOverSubfolderId === sub.id) {
                          setDragOverSubfolderId(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragOverSubfolderId(null)
                        const sourceId =
                          (e.dataTransfer ? e.dataTransfer.getData('application/sindecon-node-id') || e.dataTransfer.getData('text/plain') : null) ||
                          (typeof window !== 'undefined' ? (window as unknown as { __SINDECON_DRAGGING_ID__?: string }).__SINDECON_DRAGGING_ID__ : null)
                        if (typeof window !== 'undefined') {
                          ;(window as unknown as { __SINDECON_DRAGGING_ID__?: string | null }).__SINDECON_DRAGGING_ID__ = null
                        }
                        if (sourceId && sourceId !== sub.id && canMove(nodes, sourceId, sub.id)) {
                          void onMoveNodeDirect?.(sourceId, sub.id)
                        }
                      }}
                    >
                      <div className="subfolder-tab-header">
                        <div className="subfolder-folder-icon">📁</div>
                        <span className="subfolder-count-badge">
                          {count} elemento{count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <h3 className="subfolder-card-title">{sub.title}</h3>
                      <div className="subfolder-card-footer">
                        <span className="subfolder-open-label">Explorar carpeta ➔</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Sección de Artículos Médicos */}
          {articles.length > 0 && (
            <section className="folder-explorer-section">
              <div className="section-header-line">
                <span className="section-icon">📄</span>
                <h2 className="section-title">Artículos y Fichas Médicas ({articles.length})</h2>
              </div>

              <div className="articles-grid">
                {articles.map((art) => {
                  const isFav = favoriteIds.includes(art.id)
                  return (
                    <div
                      key={art.id}
                      className="article-card-item"
                      onClick={() => onSelectNode(art.id)}
                      role="button"
                      tabIndex={0}
                      draggable={true}
                      onDragStart={(e) => {
                        if (typeof window !== 'undefined') {
                          ;(window as unknown as { __SINDECON_DRAGGING_ID__?: string }).__SINDECON_DRAGGING_ID__ = art.id
                        }
                        if (e.dataTransfer) {
                          e.dataTransfer.setData('text/plain', art.id)
                          e.dataTransfer.setData('application/sindecon-node-id', art.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectNode(art.id)
                        }
                      }}
                    >
                      <div className="article-card-top-row">
                        <div className="article-card-type-tag">
                          <span className="article-sheet-icon">📄</span>
                          <span>Ficha Médica</span>
                        </div>

                        <div className="article-card-actions">
                          {onRenameNode && (
                            <button
                              type="button"
                              className="btn-card-rename"
                              onClick={(e) => {
                                e.stopPropagation()
                                onRenameNode(art.id)
                              }}
                              title="Renombrar artículo"
                              aria-label="Renombrar artículo"
                            >
                              ✏️
                            </button>
                          )}
                          {onToggleFavorite && (
                            <button
                              type="button"
                              className={`btn-card-fav ${isFav ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleFavorite(art.id)
                              }}
                              title={isFav ? 'Quitar de favoritos' : 'Anclar a favoritos'}
                              aria-label="Favorito"
                            >
                              {isFav ? '⭐' : '☆'}
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="article-card-item-title">{art.title}</h3>

                      <div className="article-card-item-footer">
                        <span className="btn-read-link">Abrir artículo ➔</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
