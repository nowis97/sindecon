import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

interface WikiLinkPickerProps {
  onPick: (insertText: string) => void
}

export function WikiLinkPicker({ onPick }: WikiLinkPickerProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const nodes = useLiveQuery(
    () =>
      db.nodes
        .filter((n) => n.kind === 'article' && n.deleted_at === null)
        .toArray(),
    [],
    [],
  )

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (nodes ?? [])
      .filter((n) => n.title.toLowerCase().includes(f))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [nodes, filter])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const pick = (articleId: string, title: string) => {
    // Formato portable: [[uuid|alias]]; el alias es el título actual (visible)
    onPick(`[[${articleId}|${title}]]`)
    setOpen(false)
    setFilter('')
  }

  return (
    <span className="wiki-link-picker">
      <button
        type="button"
        title="Insertar wiki-link"
        onClick={() => setOpen(true)}
      >
        + [[ link ]]
      </button>
      {open && (
        <div
          className="picker-overlay"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="picker-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <strong>Insertar wiki-link</strong>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <input
              ref={inputRef}
              type="search"
              placeholder="Buscar artículo…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <ul>
              {filtered.length === 0 ? (
                <li className="muted">Sin coincidencias</li>
              ) : (
                filtered.map((n) => (
                  <li key={n.id} onClick={() => pick(n.id, n.title)}>
                    {n.title}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </span>
  )
}