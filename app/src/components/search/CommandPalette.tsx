import { useEffect, useMemo, useRef, useState } from 'react'
import type { NodeRow } from '../../db/db'

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
      icon: string
      shortcut?: string
      run: () => void
    }
  | {
      id: string
      type: 'article'
      title: string
      icon: string
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

  // Lista de acciones del sistema
  const systemActions: PaletteItem[] = useMemo(
    () => [
      {
        id: 'action-quick-capture',
        type: 'action',
        title: 'Captura Rápida (Foto/Nota al Inbox)',
        icon: '⚡',
        run: () => {
          onClose()
          onOpenQuickCapture()
        },
      },
      {
        id: 'action-smart-import',
        type: 'action',
        title: 'Importar desde ChatGPT, IA o Word (.docx)',
        icon: '🪄',
        run: () => {
          onClose()
          onOpenSmartImport?.()
        },
      },
      {
        id: 'action-new-article',
        type: 'action',
        title: 'Nuevo Artículo',
        icon: '📝',
        run: () => {
          onClose()
          onOpenCreatePrompt('article')
        },
      },
      {
        id: 'action-new-folder',
        type: 'action',
        title: 'Nueva Carpeta / Especialidad',
        icon: '📁',
        run: () => {
          onClose()
          onOpenCreatePrompt('folder')
        },
      },
      {
        id: 'action-toggle-theme',
        type: 'action',
        title: 'Alternar Modo Oscuro / Claro',
        icon: '🌓',
        run: () => {
          onClose()
          onToggleTheme()
        },
      },
      {
        id: 'action-inbox',
        type: 'action',
        title: 'Ir a Bandeja Inbox',
        icon: '📥',
        run: () => {
          onClose()
          onGoInbox()
        },
      },
      {
        id: 'action-home',
        type: 'action',
        title: 'Ir al Inicio / Dashboard',
        icon: '🏠',
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

  // Mapa de carpetas por ID
  const foldersMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of nodes) {
      if (n.kind === 'folder') map.set(n.id, n.title)
    }
    return map
  }, [nodes])

  // Filtrado de items
  const filteredItems: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const articles = nodes.filter((n) => n.kind === 'article')

    if (!q) {
      // Sin query: mostrar acciones principales + favoritos
      const favItems: PaletteItem[] = favoriteIds
        .map((id) => articles.find((a) => a.id === id))
        .filter((a): a is NodeRow => Boolean(a))
        .map((a) => ({
          id: `art-${a.id}`,
          type: 'article',
          title: a.title,
          icon: '⭐',
          nodeId: a.id,
          folderName: a.parent_id ? foldersMap.get(a.parent_id) : undefined,
          run: () => {
            onClose()
            onSelectArticle(a.id)
          },
        }))

      return [...systemActions, ...favItems]
    }

    // Con query: buscar en acciones y artículos
    const matchedActions = systemActions.filter((a) =>
      a.title.toLowerCase().includes(q),
    )

    const matchedArticles: PaletteItem[] = articles
      .filter((a) => a.title.toLowerCase().includes(q))
      .slice(0, 15)
      .map((a) => ({
        id: `art-${a.id}`,
        type: 'article',
        title: a.title,
        icon: favoriteIds.includes(a.id) ? '⭐' : '📄',
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
    onClose,
    onSelectArticle,
  ])

  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredItems.length - 1),
  )

  // Autofocus al abrir
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Navegación por teclado
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

  // Scroll interactivo para mantener el item visible
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
      className="command-palette-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-search-row">
          <span className="palette-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="search"
            className="palette-input"
            placeholder="Buscar artículos o escribir un comando… (Esc para salir)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        <ul ref={listRef} className="palette-list">
          {filteredItems.length === 0 ? (
            <li className="palette-empty">
              No se encontraron artículos ni comandos para "{query}".
            </li>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === safeSelectedIndex
              return (
                <li
                  key={item.id}
                  className={`palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={item.run}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="palette-item-icon">{item.icon}</span>
                  <div className="palette-item-text">
                    <span className="palette-item-title">{item.title}</span>
                    {item.type === 'article' && item.folderName && (
                      <span className="palette-item-badge">
                        📁 {item.folderName}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="palette-item-enter">↵ Seleccionar</span>
                  )}
                </li>
              )
            })
          )}
        </ul>

        <div className="palette-footer">
          <div className="palette-shortcuts-hint">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Navegar</span>
            <span><kbd>↵</kbd> Ejecutar</span>
            <span><kbd>Esc</kbd> Cerrar</span>
          </div>
        </div>
      </div>
    </div>
  )
}
