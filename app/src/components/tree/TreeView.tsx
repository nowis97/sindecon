import { useState } from 'react'
import type { NodeRow } from '../../db/db'
import { childrenOf } from '../../domain/tree'

interface TreeViewProps {
  nodes: NodeRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Cuando está activo, un click en carpeta = elegirla como destino de movimiento */
  moveMode: boolean
  onMoveTarget: (folderId: string | null) => void
}

export function TreeView({ nodes, selectedId, onSelect, moveMode, onMoveTarget }: TreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderLevel = (parentId: string | null, depth: number) =>
    childrenOf(nodes, parentId).map((node) => {
      const isFolder = node.kind === 'folder'
      const isCollapsed = collapsed.has(node.id)
      const hasChildren = childrenOf(nodes, node.id).length > 0
      return (
        <div key={node.id}>
          <div
            className={[
              'tree-row',
              node.id === selectedId ? 'selected' : '',
              moveMode && isFolder ? 'move-target' : '',
            ].join(' ')}
            style={{ paddingLeft: 8 + depth * 16 }}
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
                className="tree-caret"
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(node.id)
                }}
              >
                {hasChildren ? (isCollapsed ? '▸' : '▾') : '·'}
              </button>
            )}
            <span className="tree-icon">{isFolder ? '📁' : '📄'}</span>
            <span className="tree-title">{node.title}</span>
          </div>
          {isFolder && !isCollapsed && renderLevel(node.id, depth + 1)}
        </div>
      )
    })

  return (
    <div className="tree">
      {moveMode && (
        <div className="move-banner">
          Elige la carpeta destino…{' '}
          <button onClick={() => onMoveTarget(null)}>Mover a raíz (Tema)</button>
        </div>
      )}
      {renderLevel(null, 0)}
    </div>
  )
}
