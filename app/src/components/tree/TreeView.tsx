import { useEffect, useRef, useState } from 'react'
import type { NodeRow } from '../../db/db'
import { canMove, childrenOf } from '../../domain/tree'

let globalDraggingId: string | null = null

interface TreeViewProps {
  nodes: NodeRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Cuando está activo, un click en carpeta = elegirla como destino de movimiento */
  moveMode: boolean
  onMoveTarget: (folderId: string | null) => void
  onCancelMove?: () => void
  onMoveNodeDirect?: (nodeId: string, targetFolderId: string | null) => Promise<void>
  onRenameNode?: (id: string) => void
  onMoveNode?: (id: string) => void
  onDeleteNode?: (id: string) => void
  onCreateChild?: (parentId: string, kind: 'folder' | 'article') => void
  favoriteIds?: string[]
  onToggleFavorite?: (id: string) => void
}

export function TreeView({
  nodes,
  selectedId,
  onSelect,
  moveMode,
  onMoveTarget,
  onCancelMove,
  onMoveNodeDirect,
  onRenameNode,
  onMoveNode,
  onDeleteNode,
  onCreateChild,
  favoriteIds = [],
  onToggleFavorite,
}: TreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down')

  // Drag and Drop State
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.tree-row-actions, .tree-context-menu, .btn-tree-row-menu')) {
        return
      }
      setActiveMenuId(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null)
        if (moveMode) {
          onCancelMove?.()
        }
      }
    }

    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleKeyDown)
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current)
      }
    }
  }, [moveMode, onCancelMove])

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Obtener nodos favoritos válidos
  const favoriteNodes = favoriteIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is NodeRow => Boolean(n))

  const renderLevel = (parentId: string | null, depth: number) =>
    childrenOf(nodes, parentId).map((node) => {
      const isFolder = node.kind === 'folder'
      const isCollapsed = collapsed.has(node.id)
      const hasChildren = childrenOf(nodes, node.id).length > 0
      const isMenuOpen = activeMenuId === node.id
      const isFav = favoriteIds.includes(node.id)
      const isBeingDragged = draggedId === node.id
      const isDragTarget = dragOverId === node.id

      return (
        <div key={node.id} className={`tree-node-wrapper ${isMenuOpen ? 'has-open-menu' : ''}`}>
          <div
            className={[
              'tree-row',
              node.id === selectedId ? 'selected' : '',
              moveMode && isFolder ? 'move-target' : '',
              isBeingDragged ? 'dragging' : '',
              isDragTarget ? 'drag-over' : '',
              isMenuOpen ? 'has-open-menu' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ paddingLeft: 8 + depth * 16 }}
            draggable={!moveMode}
            onDragStart={(e) => {
              if (moveMode) return
              globalDraggingId = node.id
              e.dataTransfer.setData('text/plain', node.id)
              e.dataTransfer.setData('application/sindecon-node-id', node.id)
              e.dataTransfer.effectAllowed = 'move'
              setDraggedId(node.id)
            }}
            onDragEnd={() => {
              globalDraggingId = null
              setDraggedId(null)
              setDragOverId(null)
              if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current)
                hoverExpandTimerRef.current = null
              }
            }}
            onDragOver={(e) => {
              const currentDragged = globalDraggingId || draggedId
              if (!currentDragged || currentDragged === node.id) return
              const targetFolder = isFolder ? node.id : node.parent_id
              if (!canMove(nodes, currentDragged, targetFolder)) return

              e.preventDefault()
              e.stopPropagation()
              e.dataTransfer.dropEffect = 'move'

              if (dragOverId !== node.id) {
                setDragOverId(node.id)
                if (isFolder && isCollapsed) {
                  if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current)
                  hoverExpandTimerRef.current = setTimeout(() => {
                    setCollapsed((prev) => {
                      const next = new Set(prev)
                      next.delete(node.id)
                      return next
                    })
                  }, 500)
                }
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation()
              if (e.currentTarget.contains(e.relatedTarget as Node)) {
                return
              }
              if (dragOverId === node.id) {
                setDragOverId(null)
                if (hoverExpandTimerRef.current) {
                  clearTimeout(hoverExpandTimerRef.current)
                  hoverExpandTimerRef.current = null
                }
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOverId(null)
              if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current)
                hoverExpandTimerRef.current = null
              }
              const sourceId =
                e.dataTransfer.getData('application/sindecon-node-id') ||
                e.dataTransfer.getData('text/plain') ||
                globalDraggingId ||
                draggedId
              globalDraggingId = null
              setDraggedId(null)
              const targetFolder = isFolder ? node.id : node.parent_id
              if (sourceId && sourceId !== targetFolder && canMove(nodes, sourceId, targetFolder)) {
                void onMoveNodeDirect?.(sourceId, targetFolder)
              }
            }}
            onClick={() => {
              if (moveMode) {
                if (isFolder) onMoveTarget(node.id)
                return
              }
              onSelect(node.id)
            }}
          >
            {isFolder && (
              <button
                type="button"
                className={`tree-caret ${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(node.id)
                }}
                aria-label={isCollapsed ? 'Desplegar carpeta' : 'Colapsar carpeta'}
              >
                {hasChildren ? '▾' : '·'}
              </button>
            )}
            <span className="tree-icon">{isFolder ? '📁' : '📄'}</span>
            <span className="tree-title">{node.title}</span>

            {/* Menú de acciones contextuales por fila */}
            {!moveMode && (
              <div
                className="tree-row-actions"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className={`btn-tree-row-menu ${isMenuOpen ? 'active' : ''}`}
                  title="Opciones"
                  aria-label={`Opciones para ${node.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isMenuOpen) {
                      setActiveMenuId(null)
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const spaceBelow = window.innerHeight - rect.bottom
                      const openUp = spaceBelow < 260 && rect.top > 220
                      setMenuPlacement(openUp ? 'up' : 'down')
                      setActiveMenuId(node.id)
                    }
                  }}
                >
                  ···
                </button>

                {isMenuOpen && (
                  <div
                    className={`tree-context-menu placement-${menuPlacement}`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {node.kind === 'article' && onToggleFavorite && (
                      <button
                        type="button"
                        className="context-menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveMenuId(null)
                          onToggleFavorite(node.id)
                        }}
                      >
                        {isFav ? '☆ Quitar de Favoritos' : '⭐ Anclar a Favoritos'}
                      </button>
                    )}

                    {isFolder && (
                      <>
                        <button
                          type="button"
                          className="context-menu-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuId(null)
                            onCreateChild?.(node.id, 'article')
                          }}
                        >
                          ➕ Nuevo artículo aquí
                        </button>
                        <button
                          type="button"
                          className="context-menu-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuId(null)
                            onCreateChild?.(node.id, 'folder')
                          }}
                        >
                          📁 Nueva subcarpeta
                        </button>
                        <hr className="context-menu-divider" />
                      </>
                    )}

                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(null)
                        onRenameNode?.(node.id)
                      }}
                    >
                      ✏️ Renombrar
                    </button>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(null)
                        onMoveNode?.(node.id)
                      }}
                    >
                      📦 Mover
                    </button>
                    <hr className="context-menu-divider" />
                    <button
                      type="button"
                      className="context-menu-item item-danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(null)
                        onDeleteNode?.(node.id)
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {isFolder && (
            <div className={`tree-children-accordion ${isCollapsed ? 'collapsed' : 'expanded'}`}>
              <div
                className="tree-children-inner"
                onDragOver={(e) => {
                  if (!draggedId || draggedId === node.id) return
                  if (!canMove(nodes, draggedId, node.id)) return
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverId !== node.id) {
                    setDragOverId(node.id)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOverId(null)
                  const sourceId = e.dataTransfer.getData('text/plain') || draggedId
                  setDraggedId(null)
                  if (sourceId && sourceId !== node.id && canMove(nodes, sourceId, node.id)) {
                    void onMoveNodeDirect?.(sourceId, node.id)
                  }
                }}
              >
                {renderLevel(node.id, depth + 1)}
              </div>
            </div>
          )}
        </div>
      )
    })

  return (
    <div
      className="tree tree-view"
      onDragOver={(e) => {
        if (!draggedId) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOverId(null)
        const sourceId = e.dataTransfer.getData('text/plain') || draggedId
        setDraggedId(null)
        if (sourceId && canMove(nodes, sourceId, null)) {
          void onMoveNodeDirect?.(sourceId, null)
        }
      }}
    >
      {moveMode && (
        <div className="move-banner">
          <span className="move-banner-title">📦 Selecciona la carpeta destino…</span>
          <div className="move-banner-actions">
            <button
              type="button"
              className="btn-move-root"
              onClick={() => onMoveTarget(null)}
            >
              Mover a raíz
            </button>
            <button
              type="button"
              className="btn-move-cancel"
              onClick={() => onCancelMove?.()}
            >
              ✕ Cancelar (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Zona superior para soltar y mover a la raíz */}
      {draggedId && canMove(nodes, draggedId, null) && (
        <div
          className={`tree-root-dropzone tree-root-dropzone-top ${
            dragOverId === '__root__' ? 'drag-over' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'move'
            setDragOverId('__root__')
          }}
          onDragLeave={() => {
            if (dragOverId === '__root__') setDragOverId(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOverId(null)
            const sourceId =
              e.dataTransfer.getData('application/sindecon-node-id') ||
              e.dataTransfer.getData('text/plain') ||
              globalDraggingId ||
              draggedId
            globalDraggingId = null
            setDraggedId(null)
            if (sourceId && canMove(nodes, sourceId, null)) {
              void onMoveNodeDirect?.(sourceId, null)
            }
          }}
        >
          📂 Soltar aquí para mover a la raíz (Temas)
        </div>
      )}

      {/* Sección Permanente de Favoritos / Protocolos Clave */}
      {!moveMode && favoriteNodes.length > 0 && (
        <div className="tree-favorites-section">
          <div
            className="favorites-header"
            onClick={() => setFavoritesCollapsed(!favoritesCollapsed)}
          >
            <span className="favorites-header-title">⭐ Favoritos / Clave</span>
            <span className="favorites-header-count">{favoriteNodes.length}</span>
            <span className={`favorites-caret ${favoritesCollapsed ? 'collapsed' : 'expanded'}`}>
              ▾
            </span>
          </div>

          <div className={`tree-favorites-accordion ${favoritesCollapsed ? 'collapsed' : 'expanded'}`}>
            <div className="tree-favorites-inner">
              <div className="favorites-list">
                {favoriteNodes.map((fav) => (
                  <div
                    key={`fav-${fav.id}`}
                    className={`tree-row favorite-row ${
                      fav.id === selectedId ? 'selected' : ''
                    } ${draggedId === fav.id ? 'dragging' : ''}`}
                    style={{ paddingLeft: 12 }}
                    draggable={!moveMode}
                    onDragStart={(e) => {
                      if (moveMode) return
                      globalDraggingId = fav.id
                      e.dataTransfer.setData('text/plain', fav.id)
                      e.dataTransfer.setData('application/sindecon-node-id', fav.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggedId(fav.id)
                    }}
                    onDragEnd={() => {
                      globalDraggingId = null
                      setDraggedId(null)
                      setDragOverId(null)
                    }}
                    onClick={() => onSelect(fav.id)}
                  >
                    <span className="tree-icon">⭐</span>
                    <span className="tree-title">{fav.title}</span>
                    {onToggleFavorite && (
                      <button
                        type="button"
                        className="btn-remove-fav"
                        title="Quitar de favoritos"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(fav.id)
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {renderLevel(null, 0)}

      {/* Zona inferior para soltar y mover a la raíz */}
      {draggedId && canMove(nodes, draggedId, null) && (
        <div
          className={`tree-root-dropzone ${dragOverId === '__root__' ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'move'
            setDragOverId('__root__')
          }}
          onDragLeave={() => {
            if (dragOverId === '__root__') setDragOverId(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOverId(null)
            const sourceId =
              e.dataTransfer.getData('application/sindecon-node-id') ||
              e.dataTransfer.getData('text/plain') ||
              globalDraggingId ||
              draggedId
            globalDraggingId = null
            setDraggedId(null)
            if (sourceId && canMove(nodes, sourceId, null)) {
              void onMoveNodeDirect?.(sourceId, null)
            }
          }}
        >
          📂 Soltar aquí para mover a la raíz (Temas)
        </div>
      )}
    </div>
  )
}
