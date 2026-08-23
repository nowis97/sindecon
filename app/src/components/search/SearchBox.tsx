import { useState } from 'react'
import { useSearchResults, useSearchIndex } from '../../hooks/useSearch'
import type { SearchResult } from 'minisearch'

interface SearchBoxProps {
  onSelect: (nodeId: string) => void
}

export function SearchBox({ onSelect }: SearchBoxProps) {
  const [q, setQ] = useState('')
  const results = useSearchResults(q)
  const { articles } = useSearchIndex()

  const tagMap = new Map(articles.map((a) => [a.id, a.tags]))

  return (
    <div className="search-box">
      <input
        type="search"
        value={q}
        placeholder="Buscar artículos o síntomas…"
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar"
      />
      {q.trim() && (
        <ul className="search-results">
          {results.length === 0 ? (
            <li className="muted">Sin coincidencias para «{q}»</li>
          ) : (
            results.map((r) => {
              const tags = (tagMap.get(r.id) ?? '').split(' ').filter(Boolean)
              return (
                <SearchResultRow
                  key={r.id}
                  r={r}
                  tags={tags}
                  onPick={() => {
                    onSelect(r.id)
                    setQ('')
                  }}
                />
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

function SearchResultRow({
  r,
  tags,
  onPick,
}: {
  r: SearchResult
  tags: string[]
  onPick: () => void
}) {
  return (
    <li onClick={onPick}>
      <strong>{r.title}</strong>
      {tags.length > 0 && (
        <span className="muted"> · {tags.join(', ')}</span>
      )}
    </li>
  )
}