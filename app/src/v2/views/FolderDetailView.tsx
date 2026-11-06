import React, { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type NodeRow, type ArticleRow } from '../../db/db'
import { createNode, moveNode, deleteNodeCascade } from '../../db/nodes'
import { saveArticle } from '../../db/articles'
import { NoteContextMenu, type NoteStatusMarker, type NoteContextMenuAction } from '../components/NoteContextMenu'
import { BottomNav } from '../components/BottomNav'
import { CreateItemModal } from '../components/CreateItemModal'
import { VersionSwitcher } from '../components/VersionSwitcher'

export interface FolderDetailViewProps {
  folderId: string
  onBack: () => void
  onOpenEditor: (noteId: string) => void
  onSwitchToV1?: () => void
  initialNodes?: NodeRow[]
  initialArticles?: ArticleRow[]
  className?: string
}

function formatNoteDate(timestamp: number): string {
  if (!timestamp) return ''
  try {
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return ''
    const day = String(d.getDate()).padStart(2, '0')
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  } catch {
    return ''
  }
}

export function FolderDetailView({
  folderId,
  onBack,
  onOpenEditor,
  onSwitchToV1,
  initialNodes,
  initialArticles,
  className = '',
}: FolderDetailViewProps): React.JSX.Element {
  // State for fallbacks in tests / Node
  const [fallbackNodes, setFallbackNodes] = useState<NodeRow[]>(initialNodes ?? [])
  const [fallbackArticles, setFallbackArticles] = useState<ArticleRow[]>(initialArticles ?? [])
  const [noteMarkers, setNoteMarkers] = useState<Record<string, NoteStatusMarker>>({})

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())

  // Context menu state
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>(undefined)

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteTargetNote, setDeleteTargetNote] = useState<NodeRow | null>(null)
  const [moveTargetNote, setMoveTargetNote] = useState<NodeRow | null>(null)
  const [targetDestinationFolderId, setTargetDestinationFolderId] = useState<string>('')
  const [tagEditNote, setTagEditNote] = useState<NodeRow | null>(null)
  const [tagInputValue, setTagInputValue] = useState('')

  // Live queries from IndexedDB
  const liveNodes = useLiveQuery(
    () => db.nodes.filter((n) => n.deleted_at === null).toArray(),
    [],
    initialNodes,
  )

  const liveArticles = useLiveQuery(
    () => db.articles.toArray(),
    [],
    initialArticles,
  )

  // Load live data and markers on mount
  useEffect(() => {
    let isMounted = true
    Promise.all([
      db.nodes.filter((n) => n.deleted_at === null).toArray(),
      db.articles.toArray(),
      db.meta.toArray(),
    ])
      .then(([nodes, articles, metaRows]) => {
        if (!isMounted) return
        if (nodes.length > 0) setFallbackNodes(nodes)
        if (articles.length > 0) setFallbackArticles(articles)

        const markers: Record<string, NoteStatusMarker> = {}
        for (const m of metaRows) {
          if (m.key.startsWith('marker:')) {
            const nId = m.key.replace('marker:', '')
            markers[nId] = m.value as NoteStatusMarker
          }
        }
        setNoteMarkers((prev) => ({ ...markers, ...prev }))
      })
      .catch(() => {
        // Ignore test errors
      })
    return () => {
      isMounted = false
    }
  }, [folderId])

  const allNodes = useMemo(() => {
    if (liveNodes && liveNodes.length > 0) return liveNodes
    if (fallbackNodes && fallbackNodes.length > 0) return fallbackNodes
    return []
  }, [liveNodes, fallbackNodes])

  const allArticles = useMemo(() => {
    if (liveArticles && liveArticles.length > 0) return liveArticles
    if (fallbackArticles && fallbackArticles.length > 0) return fallbackArticles
    return []
  }, [liveArticles, fallbackArticles])

  // Current folder node
  const currentFolder = useMemo(() => {
    return allNodes.find((n) => n.id === folderId && n.kind === 'folder') ?? null
  }, [allNodes, folderId])

  // All other available folders for Move destination
  const availableTargetFolders = useMemo(() => {
    return allNodes.filter(
      (n) => n.kind === 'folder' && n.id !== folderId && n.deleted_at === null,
    )
  }, [allNodes, folderId])

  // Map of article by node_id
  const articleMap = useMemo(() => {
    const map = new Map<string, ArticleRow>()
    for (const art of allArticles) {
      map.set(art.node_id, art)
    }
    return map
  }, [allArticles])

  // Notes inside this folder
  const folderNotes = useMemo(() => {
    return allNodes
      .filter((n) => n.kind === 'article' && n.parent_id === folderId && n.deleted_at === null)
      .sort((a, b) => a.order - b.order || b.created_at - a.created_at)
  }, [allNodes, folderId])

  // Collect active tags and their frequencies in this folder
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const note of folderNotes) {
      const art = articleMap.get(note.id)
      if (art?.tags) {
        for (const t of art.tags) {
          const trimmed = t.trim()
          if (trimmed) {
            counts.set(trimmed, (counts.get(trimmed) || 0) + 1)
          }
        }
      }
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
  }, [folderNotes, articleMap])

  // Filter notes by search query and selected tag
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return folderNotes.filter((note) => {
      const art = articleMap.get(note.id)
      const matchesSearch =
        !q ||
        note.title.toLowerCase().includes(q) ||
        (art?.body_md && art.body_md.toLowerCase().includes(q))

      const matchesTag =
        !selectedTag || (art?.tags && art.tags.includes(selectedTag))

      return matchesSearch && matchesTag
    })
  }, [folderNotes, articleMap, searchQuery, selectedTag])

  // Handle Note Context Menu Actions
  const handleNoteAction = (action: NoteContextMenuAction | string, payload?: any) => {
    if (!activeMenuNoteId) return
    const note = folderNotes.find((n) => n.id === activeMenuNoteId)
    if (!note) return

    switch (action) {
      case 'delete':
        setDeleteTargetNote(note)
        break
      case 'move':
        setMoveTargetNote(note)
        setTargetDestinationFolderId(availableTargetFolders[0]?.id || '')
        break
      case 'export_editor':
        onOpenEditor(note.id)
        break
      case 'print':
        handlePrintNote(note)
        break
      case 'tag': {
        const art = articleMap.get(note.id)
        setTagEditNote(note)
        setTagInputValue(art?.tags ? art.tags.join(', ') : '')
        break
      }
      case 'select':
        setIsSelectionMode(true)
        setSelectedNoteIds((prev) => {
          const next = new Set(prev)
          if (next.has(note.id)) {
            next.delete(note.id)
          } else {
            next.add(note.id)
          }
          return next
        })
        break
      case 'mark': {
        if (payload === undefined) break
        const marker = payload as NoteStatusMarker | 'none'
        if (marker === null || marker === 'none') {
          setNoteMarkers((prev) => {
            const next = { ...prev }
            delete next[note.id]
            return next
          })
          db.meta.delete(`marker:${note.id}`).catch(() => {})
        } else if (marker === 'urgent' || marker === 'pending' || marker === 'completed') {
          setNoteMarkers((prev) => ({ ...prev, [note.id]: marker }))
          db.meta.put({ key: `marker:${note.id}`, value: marker }).catch(() => {})
        }
        break
      }
      default:
        break
    }
  }

  // Handle Print
  const handlePrintNote = (_note: NodeRow) => {
    try {
      const printFn =
        typeof window !== 'undefined' && typeof window.print === 'function'
          ? window.print
          : typeof globalThis !== 'undefined' && typeof (globalThis as any).print === 'function'
            ? (globalThis as any).print
            : null
      if (printFn) {
        printFn()
      }
    } catch {
      // Ignore print errors in test environments
    }
  }

  // Confirm delete note
  const handleConfirmDelete = async () => {
    if (!deleteTargetNote) return
    const id = deleteTargetNote.id
    await deleteNodeCascade(id)
    setFallbackNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, deleted_at: Date.now() } : n)),
    )
    setSelectedNoteIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setDeleteTargetNote(null)
  }

  // Confirm move note
  const handleConfirmMove = async () => {
    if (!moveTargetNote || !targetDestinationFolderId) return
    const id = moveTargetNote.id
    await moveNode(id, targetDestinationFolderId)
    setFallbackNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, parent_id: targetDestinationFolderId } : n,
      ),
    )
    setMoveTargetNote(null)
  }

  // Save updated tags
  const handleSaveTags = async () => {
    if (!tagEditNote) return
    const id = tagEditNote.id
    const tags = tagInputValue
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const art = articleMap.get(id)
    const body = art?.body_md || ''
    await saveArticle(id, body, tags)
    setFallbackArticles((prev) => {
      const existing = prev.find((a) => a.node_id === id)
      if (existing) {
        return prev.map((a) => (a.node_id === id ? { ...a, tags } : a))
      }
      return [...prev, { node_id: id, body_md: body, tags }]
    })
    setTagEditNote(null)
  }

  // Handle note creation inside folder
  const handleCreateNote = async (title: string, templateKey?: string) => {
    const trimmed = title.trim()
    if (!trimmed) return

    const note = await createNode({
      kind: 'article',
      title: trimmed,
      parent_id: folderId,
    })

    let initialBody = ''
    if (templateKey === 'soap') {
      initialBody = '# Evolución Clínica (SOAP)\n\n## Subjetivo (S)\n\n## Objetivo (O)\n\n## Análisis (A)\n\n## Plan (P)\n'
    } else if (templateKey === 'epicrisis') {
      initialBody = '# Epicrisis Médica\n\n## Resumen de Ingreso\n\n## Evolución Hospitalaria\n\n## Diagnósticos de Egreso\n\n## Indicaciones al Alta\n'
    } else if (templateKey === 'urgencias') {
      initialBody = '# Ingreso Urgencias\n\n## Triage y Signos Vitales\n\n## Motivo de Consulta\n\n## Anamnesis\n\n## Examen Físico\n\n## Conducta de Urgencia\n'
    }

    if (initialBody) {
      await saveArticle(note.id, initialBody)
    }

    setFallbackNodes((prev) => [...prev, note])
    setIsCreateModalOpen(false)
  }

  const handleCreateFolder = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const folder = await createNode({
      kind: 'folder',
      title: trimmed,
      parent_id: folderId,
    })
    setFallbackNodes((prev) => [...prev, folder])
    setIsCreateModalOpen(false)
  }

  const activeMenuNote = useMemo(() => {
    if (!activeMenuNoteId) return null
    return folderNotes.find((n) => n.id === activeMenuNoteId) ?? null
  }, [activeMenuNoteId, folderNotes])

  return (
    <div
      className={`sindecon-v2 min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-200/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 flex flex-col pb-24 ${className}`}
    >
      {/* Cabecera superior según Mockup Página 3 */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            {/* Botón de retorno ← Volver a Mi Repositorio */}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors cursor-pointer w-fit"
              aria-label="Volver a Mi Repositorio"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              <span>← Volver a Mi Repositorio</span>
            </button>

            {/* Icono de carpeta, título y contador */}
            <div className="flex items-center gap-3 mt-1">
              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 shadow-xs">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {currentFolder ? currentFolder.title : 'Detalle de Carpeta'}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>{`${folderNotes.length} ${folderNotes.length === 1 ? 'nota' : 'notas'}`}</span>
                  {selectedTag && (
                    <span className="inline-flex items-center gap-1 bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 px-2 py-0.5 rounded-full text-[11px]">
                      Filtro: {selectedTag}
                      <button
                        type="button"
                        onClick={() => setSelectedTag(null)}
                        className="hover:font-bold cursor-pointer ml-0.5"
                        title="Limpiar filtro"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onSwitchToV1 && <VersionSwitcher currentVersion="v2" onToggle={onSwitchToV1} />}
          </div>
        </div>
      </header>

      {/* Main Layout: Notes Table + Right Search & Tags Panel */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Columna Izquierda / Central: Tabla de Notas */}
        <section className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Barra de Selección múltiple activa */}
          {isSelectionMode && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedNoteIds.size > 0 && selectedNoteIds.size === folderNotes.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedNoteIds(new Set(folderNotes.map((n) => n.id)))
                    } else {
                      setSelectedNoteIds(new Set())
                    }
                  }}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  aria-label="Seleccionar todas las notas"
                />
                <span className="font-semibold text-teal-900 dark:text-teal-200">
                  {selectedNoteIds.size} seleccionada(s)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(false)
                  setSelectedNoteIds(new Set())
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Cerrar selección
              </button>
            </div>
          )}

          {/* Tabla de Notas Clínicas */}
          <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  {isSelectionMode && <th className="py-3 px-3 w-8" scope="col"></th>}
                  <th className="py-3 px-4 font-bold" scope="col">
                    Documento
                  </th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap" scope="col">
                    Fecha Creación
                  </th>
                  <th className="py-3 px-4 font-bold" scope="col">
                    Etiqueta
                  </th>
                  <th className="py-3 px-4 font-bold text-right" scope="col">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredNotes.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectionMode ? 5 : 4} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      {folderNotes.length === 0
                        ? 'Esta carpeta está vacía. Crea una nueva nota con el botón +'
                        : 'No se encontraron notas que coincidan con la búsqueda o filtro.'}
                    </td>
                  </tr>
                ) : (
                  filteredNotes.map((note) => {
                    const art = articleMap.get(note.id)
                    const marker = noteMarkers[note.id]
                    const isSelected = selectedNoteIds.has(note.id)

                    return (
                      <tr
                        key={note.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                        }`}
                      >
                        {/* Checkbox de selección */}
                        {isSelectionMode && (
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedNoteIds((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(note.id)) next.delete(note.id)
                                  else next.add(note.id)
                                  return next
                                })
                              }}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                              aria-label={`Seleccionar ${note.title}`}
                            />
                          </td>
                        )}

                        {/* Columna 1: Documento (Icono + Título + Marcador visual) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {/* Marcador visual si existe */}
                            {marker === 'urgent' && (
                              <span
                                title="Urgente / Prioritario"
                                className="text-amber-500 font-bold shrink-0 text-sm"
                              >
                                ▲
                              </span>
                            )}
                            {marker === 'pending' && (
                              <span
                                title="En Proceso / Pendiente"
                                className="text-blue-500 font-bold shrink-0 text-sm"
                              >
                                ●
                              </span>
                            )}
                            {marker === 'completed' && (
                              <span
                                title="Completado / Validado"
                                className="text-teal-600 font-bold shrink-0 text-sm"
                              >
                                ■
                              </span>
                            )}

                            {/* Icono de documento */}
                            <svg
                              className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                              />
                            </svg>

                            {/* Título de la nota clickeable */}
                            <button
                              type="button"
                              onClick={() => onOpenEditor(note.id)}
                              className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 text-left transition-colors cursor-pointer truncate max-w-xs sm:max-w-sm md:max-w-md"
                              title={note.title}
                            >
                              {note.title}
                            </button>
                          </div>
                        </td>

                        {/* Columna 2: Fecha Creación */}
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                          {formatNoteDate(note.created_at)}
                        </td>

                        {/* Columna 3: Etiqueta (Badges visuales) */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {art?.tags && art.tags.length > 0 ? (
                              art.tags.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                                    selectedTag === t
                                      ? 'bg-teal-600 text-white dark:bg-teal-500'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                  }`}
                                  title={`Filtrar por etiqueta: ${t}`}
                                >
                                  {t}
                                </button>
                              ))
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* Columna 4: Acciones (···) */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect?.()
                              if (rect) {
                                setMenuPosition({ x: rect.right - 220, y: rect.bottom + 6 })
                              }
                              setActiveMenuNoteId(note.id)
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer font-bold tracking-widest"
                            aria-label="Acciones de nota"
                            title="Acciones"
                          >
                            ···
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Columna Derecha: Panel Lateral / Buscador y Etiquetas */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-5">
          {/* Panel de Búsqueda */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-2.5">
            <label htmlFor="folder-search-input" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔍</span>
              <span>Buscar</span>
            </label>
            <div className="relative">
              <input
                id="folder-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar nota por título o contenido..."
                className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Panel de Etiquetas Activas */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🏷</span>
                <span>Etiquetas</span>
              </h2>
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Todas
                </button>
              )}
            </div>

            {tagCounts.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                No hay etiquetas en esta carpeta.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tagCounts.map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedTag === tag.name
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{tag.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedTag === tag.name
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tag.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Menú Contextual Inteligente */}
      {activeMenuNote && (
        <NoteContextMenu
          noteId={activeMenuNote.id}
          noteTitle={activeMenuNote.title}
          currentTags={articleMap.get(activeMenuNote.id)?.tags || []}
          currentStatus={noteMarkers[activeMenuNote.id]}
          position={menuPosition}
          onAction={handleNoteAction}
          onClose={() => setActiveMenuNoteId(null)}
        />
      )}

      {/* Modal: Confirmar Eliminación de Nota */}
      {deleteTargetNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-rose-500">🗑</span>
              <span>Eliminar nota</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar esta nota clínica <strong>{deleteTargetNote.title}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetNote(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer shadow-xs"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mover Nota a otra Carpeta */}
      {moveTargetNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-teal-600">📁</span>
              <span>Mover nota a otra carpeta</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecciona la carpeta de destino para <strong>{moveTargetNote.title}</strong>:
            </p>

            <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/40">
              {availableTargetFolders.length === 0 ? (
                <p className="text-xs text-slate-400 p-2 italic">
                  No hay otras carpetas creadas en tu repositorio.
                </p>
              ) : (
                availableTargetFolders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTargetDestinationFolderId(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                      targetDestinationFolderId === f.id
                        ? 'bg-teal-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span>📁</span>
                    <span className="truncate">{f.title}</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMoveTargetNote(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!targetDestinationFolderId}
                onClick={handleConfirmMove}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Mover nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Etiquetas */}
      {tagEditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-teal-600">🏷</span>
              <span>Editar etiquetas</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escribe las etiquetas separadas por comas para <strong>{tagEditNote.title}</strong>:
            </p>

            <input
              type="text"
              value={tagInputValue}
              onChange={(e) => setTagInputValue(e.target.value)}
              placeholder="ej. urgencias, valvulopatía, cardiología"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTagEditNote(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTags}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 cursor-pointer shadow-xs"
              >
                Guardar etiquetas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación (+) */}
      <CreateItemModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateFolder={handleCreateFolder}
        onCreateNote={handleCreateNote}
        defaultTab="note"
      />

      {/* Barra Inferior con FAB (+) */}
      <BottomNav
        onFabClick={() => setIsCreateModalOpen(true)}
        onNavigateHome={onBack}
        activeTab="notes"
      />
    </div>
  )
}
