import { useMemo, useState } from 'react'
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
    const clean = t.trim()
    if (!clean || tags.includes(clean)) return
    await persistTags([...tags, clean])
    setInput('')
  }

  async function removeTag(t: string) {
    await persistTags(tags.filter((x) => x !== t))
  }

  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span key={t} className="tag chip">
          {t}
          <button
            aria-label={`Quitar tag ${t}`}
            onClick={() => void removeTag(t)}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-entry"
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
        placeholder={tags.length ? 'Añadir otro…' : 'Añadir tag…'}
        aria-label="Añadir tag"
      />
      {suggestions.length > 0 && (
        <ul className="tag-suggestions">
          {suggestions.slice(0, 6).map((s) => (
            <li key={s} onMouseDown={() => void addTag(s)}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}