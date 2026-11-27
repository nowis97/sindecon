import { allClozeIndices } from '../../domain/cloze'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BrainCircuit,
  FileText,
  Layers,
  Zap,
  Sparkles,
  Plus,
  Play,
  Search,
  PenLine,
  Eye,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import {
  getFlashcardsByNode,
  createFlashcard,
  deleteFlashcard,
  updateFlashcard,
} from '../../db/flashcards'
import type { FlashcardRow } from '../../db/db'
import { GenerateFlashcardsModal } from './GenerateFlashcardsModal'
import { FlashcardMarkdown } from './FlashcardMarkdown'
import { FlashcardLivePreview } from './FlashcardLivePreview'
import { estimateFlashcardsFromWords } from '../../domain/cardExtractor'
import {
  BaseModal,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
} from '../common/DialogModal'

interface ArticleFlashcardsModalProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string
  articleTitle: string
  bodyMd: string
  onStartStudy?: (cards: FlashcardRow[]) => void
  onOpenAiSettings?: () => void
}

export const ArticleFlashcardsModal: React.FC<ArticleFlashcardsModalProps> = ({
  isOpen,
  onClose,
  nodeId,
  articleTitle,
  bodyMd,
  onStartStudy,
  onOpenAiSettings,
}) => {
  const [cards, setCards] = useState<FlashcardRow[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isCreatingManual, setIsCreatingManual] = useState(false)
  const [manualFront, setManualFront] = useState('')
  const [manualBack, setManualBack] = useState('')
  const [manualTab, setManualTab] = useState<'edit' | 'preview'>('edit')
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit')

  const loadCards = useCallback(async () => {
    const list = await getFlashcardsByNode(nodeId)
    setCards(list)
  }, [nodeId])

  useEffect(() => {
    if (isOpen) {
      void loadCards()
      setIsCreatingManual(false)
      setEditingCardId(null)
      setSearchFilter('')
    }
  }, [isOpen, nodeId, loadCards])

  const now = Date.now()

  const stats = useMemo(() => {
    const dueCount = cards.filter((c) => c.due_date <= now).length
    const masteredCount = cards.filter((c) => c.interval >= 21).length
    const newCount = cards.filter((c) => c.interval === 0).length
    return { dueCount, masteredCount, newCount, total: cards.length }
  }, [cards, now])

  const wordEstimate = useMemo(() => estimateFlashcardsFromWords(bodyMd), [bodyMd])

  const filteredCards = useMemo(() => {
    if (!searchFilter.trim()) return cards
    const q = searchFilter.toLowerCase()
    return cards.filter(
      (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q),
    )
  }, [cards, searchFilter])

  if (!isOpen) return null

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualFront.trim() || !manualBack.trim()) return

    await createFlashcard({
      nodeId,
      front: manualFront.trim(),
      back: manualBack.trim(),
      sourceType: 'manual',
    })

    setManualFront('')
    setManualBack('')
    setIsCreatingManual(false)
    await loadCards()
  }

  const handleDelete = async (id: string) => {
    await deleteFlashcard(id)
    await loadCards()
  }

  const handleSaveEdit = async (id: string) => {
    if (!editFront.trim() || !editBack.trim()) return
    await updateFlashcard(id, { front: editFront.trim(), back: editBack.trim() })
    setEditingCardId(null)
    await loadCards()
  }

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Flashcards SM-2 del Tema"
        subtitle={articleTitle}
        icon={<BrainCircuit className="h-5 w-5" />}
        maxWidthClass="max-w-3xl"
        bodyClassName="space-y-4 px-5 py-4 sm:px-6"
      >
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {wordEstimate.wordCount >= 30 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--ch-text-secondary)]"
              title={`Artículo de ${wordEstimate.wordCount} palabras (${wordEstimate.densityDescription}). Estimación: 1 flashcard clínica por cada ~60 palabras.`}
            >
              <FileText className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>
                ~{wordEstimate.estimatedCards} estimadas ({wordEstimate.wordCount} palabras)
              </span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-primary)] px-3 py-1 font-mono text-[11px] font-semibold text-[var(--ch-text-primary)]"
            title="Total de tarjetas en este tema"
          >
            <Layers className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
            <span>{stats.total} en mazo</span>
          </span>
          {stats.dueCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-accent)]/35 bg-[var(--ch-accent-soft)] px-3 py-1 font-mono text-[11px] font-semibold text-[var(--ch-accent)]"
              title="Tarjetas listas para repasar hoy"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{stats.dueCount} por repasar</span>
            </span>
          )}
        </div>

        {/* Deck Actions Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-y border-[var(--ch-border-subtle)] py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={PILL_BTN_PRIMARY}
              onClick={() => setShowGenerateModal(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Generar Flashcards con IA / Extractor</span>
            </button>
            <button
              type="button"
              className={
                isCreatingManual
                  ? 'inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--ch-accent)] bg-[var(--ch-accent-soft)] px-4 text-xs font-semibold text-[var(--ch-accent)] transition'
                  : PILL_BTN_SECONDARY
              }
              onClick={() => setIsCreatingManual(!isCreatingManual)}
            >
              {isCreatingManual ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>{isCreatingManual ? 'Cancelar' : 'Tarjeta Manual'}</span>
            </button>
          </div>

          {cards.length > 0 && onStartStudy && (
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              onClick={() => {
                onClose()
                onStartStudy(cards)
              }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Repasar Ahora ({cards.length})</span>
            </button>
          )}
        </div>

        {/* Search Filter */}
        {cards.length >= 3 && (
          <div className="flex items-center gap-2 rounded-full border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] px-3.5 py-2 focus-within:border-[var(--ch-accent)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--ch-accent)]" />
            <input
              type="text"
              placeholder="Filtrar preguntas o conceptos de este tema…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)]"
            />
            {searchFilter && (
              <button
                type="button"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ch-text-muted)] transition hover:bg-[var(--ch-bg-secondary)] hover:text-[var(--ch-text-primary)]"
                onClick={() => setSearchFilter('')}
                title="Limpiar filtro"
                aria-label="Limpiar filtro"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Manual Card Creation Form */}
        {isCreatingManual && (
          <form
            onSubmit={(e) => void handleCreateManual(e)}
            className="space-y-3 rounded-2xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-secondary)]/55 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-primary)]">
                <PenLine className="h-4 w-4 text-[var(--ch-accent)]" />
                <span>Añadir Nueva Flashcard</span>
              </span>
              <div className="inline-flex rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-0.5">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    manualTab === 'edit'
                      ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                      : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                  }`}
                  onClick={() => setManualTab('edit')}
                >
                  <PenLine className="h-3 w-3" />
                  <span>Redactar</span>
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    manualTab === 'preview'
                      ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                      : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                  }`}
                  onClick={() => setManualTab('preview')}
                >
                  <Eye className="h-3 w-3" />
                  <span>Vista Previa (Flip 3D)</span>
                </button>
              </div>
            </div>

            {manualTab === 'edit' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                    Pregunta / Anverso
                    <span className="block font-normal text-[11px] text-[var(--ch-text-muted)]">
                      ¿Qué síntoma, dosis o criterio evaluar?
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={manualFront}
                    onChange={(e) => setManualFront(e.target.value)}
                    placeholder="Ej. ¿Cuál es el tratamiento de primera línea en neumonía típica?"
                    autoFocus
                    className="w-full rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] p-2.5 text-xs text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)] focus:border-[var(--ch-accent)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                    Respuesta / Reverso
                    <span className="block font-normal text-[11px] text-[var(--ch-text-muted)]">
                      Respuesta clínica concisa (soporta Markdown)
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={manualBack}
                    onChange={(e) => setManualBack(e.target.value)}
                    placeholder="Ej. Amoxicilina 1g c/8h vía oral por 5 a 7 días."
                    className="w-full rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-primary)] p-2.5 text-xs text-[var(--ch-text-primary)] outline-none placeholder:text-[var(--ch-text-muted)] focus:border-[var(--ch-accent)]"
                  />
                </div>
              </div>
            ) : (
              <div className="manual-card-preview-stage">
                <FlashcardLivePreview
                  front={manualFront}
                  back={manualBack}
                  articleTitle={articleTitle}
                  sourceType="manual"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                className={PILL_BTN_SECONDARY}
                onClick={() => setIsCreatingManual(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={PILL_BTN_PRIMARY}
                disabled={!manualFront.trim() || !manualBack.trim()}
              >
                Añadir al Mazo
              </button>
            </div>
          </form>
        )}

        {/* Cards List */}
        <div className="space-y-3">
          {cards.length === 0 && !isCreatingManual ? (
            <div className="rounded-2xl border border-dashed border-[var(--ch-border-strong)] bg-[var(--ch-bg-secondary)]/35 px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h4 className="font-display text-base font-semibold text-[var(--ch-text-primary)]">
                Sin Flashcards en este Tema
              </h4>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[var(--ch-text-secondary)]">
                Convierte tus apuntes en memoria a largo plazo. Puedes extraer automáticamente conceptos y dosis clave o redactar preguntas manuales.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  className={PILL_BTN_PRIMARY}
                  onClick={() => setShowGenerateModal(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Generar Flashcards Automáticas</span>
                </button>
                <button
                  type="button"
                  className={PILL_BTN_SECONDARY}
                  onClick={() => setIsCreatingManual(true)}
                >
                  <Plus className="h-4 w-4" />
                  <span>Crear Primera Tarjeta</span>
                </button>
              </div>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/45 p-6 text-center">
              <p className="text-xs text-[var(--ch-text-secondary)]">
                No se encontraron tarjetas que coincidan con <strong>«{searchFilter}»</strong>.
              </p>
              <button
                type="button"
                className={`${PILL_BTN_SECONDARY} mt-3`}
                onClick={() => setSearchFilter('')}
              >
                Mostrar todas las tarjetas
              </button>
            </div>
          ) : (
            filteredCards.map((card, idx) => (
              <div
                key={card.id}
                className="space-y-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-primary)]/55 p-4 transition hover:border-[var(--ch-border-strong)]"
              >
                {editingCardId === card.id ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ch-text-primary)]">
                        <Pencil className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                        <span>Editando Tarjeta #{idx + 1}</span>
                      </span>
                      <div className="inline-flex rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-0.5">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                            editTab === 'edit'
                              ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                              : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                          }`}
                          onClick={() => setEditTab('edit')}
                        >
                          <PenLine className="h-3 w-3" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                            editTab === 'preview'
                              ? 'bg-[var(--ch-accent-solid)] text-white shadow-xs'
                              : 'text-[var(--ch-text-secondary)] hover:text-[var(--ch-text-primary)]'
                          }`}
                          onClick={() => setEditTab('preview')}
                        >
                          <Eye className="h-3 w-3" />
                          <span>Vista Previa (Flip 3D)</span>
                        </button>
                      </div>
                    </div>

                    {editTab === 'edit' ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                            Pregunta / Anverso
                          </label>
                          <textarea
                            rows={3}
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            className="w-full rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-2.5 text-xs text-[var(--ch-text-primary)] outline-none focus:border-[var(--ch-accent)]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-[var(--ch-text-primary)]">
                            Respuesta / Reverso (soporta Markdown)
                          </label>
                          <textarea
                            rows={3}
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            className="w-full rounded-xl border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] p-2.5 text-xs text-[var(--ch-text-primary)] outline-none focus:border-[var(--ch-accent)]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="manual-card-preview-stage">
                        <FlashcardLivePreview
                          front={editFront}
                          back={editBack}
                          articleTitle={articleTitle}
                          sourceType={card.source_type}
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        className={PILL_BTN_SECONDARY}
                        onClick={() => setEditingCardId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className={PILL_BTN_PRIMARY}
                        onClick={() => void handleSaveEdit(card.id)}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--ch-text-muted)]">
                          #{idx + 1}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                          {card.source_type === 'cloud_ai' ? (
                            <>
                              <Sparkles className="h-3 w-3 text-[var(--ch-accent)]" />
                              <span>IA Cloud</span>
                            </>
                          ) : card.source_type === 'structural' ? (
                            <>
                              <Zap className="h-3 w-3 text-[var(--ch-accent)]" />
                              <span>Extractor</span>
                            </>
                          ) : (
                            <>
                              <PenLine className="h-3 w-3 text-[var(--ch-accent)]" />
                              <span>Manual</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                            card.interval >= 21
                              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                              : card.interval > 0
                                ? 'bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]'
                                : 'border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-muted)]'
                          }`}
                        >
                          {card.interval === 0
                            ? 'Nueva'
                            : card.interval >= 21
                              ? `Dominada (${card.interval}d)`
                              : `Repaso (${card.interval}d)`}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                          title="Editar"
                          aria-label="Editar tarjeta"
                          onClick={() => {
                            setEditingCardId(card.id)
                            setEditFront(card.front)
                            setEditBack(card.back)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-muted)] transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                          title="Eliminar"
                          aria-label="Eliminar tarjeta"
                          onClick={() => void handleDelete(card.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-3">
                        <span className="mb-1 block font-mono text-[10px] font-bold tracking-wider text-[var(--ch-text-muted)] uppercase">
                          PREGUNTA
                        </span>
                        <div className="text-xs leading-relaxed text-[var(--ch-text-primary)]">
                          <FlashcardMarkdown content={card.front} revealed={allClozeIndices(card.front)} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--ch-accent)]/25 bg-[var(--ch-accent-soft)]/30 p-3">
                        <span className="mb-1 block font-mono text-[10px] font-bold tracking-wider text-[var(--ch-accent)] uppercase">
                          RESPUESTA CLÍNICA
                        </span>
                        <div className="text-xs leading-relaxed text-[var(--ch-text-primary)]">
                          <FlashcardMarkdown content={card.back} revealed={allClozeIndices(card.back)} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </BaseModal>

      <GenerateFlashcardsModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        nodeId={nodeId}
        articleTitle={articleTitle}
        bodyMd={bodyMd}
        onCardsAdded={loadCards}
        onOpenAiSettings={onOpenAiSettings}
      />
    </>
  )
}

