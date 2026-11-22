import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Search,
  Camera,
  Sparkles,
  FilePlus,
  FolderPlus,
  SunMoon,
  Inbox,
  Home,
  Star,
  FileText,
  Folder,
  CornerDownLeft,
} from 'lucide-react'
import { db, type NodeRow } from '../../db/db'
import {
  CLINICAL_MARK_META,
  mergeClinicalMarks,
  readAllClinicalMarks,
} from '../../utils/clinicalMarks'

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  nodes: NodeRow[]
  favoriteIds?: string[]
  onSelectArticle: (id: string) => void
  onOpenCreatePrompt: (kind: 'folder' | 'article') => void
  onOpenQuickCapture: () => void
  onOpenSmartImport?: () => void
  onToggleTheme: () => void
  onGoHome: () => void
  onGoInbox: () => void
}

type PaletteItem =
  | {
      id: string
      type: 'action'
      title: string
      icon: React.ReactNode
      shortcut?: string
      run: () => void
    }
  | {
      id: string
      type: 'article'
      title: string
      icon: React.ReactNode
      nodeId: string
      folderName?: string
      run: () => void
    }

export function CommandPalette({
  isOpen,
  onClose,
  nodes,
  favoriteIds = [],
  onSelectArticle,
  onOpenCreatePrompt,
  onOpenQuickCapture,
  onOpenSmartImport,
  onToggleTheme,
  onGoHome,
  onGoInbox,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  const metaClinicalMarks = useLiveQuery(
    () => db.meta.get('clinical_marks'),
    [isOpen],
    undefined,
  )

  const clinicalMarks = useMemo(
    () => mergeClinicalMarks(metaClinicalMarks?.value, readAllClinicalMarks()),
    [metaClinicalMarks],
  )

  const systemActions: PaletteItem[] = useMemo(
    () => [
      {
        id: 'action-quick-capture',
        type: 'action',
        title: 'Captura Rápida (Foto / Nota al Inbox)',
        icon: <Camera className="h-4 w-4 text-[var(--ch-accent)]" />,
        run: () => {
          onClose()
          onOpenQuickCapture()
        },
      },
      {
        id: 'action-smart-import',
        type: 'action',
        title: 'Importar desde ChatGPT, IA o Word (.docx)',
        icon: <Sparkles className="h-4 w-4 text-[var(--ch-accent)]" />,
        run: () => {
          onClose()
          onOpenSmartImport?.()
        },
      },
      {
        id: 'action-new-article',
        type: 'action',
        title: 'Nuevo Artículo Clínico',
        icon: <FilePlus className="h-4 w-4 text-[var(--ch-accent)]" />,
        run: () => {
          onClose()
          onOpenCreatePrompt('article')
        },
      },
      {
        id: 'action-new-folder',
        type: 'action',
        title: 'Nueva Carpeta / Especialidad',
        icon: <FolderPlus className="h-4 w-4 text-[var(--ch-accent)]" />,
        run: () => {
          onClose()
          onOpenCreatePrompt('folder')
        },
      },
      {
        id: 'action-toggle-theme',
        type: 'action',
        title: 'Alternar Modo Guardia Nocturna / Diurno',
        icon: <SunMoon className="h-4 w-4 text-[var(--ch-accent)]" />,
        run: () => {
          onClose()
          onToggleTheme()
        },
      },
      {
        id: 'action-inbox',
        type: 'action',
        title: 'Ir a Bandeja Inbox',
        icon: <Inbox className="h-4 w-4 text-[var(--ch-accent)]" />,
        run: () => {
          onClose()
          onGoInbox()
        },
      },
      {
        id: 'action-home',
        type: 'action',
        title: 'Ir al Inicio / Mi Repositorio',
        icon: <Home className="h-4 w-4 text-[var(--ch-accent)]" />,
        run: () => {
          onClose()
          onGoHome()
        },
      },
    ],
    [
      onClose,
      onOpenCreatePrompt,
      onOpenQuickCapture,
      onOpenSmartImport,
      onToggleTheme,
      onGoHome,
      onGoInbox,
    ],
  )

  const foldersMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of nodes) {
      if (n.kind === 'folder') map.set(n.id, n.title)
    }
    return map
  }, [nodes])

  const filteredItems: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const articles = nodes.filter((n) => n.kind === 'article')

    if (!q) {
      const favItems: PaletteItem[] = favoriteIds
        .map((id) => articles.find((a) => a.id === id))
        .filter((a): a is NodeRow => Boolean(a))
        .map((a) => ({
          id: `art-${a.id}`,
          type: 'article',
          title: a.title,
          icon: <Star className="h-4 w-4 fill-amber-500 text-amber-500" />,
          nodeId: a.id,
          folderName: a.parent_id ? foldersMap.get(a.parent_id) : undefined,
          run: () => {
            onClose()
            onSelectArticle(a.id)
          },
        }))

      return [...systemActions, ...favItems]
    }

    const matchedActions = systemActions.filter((a) =>
      a.title.toLowerCase().includes(q),
    )

    const matchedArticles: PaletteItem[] = articles
      .filter((a) => {
        if (!q) return true
        if (a.title.toLowerCase().includes(q)) return true
        const mark = clinicalMarks[a.id]
        return mark ? CLINICAL_MARK_META[mark].label.toLowerCase().includes(q) : false
      })
      .slice(0, 15)
      .map((a) => ({
        id: `art-${a.id}`,
        type: 'article',
        title: a.title,
        icon: favoriteIds.includes(a.id) ? (
          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
        ) : (
          <FileText className="h-4 w-4 text-[var(--ch-accent)]" />
        ),
        nodeId: a.id,
        folderName: a.parent_id ? foldersMap.get(a.parent_id) : undefined,
        run: () => {
          onClose()
          onSelectArticle(a.id)
        },
      }))

    return [...matchedActions, ...matchedArticles]
  }, [
    query,
    nodes,
    favoriteIds,
    foldersMap,
    systemActions,
    clinicalMarks,
    onClose,
    onSelectArticle,
  ])

  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredItems.length - 1),
  )

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, filteredItems.length - 1) : prev - 1,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filteredItems[safeSelectedIndex]
      if (item) item.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.children[safeSelectedIndex] as HTMLElement
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [safeSelectedIndex])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-16 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div
        className="clinical-home flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] shadow-[var(--ch-shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
          <input
            ref={inputRef}
            type="search"
            className="w-full bg-transparent text-sm font-medium text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)]"
            placeholder="Buscar artículos o escribir un comando… (Esc para salir)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <kbd className="rounded-md border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--ch-text-muted)]">
            Esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-96 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <li className="py-8 text-center text-xs text-[var(--ch-text-muted)]">
              No se encontraron artículos ni comandos para «{query}».
            </li>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === safeSelectedIndex
              return (
                <li
                  key={item.id}
                  onClick={item.run}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition ${
                    isSelected
                      ? 'bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                      : 'text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)]">
                      {item.icon}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold">
                        {item.title}
                      </span>
                      {item.type === 'article' && item.folderName && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--ch-text-muted)]">
                          <Folder className="h-2.5 w-2.5" />
                          <span>{item.folderName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.type === 'article' && clinicalMarks[item.nodeId] && (
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${CLINICAL_MARK_META[clinicalMarks[item.nodeId]].badgeClass}`}
                      >
                        {CLINICAL_MARK_META[clinicalMarks[item.nodeId]].shortLabel}
                      </span>
                    )}
                    {isSelected && (
                      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold text-[var(--ch-accent)]">
                        <CornerDownLeft className="h-3 w-3" />
                        <span>Abrir</span>
                      </span>
                    )}
                  </div>
                </li>
              )
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-4 py-2 font-mono text-[10px] text-[var(--ch-text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-1">
                ↑
              </kbd>{' '}
              <kbd className="rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-1">
                ↓
              </kbd>{' '}
              Navegar
            </span>
            <span>
              <kbd className="rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-1">
                ↵
              </kbd>{' '}
              Ejecutar
            </span>
            <span>
              <kbd className="rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-1">
                Esc
              </kbd>{' '}
              Cerrar
            </span>
          </div>
          <span>SINDECON Clínico</span>
        </div>
      </div>
    </div>
  )
}
