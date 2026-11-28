import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react'
import {
  useAllNodes,
  useArticle,
  useStoragePersisted,
  useTemplates,
} from './hooks/useNodes'
import { useBacklinks } from './hooks/useBacklinks'
import { useTheme } from './hooks/useTheme'
import { useFavorites } from './hooks/useFavorites'
import { useAuth } from './hooks/useAuth'
import { LoginView } from './components/auth/LoginView'
import { SecuritySettingsModal } from './components/auth/SecuritySettingsModal'
import { checkServerAuthSession, initiateGoogleLoginFlow } from './pwa/googleAuth'
import { useGoogleSync } from './hooks/useGoogleSync'
import { useGoogleCalendar } from './hooks/useGoogleCalendar'
import { usePWAUpdate } from './hooks/usePWAUpdate'
import { usePwaInstall } from './hooks/usePwaInstall'
import { FolderExplorerView } from './components/tree/FolderExplorerView'
import type { MarkdownEditorHandle } from './components/editor/MarkdownEditor'
import {
  ArticleReader,
  matchPdfBlock,
  parseMarkdownBlocks,
  prepareTemplateDocument,
} from './components/reader/ArticleReader'
import { ArticleWorkspaceView } from './components/reader/ArticleWorkspaceView'
import { QuickCapture } from './components/capture/QuickCapture'
import { SmartImportModal } from './components/editor/SmartImportModal'
import { BulkImportModal } from './components/portability/BulkImportModal'
import { UploadPdfModal } from './components/portability/UploadPdfModal'
import type { BulkImportResult } from './db/bulkArticles'
import type { SavedPdfArticleResult } from './db/pdfArticles'
import { StudyModal } from './components/flashcards/StudyModal'
import { DecksModal } from './components/decks/DecksModal'
import { ArticleFlashcardsModal } from './components/flashcards/ArticleFlashcardsModal'
import { AiSettingsModal } from './components/settings/AiSettingsModal'
import { getDueFlashcards, getAllFlashcards } from './db/flashcards'
import type {
  ArticleRow,
  CalendarEventDraft,
  CalendarEventRow,
  FlashcardRow,
  NodeRow,
} from './db/db'
import { GoogleDriveModal } from './components/portability/GoogleDriveModal'
import { CalendarModal } from './components/calendar/CalendarModal'
import { CalendarEventFormModal } from './components/calendar/CalendarEventFormModal'
import { clearLocalCalendarData } from './db/calendar'
import { setLastCalendarSyncTime } from './pwa/calendarSync'
import { GOOGLE_SCOPES_KEY, setCalendarSyncEnabled } from './pwa/googleDrive'
import { IosInstallModal } from './components/portability/IosInstallModal'
import { ExportPdfModal, type ExportPdfOptions } from './components/portability/ExportPdfModal'
import { BulkExportPdfModal, type BulkExportPdfOptions } from './components/portability/BulkExportPdfModal'
import { UpdateToast } from './components/pwa/UpdateToast'
import { CommandPalette } from './components/search/CommandPalette'
import { Dashboard } from './components/dashboard/Dashboard'
import {
  PromptDialog,
  ConfirmDialog,
  AlertDialog,
} from './components/common/DialogModal'
import { Toast } from './components/common/Toast'
import { ensurePersistentStorage } from './pwa/persistence'
import { pathTo } from './domain/tree'
import { db } from './db/db'
import {
  createNode,
  renameNode,
  moveNode,
  deleteNodeCascade,
  deduplicateSystemNodes,
  sortChildrenInFolder,
} from './db/nodes'
import { saveArticle } from './db/articles'
import { ensureInboxFolder } from './db/inbox'
import {
  fillTitlePlaceholder,
  seedTemplatesIfNeeded,
} from './db/templates'
import {
  preloadMermaidInArticles,
  waitForPrintReady,
} from './utils/printUtils'

type PromptState =
  | {
      type: 'create-node'
      kind: 'folder' | 'article'
      parentId: string | null
    }
  | {
      type: 'create-from-template'
      templateTitle: string
      parentId: string | null
    }
  | {
      type: 'rename-node'
      nodeId: string
      currentTitle: string
    }
  | null

type DeleteState = {
  nodeId: string
  title: string
  isFolder: boolean
} | null

const GoogleDocsExportModal = lazy(() =>
  import('./components/portability/GoogleDocsExportModal').then((m) => ({
    default: m.GoogleDocsExportModal,
  }))
)

function App() {
  const nodes = useAllNodes()
  const templates = useTemplates()
  const { theme, toggleTheme } = useTheme()
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const {
    isConnected: isGoogleConnected,
    isSessionExpired: isGoogleSessionExpired,
    hasPendingChanges: googleHasPendingChanges,
    syncState: googleSyncState,
    syncProgress: googleSyncProgress,
    lastSyncedAt: googleLastSyncedAt,
    lastCheckedAt: googleLastCheckedAt,
    errorMessage: googleErrorMessage,
    userEmail: googleUserEmail,
    connectWithToken: connectGoogleToken,
    disconnect: disconnectGoogle,
    triggerSync: triggerGoogleSync,
    initiateOAuthLogin: initiateGoogleOAuth,
  } = useGoogleSync()
  const {
    user,
    isAuthenticated,
    securityProfile,
    protectionConfigured,
    pinEnabled,
    pinLength,
    lockedUntil,
    hasPasskeys,
    loginWithPin,
    loginWithFido,
    completeGoogleLogin,
    linkGoogleAccount,
    setupInitialPin,
    setupOrChangePin,
    removePin,
    registerInitialPasskey,
    registerDevicePasskey,
    removeDevicePasskey,
    resetLocalTerminalSecurity,
    logout,
  } = useAuth()
  const { ownerEmail, ownerName, ownerAvatarUrl } = securityProfile
  const calendar = useGoogleCalendar({ fallbackEmail: ownerEmail })
  const {
    isEnabled: isCalendarEnabled,
    isOnline: isCalendarOnline,
    isSessionExpired: isCalendarSessionExpired,
    needsCalendarConsent,
    syncState: calendarSyncState,
    lastSyncedAt: calendarLastSyncedAt,
    errorMessage: calendarErrorMessage,
    noticeMessage: calendarNoticeMessage,
    pendingCount: calendarPendingCount,
    calendars: calendarCalendars,
    events: calendarEvents,
    connectCalendar,
    disconnectCalendar,
    triggerSync: triggerCalendarSync,
    createEvent: createCalendarEvent,
    updateEvent: updateCalendarEvent,
    deleteEvent: deleteCalendarEvent,
    toggleCalendarVisibility,
    ensureRangeLoaded: ensureCalendarRangeLoaded,
    clearNotice: clearCalendarNotice,
  } = calendar

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveMode, setMoveMode] = useState(false)
  const [movingNodeId, setMovingNodeId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false)
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false)
  const [calendarFormState, setCalendarFormState] = useState<{
    isOpen: boolean
    event: CalendarEventRow | null
    defaultDateYmd?: string
  }>({
    isOpen: false,
    event: null,
  })
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false)
  const [googleLoginError, setGoogleLoginError] = useState<string | null>(null)
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false)
  const [smartImportFolderId, setSmartImportFolderId] = useState<string | null>(null)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [bulkImportFolderId, setBulkImportFolderId] = useState<string | null>(null)
  const [isUploadPdfOpen, setIsUploadPdfOpen] = useState(false)
  const [uploadPdfFolderId, setUploadPdfFolderId] = useState<string | null>(null)
  const [promptState, setPromptState] = useState<PromptState>(null)
  const [deleteState, setDeleteState] = useState<DeleteState>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Estados de Flashcards y Repaso Activo SM-2
  const [isStudyModalOpen, setIsStudyModalOpen] = useState(false)
  const [isDecksModalOpen, setIsDecksModalOpen] = useState(false)
  const [studyDeck, setStudyDeck] = useState<FlashcardRow[]>([])
  const [isArticleFlashcardsOpen, setIsArticleFlashcardsOpen] = useState(false)
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false)
  const [dueFlashcardsCount, setDueFlashcardsCount] = useState(0)
  const [totalFlashcardsCount, setTotalFlashcardsCount] = useState(0)

  // Estados y flujo de Exportación a PDF
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false)
  const [printOptions, setPrintOptions] = useState<ExportPdfOptions>({
    columns: '2',
    includeHeader: true,
    includeTags: true,
  })
  const [isBulkExportPdfOpen, setIsBulkExportPdfOpen] = useState(false)
  const [bulkExportPdfFolderId, setBulkExportPdfFolderId] = useState<string | null>(null)
  const [bulkExportPdfSelectedIds, setBulkExportPdfSelectedIds] = useState<string[] | null>(null)
  const [bulkPrintState, setBulkPrintState] = useState<{
    active: boolean
    items: Array<{ node: NodeRow; article?: ArticleRow }>
    options: BulkExportPdfOptions
  } | null>(null)

  // Estado de Exportación a Google Docs
  const [googleDocsExportState, setGoogleDocsExportState] = useState<{
    isOpen: boolean
    title: string
    markdown: string
    folderPath?: string
    tags?: string[]
  }>({
    isOpen: false,
    title: '',
    markdown: '',
  })

  // Visibilidad de Carpeta de Plantillas
  const [showTemplatesFolder, setShowTemplatesFolder] = useState<boolean>(
    () => localStorage.getItem('sindecon_show_templates_folder') !== 'false',
  )

  const toggleTemplatesFolder = useCallback(() => {
    setShowTemplatesFolder((prev) => {
      const next = !prev
      localStorage.setItem('sindecon_show_templates_folder', String(next))
      return next
    })
  }, [])

  const refreshFlashcardCounts = useCallback(async () => {
    try {
      const due = await getDueFlashcards()
      const all = await getAllFlashcards()
      setDueFlashcardsCount(due.length)
      setTotalFlashcardsCount(all.length)
    } catch {
      // Ignorar en ciclo inicial
    }
  }, [])

  useEffect(() => {
    refreshFlashcardCounts()
  }, [refreshFlashcardCounts, selectedId])

  const handleStartDeckStudy = async (cardIds: string[]) => {
    const cards = (await db.flashcards.bulkGet(cardIds)).filter(
      (card): card is FlashcardRow => Boolean(card),
    )
    if (cards.length === 0) {
      setToastMessage('Descarga un bloque del mazo antes de estudiarlo.')
      return
    }
    setStudyDeck(cards)
    setIsDecksModalOpen(false)
    setIsStudyModalOpen(true)
  }

  const handleStartGeneralStudy = async (nodeIdsFilter?: string[]) => {
    const due = await getDueFlashcards()
    const all = await getAllFlashcards()
    const baseCards = due.length > 0 ? due : all
    let targetCards = baseCards
    if (Array.isArray(nodeIdsFilter) && nodeIdsFilter.length > 0) {
      const allowed = new Set(nodeIdsFilter)
      const folderDue = due.filter((c) => allowed.has(c.node_id))
      const folderAll = all.filter((c) => allowed.has(c.node_id))
      targetCards = folderDue.length > 0 ? folderDue : folderAll
    }
    if (targetCards.length === 0) {
      setToastMessage('No tienes flashcards en el mazo. Puedes crearlas o generarlas en cualquier artículo.')
      return
    }
    setStudyDeck(targetCards)
    setIsStudyModalOpen(true)
  }

  // Hook de Actualización PWA y Sondeo Activo
  const { needRefresh, updateApp, closeToast } = usePWAUpdate()

  // Hook de Instalación PWA
  const {
    canInstall: canInstallPwa,
    showIosGuide,
    triggerInstall: triggerInstallPwa,
    closeIosGuide,
  } = usePwaInstall()

  const storagePersisted = useStoragePersisted()
  const editorRef = useRef<MarkdownEditorHandle | null>(null)

  // Para el artículo recién creado o importado: guardamos el body en local state
  // para evitar la carrera con useLiveQuery (el editor podría montar
  // brevemente con body vacío y sobrescribir el contenido sembrado).
  const [seedBody, setSeedBody] = useState<string | null>(null)
  const [editorRevision, setEditorRevision] = useState(0)

  useEffect(() => {
    void (async () => {
      await ensurePersistentStorage()
      await seedTemplatesIfNeeded()
      await ensureInboxFolder()
      await deduplicateSystemNodes()
    })()
  }, [])

  // Listener global para atajo Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const article = useArticle(selected?.kind === 'article' ? selected.id : null)
  const backlinks = useBacklinks(selected?.kind === 'article' ? selected.id : null)

  // Actualizar título de la pestaña con el artículo activo
  useEffect(() => {
    if (selected && selected.kind === 'article' && selected.title) {
      document.title = `${selected.title} — SINDECON`
    } else {
      document.title = 'SINDECON — Cuaderno Médico'
    }
  }, [selected])

  const handleConfirmExportPdf = async (options: ExportPdfOptions) => {
    setPrintOptions(options)
    setIsExportPdfOpen(false)

    // Si estamos en modo editor, asegurar que el último texto tipeado se guarde
    if (editorRef.current && selected?.id && isEditMode) {
      try {
        const liveMd = editorRef.current.getMarkdown()
        if (liveMd !== undefined) {
          saveArticle(selected.id, liveMd)
        }
      } catch {}
    }

    // Precargar esquemas mermaid del artículo antes de imprimir
    await preloadMermaidInArticles([currentBody])

    const previousTitle = document.title
    const cleanArticleTitle = (selected?.title || 'Artículo').replace(/[\\/:*?"<>|]/g, '-').trim()
    // Asignar el nombre exacto del artículo para que el navegador sugiera este nombre al guardar el PDF
    document.title = cleanArticleTitle

    document.body.classList.remove('print-columns-1', 'print-columns-2')
    document.body.classList.add(
      'printing-active',
      options.columns === '2' ? 'print-columns-2' : 'print-columns-1'
    )

    const cleanupPrint = () => {
      document.body.classList.remove('printing-active', 'print-columns-1', 'print-columns-2')
      document.title = previousTitle
      window.removeEventListener('afterprint', cleanupPrint)
    }

    window.addEventListener('afterprint', cleanupPrint)

    // Esperar de forma determinista a que el documento y sus diagramas estén listos
    await waitForPrintReady('print-article-document')

    document.title = cleanArticleTitle
    window.print()
    setTimeout(cleanupPrint, 800)
  }

  const handleOpenBulkExportPdf = (
    folderId?: string | null,
    selectedIds?: string[] | null,
  ) => {
    setBulkExportPdfFolderId(folderId !== undefined ? folderId : null)
    setBulkExportPdfSelectedIds(
      selectedIds && selectedIds.length > 0 ? [...selectedIds] : null,
    )
    setIsBulkExportPdfOpen(true)
  }

  const handleConfirmBulkExportPdf = async (
    selectedNodeIds: string[],
    options: BulkExportPdfOptions,
  ) => {
    setIsBulkExportPdfOpen(false)
    if (selectedNodeIds.length === 0) return

    try {
      const articles = await db.articles.where('node_id').anyOf(selectedNodeIds).toArray()
      const articleMap = new Map(articles.map((a) => [a.node_id, a]))
      const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
      const items = selectedNodes.map((node) => ({ node, article: articleMap.get(node.id) }))

      // 1. Precargar y renderizar en caché todos los diagramas mermaid de los artículos
      const markdowns = items.map((it) => it.article?.body_md || '')
      await preloadMermaidInArticles(markdowns)

      // 2. Montar el contenedor de impresión masiva en el DOM
      setBulkPrintState({ active: true, items, options })

      const previousTitle = document.title
      const cleanTitle = (options.compilationTitle || 'Compendio Medico - SINDECON')
        .replace(/[\\/:*?"<>|]/g, '-')
        .trim()
      document.title = cleanTitle

      document.body.classList.remove('print-columns-1', 'print-columns-2', 'print-break-between')
      document.body.classList.add(
        'printing-active',
        options.columns === '2' ? 'print-columns-2' : 'print-columns-1',
      )
      if (options.pageBreakBetween) {
        document.body.classList.add('print-break-between')
      }

      const cleanupPrint = () => {
        document.body.classList.remove(
          'printing-active',
          'print-columns-1',
          'print-columns-2',
          'print-break-between',
        )
        document.title = previousTitle
        setBulkPrintState(null)
        window.removeEventListener('afterprint', cleanupPrint)
      }

      window.addEventListener('afterprint', cleanupPrint)

      // 3. Esperar de forma determinista a que todos los esquemas, fuentes e imágenes estén listos
      await waitForPrintReady('print-bulk-document')

      document.title = cleanTitle
      window.print()
      setTimeout(cleanupPrint, 1000)
    } catch (err) {
      console.error('Error preparando compendio PDF:', err)
      setToastMessage('Ocurrió un error al preparar los artículos para exportar a PDF')
    }
  }

  // Búsqueda de carpeta Inbox y cálculo de conteo de pendientes
  const inboxFolder = nodes.find(
    (n) => n.kind === 'folder' && n.title === 'Inbox' && n.parent_id === null,
  )
  const isArticleReady =
    selected?.kind === 'article' &&
    (seedBody !== null || article === null || article?.node_id === selected.id)
  const currentBody =
    (selected?.kind === 'article' && article?.node_id === selected.id
      ? article.body_md
      : null) ??
    seedBody ??
    ''

  const targetFolderId = selected
    ? selected.kind === 'folder'
      ? selected.id
      : selected.parent_id
    : null

  const isPdfArticle = useMemo(() => {
    if (selected?.kind !== 'article' || !currentBody) return false
    return matchPdfBlock(currentBody.trim()) !== null
  }, [selected?.kind, currentBody])

  const effectiveEditMode = isEditMode && !isPdfArticle

  useEffect(() => {
    if (isPdfArticle && isEditMode) {
      setIsEditMode(false)
    }
  }, [isPdfArticle, isEditMode])

  const selectArticle = (id: string) => {
    setSelectedId(id)
    setMoveMode(false)
    setSeedBody(null)
  }

  // --- Manejo de Creación y Edición mediante Diálogos Modales ---
  const handleOpenCreatePrompt = (
    kind: 'folder' | 'article',
    parentId: string | null = targetFolderId,
  ) => {
    setPromptState({
      type: 'create-node',
      kind,
      parentId,
    })
  }

  const handleOpenTemplatePrompt = (
    templateTitle: string,
    parentId: string | null = targetFolderId,
  ) => {
    setPromptState({
      type: 'create-from-template',
      templateTitle,
      parentId,
    })
  }

  const handleOpenRenamePrompt = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setPromptState({
      type: 'rename-node',
      nodeId: node.id,
      currentTitle: node.title,
    })
  }

  const handleOpenDeleteConfirm = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setDeleteState({
      nodeId: node.id,
      title: node.title,
      isFolder: node.kind === 'folder',
    })
  }

  const handleOpenSmartImport = (folderId?: string | null) => {
    setSmartImportFolderId(folderId !== undefined ? folderId : null)
    setIsSmartImportOpen(true)
  }

  const handleOpenBulkImport = (folderId?: string | null) => {
    setBulkImportFolderId(folderId !== undefined ? folderId : null)
    setIsBulkImportOpen(true)
  }

  const handleBulkImportComplete = (result: BulkImportResult) => {
    const parts: string[] = []
    if (result.importedCount > 0) {
      parts.push(`${result.importedCount} ${result.importedCount === 1 ? 'artículo importado' : 'artículos importados'}`)
    }
    if (result.updatedCount > 0) {
      parts.push(`${result.updatedCount} ${result.updatedCount === 1 ? 'artículo actualizado' : 'artículos actualizados'}`)
    }
    if (result.skippedCount > 0) {
      parts.push(`${result.skippedCount} ${result.skippedCount === 1 ? 'omitido' : 'omitidos'}`)
    }
    const summary = parts.length > 0 ? parts.join(', ') : 'No se importaron notas'
    setToastMessage(summary)
  }

  const handleOpenUploadPdf = (folderId?: string | null) => {
    setUploadPdfFolderId(folderId !== undefined ? folderId : null)
    setIsUploadPdfOpen(true)
  }

  const handleUploadPdfComplete = (results: SavedPdfArticleResult[]) => {
    if (results.length === 1) {
      setSelectedId(results[0].nodeId)
      setToastMessage(`PDF "${results[0].title}" subido con éxito`)
    } else if (results.length > 1) {
      setToastMessage(`Se subieron ${results.length} documentos PDF con éxito`)
    }
  }

  const handlePromptConfirm = async (value: string) => {
    if (!promptState || !value.trim()) return

    try {
      if (promptState.type === 'create-node') {
        const node = await createNode({
          kind: promptState.kind,
          title: value.trim(),
          parent_id: promptState.parentId,
        })
        if (promptState.kind === 'article') {
          setSelectedId(node.id)
          setSeedBody(null)
          setIsEditMode(true)
        } else {
          // Al crear carpeta raíz: navegamos a ella.
          // Al crear subcarpeta: nos mantenemos en la carpeta padre para ver la tarjeta en el explorador
          if (!promptState.parentId) {
            setSelectedId(node.id)
          }
          setToastMessage(`Carpeta "${node.title}" creada con éxito`)
        }
      } else if (promptState.type === 'create-from-template') {
        const tpl = templates.find((t) => t.node.title === promptState.templateTitle)
        if (!tpl) return
        const finalTitle = value.trim()
        const body = fillTitlePlaceholder(tpl.body, finalTitle)
        const node = await createNode({
          kind: 'article',
          title: finalTitle,
          parent_id: promptState.parentId,
        })
        await saveArticle(node.id, body)
        setSeedBody(body)
        setSelectedId(node.id)
        setIsEditMode(true)
      } else if (promptState.type === 'rename-node') {
        await renameNode(promptState.nodeId, value.trim())
      }
    } catch (e) {
      setErrorMessage((e as Error).message || 'Error al procesar la solicitud')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteState) return
    await deleteNodeCascade(deleteState.nodeId)
    if (selectedId === deleteState.nodeId) {
      setSelectedId(null)
    }
    setDeleteState(null)
  }

  const onMoveTarget = async (folderId: string | null) => {
    const targetId = movingNodeId || selectedId
    setMoveMode(false)
    setMovingNodeId(null)
    if (!targetId) return
    try {
      await moveNode(targetId, folderId)
      const movedNode = nodes.find((n) => n.id === targetId)
      const targetNode = folderId ? nodes.find((n) => n.id === folderId) : null
      const targetName = targetNode ? `"${targetNode.title}"` : 'la raíz'
      if (movedNode) {
        setToastMessage(`"${movedNode.title}" movido a ${targetName}`)
      }
    } catch (e) {
      setErrorMessage((e as Error).message)
    }
  }

  const handleMoveNodeDirect = async (nodeId: string, folderId: string | null) => {
    try {
      await moveNode(nodeId, folderId)
      const movedNode = nodes.find((n) => n.id === nodeId)
      const targetNode = folderId ? nodes.find((n) => n.id === folderId) : null
      const targetName = targetNode ? `"${targetNode.title}"` : 'la raíz'
      if (movedNode) {
        setToastMessage(`"${movedNode.title}" movido a ${targetName}`)
      }
    } catch (e) {
      setErrorMessage((e as Error).message)
    }
  }

  const handleSortFolderAlphabetically = async (folderId: string) => {
    try {
      const folder = nodes.find((n) => n.id === folderId)
      await sortChildrenInFolder(folderId, 'alpha-asc')
      setToastMessage(`Elementos de "${folder?.title || 'Carpeta'}" ordenados alfabéticamente (A-Z)`)
    } catch (e) {
      setErrorMessage((e as Error).message || 'Error al ordenar la carpeta')
    }
  }

  const handleDuplicateArticle = async (nodeId: string) => {
    const sourceNode = nodes.find((n) => n.id === nodeId)
    if (!sourceNode || sourceNode.kind !== 'article') return
    try {
      const sourceArt = await db.articles.get(nodeId)
      const dupTitle = `${sourceNode.title} (Copia)`
      const newNode = await createNode({
        kind: 'article',
        title: dupTitle,
        parent_id: sourceNode.parent_id,
      })
      const copiedBody = sourceArt?.body_md ?? (selected?.id === nodeId ? currentBody : '')
      await saveArticle(newNode.id, copiedBody, sourceArt?.tags)
      setSeedBody(copiedBody)
      setSelectedId(newNode.id)
      setIsEditMode(true)
      setToastMessage(`Protocolo duplicado como "${dupTitle}"`)
    } catch (e) {
      setErrorMessage((e as Error).message || 'No se pudo duplicar el protocolo')
    }
  }

  // --- Handlers de Importación Inteligente (ChatGPT / Word) ---
  const handleAppendToCurrentArticle = async (articleId: string, additionalMarkdown: string) => {
    const art = await db.articles.get(articleId)
    const current = art?.body_md || ''
    const updated = current.trim()
      ? `${current.trim()}\n\n---\n\n${additionalMarkdown.trim()}`
      : additionalMarkdown.trim()
    await saveArticle(articleId, updated)
    setSeedBody(updated)
    setEditorRevision((r) => r + 1)
  }

  const handleReplaceCurrentArticle = async (articleId: string, newMarkdown: string) => {
    await saveArticle(articleId, newMarkdown)
    setSeedBody(newMarkdown)
    setEditorRevision((r) => r + 1)
  }

  const handleCreateNewArticle = async (
    title: string,
    markdown: string,
    parentId: string | null,
  ) => {
    const node = await createNode({
      kind: 'article',
      title,
      parent_id: parentId,
    })
    await saveArticle(node.id, markdown)
    setSeedBody(markdown)
    setSelectedId(node.id)
    setIsEditMode(false)
  }

  const handleSaveToInbox = async (title: string, markdown: string) => {
    const inbox = await ensureInboxFolder()
    const node = await createNode({
      kind: 'article',
      title,
      parent_id: inbox.id,
    })
    await saveArticle(node.id, markdown)
    setSelectedId(node.id)
  }

  useEffect(() => {
    if (!isAuthenticated || user?.method !== 'google') return
    let cancelled = false
    void checkServerAuthSession().then((profile) => {
      if (cancelled || !profile) return
      if (
        profile.email !== ownerEmail ||
        profile.name !== ownerName ||
        (profile.avatarUrl ?? null) !== ownerAvatarUrl
      ) {
        linkGoogleAccount(profile)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.method, ownerEmail, ownerName, ownerAvatarUrl, linkGoogleAccount])

  const handleGoogleSignIn = useCallback(
    (recoverMode = false) => {
      setGoogleLoginError(null)
      initiateGoogleLoginFlow({
        loginHint: isAuthenticated ? undefined : (ownerEmail ?? undefined),
        onSuccess: (profile) => {
          if (isAuthenticated) {
            const res = linkGoogleAccount(profile)
            if (!res.success) {
              setErrorMessage(res.error ?? 'Error al vincular Google')
              return
            }
            setToastMessage(`Cuenta Google vinculada: ${profile.email}`)
            return
          }
          const res = completeGoogleLogin(profile, { allowRecovery: recoverMode })
          if (!res.success) {
            setGoogleLoginError(res.error ?? 'Acceso denegado para esta cuenta Google.')
            return
          }
          setToastMessage(`Sesión iniciada: ${profile.name}`)
          if (res.needsPinResetOption) {
            setIsSecurityModalOpen(true)
          }
        },
        onError: (msg) => {
          if (isAuthenticated) {
            setErrorMessage(msg)
          } else {
            setGoogleLoginError(msg)
          }
        },
      })
    },
    [isAuthenticated, ownerEmail, linkGoogleAccount, completeGoogleLogin],
  )

  const handleLockTerminal = useCallback(() => {
    setGoogleLoginError(null)
    setIsSecurityModalOpen(false)
    setIsCalendarModalOpen(false)
    setCalendarFormState({ isOpen: false, event: null })
    logout()
  }, [logout])

  const handleResetTerminal = useCallback(async () => {
    setGoogleLoginError(null)
    setIsSecurityModalOpen(false)
    setIsCalendarModalOpen(false)
    setCalendarFormState({ isOpen: false, event: null })
    await disconnectCalendar()
    await clearLocalCalendarData()
    setCalendarSyncEnabled(false)
    setLastCalendarSyncTime(0)
    localStorage.removeItem(GOOGLE_SCOPES_KEY)
    await resetLocalTerminalSecurity()
  }, [disconnectCalendar, resetLocalTerminalSecurity])

  const handleOpenCalendar = useCallback(() => {
    if (!isCalendarEnabled) {
      connectCalendar()
      return
    }
    setIsCalendarModalOpen(true)
  }, [isCalendarEnabled, connectCalendar])

  const handleSaveCalendarEvent = useCallback(
    async (draft: CalendarEventDraft, existingEventId?: string) => {
      if (existingEventId) {
        await updateCalendarEvent(existingEventId, draft)
        setToastMessage(
          isCalendarOnline
            ? 'Evento actualizado en tu agenda'
            : 'Cambio guardado offline (pendiente de sincronización)',
        )
      } else {
        await createCalendarEvent(draft)
        setToastMessage(
          isCalendarOnline
            ? 'Evento guardado en tu agenda'
            : 'Evento guardado offline (pendiente de sincronización)',
        )
      }
    },
    [updateCalendarEvent, createCalendarEvent, isCalendarOnline],
  )

  const handleDeleteCalendarEvent = useCallback(
    async (eventId: string) => {
      await deleteCalendarEvent(eventId)
      setToastMessage(
        isCalendarOnline
          ? 'Evento eliminado de tu agenda'
          : 'Eliminación encolada offline',
      )
    },
    [deleteCalendarEvent, isCalendarOnline],
  )

  const activeToastMessage =
    toastMessage ?? (!isCalendarModalOpen ? calendarNoticeMessage : null)

  if (!isAuthenticated) {
    return (
      <LoginView
        onGoogleSignIn={() => handleGoogleSignIn(false)}
        onRecoverWithGoogle={() => handleGoogleSignIn(true)}
        onResetTerminal={handleResetTerminal}
        onPinSubmit={async (candidate) => {
          setGoogleLoginError(null)
          return await loginWithPin(candidate)
        }}
        onFidoLogin={async () => {
          setGoogleLoginError(null)
          return await loginWithFido()
        }}
        onSetupInitialPin={async (newPin) => {
          setGoogleLoginError(null)
          return await setupInitialPin(newPin)
        }}
        onRegisterInitialPasskey={async (label) => {
          setGoogleLoginError(null)
          return await registerInitialPasskey(label)
        }}
        onLoginSuccess={(loggedUser) =>
          setToastMessage(
            loggedUser.method === 'offline'
              ? 'Acceso en Modo Urgencias Offline activado'
              : `Sesión iniciada: ${loggedUser.name}`,
          )
        }
        protectionConfigured={protectionConfigured}
        pinEnabled={pinEnabled}
        pinLength={pinLength}
        hasPasskeys={hasPasskeys}
        lockedUntil={lockedUntil}
        ownerEmail={ownerEmail}
        externalError={googleLoginError}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  }

  return (
    <div className="app-container">
      <div className="layout desktop-sidebar-collapsed">
        <main className={`content ${isPdfArticle ? 'content-pdf-active' : 'content-dashboard-home'}`}>
          {selected ? (
            <div className={selected.kind === 'folder' ? 'folder-main-view-wrapper' : `article-container ${isPdfArticle ? 'article-container-pdf' : ''}`}>
              {selected.kind === 'folder' ? (
                <FolderExplorerView
                  key={selected.id}
                  folderNode={selected}
                  nodes={nodes}
                  onSelectNode={(id) => {
                    setSelectedId(id)
                  }}
                  onCreateArticle={(folderId) => handleOpenCreatePrompt('article', folderId)}
                  onCreateSubfolder={(folderId) => handleOpenCreatePrompt('folder', folderId)}
                  onSmartImport={(folderId) => handleOpenSmartImport(folderId)}
                  onBulkImport={(folderId) => handleOpenBulkImport(folderId)}
                  onBulkExportPdf={(folderId, selectedIds) =>
                    handleOpenBulkExportPdf(folderId, selectedIds)
                  }
                  onUploadPdf={(folderId) => handleOpenUploadPdf(folderId)}
                  onSortFolderAlphabetically={handleSortFolderAlphabetically}
                  onToggleFavorite={toggleFavorite}
                  onRenameNode={(id) => handleOpenRenamePrompt(id)}
                  favoriteIds={favoriteIds}
                  onMoveNodeDirect={handleMoveNodeDirect}
                  onDeleteNode={(id) => handleOpenDeleteConfirm(id)}
                  onEditArticle={(id) => {
                    setSelectedId(id)
                    setIsEditMode(true)
                  }}
                  onPrintArticle={(id) => {
                    setSelectedId(id)
                    setTimeout(() => setIsExportPdfOpen(true), 80)
                  }}
                  onGoBack={() => setSelectedId(selected.parent_id)}
                  onGoHome={() => setSelectedId(null)}
                  onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
                  onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                  templates={templates}
                  onCreateFromTemplate={(tplTitle, folderId) => handleOpenTemplatePrompt(tplTitle, folderId)}
                  onOpenStudy={(folderArticleIds) => void handleStartGeneralStudy(folderArticleIds)}
                  dueFlashcardsCount={dueFlashcardsCount}
                  userName={user?.name}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onOpenSecuritySettings={() => setIsSecurityModalOpen(true)}
                  onLockTerminal={handleLockTerminal}
                  isGoogleConnected={isGoogleConnected}
                  isGoogleSessionExpired={isGoogleSessionExpired}
                  googleHasPendingChanges={googleHasPendingChanges}
                  googleSyncState={googleSyncState}
                  googleSyncProgress={googleSyncProgress}
                  googleLastSyncedAt={googleLastSyncedAt}
                  onOpenGoogleDriveSync={() => setIsGoogleModalOpen(true)}
                  onOpenCalendar={handleOpenCalendar}
                  calendarEnabled={isCalendarEnabled}
                  calendarOnline={isCalendarOnline}
                  calendarPendingCount={calendarPendingCount}
                  calendarSessionExpired={isCalendarSessionExpired}
                  calendarNeedsConsent={needsCalendarConsent}
                  onInstallPwa={triggerInstallPwa}
                  canInstallPwa={canInstallPwa}
                />
              ) : (
                <ArticleWorkspaceView
                  key={selected.id}
                  articleNode={selected}
                  nodes={nodes}
                  tags={article?.node_id === selected.id ? (article?.tags ?? []) : []}
                  currentBody={currentBody}
                  isArticleReady={isArticleReady}
                  isPdfArticle={isPdfArticle}
                  effectiveEditMode={effectiveEditMode}
                  editorRevision={editorRevision}
                  editorRef={editorRef}
                  backlinks={backlinks}
                  isFavorite={isFavorite(selected.id)}
                  onToggleFavorite={toggleFavorite}
                  onRenameArticle={(id) => handleOpenRenamePrompt(id)}
                  onSelectNode={(id) => {
                    setSelectedId(id)
                  }}
                  onSelectArticle={selectArticle}
                  onSetEditMode={setIsEditMode}
                  onSaveMarkdown={(nodeId, md) => saveArticle(nodeId, md)}
                  onOpenExportPdf={() => setIsExportPdfOpen(true)}
                  onOpenExportGoogleDocs={() => {
                    const folderPathString = pathTo(nodes, selected.id)
                      .slice(0, -1)
                      .map((n) => n.title)
                      .join(' / ')
                    const currentTags =
                      article?.node_id === selected.id ? (article?.tags ?? []) : []
                    setGoogleDocsExportState({
                      isOpen: true,
                      title: selected.title,
                      markdown: currentBody,
                      folderPath: folderPathString,
                      tags: currentTags,
                    })
                  }}
                  onOpenFlashcards={() => setIsArticleFlashcardsOpen(true)}
                  onOpenSmartImport={() => handleOpenSmartImport()}
                  onCreateArticle={(folderId) => handleOpenCreatePrompt('article', folderId)}
                  onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                  onMoveArticle={(nodeId, folderId) => void handleMoveNodeDirect(nodeId, folderId)}
                  onDuplicateArticle={(nodeId) => void handleDuplicateArticle(nodeId)}
                  onDeleteArticle={(nodeId) => handleOpenDeleteConfirm(nodeId)}
                />
              )}
            </div>
          ) : (
            <Dashboard
              nodes={nodes}
              templates={templates}
              onSelectArticle={selectArticle}
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
              onOpenSmartImport={(folderId) => handleOpenSmartImport(folderId)}
              onCreateNode={(kind, parentId) =>
                handleOpenCreatePrompt(kind, parentId ?? targetFolderId)
              }
              onCreateFromTemplate={(tplTitle, parentId) =>
                handleOpenTemplatePrompt(tplTitle, parentId ?? targetFolderId)
              }
              onInstallPwa={triggerInstallPwa}
              canInstallPwa={canInstallPwa}
              dueFlashcardsCount={dueFlashcardsCount}
              totalFlashcardsCount={totalFlashcardsCount}
              onOpenStudy={handleStartGeneralStudy}
              onOpenDecks={() => setIsDecksModalOpen(true)}
              onOpenAiSettings={() => setIsAiSettingsOpen(true)}
              userName={user?.name}
              theme={theme}
              onToggleTheme={toggleTheme}
              onOpenSecuritySettings={() => setIsSecurityModalOpen(true)}
              onLockTerminal={handleLockTerminal}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              showTemplatesFolder={showTemplatesFolder}
              onToggleTemplatesFolder={toggleTemplatesFolder}
              isGoogleConnected={isGoogleConnected}
              isGoogleSessionExpired={isGoogleSessionExpired}
              googleHasPendingChanges={googleHasPendingChanges}
              googleSyncState={googleSyncState}
              googleSyncProgress={googleSyncProgress}
              googleLastSyncedAt={googleLastSyncedAt}
              onOpenGoogleDriveSync={() => setIsGoogleModalOpen(true)}
              onBulkImportMarkdown={(folderId) => handleOpenBulkImport(folderId)}
              onBulkExportPdf={(folderId) => handleOpenBulkExportPdf(folderId)}
              onUploadPdf={(folderId) => handleOpenUploadPdf(folderId)}
              onSortFolder={handleSortFolderAlphabetically}
              onRenameNode={handleOpenRenamePrompt}
              onDeleteNode={handleOpenDeleteConfirm}
              moveMode={moveMode}
              movingNodeId={movingNodeId}
              onMoveNode={(id) => {
                setMovingNodeId(id)
                setMoveMode(true)
              }}
              onMoveTarget={onMoveTarget}
              onCancelMove={() => {
                setMoveMode(false)
                setMovingNodeId(null)
              }}
              storagePersisted={storagePersisted}
              calendarEnabled={isCalendarEnabled}
              calendarOnline={isCalendarOnline}
              calendarSessionExpired={isCalendarSessionExpired}
              calendarNeedsConsent={needsCalendarConsent}
              calendarSyncState={calendarSyncState}
              calendarPendingCount={calendarPendingCount}
              calendarCalendars={calendarCalendars}
              calendarEvents={calendarEvents}
              calendarLastSyncedAt={calendarLastSyncedAt}
              calendarErrorMessage={calendarErrorMessage}
              onConnectCalendar={connectCalendar}
              onSyncCalendar={() => void triggerCalendarSync()}
              onOpenCalendar={handleOpenCalendar}
              onQuickCreateCalendarEvent={() =>
                setCalendarFormState({ isOpen: true, event: null })
              }
              onSelectCalendarEvent={(event) =>
                setCalendarFormState({ isOpen: true, event })
              }
            />
          )}
        </main>
      </div>

      {/* Modal de Paleta de Comandos Global (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        nodes={nodes}
        favoriteIds={favoriteIds}
        onSelectArticle={selectArticle}
        onOpenCreatePrompt={(kind) => handleOpenCreatePrompt(kind)}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        onOpenSmartImport={() => handleOpenSmartImport()}
        onToggleTheme={toggleTheme}
        onGoHome={() => setSelectedId(null)}
        onGoInbox={() => inboxFolder && selectArticle(inboxFolder.id)}
      />

      {/* Modal de Asistente de Importación Inteligente (ChatGPT, Word, Rich Text) */}
      <SmartImportModal
        isOpen={isSmartImportOpen}
        onClose={() => {
          setIsSmartImportOpen(false)
          setSmartImportFolderId(null)
        }}
        currentArticle={
          smartImportFolderId !== null
            ? null
            : selected?.kind === 'article'
              ? { id: selected.id, title: selected.title, body: currentBody }
              : null
        }
        currentFolderId={smartImportFolderId ?? targetFolderId}
        nodes={nodes}
        onAppendToCurrentArticle={handleAppendToCurrentArticle}
        onReplaceCurrentArticle={handleReplaceCurrentArticle}
        onCreateNewArticle={handleCreateNewArticle}
        onSaveToInbox={handleSaveToInbox}
        onExportToGoogleDocs={(title, md) =>
          setGoogleDocsExportState({
            isOpen: true,
            title,
            markdown: md,
          })
        }
      />

      {/* Modal de Importación Masiva de Archivos Markdown y Carpetas */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => {
          setIsBulkImportOpen(false)
          setBulkImportFolderId(null)
        }}
        targetFolderId={bulkImportFolderId ?? (selected?.kind === 'folder' ? selected.id : null)}
        nodes={nodes}
        onImportComplete={handleBulkImportComplete}
      />

      {/* Modal de Subida de Documentos PDF */}
      <UploadPdfModal
        isOpen={isUploadPdfOpen}
        onClose={() => {
          setIsUploadPdfOpen(false)
          setUploadPdfFolderId(null)
        }}
        targetFolderId={uploadPdfFolderId ?? (selected?.kind === 'folder' ? selected.id : null)}
        nodes={nodes}
        onUploadComplete={handleUploadPdfComplete}
      />

      {/* Modal de Configuración y Estado de Google Drive */}
      <GoogleDriveModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        isConnected={isGoogleConnected}
        isSessionExpired={isGoogleSessionExpired}
        hasPendingChanges={googleHasPendingChanges}
        syncState={googleSyncState}
        syncProgress={googleSyncProgress}
        lastSyncedAt={googleLastSyncedAt}
        lastCheckedAt={googleLastCheckedAt}
        userEmail={googleUserEmail}
        errorMessage={googleErrorMessage}
        onTriggerSync={() => void triggerGoogleSync()}
        onDisconnect={disconnectGoogle}
        onConnectToken={connectGoogleToken}
        onInitiateOAuth={initiateGoogleOAuth}
      />

      {/* Modal de Agenda Clínica y Guardias (Google Calendar) */}
      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => {
          if (!calendarFormState.isOpen) setIsCalendarModalOpen(false)
        }}
        theme={theme}
        isOnline={isCalendarOnline}
        isSessionExpired={isCalendarSessionExpired}
        needsCalendarConsent={needsCalendarConsent}
        syncState={calendarSyncState}
        pendingCount={calendarPendingCount}
        lastSyncedAt={calendarLastSyncedAt}
        errorMessage={calendarErrorMessage}
        noticeMessage={calendarNoticeMessage}
        calendars={calendarCalendars}
        events={calendarEvents}
        onSync={() => void triggerCalendarSync()}
        onReconnect={connectCalendar}
        onDisconnect={async () => {
          await disconnectCalendar()
          setCalendarFormState({ isOpen: false, event: null })
          setIsCalendarModalOpen(false)
          setToastMessage('Google Calendar desconectado')
        }}
        onToggleCalendar={toggleCalendarVisibility}
        onCreateEvent={(defaultDateYmd) =>
          setCalendarFormState({ isOpen: true, event: null, defaultDateYmd })
        }
        onSelectEvent={(event) => setCalendarFormState({ isOpen: true, event })}
        onEnsureRangeLoaded={ensureCalendarRangeLoaded}
        onClearNotice={clearCalendarNotice}
      />

      {/* Modal de Creación/Edición de Evento de Google Calendar */}
      <CalendarEventFormModal
        isOpen={calendarFormState.isOpen}
        onClose={() => setCalendarFormState({ isOpen: false, event: null })}
        calendars={calendarCalendars}
        event={calendarFormState.event}
        defaultDateYmd={calendarFormState.defaultDateYmd}
        theme={theme}
        isOnline={isCalendarOnline}
        onSubmit={handleSaveCalendarEvent}
        onDelete={handleDeleteCalendarEvent}
      />

      {/* Modal de Seguridad de Estación Clínica (Google Identity, PIN PBKDF2, Passkeys FIDO2) */}
      <SecuritySettingsModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        user={user}
        securityProfile={securityProfile}
        protectionConfigured={protectionConfigured}
        isGoogleDriveConnected={isGoogleConnected}
        onLinkGoogleAccount={() => handleGoogleSignIn(false)}
        onOpenGoogleDriveSync={() => {
          setIsSecurityModalOpen(false)
          setIsGoogleModalOpen(true)
        }}
        onSavePin={setupOrChangePin}
        onRemovePin={removePin}
        onRegisterPasskey={registerDevicePasskey}
        onRemovePasskey={removeDevicePasskey}
        onResetTerminalSecurity={handleResetTerminal}
      />

      {/* Modal de Captura Rápida Global */}
      <QuickCapture
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onCaptureSaved={selectArticle}
        hideLauncher
      />

      {/* Diálogo Prompt unificado (Crear Carpeta, Crear Artículo, Crear desde Plantilla, Renombrar) */}
      {promptState && (
        <PromptDialog
          isOpen={true}
          title={
            promptState.type === 'create-node'
              ? promptState.kind === 'folder'
                ? 'Nueva Carpeta'
                : 'Nuevo Artículo'
              : promptState.type === 'create-from-template'
                ? `Nuevo desde "${promptState.templateTitle}"`
                : 'Renombrar'
          }
          label={
            promptState.type === 'create-node'
              ? promptState.kind === 'folder'
                ? 'Nombre de la carpeta:'
                : 'Título del artículo:'
              : promptState.type === 'create-from-template'
                ? 'Título del artículo a crear:'
                : 'Nuevo nombre:'
          }
          placeholder={
            promptState.type === 'create-node'
              ? promptState.kind === 'folder'
                ? 'ej. Cardiología, Urgencias, Farmacología'
                : 'ej. Cetoacidosis Diabética, Ficha Fármaco'
              : promptState.type === 'create-from-template'
                ? `ej. ${promptState.templateTitle}`
                : ''
          }
          initialValue={
            promptState.type === 'rename-node' ? promptState.currentTitle : ''
          }
          confirmText={
            promptState.type === 'rename-node' ? 'Renombrar' : 'Crear'
          }
          onConfirm={handlePromptConfirm}
          onClose={() => setPromptState(null)}
        />
      )}

      {/* Diálogo de Confirmación para Eliminación */}
      {deleteState && (
        <ConfirmDialog
          isOpen={true}
          title={
            deleteState.isFolder
              ? '¿Eliminar carpeta y su contenido?'
              : '¿Eliminar artículo?'
          }
          message={
            deleteState.isFolder
              ? `¿Estás seguro de que deseas eliminar la carpeta "${deleteState.title}" y TODO su contenido? Esta acción no se puede deshacer.`
              : `¿Estás seguro de que deseas eliminar el artículo "${deleteState.title}"?`
          }
          confirmText="Eliminar definitivamente"
          cancelText="Cancelar"
          isDestructive={true}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteState(null)}
        />
      )}

      {/* Diálogo de Alerta de Error */}
      {errorMessage && (
        <AlertDialog
          isOpen={true}
          title="Notificación"
          content={<p className="text-sm leading-relaxed text-[var(--ch-text-secondary)]">{errorMessage}</p>}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Notificación Toast Flotante */}
      <Toast
        message={activeToastMessage}
        onClose={() => {
          if (toastMessage !== null) {
            setToastMessage(null)
          } else {
            clearCalendarNotice()
          }
        }}
      />

      {/* Aviso Flotante de Actualización PWA */}
      <UpdateToast
        needRefresh={needRefresh}
        onUpdate={updateApp}
        onDismiss={closeToast}
      />

      {/* Guía Visual de Instalación en iOS Safari */}
      <IosInstallModal isOpen={showIosGuide} onClose={closeIosGuide} />

      {/* Modal de Estudio Activo SM-2 (Flip Card 3D) */}
      <StudyModal
        isOpen={isStudyModalOpen}
        onClose={() => {
          setIsStudyModalOpen(false)
          refreshFlashcardCounts()
        }}
        cards={studyDeck}
        onOpenArticle={(nodeId) => selectArticle(nodeId)}
        onSessionComplete={() => refreshFlashcardCounts()}
      />

      {/* Mazos EUNACOM descargables */}
      <DecksModal
        isOpen={isDecksModalOpen}
        onClose={() => setIsDecksModalOpen(false)}
        onDownloaded={refreshFlashcardCounts}
        onLogin={() => handleGoogleSignIn(false)}
        onStudyDeck={(cardIds) => void handleStartDeckStudy(cardIds)}
      />

      {/* Modal de Flashcards del Artículo */}
      {selected?.kind === 'article' && (
        <ArticleFlashcardsModal
          isOpen={isArticleFlashcardsOpen}
          onClose={() => {
            setIsArticleFlashcardsOpen(false)
            refreshFlashcardCounts()
          }}
          nodeId={selected.id}
          articleTitle={selected.title}
          bodyMd={currentBody}
          onStartStudy={(cards) => {
            setStudyDeck(cards)
            setIsStudyModalOpen(true)
          }}
          onOpenAiSettings={() => setIsAiSettingsOpen(true)}
        />
      )}

      {/* Modal de Configuración de IA */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
      />

      {/* Modal de Exportación a PDF / Impresión */}
      {selected?.kind === 'article' && (
        <ExportPdfModal
          isOpen={isExportPdfOpen}
          onClose={() => setIsExportPdfOpen(false)}
          articleTitle={selected.title}
          folderPath={pathTo(nodes, selected.id).slice(0, -1).map((n) => n.title).join(' / ')}
          tags={article?.node_id === selected.id ? (article?.tags ?? []) : []}
          onConfirmExport={handleConfirmExportPdf}
        />
      )}

      {/* Modal de Exportación Masiva a PDF (Compendio) */}
      <BulkExportPdfModal
        isOpen={isBulkExportPdfOpen}
        onClose={() => {
          setIsBulkExportPdfOpen(false)
          setBulkExportPdfFolderId(null)
          setBulkExportPdfSelectedIds(null)
        }}
        nodes={nodes}
        initialFolderId={bulkExportPdfFolderId}
        initialSelectedIds={bulkExportPdfSelectedIds}
        onConfirmExport={handleConfirmBulkExportPdf}
      />

      {/* Modal de Exportación a Google Docs */}
      <Suspense fallback={null}>
        <GoogleDocsExportModal
          isOpen={googleDocsExportState.isOpen}
          onClose={() =>
            setGoogleDocsExportState((prev) => ({ ...prev, isOpen: false }))
          }
          title={googleDocsExportState.title}
          markdown={googleDocsExportState.markdown}
          folderPath={googleDocsExportState.folderPath}
          tags={googleDocsExportState.tags}
        />
      </Suspense>

      {/* Documento Exclusivo para Impresión Masiva (Compendio Multidocumento) */}
      {bulkPrintState?.active && (
        <div
          id="print-bulk-document"
          className={`print-bulk-document print-layout-${bulkPrintState.options.columns === '2' ? 'two-columns' : 'single'} ${bulkPrintState.options.pageBreakBetween ? 'print-break-between' : ''}`}
          aria-hidden="true"
        >
          {bulkPrintState.items.map(({ node, article: artItem }) => {
            const itemFolderPath =
              pathTo(nodes, node.id)
                .slice(0, -1)
                .map((n) => n.title)
                .join(' · ') || undefined
            const itemMd = artItem?.body_md ?? ''
            const prepared = prepareTemplateDocument(
              parseMarkdownBlocks(itemMd),
              node.title,
              itemFolderPath,
            )
            return (
              <div key={node.id} className="print-bulk-article-item">
                {bulkPrintState.options.includeHeader && (
                  <div className="print-article-header">
                    <h1 className="print-article-title">{prepared.docTitle || node.title}</h1>
                    {prepared.docSubtitle && (
                      <p className="print-article-subtitle">{prepared.docSubtitle}</p>
                    )}
                  </div>
                )}

                {bulkPrintState.options.includeTags && (artItem?.tags ?? []).length > 0 && (
                  <div className="print-tags-row">
                    {(artItem?.tags ?? []).map((t: string) => (
                      <span key={t} className="print-tag-pill">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="print-article-body">
                  <ArticleReader
                    articleTitle={node.title}
                    folderPath={itemFolderPath}
                    markdown={itemMd}
                    onWikiLinkClick={() => {}}
                    isPrintView={true}
                    suppressDocHeader={true}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Documento Exclusivo para Impresión / Guardar como PDF */}
      {selected?.kind === 'article' && (() => {
        const selectedFolderPath =
          pathTo(nodes, selected.id)
            .slice(0, -1)
            .map((n) => n.title)
            .join(' · ') || undefined
        const prepared = prepareTemplateDocument(
          parseMarkdownBlocks(currentBody),
          selected.title,
          selectedFolderPath,
        )
        return (
          <div
            id="print-article-document"
            className={`print-article-document print-layout-${printOptions.columns === '2' ? 'two-columns' : 'single'}`}
            aria-hidden="true"
          >
            {printOptions.includeHeader && (
              <div className="print-article-header">
                <h1 className="print-article-title">{prepared.docTitle || selected.title}</h1>
                {prepared.docSubtitle && (
                  <p className="print-article-subtitle">{prepared.docSubtitle}</p>
                )}
              </div>
            )}

            {printOptions.includeTags && (article?.tags ?? []).length > 0 && (
              <div className="print-tags-row">
                {(article?.tags ?? []).map((t) => (
                  <span key={t} className="print-tag-pill">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div className="print-article-body">
              <ArticleReader
                articleTitle={selected?.title}
                folderPath={selectedFolderPath}
                markdown={currentBody}
                onWikiLinkClick={() => {}}
                isPrintView={true}
                suppressDocHeader={true}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default App

