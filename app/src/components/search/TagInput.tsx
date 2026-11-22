import { useMemo, useState } from 'react'
import { Tag, Plus, X } from 'lucide-react'
import { db } from '../../db/db'
import { useAllTags } from '../../hooks/useSearch'

interface TagInputProps {
  articleId: string
  tags: string[]
}

export function TagInput({ articleId, tags }: TagInputProps) {
  const allTags = useAllTags()
  const [input, setInput] = useState('')

  const suggestions = useMemo(
    () =>
      input.trim()
        ? allTags.filter(
            (t) =>
              t.toLowerCase().includes(input.toLowerCase()) &&
              !tags.includes(t),
          )
        : [],
    [input, allTags, tags],
  )

  async function persistTags(next: string[]) {
    const existing = await db.articles.get(articleId)
    await db.articles.put({
      node_id: articleId,
      body_md: existing?.body_md ?? '',
      tags: next,
    })
  }

  async function addTag(t: string) {
    const clean = t.replace(/^#+/, '').trim()
    if (!clean || tags.includes(clean)) return
    await persistTags([...tags, clean])
    setInput('')
  }

  async function removeTag(t: string) {
    await persistTags(tags.filter((x) => x !== t))
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
        <Tag className="h-3 w-3 text-[var(--ch-accent)]" />
        <span>Etiquetas:</span>
      </span>

      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--ch-text-primary)]"
        >
          <span className="text-[var(--ch-accent)]">#</span>
          <span>{t}</span>
          <button
            type="button"
            aria-label={`Quitar tag ${t}`}
            onClick={() => void removeTag(t)}
            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[var(--ch-text-muted)] transition hover:bg-red-500/15 hover:text-red-600"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <div className="relative inline-flex items-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--ch-border-subtle)] bg-[var(--ch-bg-primary)] px-2.5 py-0.5 transition focus-within:border-solid focus-within:border-[var(--ch-accent)]">
          <Plus className="h-3 w-3 text-[var(--ch-accent)]" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addTag(input)
              } else if (
                e.key === 'Backspace' &&
                !input &&
                tags.length > 0
              ) {
                e.preventDefault()
                void removeTag(tags[tags.length - 1]!)
              }
            }}
            placeholder={tags.length ? 'Añadir otra…' : 'Añadir etiqueta…'}
            aria-label="Añadir tag"
            className="w-28 bg-transparent font-mono text-xs text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)] focus:w-36"
          />
        </div>

        {suggestions.length > 0 && (
          <ul className="absolute top-full left-0 z-30 mt-1 min-w-[170px] overflow-hidden rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-1 shadow-[var(--ch-shadow-modal)]">
            {suggestions.slice(0, 6).map((s) => (
              <li
                key={s}
                onMouseDown={() => void addTag(s)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--ch-text-primary)] hover:bg-[var(--ch-accent-soft)] hover:text-[var(--ch-accent)]"
              >
                <span>#{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
