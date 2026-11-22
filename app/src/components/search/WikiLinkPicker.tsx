import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link2, Search, FileText } from 'lucide-react'
import { db } from '../../db/db'
import { BaseModal } from '../common/DialogModal'

interface WikiLinkPickerProps {
  onPick: (insertText: string) => void
  className?: string
}

export function WikiLinkPicker({ onPick, className }: WikiLinkPickerProps) {
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
    onPick(`[[${articleId}|${title}]]`)
    setOpen(false)
    setFilter('')
  }

  return (
    <span className={className ? 'flex w-full' : 'inline-flex'}>
      <button
        type="button"
        title="Insertar enlace cruzado a otro artículo ([[wiki-link]])"
        onClick={() => setOpen(true)}
        className={
          className ||
          'inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-3 text-xs font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:bg-[var(--ch-accent-soft)] hover:text-[var(--ch-accent)]'
        }
      >
        <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
        <span>Enlace [[Wiki]]</span>
      </button>

      <BaseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Insertar referencia cruzada"
        subtitle="Selecciona un protocolo clínico para enlazar con [[Wiki-link]]."
        icon={<Link2 className="h-5 w-5" />}
        maxWidthClass="max-w-md"
        bodyClassName="space-y-3 px-5 py-4 sm:px-6"
      >
        <div className="flex items-center gap-2 rounded-full border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-3.5 py-2 focus-within:border-[var(--ch-accent)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Buscar artículo médico para enlazar…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)]"
          />
        </div>

        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <li className="py-6 text-center text-xs text-[var(--ch-text-muted)]">
              Sin artículos que coincidan
            </li>
          ) : (
            filtered.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => pick(n.id, n.title)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-accent-soft)] hover:text-[var(--ch-accent)]"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                  <span className="truncate">{n.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </BaseModal>
    </span>
  )
}
