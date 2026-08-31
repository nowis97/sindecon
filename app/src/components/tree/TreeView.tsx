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
  const [dragOverState, setDragOverState] = useState<{
    nodeId: string
    position: 'above' | 'inside' | 'below'
  } | null>(null)
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mobile Touch Drag State
  const [touchDragState, setTouchDragState] = useState<{
    nodeId: string
    nodeTitle: string
    isFolder: boolean
    currentX: number
    currentY: number
    targetFolderId: string | null
    isDragging: boolean
  } | null>(null)
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)

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
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current)
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
      const directChildren = isFolder ? childrenOf(nodes, node.id) : []
      const hasChildren = directChildren.length > 0
      const childCount = directChildren.length
      const isMenuOpen = activeMenuId === node.id
      const isFav = favoriteIds.includes(node.id)
      const isBeingDragged = draggedId === node.id
      const isDragTarget = dragOverId === node.id
      const dragPosition = dragOverState?.nodeId === node.id ? dragOverState.position : null

      return (
        <div key={node.id} className={`tree-node-wrapper ${isMenuOpen ? 'has-open-menu' : ''}`}>
          <div
            className={[
              'tree-row',
              isFolder ? 'tree-folder-row' : 'tree-article-row',
              node.id === selectedId ? 'selected' : '',
              moveMode && isFolder ? 'move-target' : '',
              isBeingDragged ? 'dragging' : '',
              isDragTarget && dragPosition ? `drag-over-${dragPosition}` : isDragTarget ? 'drag-over' : '',
              isMenuOpen ? 'has-open-menu' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-node-id={node.id}
            data-kind={node.kind}
            style={{ paddingLeft: 8 + depth * 16 }}
            draggable={!moveMode && node.system !== 'templates'}
            onTouchStart={(e) => {
              if (moveMode || node.system === 'templates') return
              const touch = e.touches[0]
              touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
              if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
              touchTimerRef.current = setTimeout(() => {
                try {
                  navigator.vibrate?.(30)
                } catch {
                  /* no-op */
                }
                globalDraggingId = node.id
                setDraggedId(node.id)
                setTouchDragState({
                  nodeId: node.id,
                  nodeTitle: node.title,
                  isFolder,
                  currentX: touch.clientX,
                  currentY: touch.clientY,
                  targetFolderId: null,
                  isDragging: true,
                })
              }, 220)
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0]
              if (touchStartPosRef.current && !touchDragState?.isDragging) {
                const dx = Math.abs(touch.clientX - touchStartPosRef.current.x)
                const dy = Math.abs(touch.clientY - touchStartPosRef.current.y)
                if (dx > 10 || dy > 10) {
                  if (touchTimerRef.current) {
                    clearTimeout(touchTimerRef.current)
                    touchTimerRef.current = null
                  }
                }
              }
              if (touchDragState?.isDragging) {
                e.preventDefault()
                setTouchDragState((prev) =>
                  prev ? { ...prev, currentX: touch.clientX, currentY: touch.clientY } : null
                )
                const el = document.elementFromPoint(touch.clientX, touch.clientY)
                const targetRow = el?.closest?.('.tree-row[data-node-id], .tree-root-dropzone')
                if (targetRow) {
                  if (targetRow.classList.contains('tree-root-dropzone')) {
                    setDragOverId('__root__')
                    setTouchDragState((prev) => (prev ? { ...prev, targetFolderId: null } : null))
                  } else {
                    const targetId = targetRow.getAttribute('data-node-id')
                    if (targetId && targetId !== touchDragState.nodeId) {
                      const targetNode = nodes.find((n) => n.id === targetId)
                      if (targetNode) {
                        const targetFolder =
                          targetNode.kind === 'folder' ? targetNode.id : targetNode.parent_id
                        if (canMove(nodes, touchDragState.nodeId, targetFolder)) {
                          setDragOverId(targetId)
                          setTouchDragState((prev) =>
                            prev ? { ...prev, targetFolderId: targetFolder } : null
                          )
                          if (targetNode.kind === 'folder' && collapsed.has(targetNode.id)) {
                            if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current)
                            hoverExpandTimerRef.current = setTimeout(() => {
                              setCollapsed((prev) => {
                                const next = new Set(prev)
                                next.delete(targetNode.id)
                                return next
                              })
                            }, 400)
                          }
                        }
                      }
                    }
                  }
                } else {
                  setDragOverId(null)
                }
              }
            }}
            onTouchEnd={() => {
              if (touchTimerRef.current) {
                clearTimeout(touchTimerRef.current)
                touchTimerRef.current = null
              }
              if (touchDragState?.isDragging) {
                const sourceId = touchDragState.nodeId
                const targetFolder =
                  touchDragState.targetFolderId !== undefined
                    ? touchDragState.targetFolderId
                    : dragOverId === '__root__'
                    ? null
                    : dragOverId
                    ? nodes.find((n) => n.id === dragOverId)?.kind === 'folder'
                      ? dragOverId
                      : nodes.find((n) => n.id === dragOverId)?.parent_id ?? null
                    : undefined
                if (targetFolder !== undefined && canMove(nodes, sourceId, targetFolder)) {
                  if (targetFolder) {
                    setCollapsed((prev) => {
                      const next = new Set(prev)
                      next.delete(targetFolder)
                      return next
                    })
                  }
                  void onMoveNodeDirect?.(sourceId, targetFolder)
                  try {
                    navigator.vibrate?.([30, 40, 30])
                  } catch {
                    /* no-op */
                  }
                }
                setTouchDragState(null)
                setDraggedId(null)
                setDragOverId(null)
                globalDraggingId = null
              }
            }}
            onTouchCancel={() => {
              if (touchTimerRef.current) {
                clearTimeout(touchTimerRef.current)
                touchTimerRef.current = null
              }
              setTouchDragState(null)
              setDraggedId(null)
              setDragOverId(null)
              globalDraggingId = null
            }}
            onDragStart={(e) => {
              if (moveMode || node.system === 'templates') return
              globalDraggingId = node.id
              if (typeof window !== 'undefined') {
                ;(window as unknown as { __SINDECON_DRAGGING_ID__?: string }).__SINDECON_DRAGGING_ID__ = node.id
              }
              if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', node.id)
                e.dataTransfer.setData('application/sindecon-node-id', node.id)
                e.dataTransfer.effectAllowed = 'move'
              }
              setDraggedId(node.id)
            }}
            onDragEnd={() => {
              setTimeout(() => {
                globalDraggingId = null
                if (typeof window !== 'undefined') {
                  ;(window as unknown as { __SINDECON_DRAGGING_ID__?: string | null }).__SINDECON_DRAGGING_ID__ = null
                }
              }, 200)
              setDraggedId(null)
              setDragOverId(null)
              setDragOverState(null)
              if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current)
                hoverExpandTimerRef.current = null
              }
            }}
            onDragOver={(e) => {
              const currentDragged =
                globalDraggingId ||
                draggedId ||
                (typeof window !== 'undefined' ? (window as unknown as { __SINDECON_DRAGGING_ID__?: string }).__SINDECON_DRAGGING_ID__ : null) ||
                (e.dataTransfer?.types?.includes('application/sindecon-node-id') ? 'pending' : null) ||
                (e.dataTransfer?.types?.includes('text/plain') ? 'pending' : null)
              if (!currentDragged || currentDragged === node.id) return

              let position: 'above' | 'inside' | 'below' = 'inside'
              let targetFolder: string | null = null

              if (isFolder) {
                position = 'inside'
                targetFolder = node.id
              } else {
                const rect = e.currentTarget.getBoundingClientRect()
                const relY = (e.clientY - rect.top) / (rect.height || 1)
                position = relY < 0.5 ? 'above' : 'below'
                targetFolder = node.parent_id
              }

              if (currentDragged !== 'pending') {
                const ok = canMove(nodes, currentDragged, targetFolder)
                if (!ok) return
              }

              e.preventDefault()
              e.stopPropagation()
              if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move'
              }

              if (
                !dragOverState ||
                dragOverState.nodeId !== node.id ||
                dragOverState.position !== position
              ) {
                setDragOverState({ nodeId: node.id, position })
                setDragOverId(node.id)

                if (isFolder && isCollapsed && position === 'inside') {
                  if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current)
                  hoverExpandTimerRef.current = setTimeout(() => {
                    setCollapsed((prev) => {
                      const next = new Set(prev)
                      next.delete(node.id)
                      return next
                    })
                  }, 350)
                }
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation()
              if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
                return
              }
              if (dragOverState?.nodeId === node.id) {
                setDragOverState(null)
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
              setDragOverState(null)
              setDragOverId(null)
              if (hoverExpandTimerRef.current) {
                clearTimeout(hoverExpandTimerRef.current)
                hoverExpandTimerRef.current = null
              }
              const sourceId =
                (e.dataTransfer ? e.dataTransfer.getData('application/sindecon-node-id') || e.dataTransfer.getData('text/plain') : null) ||
                globalDraggingId ||
                draggedId ||
                (typeof window !== 'undefined' ? (window as unknown as { __SINDECON_DRAGGING_ID__?: string }).__SINDECON_DRAGGING_ID__ : null)
              globalDraggingId = null
              if (typeof window !== 'undefined') {
                ;(window as unknown as { __SINDECON_DRAGGING_ID__?: string | null }).__SINDECON_DRAGGING_ID__ = null
              }
              setDraggedId(null)

              if (!sourceId || sourceId === node.id) return

              const targetFolder = isFolder ? node.id : node.parent_id

              if (canMove(nodes, sourceId, targetFolder)) {
                if (targetFolder) {
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    next.delete(targetFolder)
                    return next
                  })
                }
                void onMoveNodeDirect?.(sourceId, targetFolder)
              }
            }}
            onClick={() => {
              if (moveMode) {
                if (isFolder && node.system !== 'templates') onMoveTarget(node.id)
                return
              }
              onSelect(node.id)
            }}
          >
            {isFolder && (
              <button
                type="button"
                className={`tree-caret tree-folder-chevron ${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(node.id)
                }}
                aria-label={isCollapsed ? 'Desplegar carpeta' : 'Colapsar carpeta'}
              >
                {hasChildren ? '▾' : '·'}
              </button>
            )}
            <span className={`tree-icon ${isFolder ? 'tree-icon-folder' : 'tree-icon-article'}`}>
              {isFolder ? (isCollapsed ? '📁' : '📂') : '📄'}
            </span>
            <span className="tree-title">{node.title}</span>

            {isFolder && childCount > 0 && (
              <span className="tree-folder-badge" title={`${childCount} elemento${childCount === 1 ? '' : 's'}`}>
                {childCount}
              </span>
            )}

            {!isFolder && isFav && (
              <span className="tree-article-fav-indicator" title="Artículo favorito">
                ⭐
              </span>
            )}

            {/* Menú de acciones contextuales por fila */}
            {!moveMode && !(node.system === 'templates' && isFolder) && (
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

                    {isFolder && node.system !== 'templates' && (
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

                    {node.system !== 'templates' && (
                      <>
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
                        {node.system !== 'inbox' && (
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
                        )}
                        {node.system !== 'inbox' && (
                          <>
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
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {isFolder && (
            <div className={`tree-children-accordion ${isCollapsed ? 'collapsed' : 'expanded'}`}>
              <div className="tree-children-inner">
                {renderLevel(node.id, depth + 1)}
              </div>
            </div>
          )}
        </div>
      )
    })

  return (
    <div
      className={`tree tree-view ${draggedId ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        const current = globalDraggingId || draggedId
        if (!current || !canMove(nodes, current, null)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
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
            if (dragOverId !== '__root__') setDragOverId('__root__')
          }}
          onDragLeave={(e) => {
            e.stopPropagation()
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
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
          📂 Soltar aquí para mover a la raíz (Nivel principal)
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
            if (dragOverId !== '__root__') setDragOverId('__root__')
          }}
          onDragLeave={(e) => {
            e.stopPropagation()
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
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
          📂 Soltar aquí para mover a la raíz (Nivel principal)
        </div>
      )}

      {/* Avatar flotante que sigue el dedo en Mobile Touch Drag */}
      {touchDragState?.isDragging && (
        <div
          className="touch-drag-avatar"
          style={{
            position: 'fixed',
            left: touchDragState.currentX + 16,
            top: touchDragState.currentY - 20,
            pointerEvents: 'none',
            zIndex: 99999,
          }}
        >
          <span className="avatar-icon">{touchDragState.isFolder ? '📁' : '📄'}</span>
          <span className="avatar-title">{touchDragState.nodeTitle}</span>
        </div>
      )}
    </div>
  )
}
