import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Folder,
  FolderOpen,
  FileText,
  Search,
  MoreVertical,
  Trash2,
  FolderInput,
  Download,
  Pencil,
  Printer,
  Tag,
  CheckSquare,
  Square,
  AlertTriangle,
  OctagonAlert,
  CheckCircle2,
  Plus,
  ArrowLeft,
  ArrowUpDown,
  Sparkles,
  FileUp,
  Star,
  X,
  Check,
  FileDown,
  ChevronDown,
} from 'lucide-react'
import { db, type NodeRow, type ArticleRow } from '../../db/db'
import { saveArticle } from '../../db/articles'
import { childrenOf, canMove, sortNodesBy, type SortCriteria } from '../../domain/tree'
import {
  ClinicalBottomDock,
  DOCK_BTN_ACTIVE,
  DOCK_BTN_BASE,
  DOCK_BTN_IDLE,
} from '../common/ClinicalBottomDock'

export type ClinicalMark = 'warning' | 'critical' | 'verified'

const CLINICAL_MARKS_STORAGE_KEY = 'sindecon_article_marks'

function loadClinicalMarks(): Record<string, ClinicalMark> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CLINICAL_MARKS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ClinicalMark>) : {}
  } catch {
    return {}
  }
}

function saveClinicalMarks(marks: Record<string, ClinicalMark>): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CLINICAL_MARKS_STORAGE_KEY, JSON.stringify(marks))
    } catch {
      // Ignore quota errors
    }
  }
  void db.meta.put({ key: 'clinical_marks', value: marks }).catch(() => {})
}

export interface FolderExplorerViewProps {
  folderNode: NodeRow
  nodes: NodeRow[]
  onSelectNode: (id: string) => void
  onCreateArticle: (folderId: string) => void
  onCreateSubfolder: (folderId: string) => void
  onSmartImport?: (folderId: string) => void
  onBulkImport?: (folderId: string) => void
  onBulkExportPdf?: (folderId: string) => void
  onUploadPdf?: (folderId: string) => void
  onSortFolderAlphabetically?: (folderId: string) => void
  onToggleFavorite?: (nodeId: string) => void
  onRenameNode?: (nodeId: string) => void
  favoriteIds?: string[]
  onMoveNodeDirect?: (nodeId: string, targetFolderId: string | null) => void
  onDeleteNode?: (nodeId: string) => void
  onEditArticle?: (nodeId: string) => void
  onPrintArticle?: (nodeId: string) => void
  onGoBack?: () => void
  onOpenQuickCapture?: () => void
  onOpenCommandPalette?: () => void
}

function formatClinicalDate(timestamp: number): string {
  if (!timestamp) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleDateString()
  }
}

function downloadMarkdownFile(title: string, bodyMd: string, tags: string[]) {
  const safeName = (title || 'documento-clinico')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim()
  const tagHeader = tags.length > 0 ? `Etiquetas: ${tags.map((t) => `#${t}`).join(' ')}\n\n` : ''
  const content = `# ${title}\n\n${tagHeader}${bodyMd || ''}`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function FolderExplorerView({
  folderNode,
  nodes,
  onSelectNode,
  onCreateArticle,
  onCreateSubfolder,
  onSmartImport,
  onBulkImport,
  onBulkExportPdf,
  onUploadPdf,
  onSortFolderAlphabetically,
  onToggleFavorite,
  onRenameNode,
  favoriteIds = [],
  onMoveNodeDirect,
  onDeleteNode,
  onEditArticle,
  onPrintArticle,
  onGoBack,
  onOpenQuickCapture,
  onOpenCommandPalette,
}: FolderExplorerViewProps) {
  const [filterText, setFilterText] = useState('')
  const [sortMode, setSortMode] = useState<SortCriteria>('manual')
  const [markFilter, setMarkFilter] = useState<'all' | ClinicalMark>('all')
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  // Context Menu (`⋮`), Inline Tag Editor (`Etiqueta`), Inline Move Picker (`Mover a`), & Multi-select (`Seleccionar`)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingTagNodeId, setEditingTagNodeId] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState('')
  const [movingNodeId, setMovingNodeId] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBatchMoveOpen, setIsBatchMoveOpen] = useState(false)
  const [isOrbDrawerOpen, setIsOrbDrawerOpen] = useState(false)
  const [isFolderSwitcherOpen, setIsFolderSwitcherOpen] = useState(false)
  const [switcherFolderId, setSwitcherFolderId] = useState<string>(folderNode.id)
  const [switcherSearch, setSwitcherSearch] = useState('')
  const [clinicalMarks, setClinicalMarks] = useState<Record<string, ClinicalMark>>(() =>
    loadClinicalMarks(),
  )

  // Hydrate from IndexedDB db.meta if present (e.g. after .zip restore or Google Drive sync)
  const metaClinicalMarks = useLiveQuery(
    () => db.meta.get('clinical_marks'),
    [],
    undefined,
  )

  const effectiveClinicalMarks = useMemo(() => {
    const fromDb =
      metaClinicalMarks?.value && typeof metaClinicalMarks.value === 'object'
        ? (metaClinicalMarks.value as Record<string, ClinicalMark>)
        : {}
    return { ...fromDb, ...clinicalMarks }
  }, [metaClinicalMarks, clinicalMarks])

  const menuContainerRef = useRef<HTMLDivElement | null>(null)

  // Live query for all articles in IndexedDB to get their tags and body_md
  const articleRows = useLiveQuery(() => db.articles.toArray(), [], [] as ArticleRow[])

  const articleMap = useMemo(() => {
    const map = new Map<string, ArticleRow>()
    for (const row of articleRows ?? []) {
      map.set(row.node_id, row)
    }
    return map
  }, [articleRows])

  // Close open row menu on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null)
        setEditingTagNodeId(null)
        setMovingNodeId(null)
        setIsOrbDrawerOpen(false)
        setIsFolderSwitcherOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // All specialty folders for the 2-column Breadcrumb Popover (Opción 1)
  const allSpecialtyFolders = useMemo(() => {
    return nodes.filter(
      (n) => n.kind === 'folder' && n.deleted_at === null && n.system !== 'templates',
    )
  }, [nodes])

  const filteredSwitcherFolders = useMemo(() => {
    const q = switcherSearch.trim().toLowerCase()
    if (!q) return allSpecialtyFolders
    return allSpecialtyFolders.filter((f) => f.title.toLowerCase().includes(q))
  }, [allSpecialtyFolders, switcherSearch])

  const activeSwitcherFolder = useMemo(() => {
    return (
      allSpecialtyFolders.find((f) => f.id === switcherFolderId) ?? folderNode
    )
  }, [allSpecialtyFolders, switcherFolderId, folderNode])

  const switcherFolderArticles = useMemo(() => {
    const q = switcherSearch.trim().toLowerCase()
    if (q) {
      return nodes
        .filter(
          (n) =>
            n.kind === 'article' &&
            n.deleted_at === null &&
            n.title.toLowerCase().includes(q),
        )
        .slice(0, 20)
    }
    return childrenOf(nodes, activeSwitcherFolder.id).filter(
      (n) => n.kind === 'article',
    )
  }, [nodes, activeSwitcherFolder.id, switcherSearch])

  const children = useMemo(() => childrenOf(nodes, folderNode.id), [nodes, folderNode.id])

  const subfolders = useMemo(() => {
    const list = children.filter((c) => c.kind === 'folder')
    return sortNodesBy(list, sortMode)
  }, [children, sortMode])

  const allArticles = useMemo(() => {
    const list = children.filter((c) => c.kind === 'article')
    return sortNodesBy(list, sortMode)
  }, [children, sortMode])

  const filteredSubfolders = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return subfolders
    return subfolders.filter((f) => f.title.toLowerCase().includes(q))
  }, [subfolders, filterText])

  const filteredArticles = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    return allArticles.filter((art) => {
      const mark = effectiveClinicalMarks[art.id]
      if (markFilter !== 'all' && mark !== markFilter) return false
      if (!q) return true
      const row = articleMap.get(art.id)
      const tagsMatch = row?.tags?.some((t) => t.toLowerCase().includes(q.replace(/^#/, '')))
      const titleMatch = art.title.toLowerCase().includes(q)
      return Boolean(titleMatch || tagsMatch)
    })
  }, [allArticles, filterText, markFilter, effectiveClinicalMarks, articleMap])

  // Available target folders for "Mover a"
  const availableTargetFolders = useMemo(() => {
    return nodes.filter(
      (n) =>
        n.kind === 'folder' &&
        n.deleted_at === null &&
        n.system !== 'templates' &&
        n.id !== folderNode.id,
    )
  }, [nodes, folderNode.id])

  const countSubfolderItems = (subfolderId: string) => {
    const subChildren = childrenOf(nodes, subfolderId)
    const foldersCount = subChildren.filter((c) => c.kind === 'folder').length
    const articlesCount = subChildren.filter((c) => c.kind === 'article').length
    return { foldersCount, articlesCount, total: subChildren.length }
  }

  // Mark counts inside this folder
  const markCounts = useMemo(() => {
    let warning = 0
    let critical = 0
    let verified = 0
    for (const art of allArticles) {
      const m = effectiveClinicalMarks[art.id]
      if (m === 'warning') warning++
      else if (m === 'critical') critical++
      else if (m === 'verified') verified++
    }
    return { warning, critical, verified }
  }, [allArticles, effectiveClinicalMarks])

  const handleSetClinicalMark = (nodeId: string, mark: ClinicalMark | null) => {
    setClinicalMarks((prev) => {
      const next = { ...effectiveClinicalMarks, ...prev }
      if (!mark || next[nodeId] === mark) {
        delete next[nodeId]
      } else {
        next[nodeId] = mark
      }
      saveClinicalMarks(next)
      return next
    })
    setOpenMenuId(null)
  }

  const handleBatchSetClinicalMark = (mark: ClinicalMark | null) => {
    if (selectedIds.length === 0) return
    setClinicalMarks((prev) => {
      const next = { ...effectiveClinicalMarks, ...prev }
      for (const id of selectedIds) {
        if (!mark) delete next[id]
        else next[id] = mark
      }
      saveClinicalMarks(next)
      return next
    })
  }

  const handleOpenTagEditor = (nodeId: string) => {
    const existing = articleMap.get(nodeId)?.tags ?? []
    setTagDraft(existing.join(', '))
    setEditingTagNodeId(nodeId)
    setOpenMenuId(null)
  }

  const handleSaveTags = async (nodeId: string) => {
    const existingRow = articleMap.get(nodeId)
    const bodyMd = existingRow?.body_md ?? ''
    const parsedTags = Array.from(
      new Set(
        tagDraft
          .split(/[,;\s]+/)
          .map((t) => t.replace(/^#+/, '').trim())
          .filter(Boolean),
      ),
    )
    await saveArticle(nodeId, bodyMd, parsedTags)
    setEditingTagNodeId(null)
  }

  const handleRemoveSingleTag = async (nodeId: string, tagToRemove: string) => {
    const existingRow = articleMap.get(nodeId)
    if (!existingRow) return
    const updatedTags = (existingRow.tags ?? []).filter((t) => t !== tagToRemove)
    await saveArticle(nodeId, existingRow.body_md ?? '', updatedTags)
  }

  const handleToggleSelectRow = (nodeId: string) => {
    setSelectedIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }

  const handleStartSelectionFromMenu = (nodeId: string) => {
    setIsSelectionMode(true)
    setSelectedIds((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]))
    setOpenMenuId(null)
  }

  const handleSelectAllFiltered = () => {
    if (selectedIds.length === filteredArticles.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredArticles.map((a) => a.id))
    }
  }

  const handleExportSingleArticle = (art: NodeRow) => {
    const row = articleMap.get(art.id)
    downloadMarkdownFile(art.title, row?.body_md ?? '', row?.tags ?? [])
    setOpenMenuId(null)
  }

  const handleBatchExportMarkdown = () => {
    for (const id of selectedIds) {
      const art = allArticles.find((a) => a.id === id)
      if (!art) continue
      const row = articleMap.get(art.id)
      downloadMarkdownFile(art.title, row?.body_md ?? '', row?.tags ?? [])
    }
  }

  const handleBatchMoveTo = (targetFolderId: string | null) => {
    if (!onMoveNodeDirect) return
    for (const id of selectedIds) {
      if (canMove(nodes, id, targetFolderId)) {
        onMoveNodeDirect(id, targetFolderId)
      }
    }
    setSelectedIds([])
    setIsBatchMoveOpen(false)
    setIsSelectionMode(false)
  }

  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    if (folderNode.system === 'templates') return
    setDraggedNodeId(nodeId)
    e.dataTransfer.setData('text/plain', nodeId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedNodeId(null)
    setDragOverFolderId(null)
  }

  const handleDragOverFolder = (e: React.DragEvent, targetFolderId: string) => {
    if (!onMoveNodeDirect || !draggedNodeId || draggedNodeId === targetFolderId) return
    if (!canMove(nodes, draggedNodeId, targetFolderId)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverFolderId !== targetFolderId) {
      setDragOverFolderId(targetFolderId)
    }
  }

  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceId = e.dataTransfer.getData('text/plain') || draggedNodeId
    setDraggedNodeId(null)
    setDragOverFolderId(null)
    if (!sourceId || !onMoveNodeDirect || sourceId === targetFolderId) return
    if (!canMove(nodes, sourceId, targetFolderId)) return
    onMoveNodeDirect(sourceId, targetFolderId)
  }

  const isFolderFav = favoriteIds.includes(folderNode.id)
  const parentFolder = folderNode.parent_id
    ? nodes.find((n) => n.id === folderNode.parent_id) ?? null
    : null

  const renderMarkBadge = (mark: ClinicalMark | undefined) => {
    if (!mark) return null
    if (mark === 'warning') {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-300"
          title="Marca clínica: Prioridad / Alerta"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Prioridad</span>
        </span>
      )
    }
    if (mark === 'critical') {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-red-600/30 bg-red-500/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-700 dark:text-red-300"
          title="Marca clínica: Crítico / Revisar"
        >
          <OctagonAlert className="h-3 w-3 shrink-0" />
          <span>Crítico</span>
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-600/30 bg-emerald-500/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
        title="Marca clínica: Verificado / Estudiado"
      >
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span>Verificado</span>
      </span>
    )
  }

  return (
    <div
      ref={menuContainerRef}
      className="clinical-home relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1380px] flex-col gap-5 px-4 pt-3 pb-36 sm:px-6 sm:pb-40"
    >
      {/* 1. TOP-LEFT FOLDER HEADER WITH INTERACTIVE BREADCRUMB POPOVER (Opción 1) */}
      <header className="relative z-35 flex flex-col gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-4 shadow-[var(--ch-shadow-card)] lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
              title={
                parentFolder ? `Volver a ${parentFolder.title}` : 'Volver a Mi Repositorio'
              }
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{parentFolder ? parentFolder.title : 'Mi Repositorio'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSwitcherFolderId(folderNode.id)
              setSwitcherSearch('')
              setIsFolderSwitcherOpen((v) => !v)
            }}
            title="Cambiar de especialidad o saltar a otro protocolo"
            aria-expanded={isFolderSwitcherOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--ch-accent)]/25 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)] transition hover:border-[var(--ch-accent-solid)] hover:bg-[var(--ch-accent-solid)] hover:text-white"
          >
            <FolderOpen className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSwitcherFolderId(folderNode.id)
                  setSwitcherSearch('')
                  setIsFolderSwitcherOpen((v) => !v)
                }}
                title="Abrir navegador desplegable de especialidades y protocolos"
                aria-expanded={isFolderSwitcherOpen}
                className="group inline-flex min-w-0 items-center gap-1.5 rounded-lg text-left transition hover:text-[var(--ch-accent)]"
              >
                <h1 className="truncate font-display text-xl font-bold tracking-tight text-[var(--ch-text-primary)] group-hover:text-[var(--ch-accent)] sm:text-2xl">
                  {folderNode.title}
                </h1>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--ch-accent)] transition-transform ${
                    isFolderSwitcherOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {onRenameNode && !folderNode.system && (
                <button
                  type="button"
                  onClick={() => onRenameNode(folderNode.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--ch-text-muted)] transition hover:bg-[var(--ch-bg-secondary)] hover:text-[var(--ch-text-primary)]"
                  title="Renombrar carpeta"
                  aria-label="Renombrar carpeta"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(folderNode.id)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
                    isFolderFav
                      ? 'text-amber-500'
                      : 'text-[var(--ch-text-muted)] hover:bg-[var(--ch-bg-secondary)] hover:text-[var(--ch-text-primary)]'
                  }`}
                  title={isFolderFav ? 'Quitar de favoritos' : 'Anclar carpeta a favoritos'}
                  aria-label="Favorito"
                >
                  <Star className={`h-4 w-4 ${isFolderFav ? 'fill-amber-500' : ''}`} />
                </button>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--ch-text-muted)]">
              <span>
                {allArticles.length} {allArticles.length === 1 ? 'documento' : 'documentos'}
              </span>
              {subfolders.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {subfolders.length} {subfolders.length === 1 ? 'subcarpeta' : 'subcarpetas'}
                  </span>
                </>
              )}
              <span>·</span>
              <span>Creada {formatClinicalDate(folderNode.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Clinical Mark Filter Pills & Sort Controls */}
        <div className="flex flex-wrap items-center gap-1.5 lg:shrink-0 lg:justify-end">
          <button
            type="button"
            onClick={() => setMarkFilter('all')}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              markFilter === 'all'
                ? 'border-[var(--ch-accent)]/35 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <span>Todos ({allArticles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMarkFilter(markFilter === 'warning' ? 'all' : 'warning')}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              markFilter === 'warning'
                ? 'border-amber-600/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-amber-700'
            }`}
            title="Filtrar por marca Prioridad (Triángulo)"
          >
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <span>Prioridad ({markCounts.warning})</span>
          </button>
          <button
            type="button"
            onClick={() => setMarkFilter(markFilter === 'critical' ? 'all' : 'critical')}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              markFilter === 'critical'
                ? 'border-red-600/40 bg-red-500/15 text-red-700 dark:text-red-300'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-red-700'
            }`}
            title="Filtrar por marca Crítico / Revisar (Octágono)"
          >
            <OctagonAlert className="h-3 w-3 text-red-600" />
            <span>Crítico ({markCounts.critical})</span>
          </button>
          <button
            type="button"
            onClick={() => setMarkFilter(markFilter === 'verified' ? 'all' : 'verified')}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              markFilter === 'verified'
                ? 'border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-emerald-700'
            }`}
            title="Filtrar por marca Verificado (Check)"
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Verificado ({markCounts.verified})</span>
          </button>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortCriteria)}
            aria-label="Ordenar documentos"
            className="ml-1 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-secondary)] outline-none focus:border-[var(--ch-accent)]"
          >
            <option value="manual">Orden: Manual</option>
            <option value="alpha-asc">Nombre: A → Z</option>
            <option value="alpha-desc">Nombre: Z → A</option>
            <option value="recent">Más recientes</option>
          </select>
        </div>

        {/* 2-COLUMN BREADCRUMB POPOVER MENU IN FOLDER VIEW (Opción 1) */}
        {isFolderSwitcherOpen && (
          <section
            role="dialog"
            aria-label="Navegador desplegable de especialidades y protocolos"
            className="absolute top-[calc(100%+8px)] left-4 z-50 flex w-[calc(100vw-2.5rem)] max-w-[560px] flex-col gap-3 rounded-2xl border-2 border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-3.5 shadow-[var(--ch-shadow-modal)] sm:left-6"
          >
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                <input
                  type="text"
                  value={switcherSearch}
                  onChange={(e) => setSwitcherSearch(e.target.value)}
                  placeholder="Buscar carpeta o protocolo médico…"
                  aria-label="Filtrar carpetas o protocolos"
                  className="w-full bg-transparent text-xs font-medium text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)]"
                  autoFocus
                />
                {switcherSearch && (
                  <button
                    type="button"
                    onClick={() => setSwitcherSearch('')}
                    className="rounded-full p-0.5 text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
                    aria-label="Limpiar filtro"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFolderSwitcherOpen(false)
                    onOpenCommandPalette()
                  }}
                  title="Abrir paleta de comandos global (Ctrl+K)"
                  className="shrink-0 rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--ch-text-muted)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                >
                  Ctrl+K
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFolderSwitcherOpen(false)}
                className="rounded-full p-1 text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
                aria-label="Cerrar navegador desplegable"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[215px_1fr]">
              {/* Left Column: Specialty Folders */}
              <div className="flex flex-col gap-1">
                <div className="px-1.5 pb-1 font-mono text-[10px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                  Especialidades ({filteredSwitcherFolders.length})
                </div>
                <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto pr-0.5">
                  {filteredSwitcherFolders.map((folder) => {
                    const isSelected = activeSwitcherFolder.id === folder.id
                    const isCurrentFolder = folderNode.id === folder.id
                    const count = childrenOf(nodes, folder.id).filter(
                      (n) => n.kind === 'article',
                    ).length
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setSwitcherFolderId(folder.id)}
                        onDoubleClick={() => {
                          setIsFolderSwitcherOpen(false)
                          onSelectNode(folder.id)
                        }}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                          isSelected
                            ? 'border-[var(--ch-accent)]/30 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                            : 'border-transparent text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                          <span className="truncate">{folder.title}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-[var(--ch-text-muted)]">
                          {isCurrentFolder ? `Actual (${count})` : count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Protocols in Selected Specialty */}
              <div className="flex flex-col gap-1 border-t border-[var(--ch-border-subtle)] pt-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
                <div className="px-1.5 pb-1 font-mono text-[10px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                  {switcherSearch.trim()
                    ? `Resultados (${switcherFolderArticles.length})`
                    : `Documentos en ${activeSwitcherFolder.title} (${switcherFolderArticles.length})`}
                </div>
                <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto pr-0.5">
                  {switcherFolderArticles.length === 0 ? (
                    <div className="rounded-lg bg-[var(--ch-bg-secondary)]/60 px-3 py-4 text-center text-xs text-[var(--ch-text-muted)]">
                      No hay protocolos en esta carpeta.
                    </div>
                  ) : (
                    switcherFolderArticles.map((doc) => {
                      const docMark = effectiveClinicalMarks[doc.id]
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setIsFolderSwitcherOpen(false)
                            onSelectNode(doc.id)
                          }}
                          className="flex items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)]/25 hover:bg-[var(--ch-accent-soft)]/50 hover:text-[var(--ch-accent)]"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                            <span className="truncate">{doc.title}</span>
                          </span>
                          <span className="flex shrink-0 items-center">
                            {docMark === 'warning' && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            )}
                            {docMark === 'critical' && (
                              <OctagonAlert className="h-3.5 w-3.5 text-red-600" />
                            )}
                            {docMark === 'verified' && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ch-border-subtle)] pt-2.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setIsFolderSwitcherOpen(false)
                  onCreateArticle(activeSwitcherFolder.id)
                }}
                className="inline-flex items-center gap-1 text-[var(--ch-accent)] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo artículo en {activeSwitcherFolder.title}</span>
              </button>

              {activeSwitcherFolder.id !== folderNode.id && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFolderSwitcherOpen(false)
                    onSelectNode(activeSwitcherFolder.id)
                  }}
                  className="inline-flex items-center gap-1 text-[var(--ch-text-secondary)] transition hover:text-[var(--ch-accent)] hover:underline"
                >
                  <span>Abrir carpeta {activeSwitcherFolder.title} →</span>
                </button>
              )}
            </div>
          </section>
        )}
      </header>

      {/* Optional Subfolders Strip (if folder contains subfolders) */}
      {filteredSubfolders.length > 0 && (
        <section aria-label="Subcarpetas" className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
              Subcarpetas ({filteredSubfolders.length})
            </span>
            <button
              type="button"
              onClick={() => onCreateSubfolder(folderNode.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ch-accent)] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nueva subcarpeta</span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredSubfolders.map((sub) => {
              const counts = countSubfolderItems(sub.id)
              const isFav = favoriteIds.includes(sub.id)
              const isDropTarget = dragOverFolderId === sub.id
              return (
                <div
                  key={sub.id}
                  draggable={folderNode.system !== 'templates'}
                  onDragStart={(e) => handleDragStart(e, sub.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOverFolder(e, sub.id)}
                  onDrop={(e) => handleDropOnFolder(e, sub.id)}
                  onClick={() => onSelectNode(sub.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectNode(sub.id)
                    }
                  }}
                  className={`group flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                    isDropTarget
                      ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                      : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] hover:border-[var(--ch-accent)]/50 hover:bg-[var(--ch-bg-secondary)]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--ch-text-primary)]">
                        {sub.title}
                      </div>
                      <div className="font-mono text-[11px] text-[var(--ch-text-muted)]">
                        {counts.articlesCount} docs
                        {counts.foldersCount > 0 ? ` · ${counts.foldersCount} sub` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(sub.id)
                        }}
                        className={`rounded p-1 ${
                          isFav
                            ? 'text-amber-500'
                            : 'text-[var(--ch-text-muted)] opacity-0 group-hover:opacity-100'
                        }`}
                        title="Favorito"
                      >
                        <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-amber-500' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 2. MAIN TWO-COLUMN WORKSPACE FROM SKETCH:
          Left: Indented Document Table (Documento | Fecha creación | Etiqueta | ⋮)
          Right: 🔍 Buscar + Live Compact Document Index List (📄 ~~~~) */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_275px]">
        {/* LEFT COLUMN: Document Table */}
        <section
          aria-label="Tabla de documentos de la carpeta"
          className="rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] shadow-[var(--ch-shadow-card)]"
        >
          {/* Table Header matching 'Fecha creación' and 'Etiqueta' in the sketch */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-t-xl border-b border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-4 py-3 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase sm:grid-cols-[minmax(240px,1fr)_105px_125px_36px] sm:pl-5">
            <div className="flex items-center gap-2.5">
              {isSelectionMode && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="inline-flex items-center justify-center text-[var(--ch-accent)]"
                  title="Seleccionar todos"
                >
                  {selectedIds.length > 0 && selectedIds.length === filteredArticles.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              )}
              <span>Documento</span>
            </div>
            <span className="hidden sm:block">Fecha creación</span>
            <span className="hidden sm:block">Etiqueta</span>
            <span className="sr-only">Acciones</span>
          </div>

          {/* Document Rows */}
          {filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                <FileText className="h-6 w-6" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-semibold text-[var(--ch-text-primary)]">
                  {filterText || markFilter !== 'all'
                    ? 'Sin documentos que coincidan con el filtro'
                    : 'Esta carpeta aún no tiene documentos'}
                </h3>
                <p className="mt-1 text-xs text-[var(--ch-text-secondary)]">
                  {filterText || markFilter !== 'all'
                    ? 'Prueba limpiando la búsqueda o cambiando el filtro de marca clínica.'
                    : 'Crea un artículo nuevo o importa apuntes con IA, Word o PDF desde la barra inferior.'}
                </p>
              </div>
              {!filterText && markFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => onCreateArticle(folderNode.id)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--ch-accent-solid)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Crear primer documento</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[var(--ch-border-subtle)]">
              {filteredArticles.map((art) => {
                const artRow = articleMap.get(art.id)
                const tags = artRow?.tags ?? []
                const mark = effectiveClinicalMarks[art.id]
                const isFav = favoriteIds.includes(art.id)
                const isSelected = selectedIds.includes(art.id)
                const isMenuOpen = openMenuId === art.id
                const isEditingTags = editingTagNodeId === art.id
                const isMovingRow = movingNodeId === art.id

                return (
                  <div
                    key={art.id}
                    draggable={folderNode.system !== 'templates'}
                    onDragStart={(e) => handleDragStart(e, art.id)}
                    onDragEnd={handleDragEnd}
                    className={`group relative transition ${
                      isSelected || isMenuOpen
                        ? 'bg-[var(--ch-accent-soft)]/60'
                        : 'hover:bg-[var(--ch-bg-secondary)]/75'
                    }`}
                  >
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(240px,1fr)_105px_125px_36px] sm:pl-5">
                      {/* Column 1: Document Icon + Title + Clinical Status Mark */}
                      <div className="flex min-w-0 items-center gap-2.5 pr-2">
                        {isSelectionMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleSelectRow(art.id)
                            }}
                            className="inline-flex shrink-0 items-center justify-center text-[var(--ch-accent)]"
                            aria-label={`Seleccionar ${art.title}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4 text-[var(--ch-text-muted)]" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            isSelectionMode ? handleToggleSelectRow(art.id) : onSelectNode(art.id)
                          }
                          className="flex min-w-0 items-center gap-2.5 text-left"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-accent)]">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="truncate text-sm font-semibold text-[var(--ch-text-primary)] group-hover:text-[var(--ch-accent)]">
                            {art.title}
                          </span>
                        </button>

                        {renderMarkBadge(mark)}

                        {isFav && (
                          <Star
                            className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500"
                            aria-label="Favorito"
                          />
                        )}
                      </div>

                      {/* Column 2: Fecha creación */}
                      <div className="hidden font-mono text-xs tabular-nums text-[var(--ch-text-secondary)] sm:block">
                        {formatClinicalDate(art.created_at)}
                      </div>

                      {/* Column 3: Etiqueta */}
                      <div className="hidden flex-wrap items-center gap-1 sm:flex">
                        {tags.length > 0 ? (
                          tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--ch-text-secondary)]"
                            >
                              <span>#{tag}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleRemoveSingleTag(art.id, tag)
                                }}
                                className="text-[var(--ch-text-muted)] hover:text-red-600"
                                title={`Quitar etiqueta #${tag}`}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenTagEditor(art.id)
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--ch-border-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--ch-text-muted)] opacity-75 transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)] hover:opacity-100"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            <span>+ etiqueta</span>
                          </button>
                        )}
                        {tags.length > 3 && (
                          <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                            +{tags.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Column 4: ⋮ Vertical 3-Dots Context Menu Trigger */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(isMenuOpen ? null : art.id)
                            setEditingTagNodeId(null)
                            setMovingNodeId(null)
                          }}
                          aria-label={`Acciones para ${art.title}`}
                          aria-expanded={isMenuOpen}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                            isMenuOpen
                              ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                              : 'border-transparent text-[var(--ch-text-secondary)] hover:border-[var(--ch-border-subtle)] hover:bg-[var(--ch-bg-elevated)]'
                          }`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Tag Editor Popover when user clicks "Etiqueta" */}
                    {isEditingTags && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-4 py-2.5 sm:pl-7">
                        <Tag className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                        <span className="text-xs font-semibold text-[var(--ch-text-secondary)]">
                          Etiquetas:
                        </span>
                        <input
                          type="text"
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void handleSaveTags(art.id)
                            } else if (e.key === 'Escape') {
                              setEditingTagNodeId(null)
                            }
                          }}
                          placeholder="ej: cardiologia, uci, protocolo"
                          autoFocus
                          className="min-w-[200px] flex-1 rounded-md border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] px-2.5 py-1 font-mono text-xs text-[var(--ch-text-primary)] outline-none focus:border-[var(--ch-accent)]"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveTags(art.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--ch-accent-solid)] px-3 py-1 text-xs font-semibold text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Guardar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagNodeId(null)}
                          className="inline-flex items-center rounded-md border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2 py-1 text-xs text-[var(--ch-text-secondary)]"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Inline Destination Folder Picker when user clicks "Mover a" */}
                    {isMovingRow && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-4 py-2.5 sm:pl-7">
                        <FolderInput className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                        <span className="text-xs font-semibold text-[var(--ch-text-secondary)]">
                          Mover «{art.title}» a:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {folderNode.parent_id !== null && onMoveNodeDirect && (
                            <button
                              type="button"
                              onClick={() => {
                                onMoveNodeDirect(art.id, null)
                                setMovingNodeId(null)
                              }}
                              className="rounded-md border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
                            >
                              Raíz (Mi Repositorio)
                            </button>
                          )}
                          {availableTargetFolders.map((target) => (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => {
                                onMoveNodeDirect?.(art.id, target.id)
                                setMovingNodeId(null)
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                            >
                              <Folder className="h-3 w-3 text-[var(--ch-accent)]" />
                              <span>{target.title}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMovingNodeId(null)}
                          className="ml-auto text-xs font-semibold text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* ⋮ CONTEXT MENU POPOVER WITH ALL 8 HANDWRITTEN ACTIONS + 3 CLINICAL STATUS MARKS */}
                    {isMenuOpen && (
                      <div
                        role="menu"
                        aria-label={`Menú de acciones para ${art.title}`}
                        className=" right-12 z-30 mx-4 mb-3 rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-1.5 shadow-[var(--ch-shadow-modal)] sm:absolute sm:top-10 sm:mx-0 sm:mb-0 sm:w-64"
                      >
                        {/* 1. Editar */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuId(null)
                            if (onEditArticle) onEditArticle(art.id)
                            else onSelectNode(art.id)
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-bg-secondary)]"
                        >
                          <span className="flex items-center gap-2">
                            <Pencil className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                            <span>Editar</span>
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                            Editor
                          </span>
                        </button>

                        {/* 2. Imprimir */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuId(null)
                            if (onPrintArticle) onPrintArticle(art.id)
                            else onSelectNode(art.id)
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-bg-secondary)]"
                        >
                          <span className="flex items-center gap-2">
                            <Printer className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                            <span>Imprimir</span>
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                            PDF
                          </span>
                        </button>

                        {/* 3. Exportar */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleExportSingleArticle(art)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-bg-secondary)]"
                        >
                          <span className="flex items-center gap-2">
                            <Download className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                            <span>Exportar</span>
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                            .MD
                          </span>
                        </button>

                        {/* 4. Etiqueta */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleOpenTagEditor(art.id)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-bg-secondary)]"
                        >
                          <span className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                            <span>Etiqueta</span>
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                            {tags.length > 0 ? `${tags.length} tags` : '#tags'}
                          </span>
                        </button>

                        {/* 5. Seleccionar */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleStartSelectionFromMenu(art.id)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-bg-secondary)]"
                        >
                          <span className="flex items-center gap-2">
                            <CheckSquare className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                            <span>Seleccionar</span>
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                            Lote
                          </span>
                        </button>

                        {/* 6. Mover a */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMovingNodeId(art.id)
                            setOpenMenuId(null)
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-bg-secondary)]"
                        >
                          <span className="flex items-center gap-2">
                            <FolderInput className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                            <span>Mover a…</span>
                          </span>
                        </button>

                        {/* 7. Marcar -> 3 Visual Clinical Marks (⚠ Triangle, 🛑 Octagon, ☑ Checked Box) */}
                        <div className="my-1 rounded-lg bg-[var(--ch-bg-secondary)] p-2">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                              Marcar estado clínico:
                            </span>
                            {mark && (
                              <button
                                type="button"
                                onClick={() => handleSetClinicalMark(art.id, null)}
                                className="font-mono text-[10px] text-[var(--ch-text-muted)] hover:underline"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetClinicalMark(art.id, 'warning')}
                              aria-label="Marcar Prioridad"
                              title="Prioridad / Importante (Triángulo)"
                              className={`flex flex-col items-center justify-center gap-0.5 rounded-md border py-1.5 text-[10px] font-semibold transition ${
                                mark === 'warning'
                                  ? 'border-amber-600 bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-amber-600 hover:border-amber-500/50'
                              }`}
                            >
                              <AlertTriangle className="h-4 w-4" />
                              <span>Prioridad</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetClinicalMark(art.id, 'critical')}
                              aria-label="Marcar Crítico"
                              title="Crítico / Revisar (Octágono)"
                              className={`flex flex-col items-center justify-center gap-0.5 rounded-md border py-1.5 text-[10px] font-semibold transition ${
                                mark === 'critical'
                                  ? 'border-red-600 bg-red-500/20 text-red-700 dark:text-red-300'
                                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-red-600 hover:border-red-500/50'
                              }`}
                            >
                              <OctagonAlert className="h-4 w-4" />
                              <span>Crítico</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetClinicalMark(art.id, 'verified')}
                              aria-label="Marcar Verificado"
                              title="Verificado / Estudiado (Check)"
                              className={`flex flex-col items-center justify-center gap-0.5 rounded-md border py-1.5 text-[10px] font-semibold transition ${
                                mark === 'verified'
                                  ? 'border-emerald-600 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-emerald-600 hover:border-emerald-500/50'
                              }`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Verificado</span>
                            </button>
                          </div>
                        </div>

                        <div className="my-1 h-px bg-[var(--ch-border-subtle)]" />

                        {/* 8. Eliminar */}
                        {onDeleteNode && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null)
                              onDeleteNode(art.id)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 3. RIGHT COLUMN FROM SKETCH: 🔍 Buscar + Live Vertical Quick Document Index (📄 ~~~~) */}
        <aside
          aria-label="Buscador e índice rápido de carpeta"
          className="flex flex-col gap-3 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-4 shadow-[var(--ch-shadow-card)]"
        >
          {/* Search Input matching top-right '🔍 Buscar' in sketch */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-3 py-2 focus-within:border-[var(--ch-accent)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={`Buscar en ${folderNode.title}…`}
              aria-label="Buscar documento o etiqueta en esta carpeta"
              className="w-full bg-transparent text-xs font-medium text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)]"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Document List directly under Buscar (matching the vertical stack of 📄 ~~~~ in the sketch) */}
          <div className="flex items-center justify-between px-1 pt-1 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
            <span>Índice Rápido</span>
            <span>{filteredArticles.length} docs</span>
          </div>

          <div className="flex max-h-[380px] flex-col gap-1 overflow-y-auto pr-0.5">
            {filteredArticles.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--ch-text-muted)]">
                Sin coincidencias
              </p>
            ) : (
              filteredArticles.map((art) => {
                const mark = effectiveClinicalMarks[art.id]
                const artTags = articleMap.get(art.id)?.tags ?? []
                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => onSelectNode(art.id)}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs font-medium text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)]/25 hover:bg-[var(--ch-accent-soft)] hover:text-[var(--ch-accent)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                      <span className="truncate font-semibold text-[var(--ch-text-primary)] group-hover:text-[var(--ch-accent)]">
                        {art.title}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {mark === 'warning' && (
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-amber-600"
                          aria-label="Prioridad"
                        />
                      )}
                      {mark === 'critical' && (
                        <OctagonAlert
                          className="h-3.5 w-3.5 text-red-600"
                          aria-label="Crítico"
                        />
                      )}
                      {mark === 'verified' && (
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-emerald-600"
                          aria-label="Verificado"
                        />
                      )}
                      {!mark && artTags[0] && (
                        <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                          #{artTags[0]}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Legend for the 3 clinical marks drawn in the user's sketch */}
          <div className="mt-1 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5">
            <div className="mb-1.5 font-mono text-[10px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
              Marcas Clínicas (Menú ⋮)
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Prioridad</span>
              </span>
              <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300">
                <OctagonAlert className="h-3.5 w-3.5" />
                <span>Crítico</span>
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Verificado</span>
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* BATCH SELECTION BAR (Visible when 'Seleccionar' mode is active) */}
      {isSelectionMode && (
        <div className="fixed bottom-20 left-1/2 z-40 flex w-[94%] max-w-3xl -translate-x-1/2 flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--ch-accent)] bg-[var(--ch-bg-elevated)] px-4 py-2.5 shadow-[var(--ch-shadow-modal)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ch-text-primary)]">
            <CheckSquare className="h-4 w-4 text-[var(--ch-accent)]" />
            <span>
              {selectedIds.length}{' '}
              {selectedIds.length === 1 ? 'documento seleccionado' : 'documentos seleccionados'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleBatchSetClinicalMark('warning')}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 disabled:opacity-40 dark:text-amber-300"
              title="Marcar lote como Prioridad"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Prioridad</span>
            </button>
            <button
              type="button"
              onClick={() => handleBatchSetClinicalMark('critical')}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 disabled:opacity-40 dark:text-red-300"
              title="Marcar lote como Crítico"
            >
              <OctagonAlert className="h-3.5 w-3.5" />
              <span>Crítico</span>
            </button>
            <button
              type="button"
              onClick={() => handleBatchSetClinicalMark('verified')}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-40 dark:text-emerald-300"
              title="Marcar lote como Verificado"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verificado</span>
            </button>

            <button
              type="button"
              onClick={handleBatchExportMarkdown}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar (.md)</span>
            </button>

            {onMoveNodeDirect && (
              <button
                type="button"
                onClick={() => setIsBatchMoveOpen((v) => !v)}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] disabled:opacity-40"
              >
                <FolderInput className="h-3.5 w-3.5" />
                <span>Mover a…</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false)
                setSelectedIds([])
                setIsBatchMoveOpen(false)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--ch-border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
              <span>Salir</span>
            </button>
          </div>

          {isBatchMoveOpen && (
            <div className="mt-1 flex w-full flex-wrap items-center gap-1.5 border-t border-[var(--ch-border-subtle)] pt-2">
              <span className="text-xs font-semibold text-[var(--ch-text-secondary)]">
                Destino del lote:
              </span>
              {folderNode.parent_id !== null && (
                <button
                  type="button"
                  onClick={() => handleBatchMoveTo(null)}
                  className="rounded-md border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
                >
                  Raíz (Mi Repositorio)
                </button>
              )}
              {availableTargetFolders.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => handleBatchMoveTo(target.id)}
                  className="rounded-md border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
                >
                  {target.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CENTER ORB QUICK CREATION DRAWER */}
      {isOrbDrawerOpen && (
        <div
          role="dialog"
          aria-label="Crear o importar en esta carpeta"
          className="fixed bottom-24 left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-4 shadow-[var(--ch-shadow-modal)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
              Acciones en «{folderNode.title}»
            </span>
            <button
              type="button"
              onClick={() => setIsOrbDrawerOpen(false)}
              className="rounded-md p-1 text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                onCreateArticle(folderNode.id)
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
            >
              <FileText className="h-4 w-4 text-[var(--ch-accent)]" />
              <span>Nuevo Artículo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                onCreateSubfolder(folderNode.id)
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
            >
              <Folder className="h-4 w-4 text-[var(--ch-accent)]" />
              <span>Nueva Subcarpeta</span>
            </button>
            {onSmartImport && (
              <button
                type="button"
                onClick={() => {
                  setIsOrbDrawerOpen(false)
                  onSmartImport(folderNode.id)
                }}
                className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
              >
                <Sparkles className="h-4 w-4 text-[var(--ch-accent)]" />
                <span>Importar con IA</span>
              </button>
            )}
            {onUploadPdf && (
              <button
                type="button"
                onClick={() => {
                  setIsOrbDrawerOpen(false)
                  onUploadPdf(folderNode.id)
                }}
                className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
              >
                <FileUp className="h-4 w-4 text-[var(--ch-accent)]" />
                <span>Subir PDF</span>
              </button>
            )}
            {onBulkImport && (
              <button
                type="button"
                onClick={() => {
                  setIsOrbDrawerOpen(false)
                  onBulkImport(folderNode.id)
                }}
                className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
              >
                <Download className="h-4 w-4 text-[var(--ch-accent)]" />
                <span>Importar .md / Word</span>
              </button>
            )}
            {onBulkExportPdf && (
              <button
                type="button"
                onClick={() => {
                  setIsOrbDrawerOpen(false)
                  onBulkExportPdf(folderNode.id)
                }}
                className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
              >
                <FileDown className="h-4 w-4 text-[var(--ch-accent)]" />
                <span>Compendio PDF</span>
              </button>
            )}
            {onOpenQuickCapture && (
              <button
                type="button"
                onClick={() => {
                  setIsOrbDrawerOpen(false)
                  onOpenQuickCapture()
                }}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
              >
                <Plus className="h-4 w-4 text-[var(--ch-accent)]" />
                <span>Captura Rápida en Inbox</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. BOTTOM TOOLS BAR WITH CENTERED CIRCULAR BUTTON */}
      <ClinicalBottomDock
        ariaLabel="Barra inferior de herramientas de carpeta"
        orbLabel="Abrir menú central de creación e importación"
        orbTitle="Crear o importar en esta carpeta"
        onOrbClick={() => setIsOrbDrawerOpen((prev) => !prev)}
        orbIcon={
          <Plus
            className={`h-6 w-6 stroke-[2.4] transition-transform ${isOrbDrawerOpen ? 'rotate-45' : ''}`}
          />
        }
        left={
          <>
            <button
              type="button"
              onClick={() => onCreateArticle(folderNode.id)}
              title="Nuevo Artículo"
              aria-label="Nuevo Artículo"
              className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE} text-[var(--ch-text-primary)]`}
            >
              <FileText className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
              <span className="hidden sm:inline">Nuevo Artículo</span>
            </button>

            <button
              type="button"
              onClick={() => onCreateSubfolder(folderNode.id)}
              title="Nueva Subcarpeta"
              aria-label="Nueva Subcarpeta"
              className={`hidden md:inline-flex md:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
            >
              <Folder className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
              <span>Subcarpeta</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSelectionMode((prev) => !prev)
                if (isSelectionMode) setSelectedIds([])
              }}
              title="Seleccionar múltiples documentos"
              aria-label="Seleccionar"
              className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${isSelectionMode ? DOCK_BTN_ACTIVE : DOCK_BTN_IDLE}`}
            >
              <CheckSquare className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Seleccionar</span>
            </button>
          </>
        }
        right={
          <>
            {onSmartImport && (
              <button
                type="button"
                onClick={() => onSmartImport(folderNode.id)}
                className={`inline-flex md:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
                title="Importar apuntes con IA en esta carpeta"
                aria-label="Importar IA"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
                <span className="hidden md:inline">Importar IA</span>
              </button>
            )}

            {onUploadPdf && (
              <button
                type="button"
                onClick={() => onUploadPdf(folderNode.id)}
                className={`hidden sm:inline-flex sm:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
                title="Subir documento PDF a esta carpeta"
                aria-label="Subir PDF"
              >
                <FileUp className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
                <span>Subir PDF</span>
              </button>
            )}

            {onBulkExportPdf && allArticles.length > 0 && (
              <button
                type="button"
                onClick={() => onBulkExportPdf(folderNode.id)}
                className={`hidden lg:inline-flex lg:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
                title="Exportar carpeta como Compendio PDF"
                aria-label="Compendio PDF"
              >
                <Printer className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
                <span>Compendio PDF</span>
              </button>
            )}

            {onSortFolderAlphabetically && children.length > 1 && (
              <button
                type="button"
                onClick={() => onSortFolderAlphabetically(folderNode.id)}
                className={`inline-flex lg:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
                title="Ordenar carpeta alfabéticamente (A-Z)"
                aria-label="Ordenar A-Z"
              >
                <ArrowUpDown className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
                <span className="hidden lg:inline">A–Z</span>
              </button>
            )}
          </>
        }
      />
    </div>
  )
}
