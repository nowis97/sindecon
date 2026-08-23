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

  const articleTagText = (id: string): string => {
    const a = articles.find((x) => x.id === id)
    if (!a) return ''
    return a.tags
  }

  const tagList = (id: string): string[] =>
    articleTagText(id)
      .split(' ')
      .filter(Boolean)

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
            results.map((r) => (
              <SearchResultRow
                key={r.id}
                r={r}
                tags={tagList(r.id)}
                onPick={() => {
                  onSelect(r.id)
                  setQ('')
                }}
              />
            ))
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