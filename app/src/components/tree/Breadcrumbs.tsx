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
    <nav className="breadcrumbs">
      {path.map((node, i) => (
        <span key={node.id}>
          {i > 0 && <span className="crumb-sep">▸</span>}
          <button className="crumb" onClick={() => onSelect(node.id)}>
            {node.title}
          </button>
        </span>
      ))}
    </nav>
  )
}
