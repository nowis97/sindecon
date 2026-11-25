import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Brain,
  Camera,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FilePlus,
  FileText,
  FileUp,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { db, type NodeRow } from '../../db/db'
import {
  CLINICAL_MARK_META,
  countArticlesByTriage,
  filterArticlesByTriage,
  mergeClinicalMarks,
  readAllClinicalMarks,
  type ClinicalTriageFilter,
} from '../../utils/clinicalMarks'
import { exportToZip, importFromZip } from '../../db/exportImport'
import type { MergeReport } from '../../domain/merge'
import { childrenOf } from '../../domain/tree'
import { useAllTags, useArticlesWithTag } from '../../hooks/useSearch'
import type { Theme } from '../../hooks/useTheme'
import type { SyncProgress, SyncState } from '../../pwa/syncEngine'
import {
  ClinicalBottomDock,
  DOCK_BTN_ACTIVE,
  DOCK_BTN_BASE,
  DOCK_BTN_IDLE,
} from '../common/ClinicalBottomDock'
import { ClinicalStationHeader } from '../common/ClinicalStationHeader'
import { AlertDialog } from '../common/DialogModal'

export interface DashboardProps {
  nodes: NodeRow[]
  templates: Array<{ node: NodeRow; body: string }>
  onSelectArticle: (id: string) => void
  onOpenQuickCapture: () => void
  onOpenSmartImport?: (folderId?: string | null) => void
  onCreateNode: (kind: 'folder' | 'article', parentId?: string | null) => void
  onCreateFromTemplate: (templateTitle: string, parentId?: string | null) => void
  onInstallPwa?: () => void
  canInstallPwa?: boolean
  dueFlashcardsCount?: number
  totalFlashcardsCount?: number
  onOpenStudy?: () => void
  onOpenAiSettings?: () => void
  // Extensiones de estación clínica completa
  userName?: string
  theme?: Theme
  onToggleTheme?: () => void
  onOpenSecuritySettings?: () => void
  onLockTerminal?: () => void
  onOpenCommandPalette?: () => void
  favoriteIds?: string[]
  onToggleFavorite?: (id: string) => void
  showTemplatesFolder?: boolean
  onToggleTemplatesFolder?: () => void
  isGoogleConnected?: boolean
  isGoogleSessionExpired?: boolean
  googleHasPendingChanges?: boolean
  googleSyncState?: SyncState
  googleSyncProgress?: SyncProgress | null
  googleLastSyncedAt?: Date | null
  onOpenGoogleDriveSync?: () => void
  onBulkImportMarkdown?: (folderId?: string | null) => void
  onBulkExportPdf?: (folderId?: string | null) => void
  onUploadPdf?: (folderId?: string | null) => void
  onSortFolder?: (folderId: string) => void
  onRenameNode?: (id: string) => void
  onDeleteNode?: (id: string) => void
  moveMode?: boolean
  movingNodeId?: string | null
  onMoveNode?: (id: string) => void
  onMoveTarget?: (folderId: string | null) => void
  onCancelMove?: () => void
  storagePersisted?: boolean | null
}

type DockDrawerKey = 'create' | 'import' | 'export' | null

function formatClinicalDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function Dashboard({
  nodes,
  templates,
  onSelectArticle,
  onOpenQuickCapture,
  onOpenSmartImport,
  onCreateNode,
  onCreateFromTemplate,
  onInstallPwa,
  canInstallPwa,
  dueFlashcardsCount = 0,
  totalFlashcardsCount = 0,
  onOpenStudy,
  onOpenAiSettings,
  userName = 'Médico de Guardia',
  theme = 'light',
  onToggleTheme,
  onOpenSecuritySettings,
  onLockTerminal,
  onOpenCommandPalette,
  favoriteIds = [],
  onToggleFavorite,
  showTemplatesFolder = true,
  onToggleTemplatesFolder,
  isGoogleConnected = false,
  isGoogleSessionExpired = false,
  googleHasPendingChanges = false,
  googleSyncState = 'idle',
  googleSyncProgress = null,
  googleLastSyncedAt = null,
  onOpenGoogleDriveSync,
  onBulkImportMarkdown,
  onBulkExportPdf,
  onUploadPdf,
  onSortFolder,
  onRenameNode,
  onDeleteNode,
  moveMode = false,
  movingNodeId = null,
  onMoveNode,
  onMoveTarget,
  onCancelMove,
  storagePersisted = null,
}: DashboardProps) {
  const allTags = useAllTags()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const taggedArticleIds = useArticlesWithTag(selectedTag)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [triageFilter, setTriageFilter] = useState<ClinicalTriageFilter>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null)
  const [activeDrawer, setActiveDrawer] = useState<DockDrawerKey>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const metaClinicalMarks = useLiveQuery(
    () => db.meta.get('clinical_marks'),
    [],
    undefined,
  )

  const clinicalMarks = useMemo(
    () => mergeClinicalMarks(metaClinicalMarks?.value, readAllClinicalMarks()),
    [metaClinicalMarks],
  )

  // Portabilidad ZIP local
  const zipInputRef = useRef<HTMLInputElement>(null)
  const [zipBusy, setZipBusy] = useState(false)
  const [zipReport, setZipReport] = useState<MergeReport | null>(null)
  const [zipError, setZipError] = useState<string | null>(null)

  const inboxFolder = useMemo(
    () => nodes.find((n) => n.kind === 'folder' && n.title === 'Inbox' && n.parent_id === null),
    [nodes],
  )
  const templatesFolder = useMemo(
    () =>
      nodes.find((n) => n.kind === 'folder' && n.title === 'Plantillas' && n.parent_id === null),
    [nodes],
  )
  const inboxChildren = useMemo(
    () => (inboxFolder ? childrenOf(nodes, inboxFolder.id) : []),
    [nodes, inboxFolder],
  )
  const inboxCount = inboxChildren.length

  const allArticles = useMemo(
    () => nodes.filter((n) => n.kind === 'article'),
    [nodes],
  )

  const triageCounts = useMemo(
    () => countArticlesByTriage(allArticles, clinicalMarks, inboxFolder?.id),
    [allArticles, clinicalMarks, inboxFolder?.id],
  )

  const triageFilteredArticles = useMemo(
    () =>
      filterArticlesByTriage(allArticles, clinicalMarks, inboxFolder?.id, triageFilter).sort(
        (a, b) => b.updated_at - a.updated_at,
      ),
    [allArticles, clinicalMarks, inboxFolder?.id, triageFilter],
  )

  const totalArticles = allArticles.length
  const totalFolders = useMemo(
    () =>
      nodes.filter(
        (n) => n.kind === 'folder' && n.title !== 'Plantillas' && n.title !== 'Inbox',
      ).length,
    [nodes],
  )

  const recentArticles = useMemo(
    () => triageFilteredArticles.slice(0, triageFilter === 'all' ? 6 : 12),
    [triageFilteredArticles, triageFilter],
  )

  const filteredByTagArticles = useMemo(() => {
    if (!selectedTag) return []
    return nodes.filter((n) => n.kind === 'article' && taggedArticleIds.includes(n.id))
  }, [nodes, selectedTag, taggedArticleIds])

  const folderMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of nodes) {
      if (n.kind === 'folder') map.set(n.id, n.title)
    }
    return map
  }, [nodes])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  // Carpetas raíz del repositorio (Inbox -> Especialidades -> Plantillas)
  const orderedRootFolders = useMemo(() => {
    const roots = childrenOf(nodes, null).filter((n) => n.kind === 'folder')
    const list: NodeRow[] = []
    if (inboxFolder) list.push(inboxFolder)
    for (const folder of roots) {
      if (folder.id === inboxFolder?.id || folder.id === templatesFolder?.id) continue
      list.push(folder)
    }
    if (templatesFolder && (showTemplatesFolder || searchQuery.trim().length > 0)) {
      list.push(templatesFolder)
    }
    return list
  }, [nodes, inboxFolder, templatesFolder, showTemplatesFolder, searchQuery])

  const rootArticles = useMemo(
    () => childrenOf(nodes, null).filter((n) => n.kind === 'article'),
    [nodes],
  )

  // Filtrado de carpetas y artículos por búsqueda o Favoritos
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredFolders = useMemo(() => {
    return orderedRootFolders.filter((folder) => {
      const folderMatchesFav =
        !showFavoritesOnly ||
        favoriteSet.has(folder.id) ||
        childrenOf(nodes, folder.id).some((child) => favoriteSet.has(child.id))
      if (!folderMatchesFav) return false

      if (!normalizedQuery) return true
      if (folder.title.toLowerCase().includes(normalizedQuery)) return true
      return childrenOf(nodes, folder.id).some((child) =>
        child.title.toLowerCase().includes(normalizedQuery),
      )
    })
  }, [orderedRootFolders, nodes, normalizedQuery, showFavoritesOnly, favoriteSet])

  const filteredRootArticles = useMemo(() => {
    return rootArticles.filter((art) => {
      if (showFavoritesOnly && !favoriteSet.has(art.id)) return false
      if (!normalizedQuery) return true
      return art.title.toLowerCase().includes(normalizedQuery)
    })
  }, [rootArticles, normalizedQuery, showFavoritesOnly, favoriteSet])

  // Cerrar menús flotantes con Escape o clic fuera
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('[data-folder-menu], [data-dock-drawer], [data-dock-trigger]')) {
        return
      }
      setActiveMenuFolderId(null)
      setActiveDrawer(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuFolderId(null)
        setActiveDrawer(null)
      }
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const toggleFolderExpand = (folderId: string) => {
    if (moveMode && onMoveTarget) {
      onMoveTarget(folderId)
      return
    }
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const isFolderExpanded = (folderId: string) => {
    if (normalizedQuery) return true
    if (folderId === inboxFolder?.id && inboxCount > 0 && !expandedIds.has(`closed:${folderId}`)) {
      return true
    }
    return expandedIds.has(folderId)
  }

  const handleToggleExpandFolder = (folderId: string) => {
    if (moveMode && onMoveTarget) {
      onMoveTarget(folderId)
      return
    }
    if (folderId === inboxFolder?.id && inboxCount > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(`closed:${folderId}`)) next.delete(`closed:${folderId}`)
        else next.add(`closed:${folderId}`)
        return next
      })
      return
    }
    toggleFolderExpand(folderId)
  }

  const handleExportZip = async () => {
    setZipBusy(true)
    setActiveDrawer(null)
    try {
      const blob = await exportToZip()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cuaderno-medico-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setZipError((e as Error).message || 'Error al generar el backup .zip')
    } finally {
      setZipBusy(false)
    }
  }

  const handleImportZipFile = async (file: File) => {
    setZipBusy(true)
    setActiveDrawer(null)
    try {
      const res = await importFromZip(file)
      setZipReport(res)
    } catch (e) {
      setZipError((e as Error).message || 'Error al importar el archivo .zip')
    } finally {
      setZipBusy(false)
      if (zipInputRef.current) zipInputRef.current.value = ''
    }
  }

  const isDark = theme === 'dark'
  const movingTitle = movingNodeId
    ? nodes.find((n) => n.id === movingNodeId)?.title || 'elemento'
    : 'elemento'

  return (
    <div
      className="clinical-home min-h-dvh w-full font-sans antialiased pb-28 transition-colors duration-150"
      data-home-theme={theme}
    >
      <div className="max-w-[1220px] mx-auto px-4 pt-4 pb-6 sm:px-6 sm:pt-5 sm:pb-8">
        {/* Cabecera Clínica Unificada */}
        <ClinicalStationHeader
          ariaLabel="Cabecera de estación clínica"
          theme={theme}
          userName={userName}
          canInstallPwa={canInstallPwa}
          onInstallPwa={onInstallPwa}
          onToggleTheme={onToggleTheme}
          onOpenSecuritySettings={onOpenSecuritySettings}
          onLockTerminal={onLockTerminal}
          isGoogleConnected={isGoogleConnected}
          isGoogleSessionExpired={isGoogleSessionExpired}
          googleHasPendingChanges={googleHasPendingChanges}
          googleSyncState={googleSyncState}
          googleSyncProgress={googleSyncProgress}
          googleLastSyncedAt={googleLastSyncedAt}
          onOpenGoogleDriveSync={onOpenGoogleDriveSync}
          left={
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-[42px] h-[42px] rounded-[10px] flex items-center justify-center shrink-0 transition-colors ${
                  isDark
                    ? 'bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] text-[var(--cl-success)]'
                    : 'bg-[var(--cl-fg)] text-white'
                }`}
                aria-hidden="true"
              >
                <Stethoscope className="w-5 h-5" />
              </div>

              <div className="min-w-0">
                <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-[-0.025em] leading-[1.15] text-[var(--cl-fg)] m-0 truncate">
                  ¡Hola, {userName}!
                </h1>
                <p className="font-mono tabular-nums text-xs text-[var(--cl-muted)] mt-1 mb-0 flex items-center gap-2 flex-wrap">
                  <span>
                    {totalArticles} {totalArticles === 1 ? 'artículo' : 'artículos'}
                  </span>
                  <span>·</span>
                  <span>
                    {totalFolders} {totalFolders === 1 ? 'especialidad' : 'especialidades'}
                  </span>
                  <span>·</span>
                  <span>{inboxCount} en Inbox</span>
                  <span>·</span>
                  <span>
                    {dueFlashcardsCount} {dueFlashcardsCount === 1 ? 'repaso SM-2' : 'repasos SM-2'}
                  </span>
                </p>
              </div>
            </div>
          }
        />

        {storagePersisted === false && (
          <div className="mb-4 px-3.5 py-2.5 rounded-[10px] border border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] text-[var(--cl-warn)] text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Almacenamiento no persistente en este navegador: exporta backups .zip o activa Google Drive con regularidad.
            </span>
          </div>
        )}

        {/* Grid Asimétrico 62 % Mi Repositorio / 38 % Panel de Guardia */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.58fr)_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
          {/* Columna Izquierda: Mi Repositorio + Buscar + Carpetas */}
          <section className="min-w-0" aria-label="Mi Repositorio clínico">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
              <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-[var(--cl-fg)] m-0">
                Mi Repositorio
              </h2>

              <div className="inline-flex items-center gap-2 min-h-[40px] w-full sm:w-auto sm:min-w-[248px] px-3.5 rounded-full border border-[var(--cl-border)] bg-[var(--cl-surface)] text-[var(--cl-muted)] focus-within:border-[var(--cl-accent)] transition-colors">
                <Search className="w-[15px] h-[15px] shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar protocolos…"
                  aria-label="Buscar en Mi Repositorio"
                  className="flex-1 min-w-0 border-none bg-transparent text-sm text-[var(--cl-fg)] placeholder:text-[var(--cl-muted)] focus:outline-none"
                />
                {onOpenCommandPalette && (
                  <button
                    type="button"
                    onClick={onOpenCommandPalette}
                    title="Abrir búsqueda global y comandos (Ctrl+K)"
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded-[5px] bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] text-[var(--cl-muted)] hover:text-[var(--cl-fg)] cursor-pointer shrink-0"
                  >
                    Ctrl+K
                  </button>
                )}
              </div>
            </div>

            {/* Subherramientas de Repositorio */}
            <div className="flex items-center gap-2 flex-wrap mb-3.5">
              <button
                type="button"
                onClick={() => onCreateNode('folder', null)}
                className="min-h-[36px] px-2.5 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-warm)] text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Nueva carpeta</span>
              </button>

              <button
                type="button"
                onClick={() => onCreateNode('article', null)}
                className="min-h-[36px] px-2.5 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] hover:bg-[var(--cl-surface-warm)] text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>Nuevo artículo</span>
              </button>

              {onToggleTemplatesFolder && (
                <button
                  type="button"
                  onClick={onToggleTemplatesFolder}
                  aria-pressed={showTemplatesFolder}
                  className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    showTemplatesFolder
                      ? 'border-[var(--cl-border)] bg-[var(--cl-surface)] text-[var(--cl-fg-2)] hover:bg-[var(--cl-surface-warm)]'
                      : 'border-[var(--cl-fg)] bg-[var(--cl-fg)] text-[var(--cl-bg)]'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>{showTemplatesFolder ? 'Ocultar plantillas' : 'Mostrar plantillas'}</span>
                </button>
              )}

              {favoriteIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly((prev) => !prev)}
                  aria-pressed={showFavoritesOnly}
                  className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    showFavoritesOnly
                      ? 'border-[var(--cl-fg)] bg-[var(--cl-fg)] text-[var(--cl-bg)]'
                      : 'border-[var(--cl-border)] bg-[var(--cl-surface)] text-[var(--cl-fg-2)] hover:bg-[var(--cl-surface-warm)]'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>Favoritos ({favoriteIds.length})</span>
                </button>
              )}
            </div>

            {/* Tira de Triage Clínico Unificado (Dirección A) */}
            <div
              className="flex flex-wrap items-center gap-1.5 mb-3"
              role="group"
              aria-label="Filtrar por estado de triage clínico"
            >
              {(
                [
                  { id: 'all', label: 'Todos', count: triageCounts.all },
                  { id: 'inbox', label: 'Inbox', count: triageCounts.inbox },
                  { id: 'critical', label: 'Críticos', count: triageCounts.critical },
                  { id: 'warning', label: 'Prioridad', count: triageCounts.warning },
                  { id: 'verified', label: 'Verificados', count: triageCounts.verified },
                ] as Array<{ id: ClinicalTriageFilter; label: string; count: number }>
              ).map((chip) => {
                const isActive = triageFilter === chip.id
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() =>
                      setTriageFilter((prev) => (prev === chip.id && chip.id !== 'all' ? 'all' : chip.id))
                    }
                    className={`min-h-[32px] px-2.5 py-1 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[var(--cl-accent)] border-[var(--cl-accent)] text-white'
                        : 'bg-[var(--cl-surface)] border-[var(--cl-border)] text-[var(--cl-fg-2)] hover:border-[var(--cl-accent)] hover:text-[var(--cl-fg)]'
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span className="font-mono tabular-nums text-[10px] opacity-85">
                      {chip.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {triageFilter !== 'all' && (
              <section className="mb-3 bg-[var(--cl-surface)] border border-[var(--cl-accent-border)] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--cl-diagnostic)]">
                    {triageFilter === 'inbox'
                      ? `Cola Inbox (${triageFilteredArticles.length})`
                      : `${CLINICAL_MARK_META[triageFilter].label} (${triageFilteredArticles.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTriageFilter('all')}
                    className="text-[11px] font-semibold text-[var(--cl-muted)] hover:text-[var(--cl-fg)] cursor-pointer"
                  >
                    Limpiar filtro
                  </button>
                </div>
                {triageFilteredArticles.length === 0 ? (
                  <p className="text-xs text-[var(--cl-muted)] m-0">
                    No hay protocolos en esta categoría de triage.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                    {triageFilteredArticles.slice(0, 12).map((art) => {
                      const mark = clinicalMarks[art.id]
                      const folderLabel = art.parent_id ? folderMap.get(art.parent_id) : 'Raíz'
                      return (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => onSelectArticle(art.id)}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] hover:border-[var(--cl-accent)] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-[var(--cl-fg)] truncate">
                              {art.title}
                            </span>
                            <span className="block font-mono text-[10px] text-[var(--cl-muted)] truncate">
                              {folderLabel}
                            </span>
                          </div>
                          {mark && (
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-full border font-mono text-[10px] font-bold ${CLINICAL_MARK_META[mark].badgeClass}`}
                            >
                              {CLINICAL_MARK_META[mark].shortLabel}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Banner Modo Mover */}
            {moveMode && onMoveTarget && onCancelMove && (
              <div className="mb-3 px-3.5 py-2.5 rounded-[10px] bg-[var(--cl-accent-soft)] border border-[var(--cl-accent-border)] text-[var(--cl-fg)] text-xs font-semibold flex items-center justify-between gap-3 flex-wrap">
                <span>
                  Moviendo «{movingTitle}». Haz clic en la carpeta destino o en la raíz.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMoveTarget(null)}
                    className="px-2.5 py-1 rounded-md bg-[var(--cl-surface)] border border-[var(--cl-border)] text-[var(--cl-fg)] text-xs font-semibold cursor-pointer"
                  >
                    Mover a la raíz
                  </button>
                  <button
                    type="button"
                    onClick={onCancelMove}
                    className="px-2.5 py-1 rounded-md border border-[var(--cl-border)] text-[var(--cl-muted)] hover:text-[var(--cl-fg)] text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Carpetas Expandibles */}
            {filteredFolders.length > 0 || filteredRootArticles.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {filteredFolders.map((folder) => {
                  const isInbox = folder.id === inboxFolder?.id
                  const isTpl = folder.id === templatesFolder?.id
                  const children = childrenOf(nodes, folder.id).filter((child) => {
                    if (showFavoritesOnly && !favoriteSet.has(child.id)) return false
                    if (!normalizedQuery) return true
                    return (
                      folder.title.toLowerCase().includes(normalizedQuery) ||
                      child.title.toLowerCase().includes(normalizedQuery)
                    )
                  })
                  const totalChildrenCount = childrenOf(nodes, folder.id).length
                  const expanded = isFolderExpanded(folder.id)
                  const menuOpen = activeMenuFolderId === folder.id

                  return (
                    <div
                      key={folder.id}
                      className="bg-[var(--cl-surface)] border border-[var(--cl-border)] hover:border-[var(--cl-fg-2)] rounded-xl transition-colors"
                      style={{ boxShadow: 'var(--cl-shadow-card)' }}
                    >
                      <div className="flex items-center justify-between gap-2.5 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleExpandFolder(folder.id)}
                          aria-expanded={expanded}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left bg-transparent border-none p-0 cursor-pointer"
                        >
                          <span
                            className={`w-[38px] h-[38px] rounded-lg flex items-center justify-center shrink-0 ${
                              isInbox
                                ? 'bg-[var(--cl-success-soft)] border border-[var(--cl-success-border)] text-[var(--cl-success)]'
                                : 'bg-[var(--cl-surface-warm)] text-[var(--cl-fg)]'
                            }`}
                            aria-hidden="true"
                          >
                            {isInbox ? (
                              <Inbox className="w-[18px] h-[18px]" />
                            ) : isTpl ? (
                              <ClipboardList className="w-[18px] h-[18px]" />
                            ) : expanded ? (
                              <FolderOpen className="w-[18px] h-[18px]" />
                            ) : (
                              <Folder className="w-[18px] h-[18px]" />
                            )}
                          </span>

                          <div className="min-w-0">
                            <div className="text-[15px] font-bold text-[var(--cl-fg)] truncate flex items-center gap-1.5">
                              <span className="truncate">{folder.title}</span>
                              {favoriteSet.has(folder.id) && (
                                <Star className="w-3.5 h-3.5 text-[var(--cl-diagnostic)] shrink-0 fill-current" />
                              )}
                            </div>
                            <p className="text-xs text-[var(--cl-muted)] truncate m-0">
                              {isInbox
                                ? 'Notas y fotos rápidas esperando organización'
                                : isTpl
                                  ? 'Modelos SOAP, patología, fármaco y urgencias'
                                  : `${totalChildrenCount} ${totalChildrenCount === 1 ? 'elemento clínico' : 'elementos clínicos'}`}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 relative" data-folder-menu>
                          <span className="font-mono tabular-nums text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--cl-surface-warm)] text-[var(--cl-fg-2)]">
                            {totalChildrenCount}
                          </span>

                          {!isTpl && (
                            <button
                              type="button"
                              onClick={() => onCreateNode('article', folder.id)}
                              title={`Nuevo artículo dentro de ${folder.title}`}
                              aria-label={`Nuevo artículo en ${folder.title}`}
                              className="w-8 h-8 rounded-[7px] text-[var(--cl-muted)] hover:text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}

                          {!isTpl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveMenuFolderId((prev) =>
                                  prev === folder.id ? null : folder.id,
                                )
                              }}
                              title={`Opciones de ${folder.title}`}
                              aria-label={`Opciones de ${folder.title}`}
                              aria-expanded={menuOpen}
                              className="w-8 h-8 rounded-[7px] text-[var(--cl-muted)] hover:text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onSelectArticle(folder.id)}
                            title={`Abrir vista completa de ${folder.title}`}
                            aria-label={`Abrir ${folder.title}`}
                            className="w-8 h-8 rounded-[7px] text-[var(--cl-muted)] hover:text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center justify-center cursor-pointer transition-colors"
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>

                          {menuOpen && (
                            <div
                              className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface)] p-1.5 shadow-xl"
                              role="menu"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuFolderId(null)
                                  onSelectArticle(folder.id)
                                }}
                                className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>Abrir explorador de carpeta</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuFolderId(null)
                                  onCreateNode('folder', folder.id)
                                }}
                                className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                              >
                                <FolderPlus className="w-3.5 h-3.5" />
                                <span>Nueva subcarpeta</span>
                              </button>
                              {onOpenSmartImport && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onOpenSmartImport(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Importar IA / Word aquí</span>
                                </button>
                              )}
                              {onBulkImportMarkdown && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onBulkImportMarkdown(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Importar Markdown (.md)</span>
                                </button>
                              )}
                              {onUploadPdf && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onUploadPdf(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <FileUp className="w-3.5 h-3.5" />
                                  <span>Subir PDF aquí</span>
                                </button>
                              )}
                              {onBulkExportPdf && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onBulkExportPdf(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Exportar carpeta a PDF</span>
                                </button>
                              )}
                              {onSortFolder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onSortFolder(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <ArrowUpDown className="w-3.5 h-3.5" />
                                  <span>Ordenar A–Z</span>
                                </button>
                              )}
                              {onMoveNode && !isInbox && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onMoveNode(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <FolderInput className="w-3.5 h-3.5" />
                                  <span>Mover carpeta</span>
                                </button>
                              )}
                              {onToggleFavorite && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onToggleFavorite(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                  <span>
                                    {favoriteSet.has(folder.id)
                                      ? 'Quitar de favoritos'
                                      : 'Anclar a favoritos'}
                                  </span>
                                </button>
                              )}
                              {onRenameNode && !isInbox && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onRenameNode(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-fg)] hover:bg-[var(--cl-surface-warm)] flex items-center gap-2 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Renombrar</span>
                                </button>
                              )}
                              {onDeleteNode && !isInbox && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuFolderId(null)
                                    onDeleteNode(folder.id)
                                  }}
                                  className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-[var(--cl-danger)] hover:bg-[var(--cl-danger-soft)] flex items-center gap-2 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] px-4 py-2.5 sm:pl-[66px] flex flex-col gap-1.5">
                          {children.length === 0 ? (
                            <p className="text-xs text-[var(--cl-muted)] py-1 m-0">
                              Carpeta vacía. Usa + para crear una ficha clínica aquí.
                            </p>
                          ) : (
                            children.map((child) => (
                              <div key={child.id} className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onSelectArticle(child.id)}
                                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[var(--cl-border-soft)] bg-[var(--cl-surface)] hover:border-[var(--cl-accent)] text-sm font-medium text-[var(--cl-fg)] flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                                >
                                  <span className="inline-flex items-center gap-2 min-w-0 truncate">
                                    {child.kind === 'folder' ? (
                                      <Folder className="w-3.5 h-3.5 text-[var(--cl-muted)] shrink-0" />
                                    ) : (
                                      <FileText className="w-3.5 h-3.5 text-[var(--cl-muted)] shrink-0" />
                                    )}
                                    <span className="truncate">{child.title}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 shrink-0">
                                    {clinicalMarks[child.id] && (
                                      <span
                                        className={`px-1.5 py-0.5 rounded-full border font-mono text-[10px] font-bold leading-none ${CLINICAL_MARK_META[clinicalMarks[child.id]].badgeClass}`}
                                      >
                                        {CLINICAL_MARK_META[clinicalMarks[child.id]].shortLabel}
                                      </span>
                                    )}
                                    <span className="font-mono tabular-nums text-[11px] text-[var(--cl-muted)]">
                                      {formatClinicalDate(child.updated_at)}
                                    </span>
                                  </span>
                                </button>

                                {onToggleFavorite && !isTpl && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleFavorite(child.id)}
                                    aria-label={
                                      favoriteSet.has(child.id)
                                        ? `Quitar ${child.title} de favoritos`
                                        : `Marcar ${child.title} como favorito`
                                    }
                                    className={`w-8 h-8 rounded-lg border border-transparent hover:border-[var(--cl-border)] hover:bg-[var(--cl-surface)] flex items-center justify-center shrink-0 cursor-pointer ${
                                      favoriteSet.has(child.id)
                                        ? 'text-[var(--cl-diagnostic)]'
                                        : 'text-[var(--cl-muted)]'
                                    }`}
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        favoriteSet.has(child.id) ? 'fill-current' : ''
                                      }`}
                                    />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Artículos en raíz si existen */}
                {filteredRootArticles.length > 0 && (
                  <div className="bg-[var(--cl-surface)] border border-[var(--cl-border)] rounded-xl p-3 flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-[var(--cl-muted)] px-1">
                      Fichas sueltas en raíz
                    </span>
                    {filteredRootArticles.map((art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => onSelectArticle(art.id)}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] hover:border-[var(--cl-accent)] text-sm font-medium text-[var(--cl-fg)] flex items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2 min-w-0 truncate">
                          <FileText className="w-3.5 h-3.5 text-[var(--cl-muted)] shrink-0" />
                          <span className="truncate">{art.title}</span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-[var(--cl-muted)] shrink-0">
                          {formatClinicalDate(art.updated_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--cl-surface)] border border-dashed border-[var(--cl-border)] rounded-[14px] p-7 text-center">
                <h3 className="text-base font-bold text-[var(--cl-fg)] m-0 mb-1.5">
                  {normalizedQuery || showFavoritesOnly
                    ? 'Sin coincidencias en el repositorio'
                    : 'Aún no hay carpetas creadas'}
                </h3>
                <p className="text-xs text-[var(--cl-muted)] m-0 mb-3">
                  {normalizedQuery || showFavoritesOnly
                    ? 'Limpia el filtro actual o abre la búsqueda global Ctrl+K.'
                    : 'Crea una carpeta por especialidad médica o comienza desde una plantilla.'}
                </p>
                {(normalizedQuery || showFavoritesOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setShowFavoritesOnly(false)
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-[var(--cl-fg)] text-[var(--cl-bg)] text-xs font-semibold cursor-pointer"
                  >
                    Mostrar todo el repositorio
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Columna Derecha (38 %): Panel de Guardia */}
          <aside className="flex flex-col gap-3.5 min-w-0" aria-label="Panel clínico de guardia">
            {/* Repaso Activo SM-2 */}
            <section className="bg-[var(--cl-surface-warm)] border border-[var(--cl-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-bold text-[var(--cl-fg)] m-0">Repaso Activo SM-2</h3>
                <span className="font-mono tabular-nums text-xs font-bold px-2.5 py-0.5 rounded-md bg-[var(--cl-surface)] border border-[var(--cl-border)] text-[var(--cl-fg-2)]">
                  {dueFlashcardsCount} para hoy
                </span>
              </div>
              <p className="text-xs text-[var(--cl-muted)] m-0 mb-2.5">
                {totalFlashcardsCount > 0
                  ? `${totalFlashcardsCount} flashcards médicas en tu mazo clínico con repetición espaciada.`
                  : 'Genera o practica tarjetas de repaso clínico desde tus propios protocolos.'}
              </p>
              {onOpenStudy && (
                <button
                  type="button"
                  onClick={onOpenStudy}
                  className="w-full min-h-[44px] rounded-[10px] bg-[var(--cl-accent)] hover:bg-[var(--cl-accent-hover)] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Brain className="w-4 h-4" />
                  <span>
                    {dueFlashcardsCount > 0
                      ? `Iniciar sesión SM-2 (${dueFlashcardsCount})`
                      : 'Practicar mazo SM-2'}
                  </span>
                </button>
              )}
            </section>

            {/* Modificados Recientemente / Cola de Triage */}
            <section className="bg-[var(--cl-surface)] border border-[var(--cl-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-bold text-[var(--cl-fg)] m-0 truncate">
                    {triageFilter === 'all'
                      ? 'Modificados recientemente'
                      : triageFilter === 'inbox'
                        ? `Inbox Triage (${recentArticles.length})`
                        : `Triage · ${CLINICAL_MARK_META[triageFilter].label} (${recentArticles.length})`}
                  </h3>
                </div>
                {triageFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setTriageFilter('all')}
                    className="text-[11px] font-semibold text-[var(--cl-diagnostic)] hover:underline cursor-pointer shrink-0"
                  >
                    Ver todos
                  </button>
                ) : (
                  <Activity className="w-4 h-4 text-[var(--cl-muted)]" aria-hidden="true" />
                )}
              </div>

              {recentArticles.length === 0 ? (
                <p className="text-xs text-[var(--cl-muted)] m-0">
                  {triageFilter === 'all'
                    ? 'Tus fichas clínicas editadas recientemente aparecerán aquí.'
                    : 'No hay fichas clínicas en este estado de triage.'}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentArticles.map((article) => {
                    const parentTitle = article.parent_id ? folderMap.get(article.parent_id) : null
                    const mark = clinicalMarks[article.id]
                    return (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => onSelectArticle(article.id)}
                        className="w-full px-2.5 py-2 rounded-lg bg-[var(--cl-surface-muted)] border border-[var(--cl-border-soft)] hover:border-[var(--cl-accent)] text-xs text-[var(--cl-fg)] flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                      >
                        <span className="truncate font-medium min-w-0 flex-1">{article.title}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {mark && (
                            <span
                              className={`px-1.5 py-0.5 rounded-full border font-mono text-[10px] font-bold leading-none ${CLINICAL_MARK_META[mark].badgeClass}`}
                            >
                              {CLINICAL_MARK_META[mark].shortLabel}
                            </span>
                          )}
                          <span className="text-[11px] text-[var(--cl-muted)]">
                            {parentTitle || formatClinicalDate(article.updated_at)}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Síntomas y Plantillas */}
            <section className="bg-[var(--cl-surface)] border border-[var(--cl-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h3 className="text-sm font-bold text-[var(--cl-fg)] m-0">Síntomas y plantillas</h3>
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="text-[11px] font-semibold text-[var(--cl-diagnostic)] hover:underline cursor-pointer"
                  >
                    Limpiar #{selectedTag}
                  </button>
                )}
              </div>

              {allTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-3" aria-label="Filtrar por etiqueta clínica">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`min-h-[30px] px-2.5 py-1 rounded-md border font-mono text-[11px] font-semibold cursor-pointer transition-colors ${
                        selectedTag === tag
                          ? 'bg-[var(--cl-fg)] text-[var(--cl-bg)] border-[var(--cl-fg)]'
                          : 'bg-[var(--cl-surface-muted)] border-[var(--cl-border)] text-[var(--cl-fg-2)] hover:border-[var(--cl-accent)]'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--cl-muted)] m-0 mb-3">
                  Añade etiquetas a tus fichas para filtrar síntomas o especialidades aquí.
                </p>
              )}

              {selectedTag && (
                <div className="mb-3 p-2.5 rounded-lg bg-[var(--cl-surface-muted)] border border-[var(--cl-border-soft)] flex flex-col gap-1.5">
                  <p className="text-[11px] font-bold text-[var(--cl-muted)] m-0">
                    {filteredByTagArticles.length === 0
                      ? `Sin fichas para #${selectedTag}`
                      : `Fichas con #${selectedTag} (${filteredByTagArticles.length}):`}
                  </p>
                  {filteredByTagArticles.map((art) => (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => onSelectArticle(art.id)}
                      className="w-full px-2.5 py-1.5 rounded-md bg-[var(--cl-surface)] border border-[var(--cl-border-soft)] hover:border-[var(--cl-accent)] text-xs font-medium text-[var(--cl-fg)] text-left truncate cursor-pointer"
                    >
                      {art.title}
                    </button>
                  ))}
                </div>
              )}

              {templates.length > 0 && (
                <select
                  defaultValue=""
                  aria-label="Crear artículo desde plantilla médica"
                  onChange={(e) => {
                    const val = e.currentTarget.value
                    e.currentTarget.value = ''
                    if (val) onCreateFromTemplate(val)
                  }}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] text-xs font-semibold text-[var(--cl-fg)] cursor-pointer"
                >
                  <option value="" disabled>
                    Crear desde plantilla médica ({templates.length})…
                  </option>
                  {templates.map((tpl) => (
                    <option key={tpl.node.id} value={tpl.node.title}>
                      {tpl.node.title}
                    </option>
                  ))}
                </select>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* Cajón Interactivo del Dock Inferior */}
      {activeDrawer && (
        <div
          data-dock-drawer
          role="dialog"
          aria-label="Herramientas de estación clínica"
          className="fixed bottom-[86px] left-1/2 -translate-x-1/2 w-[min(560px,calc(100vw-24px))] rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-surface)] p-4 z-50"
          style={{ boxShadow: 'var(--cl-shadow-dock)' }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-[var(--cl-fg)] m-0">
              {activeDrawer === 'create'
                ? 'Crear o capturar en estación clínica'
                : activeDrawer === 'import'
                  ? 'Importar contenido al cuaderno'
                  : 'Exportar y respaldar cuaderno'}
            </h3>
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              aria-label="Cerrar panel"
              className="w-8 h-8 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] text-[var(--cl-fg-2)] hover:text-[var(--cl-fg)] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {activeDrawer === 'create' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setActiveDrawer(null)
                  onCreateNode('article', null)
                }}
                className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
              >
                <span className="block text-xs font-bold text-[var(--cl-fg)]">
                  Nuevo artículo en blanco
                </span>
                <span className="block text-[11px] text-[var(--cl-muted)]">
                  Apuntes Markdown, KaTeX y Mermaid
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveDrawer(null)
                  onOpenQuickCapture()
                }}
                className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
              >
                <span className="block text-xs font-bold text-[var(--cl-fg)]">
                  Captura rápida a 1 toque
                </span>
                <span className="block text-[11px] text-[var(--cl-muted)]">
                  Foto de urgencias o nota directa al Inbox
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveDrawer(null)
                  onCreateNode('folder', null)
                }}
                className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
              >
                <span className="block text-xs font-bold text-[var(--cl-fg)]">
                  Nueva carpeta / tema
                </span>
                <span className="block text-[11px] text-[var(--cl-muted)]">
                  Organiza por especialidad o rotación
                </span>
              </button>

              {templates.length > 0 && (
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplatePicker((prev) => !prev)}
                    aria-expanded={showTemplatePicker}
                    className="w-full min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <span className="block text-xs font-bold text-[var(--cl-fg)]">
                        Desde plantilla clínica ({templates.length})
                      </span>
                      <span className="block text-[11px] text-[var(--cl-muted)]">
                        Elige cualquiera de las {templates.length} estructuras clínicas disponibles
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-[var(--cl-diagnostic)] transition-transform shrink-0 ${
                        showTemplatePicker ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {showTemplatePicker && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-1.5 rounded-[10px] border border-[var(--cl-border-soft)] bg-[var(--cl-surface)]">
                      {templates.map((tpl) => (
                        <button
                          key={tpl.node.id}
                          type="button"
                          onClick={() => {
                            setShowTemplatePicker(false)
                            setActiveDrawer(null)
                            onCreateFromTemplate(tpl.node.title)
                          }}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[var(--cl-border-soft)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-accent-soft)] hover:border-[var(--cl-accent)] text-left text-xs font-semibold text-[var(--cl-fg)] truncate cursor-pointer transition-colors"
                          title={tpl.node.title}
                        >
                          {tpl.node.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeDrawer === 'import' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {onOpenSmartImport && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null)
                    onOpenSmartImport(null)
                  }}
                  className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
                >
                  <span className="block text-xs font-bold text-[var(--cl-fg)]">
                    Importar Texto / Word / IA
                  </span>
                  <span className="block text-[11px] text-[var(--cl-muted)]">
                    Pega desde ChatGPT o carga archivo .docx
                  </span>
                </button>
              )}

              {onBulkImportMarkdown && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null)
                    onBulkImportMarkdown(null)
                  }}
                  className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
                >
                  <span className="block text-xs font-bold text-[var(--cl-fg)]">
                    Importar Markdown (.md)
                  </span>
                  <span className="block text-[11px] text-[var(--cl-muted)]">
                    Importación masiva de archivos y carpetas
                  </span>
                </button>
              )}

              {onUploadPdf && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null)
                    onUploadPdf(null)
                  }}
                  className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
                >
                  <span className="block text-xs font-bold text-[var(--cl-fg)]">
                    Subir documento PDF
                  </span>
                  <span className="block text-[11px] text-[var(--cl-muted)]">
                    Lectura clínica con anotaciones locales
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={zipBusy}
                onClick={() => zipInputRef.current?.click()}
                className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer disabled:opacity-50"
              >
                <span className="block text-xs font-bold text-[var(--cl-fg)]">
                  {zipBusy ? 'Importando backup…' : 'Importar backup (.zip)'}
                </span>
                <span className="block text-[11px] text-[var(--cl-muted)]">
                  Fusión segura con tu cuaderno actual
                </span>
              </button>
            </div>
          )}

          {activeDrawer === 'export' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {onBulkExportPdf && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null)
                    onBulkExportPdf(null)
                  }}
                  className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
                >
                  <span className="block text-xs font-bold text-[var(--cl-fg)]">
                    Exportar compendio a PDF
                  </span>
                  <span className="block text-[11px] text-[var(--cl-muted)]">
                    Selecciona temas para impresión hospitalaria
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={zipBusy}
                onClick={() => void handleExportZip()}
                className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer disabled:opacity-50"
              >
                <span className="block text-xs font-bold text-[var(--cl-fg)]">
                  {zipBusy ? 'Exportando .zip…' : 'Exportar backup (.zip)'}
                </span>
                <span className="block text-[11px] text-[var(--cl-muted)]">
                  Copia de seguridad completa offline
                </span>
              </button>

              {onOpenGoogleDriveSync && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawer(null)
                    onOpenGoogleDriveSync()
                  }}
                  className="min-h-[48px] px-3 py-2 rounded-[10px] border border-[var(--cl-border)] bg-[var(--cl-surface-muted)] hover:bg-[var(--cl-surface-warm)] hover:border-[var(--cl-accent)] text-left cursor-pointer"
                >
                  <span className="block text-xs font-bold text-[var(--cl-fg)]">
                    Respaldo en Google Drive
                  </span>
                  <span className="block text-[11px] text-[var(--cl-muted)]">
                    Configura sincronización en la nube
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Barra Inferior Flotante en Píldora con Círculo Central */}
      <ClinicalBottomDock
        ariaLabel="Barra inferior de herramientas"
        dockTrigger={true}
        zIndexClass="z-40"
        orbLabel="Menú principal de creación y captura rápida"
        orbTitle="Crear o capturar rápidamente"
        onOrbClick={() => setActiveDrawer((prev) => (prev === 'create' ? null : 'create'))}
        orbIcon={<Plus className="w-6 h-6 stroke-[2.4]" />}
        left={
          <>
            <button
              type="button"
              onClick={() => {
                setActiveDrawer(null)
                setShowTemplatePicker(false)
                setTriageFilter((prev) => (prev === 'inbox' ? 'all' : 'inbox'))
              }}
              title="Filtrar o revisar notas en Inbox Triage"
              aria-label={`Triage Inbox (${inboxCount})`}
              className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${
                triageFilter === 'inbox'
                  ? DOCK_BTN_ACTIVE
                  : DOCK_BTN_IDLE
              }`}
            >
              <Inbox className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Inbox</span>
              {inboxCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--cl-accent)] text-white text-[10px] font-bold tabular-nums leading-none">
                  {inboxCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenQuickCapture}
              title="Captura rápida a 1 toque (foto + nota) al Inbox"
              aria-label="Captura rápida"
              className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Captura</span>
            </button>

            {onOpenStudy && (
              <button
                type="button"
                onClick={onOpenStudy}
                title="Repaso activo de flashcards SM-2"
                aria-label="Repaso SM-2"
                className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
              >
                <Brain className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">SM-2</span>
              </button>
            )}
          </>
        }
        right={
          <>
            <button
              type="button"
              onClick={() => setActiveDrawer((prev) => (prev === 'import' ? null : 'import'))}
              title="Importar Texto, Markdown, PDF o Backup .zip"
              aria-label="Importar"
              className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${
                activeDrawer === 'import'
                  ? DOCK_BTN_ACTIVE
                  : DOCK_BTN_IDLE
              }`}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Importar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDrawer((prev) => (prev === 'export' ? null : 'export'))}
              title="Exportar compendio PDF, Backup .zip o Google Drive"
              aria-label="Exportar"
              className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${
                activeDrawer === 'export'
                  ? DOCK_BTN_ACTIVE
                  : DOCK_BTN_IDLE
              }`}
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {onOpenAiSettings && (
              <button
                type="button"
                onClick={onOpenAiSettings}
                title="Ajustes de IA Clínica"
                aria-label="IA Clínica"
                className={`inline-flex sm:px-3 ${DOCK_BTN_BASE} ${DOCK_BTN_IDLE}`}
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">IA Clínica</span>
              </button>
            )}
          </>
        }
      />

      {/* Input oculto para importar backup .zip */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImportZipFile(file)
        }}
      />

      {zipReport && (
        <AlertDialog
          isOpen={true}
          title="Importación Completada"
          onClose={() => setZipReport(null)}
          content={
            <div className="import-report-dialog">
              <p className="import-report-lead">
                Los datos se han fusionado con éxito en tu base local:
              </p>
              <div className="import-report-stats">
                <div className="report-stat-row">
                  <strong>Carpetas y Nodos:</strong>
                  <span>
                    +{zipReport.nodesAdded} nuevos · ~{zipReport.nodesUpdated} actualizados · -
                    {zipReport.nodesDeleted} eliminados · {zipReport.nodesSkipped} intactos
                  </span>
                </div>
                <div className="report-stat-row">
                  <strong>Artículos:</strong>
                  <span>
                    +{zipReport.articlesAdded} nuevos · ~{zipReport.articlesUpdated} actualizados ·{' '}
                    {zipReport.articlesSkipped} intactos
                  </span>
                </div>
                <div className="report-stat-row">
                  <strong>Imágenes / Assets:</strong>
                  <span>
                    +{zipReport.assetsAdded} añadidos · {zipReport.assetsSkipped} existentes
                  </span>
                </div>
              </div>
            </div>
          }
        />
      )}

      {zipError && (
        <AlertDialog
          isOpen={true}
          title="Error al importar"
          onClose={() => setZipError(null)}
          content={<p className="dialog-error-text">{zipError}</p>}
        />
      )}
    </div>
  )
}
