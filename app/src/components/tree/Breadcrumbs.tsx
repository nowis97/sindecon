import type { NodeRow } from '../../db/db'
import { pathTo } from '../../domain/tree'

interface BreadcrumbsProps {
  nodes: NodeRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function Breadcrumbs({ nodes, selectedId, onSelect }: BreadcrumbsProps) {
  if (!selectedId) return null
  const path = pathTo(nodes, selectedId)
  if (path.length === 0) return null

  return (
    <nav className="breadcrumbs" aria-label="Ruta de navegación">
      {path.map((node, i) => {
        const isLast = i === path.length - 1
        const isFolder = node.kind === 'folder'
        return (
          <span key={node.id} className="crumb-segment">
            {i > 0 && <span className="crumb-sep">▸</span>}
            <button
              type="button"
              className={`crumb ${isFolder ? 'crumb-folder' : 'crumb-article'} ${
                isLast ? 'crumb-active' : ''
              }`}
              onClick={() => onSelect(node.id)}
              title={`Ir a ${isFolder ? 'carpeta' : 'artículo'} ${node.title}`}
            >
              <span className="crumb-icon">{isFolder ? '📁' : '📄'}</span>
              <span className="crumb-text">{node.title}</span>
            </button>
          </span>
        )
      })}
    </nav>
  )
}
