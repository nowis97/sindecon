import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FileText,
  ArrowLeft,
  Pencil,
  Star,
  Eye,
  PenLine,
  Columns2,
  BrainCircuit,
  Sparkles,
  Printer,
  FileOutput,
  AlertTriangle,
  OctagonAlert,
  CheckCircle2,
  Lightbulb,
  Pill,
  Table2,
  GitBranch,
  Link2,
  ListTree,
  AlignJustify,
  AlignLeft,
  Tag,
  Plus,
  X,
  Folder,
  FolderOpen,
  ChevronDown,
  Search,
} from 'lucide-react'
import { db, type NodeRow } from '../../db/db'
import { pathTo, childrenOf } from '../../domain/tree'
import { TagInput } from '../search/TagInput'
import { WikiLinkPicker } from '../search/WikiLinkPicker'
import { MarkdownEditor, type MarkdownEditorHandle } from '../editor/MarkdownEditor'
import {
  ArticleReader,
  parseMarkdownBlocks,
  prepareTemplateDocument,
} from './ArticleReader'
import type { ClinicalMark } from '../tree/FolderExplorerView'

const CLINICAL_MARKS_STORAGE_KEY = 'sindecon_article_marks'

function readAllClinicalMarks(): Record<string, ClinicalMark> {
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

function writeArticleMark(nodeId: string, mark: ClinicalMark | null): Record<string, ClinicalMark> {
  const parsed = readAllClinicalMarks()
  if (!mark) {
    delete parsed[nodeId]
  } else {
    parsed[nodeId] = mark
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CLINICAL_MARKS_STORAGE_KEY, JSON.stringify(parsed))
    } catch {
      // Ignore storage quota errors
    }
  }
  void db.meta.put({ key: 'clinical_marks', value: parsed }).catch(() => {})
  return parsed
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ArticleWorkspaceViewProps {
  articleNode: NodeRow
  nodes: NodeRow[]
  tags: string[]
  currentBody: string
  isArticleReady: boolean
  isPdfArticle: boolean
  effectiveEditMode: boolean
  editorRevision: number
  editorRef: React.MutableRefObject<MarkdownEditorHandle | null>
  backlinks: Array<{ id: string; title: string }>
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onRenameArticle: (id: string) => void
  onSelectNode: (id: string | null) => void
  onSelectArticle: (id: string) => void
  onSetEditMode: (edit: boolean) => void
  onSaveMarkdown: (nodeId: string, md: string) => void
  onOpenExportPdf: () => void
  onOpenExportGoogleDocs: () => void
  onOpenFlashcards: () => void
  onOpenSmartImport: () => void
  onCreateArticle?: (folderId: string | null) => void
  onOpenCommandPalette?: () => void
}

export function ArticleWorkspaceView({
  articleNode,
  nodes,
  tags,
  currentBody,
  isArticleReady,
  isPdfArticle,
  effectiveEditMode,
  editorRevision,
  editorRef,
  backlinks,
  isFavorite,
  onToggleFavorite,
  onRenameArticle,
  onSelectNode,
  onSelectArticle,
  onSetEditMode,
  onSaveMarkdown,
  onOpenExportPdf,
  onOpenExportGoogleDocs,
  onOpenFlashcards,
  onOpenSmartImport,
  onCreateArticle,
  onOpenCommandPalette,
}: ArticleWorkspaceViewProps) {
  const [isSplitMode, setIsSplitMode] = useState(false)
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false)
  const [isOrbDrawerOpen, setIsOrbDrawerOpen] = useState(false)
  const [isMarkMenuOpen, setIsMarkMenuOpen] = useState(false)
  const [isBreadcrumbPopoverOpen, setIsBreadcrumbPopoverOpen] = useState(false)
  const [popoverFilter, setPopoverFilter] = useState('')
  const [activePopoverFolderId, setActivePopoverFolderId] = useState<string | null>(
    () => articleNode.parent_id,
  )
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const markMenuRef = useRef<HTMLDivElement | null>(null)
  const orbDrawerRef = useRef<HTMLDivElement | null>(null)
  const orbButtonRef = useRef<HTMLButtonElement | null>(null)
  const [localMarks, setLocalMarks] = useState<Record<string, ClinicalMark>>(() =>
    readAllClinicalMarks(),
  )

  // Reader Format States controlled directly from the 1-Line Top Bar (Option C)
  const [isTwoColumns, setIsTwoColumns] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sindecon_reader_columns')
      return saved !== null ? saved === '2' : true
    } catch {
      return true
    }
  })

  const [isJustified, setIsJustified] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sindecon_reader_text_align')
      return saved !== null ? saved === 'justify' : true
    } catch {
      return true
    }
  })

  const toggleColumns = () => {
    setIsTwoColumns((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sindecon_reader_columns', next ? '2' : '1')
      } catch {}
      return next
    })
  }

  const toggleAlignment = () => {
    setIsJustified((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sindecon_reader_text_align', next ? 'justify' : 'left')
      } catch {}
      return next
    })
  }

  const metaClinicalMarks = useLiveQuery(
    () => db.meta.get('clinical_marks'),
    [],
    undefined,
  )

  const allMarks = useMemo(() => {
    const fromDb =
      metaClinicalMarks?.value && typeof metaClinicalMarks.value === 'object'
        ? (metaClinicalMarks.value as Record<string, ClinicalMark>)
        : {}
    return { ...fromDb, ...localMarks }
  }, [metaClinicalMarks, localMarks])

  const clinicalMark = allMarks[articleNode.id] ?? null

  const handleSelectMark = (target: ClinicalMark | null) => {
    const nextMark = target === null ? null : clinicalMark === target ? null : target
    const updated = writeArticleMark(articleNode.id, nextMark)
    setLocalMarks({ ...updated })
    setIsMarkMenuOpen(false)
  }

  const crumbPath = pathTo(nodes, articleNode.id)
  const folderCrumbPath = crumbPath.slice(0, -1)
  const parentFolder =
    folderCrumbPath.length > 0 ? folderCrumbPath[folderCrumbPath.length - 1]! : null
  const folderPathLabel = folderCrumbPath.map((n) => n.title).join(' · ') || undefined

  // Extract section headings (H2 & H3) for the Right Clinical Outline Rail (Option A + C)
  const sectionHeadings = useMemo(() => {
    if (isPdfArticle) return []
    const blocks = parseMarkdownBlocks(currentBody)
    const prepared = prepareTemplateDocument(blocks, articleNode.title, folderPathLabel)
    const list: Array<{ text: string; id: string; level: number }> = []
    const seen = new Set<string>()
    for (const b of prepared.bodyBlocks) {
      if (b.type === 'header' && (b.level === 2 || b.level === 3)) {
        const cleanText = b.text.replace(/[*_`~]/g, '').trim()
        const id = `reader-sec-${slugifyHeading(b.text)}`
        if (cleanText && !seen.has(id)) {
          seen.add(id)
          list.push({ text: cleanText, id, level: b.level })
        }
      }
    }
    return list
  }, [currentBody, articleNode.title, folderPathLabel, isPdfArticle])

  // All specialty folders for the 2-column Breadcrumb Popover (Opción 1)
  const allFolders = useMemo(() => {
    return nodes.filter(
      (n) => n.kind === 'folder' && n.deleted_at === null && n.system !== 'templates',
    )
  }, [nodes])

  const filteredPopoverFolders = useMemo(() => {
    const q = popoverFilter.trim().toLowerCase()
    if (!q) return allFolders
    return allFolders.filter((f) => f.title.toLowerCase().includes(q))
  }, [allFolders, popoverFilter])

  const activePopoverFolder = useMemo(() => {
    if (!activePopoverFolderId) return null
    return allFolders.find((f) => f.id === activePopoverFolderId) ?? null
  }, [allFolders, activePopoverFolderId])

  const popoverFolderArticles = useMemo(() => {
    const q = popoverFilter.trim().toLowerCase()
    if (q) {
      // When searching, show matching articles across all folders or inside the active folder
      return nodes
        .filter(
          (n) =>
            n.kind === 'article' &&
            n.deleted_at === null &&
            n.title.toLowerCase().includes(q),
        )
        .slice(0, 20)
    }
    return childrenOf(nodes, activePopoverFolderId).filter((n) => n.kind === 'article')
  }, [nodes, activePopoverFolderId, popoverFilter])

  // Close Top Bar Popovers & Center Orb Drawer on Escape or outside click
  useEffect(() => {
    if (!isBreadcrumbPopoverOpen && !isMarkMenuOpen && !isOrbDrawerOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsBreadcrumbPopoverOpen(false)
        setIsMarkMenuOpen(false)
        setIsOrbDrawerOpen(false)
      }
    }
    const handlePointerDown = (e: MouseEvent) => {
      const targetNode = e.target as Node
      if (isBreadcrumbPopoverOpen && popoverRef.current && !popoverRef.current.contains(targetNode)) {
        setIsBreadcrumbPopoverOpen(false)
      }
      if (isMarkMenuOpen && markMenuRef.current && !markMenuRef.current.contains(targetNode)) {
        setIsMarkMenuOpen(false)
      }
      if (
        isOrbDrawerOpen &&
        orbDrawerRef.current &&
        !orbDrawerRef.current.contains(targetNode) &&
        !(orbButtonRef.current && orbButtonRef.current.contains(targetNode))
      ) {
        setIsOrbDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isBreadcrumbPopoverOpen, isMarkMenuOpen, isOrbDrawerOpen])

  const insertSnippet = (snippet: string) => {
    if (!effectiveEditMode) {
      onSetEditMode(true)
      setTimeout(() => {
        editorRef.current?.insertAtCursor(snippet)
        editorRef.current?.focus()
      }, 120)
    } else {
      editorRef.current?.insertAtCursor(snippet)
      editorRef.current?.focus()
    }
  }

  const showEditorPane = !isPdfArticle && (effectiveEditMode || isSplitMode)
  const showReaderPane = !effectiveEditMode || isSplitMode

  return (
    <div className="clinical-home relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1400px] flex-col gap-4 px-3 pt-2 pb-28 sm:px-6">
      {/* 1. COMPACT 1-LINE FLOATING TOP BAR WITH INTERACTIVE BREADCRUMB POPOVER (Opción 1) */}
      <header
        ref={popoverRef}
        className="relative z-35 flex flex-col gap-2.5 rounded-3xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] px-4 py-2.5 shadow-[var(--ch-shadow-card)] sm:rounded-full sm:px-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Home Button + Interactive Breadcrumb Trigger Pill (▾) + Inline Article Title + Inline Tags + Clinical Status Mark */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-1 text-xs font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
              title="Volver a Inicio (Mi Repositorio)"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Inicio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePopoverFolderId(parentFolder ? parentFolder.id : null)
                setPopoverFilter('')
                setIsBreadcrumbPopoverOpen((v) => !v)
              }}
              aria-expanded={isBreadcrumbPopoverOpen}
              aria-label="Abrir navegador desplegable de especialidades y protocolos"
              title="Explorar todas las carpetas y protocolos sin salir del artículo"
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
                isBreadcrumbPopoverOpen
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent)] text-white shadow-xs'
                  : 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] text-[var(--ch-accent)] hover:bg-[var(--ch-accent)] hover:text-white'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[165px] truncate">
                {parentFolder ? parentFolder.title : 'Mi Repositorio'}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                  isBreadcrumbPopoverOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate font-serif text-base font-semibold tracking-tight text-[var(--ch-text-primary)] sm:text-lg">
                {articleNode.title}
              </h1>
              <button
                type="button"
                onClick={() => onRenameArticle(articleNode.id)}
                title="Renombrar artículo"
                aria-label="Renombrar artículo"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ch-text-muted)] transition hover:bg-[var(--ch-bg-secondary)] hover:text-[var(--ch-text-primary)]"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(articleNode.id)}
                title={isFavorite ? 'Quitar de favoritos' : 'Anclar a favoritos'}
                aria-label="Favorito"
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                  isFavorite
                    ? 'text-amber-500'
                    : 'text-[var(--ch-text-muted)] hover:bg-[var(--ch-bg-secondary)] hover:text-[var(--ch-text-primary)]'
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-500' : ''}`} />
              </button>
            </div>

            {/* Inline Tags Chips + Quick Tag Popover Toggle (Option C) */}
            <div className="hidden flex-wrap items-center gap-1 md:flex">
              {tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[var(--ch-text-secondary)]"
                >
                  #{t}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                  +{tags.length - 3}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsTagPopoverOpen((v) => !v)}
                title="Gestionar etiquetas del artículo"
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold transition ${
                  isTagPopoverOpen
                    ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                    : 'border-dashed border-[var(--ch-border-subtle)] text-[var(--ch-text-muted)] hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]'
                }`}
              >
                <Tag className="h-2.5 w-2.5" />
                <span>{tags.length === 0 ? '+ etiqueta' : 'etiquetas'}</span>
              </button>
            </div>

            {/* Compact Single Clinical Triage Status Selector (⚠ Prioridad | 🛑 Crítico | ☑ Verificado) */}
            <div ref={markMenuRef} className="relative flex items-center">
              <button
                type="button"
                onClick={() => setIsMarkMenuOpen((v) => !v)}
                aria-expanded={isMarkMenuOpen}
                aria-haspopup="menu"
                title="Asignar o cambiar estado clínico del artículo"
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold transition ${
                  clinicalMark === 'warning'
                    ? 'border-amber-600/45 bg-amber-500/18 text-amber-700 dark:text-amber-300'
                    : clinicalMark === 'critical'
                      ? 'border-red-600/45 bg-red-500/18 text-red-700 dark:text-red-300'
                      : clinicalMark === 'verified'
                        ? 'border-emerald-600/45 bg-emerald-500/18 text-emerald-700 dark:text-emerald-300'
                        : 'border-dashed border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-muted)] hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]'
                }`}
              >
                {clinicalMark === 'warning' && (
                  <>
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <span>Prioridad</span>
                  </>
                )}
                {clinicalMark === 'critical' && (
                  <>
                    <OctagonAlert className="h-3 w-3 text-red-600" />
                    <span>Crítico</span>
                  </>
                )}
                {clinicalMark === 'verified' && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Verificado</span>
                  </>
                )}
                {!clinicalMark && (
                  <>
                    <CheckCircle2 className="h-3 w-3 opacity-70" />
                    <span>Estado</span>
                  </>
                )}
                <ChevronDown
                  className={`h-3 w-3 opacity-75 transition-transform ${
                    isMarkMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isMarkMenuOpen && (
                <div
                  role="menu"
                  aria-label="Seleccionar estado clínico"
                  className="absolute top-[calc(100%+6px)] left-0 z-50 flex min-w-[168px] flex-col gap-0.5 rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-1.5 shadow-[var(--ch-shadow-modal)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectMark('warning')}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                      clinicalMark === 'warning'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span>Prioridad</span>
                    </span>
                    {clinicalMark === 'warning' && (
                      <span className="font-mono text-[10px]">Activo</span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectMark('critical')}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                      clinicalMark === 'critical'
                        ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                        : 'text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <OctagonAlert className="h-3.5 w-3.5 text-red-600" />
                      <span>Crítico</span>
                    </span>
                    {clinicalMark === 'critical' && (
                      <span className="font-mono text-[10px]">Activo</span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectMark('verified')}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                      clinicalMark === 'verified'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Verificado</span>
                    </span>
                    {clinicalMark === 'verified' && (
                      <span className="font-mono text-[10px]">Activo</span>
                    )}
                  </button>
                  {clinicalMark && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectMark(null)}
                      className="mt-0.5 flex items-center gap-1.5 border-t border-[var(--ch-border-subtle)] px-2.5 pt-1.5 pb-1 text-left text-[11px] font-medium text-[var(--ch-text-muted)] transition hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                      <span>Quitar estado</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Reader Page Format Controls (2 Col A4 & Justificado) or Auto-save Indicator */}
          <div className="flex flex-wrap items-center gap-1.5">
            {!isPdfArticle && showReaderPane ? (
              <>
                <button
                  type="button"
                  onClick={toggleColumns}
                  title={
                    isTwoColumns
                      ? 'Cambiar a vista de 1 columna'
                      : 'Cambiar a vista de 2 columnas (Ficha A4)'
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    isTwoColumns
                      ? 'border-[var(--ch-accent)]/35 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                      : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)]'
                  }`}
                >
                  <Columns2 className="h-3 w-3" />
                  <span>{isTwoColumns ? '2 Col A4' : '1 Col'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleAlignment}
                  title={isJustified ? 'Texto justificado' : 'Alineación izquierda'}
                  className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition sm:inline-flex ${
                    isJustified
                      ? 'border-[var(--ch-accent)]/35 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                      : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)]'
                  }`}
                >
                  {isJustified ? (
                    <AlignJustify className="h-3 w-3" />
                  ) : (
                    <AlignLeft className="h-3 w-3" />
                  )}
                  <span className="hidden lg:inline">
                    {isJustified ? 'Justificado' : 'Izquierda'}
                  </span>
                </button>
              </>
            ) : (
              !isPdfArticle && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--ch-text-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Guardado local automático</span>
                </span>
              )
            )}
          </div>
        </div>

        {/* Expandable Inline Tag Editor Drawer when user clicks "+ etiqueta" in the 1-line bar */}
        {isArticleReady && isTagPopoverOpen && (
          <div className="flex items-center justify-between border-t border-[var(--ch-border-subtle)] pt-2">
            <TagInput articleId={articleNode.id} tags={tags} />
            <button
              type="button"
              onClick={() => setIsTagPopoverOpen(false)}
              className="ml-2 rounded-full p-1 text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
              aria-label="Cerrar editor de etiquetas"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 2-COLUMN BREADCRUMB POPOVER MENU (Opción 1 — Replaces the Left Sidebar) */}
        {isBreadcrumbPopoverOpen && (
          <section
            role="dialog"
            aria-label="Navegador desplegable de especialidades y protocolos"
            className="absolute top-[calc(100%+8px)] right-0 left-0 z-50 flex w-full flex-col gap-3 rounded-2xl border-2 border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-3.5 shadow-[var(--ch-shadow-modal)] sm:right-auto sm:left-5 sm:max-w-[560px]"
          >
            {/* Top Search / Command Palette Bar inside Popover */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                <input
                  type="text"
                  value={popoverFilter}
                  onChange={(e) => setPopoverFilter(e.target.value)}
                  placeholder="Buscar carpeta o protocolo médico…"
                  aria-label="Filtrar carpetas o protocolos"
                  className="w-full bg-transparent text-xs font-medium text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)]"
                  autoFocus
                />
                {popoverFilter && (
                  <button
                    type="button"
                    onClick={() => setPopoverFilter('')}
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
                    setIsBreadcrumbPopoverOpen(false)
                    onOpenCommandPalette()
                  }}
                  title="Abrir paleta de comandos global (Ctrl+K)"
                  className="shrink-0 rounded border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--ch-text-muted)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                >
                  Ctrl+K
                </button>
              )}
            </div>

            {/* 2 Columns: Left = Especialidades | Right = Documentos in Selected Specialty */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[215px_1fr]">
              {/* Left Column: Specialty Folders */}
              <div className="flex flex-col gap-1">
                <div className="px-1.5 pb-1 font-mono text-[10px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                  Especialidades ({filteredPopoverFolders.length})
                </div>
                <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto pr-0.5">
                  <button
                    type="button"
                    onClick={() => setActivePopoverFolderId(null)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                      activePopoverFolderId === null
                        ? 'border-[var(--ch-accent)]/30 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                        : 'border-transparent text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                      <span className="truncate">Raíz / Sin carpeta</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--ch-text-muted)]">
                      {childrenOf(nodes, null).filter((n) => n.kind === 'article').length}
                    </span>
                  </button>

                  {filteredPopoverFolders.map((folder) => {
                    const isSelectedFolder = activePopoverFolderId === folder.id
                    const docCount = childrenOf(nodes, folder.id).filter(
                      (n) => n.kind === 'article',
                    ).length
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setActivePopoverFolderId(folder.id)}
                        onDoubleClick={() => {
                          setIsBreadcrumbPopoverOpen(false)
                          onSelectNode(folder.id)
                        }}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                          isSelectedFolder
                            ? 'border-[var(--ch-accent)]/30 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                            : 'border-transparent text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                          <span className="truncate">{folder.title}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--ch-text-muted)]">
                          {docCount}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Protocols in Selected Folder */}
              <div className="flex flex-col gap-1 border-t border-[var(--ch-border-subtle)] pt-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
                <div className="px-1.5 pb-1 font-mono text-[10px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                  {popoverFilter.trim()
                    ? `Resultados (${popoverFolderArticles.length})`
                    : `Documentos en ${activePopoverFolder ? activePopoverFolder.title : 'Raíz'} (${popoverFolderArticles.length})`}
                </div>
                <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto pr-0.5">
                  {popoverFolderArticles.length === 0 ? (
                    <div className="rounded-lg bg-[var(--ch-bg-secondary)]/60 px-3 py-4 text-center text-xs text-[var(--ch-text-muted)]">
                      No hay protocolos en esta ubicación.
                    </div>
                  ) : (
                    popoverFolderArticles.map((doc) => {
                      const isCurrentDoc = doc.id === articleNode.id
                      const docMark = allMarks[doc.id]
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setIsBreadcrumbPopoverOpen(false)
                            if (!isCurrentDoc) {
                              onSelectArticle(doc.id)
                            }
                          }}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                            isCurrentDoc
                              ? 'border-[var(--ch-accent)]/30 bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                              : 'border-transparent text-[var(--ch-text-primary)] hover:bg-[var(--ch-bg-secondary)]'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                            <span className="truncate">{doc.title}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {docMark === 'warning' && (
                              <AlertTriangle
                                className="h-3.5 w-3.5 text-amber-600"
                                aria-label="Prioridad"
                              />
                            )}
                            {docMark === 'critical' && (
                              <OctagonAlert
                                className="h-3.5 w-3.5 text-red-600"
                                aria-label="Crítico"
                              />
                            )}
                            {docMark === 'verified' && (
                              <CheckCircle2
                                className="h-3.5 w-3.5 text-emerald-600"
                                aria-label="Verificado"
                              />
                            )}
                            {isCurrentDoc && (
                              <span className="font-mono text-[10px] font-bold text-[var(--ch-accent)]">
                                Actual
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer: Quick create article in selected folder + open full folder view */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ch-border-subtle)] pt-2.5 text-[11px] font-semibold">
              {onCreateArticle ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsBreadcrumbPopoverOpen(false)
                    onCreateArticle(activePopoverFolderId)
                  }}
                  className="inline-flex items-center gap-1 text-[var(--ch-accent)] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    Nuevo artículo en{' '}
                    {activePopoverFolder ? activePopoverFolder.title : 'Raíz'}
                  </span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => {
                  setIsBreadcrumbPopoverOpen(false)
                  onSelectNode(activePopoverFolderId)
                }}
                className="inline-flex items-center gap-1 text-[var(--ch-text-secondary)] transition hover:text-[var(--ch-accent)] hover:underline"
              >
                <span>
                  {activePopoverFolder
                    ? `Abrir vista completa de ${activePopoverFolder.title} →`
                    : 'Ir a Mi Repositorio →'}
                </span>
              </button>
            </div>
          </section>
        )}
      </header>

      {/* 2. WORKSPACE FOOTPRINT (Left: A4 Sheet / Editor / Split View; Right: Índice Clínico & Backlinks when present) */}
      {isArticleReady && (() => {
        const hasRightRail =
          !isSplitMode &&
          (sectionHeadings.length > 0 || (!isPdfArticle && backlinks.length > 0))
        return (
          <div
            className={
              isSplitMode
                ? 'grid grid-cols-1 items-start gap-5 xl:grid-cols-2'
                : hasRightRail
                  ? 'grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_290px]'
                  : 'mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-5'
            }
          >
            {/* Left/Main Column */}
            <div className="min-w-0">
              {showEditorPane && (
                <section
                  aria-label="Editor clínico Markdown"
                  className="overflow-hidden rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-2 shadow-[var(--ch-shadow-card)] sm:p-4"
                >
                  {isSplitMode && (
                    <div className="mb-2 flex items-center justify-between border-b border-[var(--ch-border-subtle)] px-2 pb-2 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                      <span>Editor Markdown</span>
                      <span>Edición en vivo</span>
                    </div>
                  )}
                  <MarkdownEditor
                    key={`${articleNode.id}-${editorRevision}`}
                    nodeId={articleNode.id}
                    defaultValue={currentBody}
                    onChange={onSaveMarkdown}
                    onWikiLinkClick={onSelectArticle}
                    editorRef={editorRef}
                  />
                </section>
              )}

              {!isSplitMode && showReaderPane && (
                <section aria-label="Vista de lectura de ficha clínica" className="min-w-0">
                  <ArticleReader
                    articleTitle={articleNode.title}
                    folderPath={folderPathLabel}
                    markdown={currentBody}
                    onWikiLinkClick={onSelectArticle}
                    onOpenExportPdf={onOpenExportPdf}
                    onOpenExportGoogleDocs={onOpenExportGoogleDocs}
                    hideReaderToolbar={true}
                    externalIsTwoColumns={isTwoColumns}
                    externalIsJustified={isJustified}
                  />
                </section>
              )}
            </div>

            {/* Right Column in Split Mode: Live A4 Preview */}
            {isSplitMode && showReaderPane && (
              <section aria-label="Vista previa A4 en vivo" className="min-w-0">
                <ArticleReader
                  articleTitle={articleNode.title}
                  folderPath={folderPathLabel}
                  markdown={currentBody}
                  onWikiLinkClick={onSelectArticle}
                  onOpenExportPdf={onOpenExportPdf}
                  onOpenExportGoogleDocs={onOpenExportGoogleDocs}
                  hideReaderToolbar={true}
                  externalIsTwoColumns={isTwoColumns}
                  externalIsJustified={isJustified}
                />
              </section>
            )}

            {/* Right Clinical Rail: focused solely on section outline and backlinks */}
            {hasRightRail && (
              <aside
                aria-label="Índice clínico del artículo"
                className="flex flex-col gap-4"
              >
                {/* Card 1: Interactive Section Outline */}
                {sectionHeadings.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-4 shadow-[var(--ch-shadow-card)]">
                    <div className="mb-1 flex items-center justify-between font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                      <span className="inline-flex items-center gap-1.5">
                        <ListTree className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                        <span>Índice Clínico</span>
                      </span>
                      <span>{sectionHeadings.length} secc.</span>
                    </div>
                    <div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-0.5">
                      {sectionHeadings.map((sec, idx) => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(sec.id)
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          className={`flex items-center justify-between gap-2 rounded-lg border border-transparent bg-[var(--ch-bg-secondary)]/70 px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)]/30 hover:bg-[var(--ch-accent-soft)] hover:text-[var(--ch-accent)] ${
                            sec.level === 3 ? 'ml-3 text-[11px] font-medium' : ''
                          }`}
                        >
                          <span className="truncate">
                            {sec.level === 2 ? `${idx + 1}. ` : '· '}
                            {sec.text}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--ch-text-muted)]">
                            H{sec.level}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card 2: Backlinks / Referencias Cruzadas */}
                {!isPdfArticle && backlinks.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-4 shadow-[var(--ch-shadow-card)]">
                    <div className="mb-1 flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                      <Link2 className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                      <span>Enlazan aquí ({backlinks.length})</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {backlinks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onSelectArticle(b.id)}
                          className="flex items-center gap-2 rounded-lg bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:bg-[var(--ch-accent-soft)] hover:text-[var(--ch-accent)]"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                          <span className="truncate">{b.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        )
      })()}

      {/* UNIFIED CENTER ORB (+) CLINICAL BLOCK DRAWER (Single point of insertion, includes Wiki-link) */}
      {!isPdfArticle && isOrbDrawerOpen && (
        <div
          ref={orbDrawerRef}
          role="dialog"
          aria-label="Acciones y bloques clínicos del artículo"
          className="fixed bottom-24 left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-4 shadow-[var(--ch-shadow-modal)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
              Insertar en «{articleNode.title}»
            </span>
            <button
              type="button"
              onClick={() => setIsOrbDrawerOpen(false)}
              className="rounded-md p-1 text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
              aria-label="Cerrar cajón de inserción"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <WikiLinkPicker
                className="flex w-full items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                onPick={(text) => {
                  setIsOrbDrawerOpen(false)
                  insertSnippet(text)
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                insertSnippet(
                  '\n\n:::columns\n### Columna 1\n- Criterio...\n\n|||\n\n### Columna 2\n- Conducta...\n:::\n\n',
                )
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
            >
              <Columns2 className="h-4 w-4 text-[var(--ch-accent)]" />
              <span>Bloque 2 Columnas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                insertSnippet(
                  '\n\n> [!WARNING] Signo de Alarma / Red Flag\n> - Criterio de gravedad.\n\n',
                )
              }}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Alerta / Red Flag</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                insertSnippet(
                  '\n\n> [!TIP] Perla Clínica\n> - Dato clave de guardia.\n\n',
                )
              }}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-300"
            >
              <Lightbulb className="h-4 w-4" />
              <span>Perla Clínica</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                insertSnippet(
                  '\n\n> [!DOSIS] Posología y Administración\n> - **Fármaco**: Dosis y vía.\n\n',
                )
              }}
              className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-left text-xs font-semibold text-sky-700 dark:text-sky-300"
            >
              <Pill className="h-4 w-4" />
              <span>Bloque de Dosis</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                insertSnippet(
                  '\n\n| Fármaco | Dosis | Vía | Notas |\n| --- | --- | --- | --- |\n| Ejemplo | 10 mg | EV | — |\n\n',
                )
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
            >
              <Table2 className="h-4 w-4 text-[var(--ch-accent)]" />
              <span>Tabla Clínica</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOrbDrawerOpen(false)
                insertSnippet(
                  '\n\n```mermaid\nflowchart TD\n  A["Sospecha"] --> B["Conducta"]\n```\n\n',
                )
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-2.5 text-left text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)]"
            >
              <GitBranch className="h-4 w-4 text-[var(--ch-accent)]" />
              <span>Algoritmo Mermaid</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. PERSISTENT FLOATING BOTTOM PILL DOCK WITH CENTERED CIRCULAR BUTTON (+) */}
      <nav
        aria-label="Barra inferior contextual del artículo"
        className="fixed bottom-3 left-1/2 z-30 flex w-[95%] max-w-4xl -translate-x-1/2 items-center justify-between gap-1.5 rounded-full border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)]/95 px-2.5 py-2 shadow-[var(--ch-shadow-modal)] backdrop-blur-md sm:gap-2 sm:px-5"
      >
        {/* Left Dock Tools: Unique Mode Switchers */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => {
              setIsSplitMode(false)
              onSetEditMode(false)
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:px-3 ${
              !effectiveEditMode && !isSplitMode
                ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Lector</span>
          </button>

          <button
            type="button"
            disabled={isPdfArticle}
            onClick={() => {
              if (!isPdfArticle) {
                setIsSplitMode(false)
                onSetEditMode(true)
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition disabled:opacity-40 sm:px-3 ${
              effectiveEditMode && !isSplitMode
                ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>Editor</span>
          </button>

          <button
            type="button"
            disabled={isPdfArticle}
            onClick={() => {
              if (!isPdfArticle) {
                setIsSplitMode((prev) => {
                  const next = !prev
                  onSetEditMode(next)
                  return next
                })
              }
            }}
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition disabled:opacity-40 sm:inline-flex ${
              isSplitMode
                ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
            }`}
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span>Dividido</span>
          </button>
        </div>

        {/* Center Raised Circular Action Button (+) */}
        <button
          ref={orbButtonRef}
          type="button"
          disabled={isPdfArticle}
          onClick={() => setIsOrbDrawerOpen((prev) => !prev)}
          aria-label="Abrir cajón de bloques clínicos"
          title="Insertar bloque clínico en el artículo"
          className="flex h-11 w-11 shrink-0 -translate-y-2 items-center justify-center rounded-full border-4 border-[var(--ch-bg-primary)] bg-[var(--ch-accent)] text-white shadow-lg transition hover:scale-105 disabled:opacity-40 sm:h-12 sm:w-12"
        >
          <Plus className={`h-5 w-5 transition-transform ${isOrbDrawerOpen ? 'rotate-45' : ''}`} />
        </button>

        {/* Right Dock Tools: Flashcards, Importar IA, Imprimir PDF, Google Docs */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
          <button
            type="button"
            disabled={isPdfArticle}
            onClick={() => {
              if (!isPdfArticle) onOpenFlashcards()
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)] disabled:opacity-40 sm:px-3"
          >
            <BrainCircuit className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
            <span>Flashcards</span>
          </button>

          <button
            type="button"
            disabled={isPdfArticle}
            onClick={() => {
              if (!isPdfArticle) onOpenSmartImport()
            }}
            className="hidden items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)] disabled:opacity-40 md:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
            <span>Importar IA</span>
          </button>

          {!isPdfArticle && (
            <button
              type="button"
              onClick={onOpenExportPdf}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)] sm:px-3"
            >
              <Printer className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span className="hidden sm:inline">Imprimir</span>
              <span>PDF</span>
            </button>
          )}

          {!isPdfArticle && (
            <button
              type="button"
              onClick={onOpenExportGoogleDocs}
              className="hidden items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)] lg:inline-flex"
            >
              <FileOutput className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Google Docs</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
