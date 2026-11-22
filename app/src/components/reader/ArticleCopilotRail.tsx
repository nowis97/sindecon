import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  Eye,
  FolderInput,
  FolderOpen,
  Link2,
  ListTree,
  OctagonAlert,
  RotateCcw,
  Sparkles,
  Tag,
} from 'lucide-react'
import { db, type FlashcardRow, type NodeRow } from '../../db/db'
import { updateFlashcard } from '../../db/flashcards'
import { calculateNextSm2, getRatingIntervalLabels, type Sm2Rating } from '../../domain/sm2'
import { CLINICAL_MARK_META, type ClinicalMark } from '../../utils/clinicalMarks'
import { FlashcardMarkdown } from '../flashcards/FlashcardMarkdown'

export type CopilotTab = 'indice' | 'sm2' | 'triage'

export interface ArticleCopilotRailProps {
  articleId: string
  parentFolder: NodeRow | null
  sectionHeadings: Array<{ text: string; id: string; level: number }>
  backlinks: Array<{ id: string; title: string }>
  tags: string[]
  clinicalMark: ClinicalMark | null
  activeTab: CopilotTab
  onChangeTab: (tab: CopilotTab) => void
  onSelectMark: (mark: ClinicalMark | null) => void
  onSelectArticle: (id: string) => void
  onSelectNode: (id: string | null) => void
  onOpenFlashcards: () => void
  onRequestMove?: () => void
  onExportMarkdown?: () => void
}

const RATING_OPTIONS: Array<{
  rating: Sm2Rating
  label: string
  btnClass: string
}> = [
  {
    rating: 1,
    label: 'Otra vez',
    btnClass:
      'border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] text-[var(--cl-danger)] hover:brightness-95',
  },
  {
    rating: 2,
    label: 'Difícil',
    btnClass:
      'border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] text-[var(--cl-warn)] hover:brightness-95',
  },
  {
    rating: 3,
    label: 'Bueno',
    btnClass:
      'border-[var(--cl-accent)] bg-[var(--cl-accent)] text-white hover:bg-[var(--cl-accent-hover)]',
  },
  {
    rating: 4,
    label: 'Fácil',
    btnClass:
      'border-[var(--cl-success-border)] bg-[var(--cl-success-soft)] text-[var(--cl-success)] hover:brightness-95',
  },
]

const MARK_OPTIONS: Array<{
  key: ClinicalMark
  label: string
  icon: typeof AlertTriangle
}> = [
  { key: 'critical', label: 'Crítico', icon: OctagonAlert },
  { key: 'warning', label: 'Prioridad', icon: AlertTriangle },
  { key: 'verified', label: 'Verificado', icon: CheckCircle2 },
]

export function ArticleCopilotRail({
  articleId,
  parentFolder,
  sectionHeadings,
  backlinks,
  tags,
  clinicalMark,
  activeTab,
  onChangeTab,
  onSelectMark,
  onSelectArticle,
  onSelectNode,
  onOpenFlashcards,
  onRequestMove,
  onExportMarkdown,
}: ArticleCopilotRailProps) {
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isSavingRating, setIsSavingRating] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())

  const rawFlashcards = useLiveQuery(
    () => db.flashcards.where('node_id').equals(articleId).toArray(),
    [articleId],
    [] as FlashcardRow[],
  )

  const orderedCards = useMemo(() => {
    const cards = [...(rawFlashcards ?? [])]
    cards.sort((a, b) => {
      const aDue = a.due_date <= nowTs ? 0 : 1
      const bDue = b.due_date <= nowTs ? 0 : 1
      if (aDue !== bDue) return aDue - bDue
      return a.due_date - b.due_date
    })
    return cards
  }, [rawFlashcards, nowTs])

  const dueCount = useMemo(
    () => orderedCards.filter((c) => c.due_date <= nowTs).length,
    [orderedCards, nowTs],
  )

  const safeIndex = orderedCards.length > 0 ? cardIndex % orderedCards.length : 0
  const activeCard = orderedCards[safeIndex] ?? null
  const intervals = activeCard ? getRatingIntervalLabels(activeCard) : null

  const handleGradeCard = async (rating: Sm2Rating) => {
    if (!activeCard || isSavingRating) return
    setIsSavingRating(true)
    try {
      const next = calculateNextSm2(activeCard, rating)
      await updateFlashcard(activeCard.id, next)
      setIsFlipped(false)
      setNowTs(Date.now())
      setCardIndex((prev) => (orderedCards.length > 1 ? (prev + 1) % orderedCards.length : 0))
    } finally {
      setIsSavingRating(false)
    }
  }

  return (
    <aside
      aria-label="Copiloto clínico en pestañas"
      className="flex flex-col rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] shadow-[var(--ch-shadow-card)] lg:sticky lg:top-4"
    >
      {/* 3-Tab Header */}
      <div
        role="tablist"
        aria-label="Herramientas del protocolo"
        className="grid grid-cols-3 gap-1 rounded-t-2xl border-b border-[var(--ch-border-subtle)] bg-[var(--cl-surface-warm)] p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'indice'}
          onClick={() => onChangeTab('indice')}
          className={`flex min-h-[36px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'indice'
              ? 'bg-[var(--ch-bg-elevated)] text-[var(--cl-diagnostic)] shadow-xs'
              : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
          }`}
        >
          <ListTree className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Índice</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sm2'}
          onClick={() => onChangeTab('sm2')}
          className={`flex min-h-[36px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'sm2'
              ? 'bg-[var(--ch-bg-elevated)] text-[var(--cl-diagnostic)] shadow-xs'
              : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
          }`}
        >
          <Brain className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">SM-2</span>
          <span className="font-mono text-[10px] opacity-85">({orderedCards.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'triage'}
          onClick={() => onChangeTab('triage')}
          className={`flex min-h-[36px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'triage'
              ? 'bg-[var(--ch-bg-elevated)] text-[var(--cl-diagnostic)] shadow-xs'
              : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
          }`}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Triage</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-4">
        {activeTab === 'indice' && (
          <div role="tabpanel" className="flex flex-col gap-3">
            <div className="flex items-center justify-between font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
              <span>Estructura del protocolo</span>
              <span className="tabular-nums">{sectionHeadings.length}</span>
            </div>

            {sectionHeadings.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-3 text-xs text-[var(--ch-text-muted)] m-0">
                Este documento no tiene subtítulos H2/H3. Usa la pestaña SM-2 o Triage para repasar o clasificar.
              </p>
            ) : (
              <nav className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1" aria-label="Secciones del protocolo">
                {sectionHeadings.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(sec.id)
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-[var(--ch-accent-soft)] hover:text-[var(--cl-diagnostic)] cursor-pointer ${
                      sec.level === 3
                        ? 'pl-5 font-medium text-[var(--ch-text-muted)]'
                        : 'font-semibold text-[var(--ch-text-primary)]'
                    }`}
                  >
                    {sec.text}
                  </button>
                ))}
              </nav>
            )}

            {parentFolder && (
              <button
                type="button"
                onClick={() => onSelectNode(parentFolder.id)}
                className="flex min-h-[38px] items-center justify-between gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-2 text-left text-xs font-semibold text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--cl-diagnostic)] cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--cl-diagnostic)]" />
                  <span className="truncate">{parentFolder.title}</span>
                </span>
                <span className="font-mono text-[10px] text-[var(--ch-text-muted)] shrink-0">
                  Abrir →
                </span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'sm2' && (
          <div role="tabpanel" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-[var(--cl-diagnostic)] uppercase">
                Repaso SM-2 integrado
              </span>
              {orderedCards.length > 0 && (
                <span className="rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--ch-text-secondary)]">
                  {dueCount > 0 ? `${dueCount} por repasar` : 'Al día'} · {safeIndex + 1}/{orderedCards.length}
                </span>
              )}
            </div>

            {!activeCard ? (
              <div className="rounded-xl border border-dashed border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-4 text-center flex flex-col gap-2.5">
                <p className="text-xs text-[var(--ch-text-secondary)] m-0">
                  Este protocolo aún no tiene flashcards SM-2 asociadas.
                </p>
                <button
                  type="button"
                  onClick={onOpenFlashcards}
                  className="min-h-[40px] w-full rounded-xl bg-[var(--cl-accent)] hover:bg-[var(--cl-accent-hover)] px-3 py-2 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Crear o generar flashcards</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] p-3.5 flex flex-col gap-2.5">
                  <div className="text-xs font-semibold leading-relaxed text-[var(--ch-text-primary)] max-h-40 overflow-y-auto">
                    <FlashcardMarkdown content={activeCard.front} />
                  </div>

                  {isFlipped && (
                    <div className="border-t border-dashed border-[var(--ch-border-subtle)] pt-2.5 text-xs leading-relaxed text-[var(--ch-text-secondary)] max-h-44 overflow-y-auto">
                      <FlashcardMarkdown content={activeCard.back} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsFlipped((prev) => !prev)}
                    className="min-h-[38px] w-full rounded-lg border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] hover:border-[var(--ch-accent)] text-xs font-semibold text-[var(--cl-diagnostic)] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isFlipped ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Ocultar respuesta</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        <span>Mostrar respuesta</span>
                      </>
                    )}
                  </button>
                </div>

                {isFlipped && intervals && (
                  <div className="grid grid-cols-2 gap-1.5" aria-label="Calificar tarjeta SM-2">
                    {RATING_OPTIONS.map((opt) => (
                      <button
                        key={opt.rating}
                        type="button"
                        disabled={isSavingRating}
                        onClick={() => void handleGradeCard(opt.rating)}
                        className={`min-h-[44px] rounded-xl border px-2 py-1.5 text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${opt.btnClass}`}
                      >
                        <span className="text-xs font-bold leading-none">{opt.label}</span>
                        <span className="font-mono text-[10px] opacity-85 leading-none">
                          {intervals[opt.rating]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  {orderedCards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsFlipped(false)
                        setCardIndex((prev) => (prev + 1) % orderedCards.length)
                      }}
                      className="text-[11px] font-semibold text-[var(--ch-text-muted)] hover:text-[var(--cl-diagnostic)] cursor-pointer"
                    >
                      Siguiente tarjeta →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenFlashcards}
                    className="ml-auto text-[11px] font-semibold text-[var(--cl-diagnostic)] hover:underline cursor-pointer"
                  >
                    Gestionar mazo ({orderedCards.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'triage' && (
          <div role="tabpanel" className="flex flex-col gap-3.5">
            <div>
              <div className="mb-1.5 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                Estado clínico (1-Tap)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {MARK_OPTIONS.map(({ key, label, icon: Icon }) => {
                  const active = clinicalMark === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectMark(key)}
                      className={`min-h-[38px] rounded-xl border px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                        active
                          ? CLINICAL_MARK_META[key].badgeClass
                          : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-secondary)] hover:border-[var(--ch-accent)]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{label}</span>
                    </button>
                  )
                })}
                {clinicalMark && (
                  <button
                    type="button"
                    onClick={() => onSelectMark(null)}
                    className="min-h-[38px] rounded-xl border border-dashed border-[var(--ch-border-subtle)] bg-transparent px-2.5 py-1.5 text-xs font-semibold text-[var(--ch-text-muted)] hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)] cursor-pointer"
                  >
                    Sin marca
                  </button>
                )}
              </div>
            </div>

            {tags.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                  <Tag className="h-3 w-3" />
                  <span>Etiquetas ({tags.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--ch-text-secondary)]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-semibold tracking-wider text-[var(--ch-text-muted)] uppercase">
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="h-3 w-3" />
                  <span>Enlazan aquí</span>
                </span>
                <span>{backlinks.length}</span>
              </div>
              {backlinks.length === 0 ? (
                <p className="text-xs text-[var(--ch-text-muted)] m-0">
                  Ningún otro protocolo enlaza todavía hacia esta ficha.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {backlinks.map((bl) => (
                    <button
                      key={bl.id}
                      type="button"
                      onClick={() => onSelectArticle(bl.id)}
                      className="rounded-lg border border-transparent bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-left text-xs font-medium text-[var(--ch-text-primary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--cl-diagnostic)] cursor-pointer"
                    >
                      [[{bl.title}]]
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(onRequestMove || onExportMarkdown) && (
              <div className="flex flex-wrap gap-1.5 border-t border-[var(--ch-border-subtle)] pt-3">
                {onRequestMove && (
                  <button
                    type="button"
                    onClick={onRequestMove}
                    className="flex-1 min-h-[38px] rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)] hover:text-[var(--cl-diagnostic)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                    <span>Mover</span>
                  </button>
                )}
                {onExportMarkdown && (
                  <button
                    type="button"
                    onClick={onExportMarkdown}
                    className="flex-1 min-h-[38px] rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ch-text-primary)] hover:border-[var(--ch-accent)] hover:text-[var(--cl-diagnostic)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar .md</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
