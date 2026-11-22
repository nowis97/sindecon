import { useState } from 'react'
import { Search, FileText, X } from 'lucide-react'
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
    <div className="relative w-full">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-primary)] px-3 py-1.5 transition focus-within:border-[var(--ch-accent)]">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
        <input
          type="search"
          value={q}
          placeholder="Buscar artículos o síntomas…"
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar"
          className="w-full bg-transparent text-xs text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Limpiar búsqueda"
            className="text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {q.trim() && (
        <ul className="absolute top-full right-0 left-0 z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-1.5 shadow-[var(--ch-shadow-modal)]">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-[var(--ch-text-muted)]">
              Sin coincidencias para «{q}»
            </li>
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
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--ch-accent-soft)]"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-primary)]">
          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
          <span className="truncate">{r.title}</span>
        </span>
        {tags.length > 0 && (
          <span className="pl-5 font-mono text-[10px] text-[var(--ch-text-muted)]">
            {tags.map((t) => `#${t}`).join(' ')}
          </span>
        )}
      </button>
    </li>
  )
}
