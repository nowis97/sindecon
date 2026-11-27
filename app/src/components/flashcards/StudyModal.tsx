import { allClozeIndices } from '../../domain/cloze'
import React, { useState, useEffect, useCallback } from 'react'
import {
  BrainCircuit,
  BookOpen,
  X,
  CheckCircle2,
  Eye,
  RotateCw,
  Sparkles,
} from 'lucide-react'
import type { FlashcardRow } from '../../db/db'
import { calculateNextSm2, getRatingIntervalLabels, type Sm2Rating } from '../../domain/sm2'
import { updateFlashcard } from '../../db/flashcards'
import { FlashcardMarkdown } from './FlashcardMarkdown'
import { PILL_BTN_PRIMARY, PILL_BTN_SECONDARY } from '../common/DialogModal'

interface StudyModalProps {
  isOpen: boolean
  onClose: () => void
  cards: FlashcardRow[]
  onOpenArticle?: (nodeId: string) => void
  onSessionComplete?: () => void
}

export const StudyModal: React.FC<StudyModalProps> = ({
  isOpen,
  onClose,
  cards,
  onOpenArticle,
  onSessionComplete,
}) => {
  const [deck, setDeck] = useState<FlashcardRow[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  })

  useEffect(() => {
    if (isOpen) {
      const shuffled = [...cards].sort(() => Math.random() - 0.5)
      setDeck(shuffled)
      setCurrentIndex(0)
      setIsFlipped(false)
      setIsFinished(false)
      setSessionStats({ total: shuffled.length, again: 0, hard: 0, good: 0, easy: 0 })
    }
  }, [isOpen, cards])

  const currentCard = deck[currentIndex]

  const handleRate = useCallback(
    async (rating: Sm2Rating) => {
      if (!currentCard) return

      const nextSm2 = calculateNextSm2(currentCard, rating)
      await updateFlashcard(currentCard.id, {
        ...nextSm2,
      })

      setSessionStats((prev) => ({
        ...prev,
        again: rating === 1 ? prev.again + 1 : prev.again,
        hard: rating === 2 ? prev.hard + 1 : prev.hard,
        good: rating === 3 ? prev.good + 1 : prev.good,
        easy: rating === 4 ? prev.easy + 1 : prev.easy,
      }))

      if (currentIndex + 1 < deck.length) {
        setIsFlipped(false)
        setCurrentIndex((i) => i + 1)
      } else {
        setIsFinished(true)
        if (onSessionComplete) onSessionComplete()
      }
    },
    [currentCard, currentIndex, deck.length, onSessionComplete],
  )

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f)
  }, [])

  useEffect(() => {
    if (!isOpen || isFinished) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        handleFlip()
      } else if (isFlipped) {
        if (e.key === '1') {
          e.preventDefault()
          void handleRate(1)
        } else if (e.key === '2') {
          e.preventDefault()
          void handleRate(2)
        } else if (e.key === '3') {
          e.preventDefault()
          void handleRate(3)
        } else if (e.key === '4') {
          e.preventDefault()
          void handleRate(4)
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isFinished, isFlipped, handleFlip, handleRate, onClose])

  if (!isOpen) return null

  const intervals = currentCard ? getRatingIntervalLabels(currentCard) : null
  const progressPercent = deck.length > 0 ? (currentIndex / deck.length) * 100 : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xs sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Repaso Activo SM-2"
    >
      <div
        className="clinical-home flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-primary)] shadow-[var(--ch-shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ch-border-subtle)] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold tracking-tight text-[var(--ch-text-primary)]">
                Repaso Activo SM-2
              </h3>
              <p className="mt-0.5 text-xs text-[var(--ch-text-muted)]">
                {!isFinished && deck.length > 0
                  ? `Tarjeta ${currentIndex + 1} de ${deck.length}`
                  : isFinished
                    ? 'Sesión de repaso completada'
                    : 'Cola de estudio clínico'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {currentCard && currentCard.node_id && onOpenArticle && (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] px-3 text-xs font-semibold text-[var(--ch-text-secondary)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-accent)]"
                onClick={() => {
                  onClose()
                  onOpenArticle(currentCard.node_id)
                }}
                title="Abrir apunte completo de este tema"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Ver Artículo</span>
              </button>
            )}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)] text-[var(--ch-text-muted)] transition hover:border-[var(--ch-accent)] hover:text-[var(--ch-text-primary)]"
              onClick={onClose}
              aria-label="Cerrar repaso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Progress Bar */}
        {!isFinished && (
          <div className="h-1.5 w-full shrink-0 bg-[var(--ch-bg-secondary)]">
            <div
              className="h-full bg-[var(--ch-accent)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Session Complete Screen */}
        {isFinished ? (
          <div className="flex-1 overflow-y-auto px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="font-display text-xl font-semibold text-[var(--ch-text-primary)]">
              ¡Sesión de Repaso Completada!
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[var(--ch-text-secondary)]">
              Has repasado {sessionStats.total} tarjeta{sessionStats.total === 1 ? '' : 's'} hoy. Tu memoria a largo plazo te lo agradecerá en la práctica clínica.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-3">
                <span className="block font-mono text-xl font-bold text-red-600 dark:text-red-400">
                  {sessionStats.again}
                </span>
                <span className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                  Otra vez
                </span>
              </div>
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
                <span className="block font-mono text-xl font-bold text-amber-700 dark:text-amber-300">
                  {sessionStats.hard}
                </span>
                <span className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                  Difícil
                </span>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <span className="block font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  {sessionStats.good}
                </span>
                <span className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                  Bueno
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--ch-accent)]/30 bg-[var(--ch-accent-soft)] p-3">
                <span className="block font-mono text-xl font-bold text-[var(--ch-accent)]">
                  {sessionStats.easy}
                </span>
                <span className="text-[11px] font-semibold text-[var(--ch-text-secondary)]">
                  Fácil
                </span>
              </div>
            </div>

            <button
              type="button"
              className={`${PILL_BTN_PRIMARY} mt-6`}
              onClick={onClose}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Concluir y Volver</span>
            </button>
          </div>
        ) : !currentCard ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              <Sparkles className="h-6 w-6" />
            </span>
            <p className="text-sm text-[var(--ch-text-secondary)]">
              No hay tarjetas pendientes para repasar en este momento.
            </p>
            <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <div className="study-card-arena min-h-0 flex-1 overflow-y-auto">
            <div
              className={`flashcard-3d-wrapper ${isFlipped ? 'is-flipped' : ''}`}
              onClick={handleFlip}
            >
              {/* Front Face */}
              <div className="flashcard-face flashcard-front">
                <div className="flashcard-tag-row">
                  <span className="card-prompt-badge">PREGUNTA (Toca o pulsa Espacio)</span>
                  <span className="card-reps-badge">
                    {currentCard.reps === 0 ? 'Nueva' : `Racha: ${currentCard.reps}`}
                  </span>
                </div>
                <div className="flashcard-body-text">
                  <FlashcardMarkdown content={currentCard.front} />
                </div>
                <div className="flashcard-flip-prompt inline-flex items-center gap-1.5">
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Toca para voltear y ver respuesta</span>
                </div>
              </div>

              {/* Back Face */}
              <div className="flashcard-face flashcard-back">
                <div className="flashcard-tag-row">
                  <span className="card-answer-badge">RESPUESTA CLÍNICA</span>
                </div>
                <div className="flashcard-body-text">
                  <FlashcardMarkdown content={currentCard.back} revealed={allClozeIndices(currentCard.back)} />
                </div>
              </div>
            </div>

            {/* Rating Controls */}
            <div className="mt-5 w-full">
              {!isFlipped ? (
                <button
                  type="button"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--ch-accent-solid)] px-6 text-sm font-semibold text-white shadow-xs transition hover:opacity-95"
                  onClick={handleFlip}
                >
                  <Eye className="h-4 w-4" />
                  <span>Mostrar Respuesta (Espacio)</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <button
                    type="button"
                    className="flex flex-col items-center gap-0.5 rounded-2xl border border-red-500/35 bg-red-500/8 px-3 py-2.5 transition hover:bg-red-500/15"
                    onClick={() => void handleRate(1)}
                  >
                    <span className="font-mono text-[10px] font-bold text-red-600 dark:text-red-400">
                      1
                    </span>
                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                      Otra vez
                    </span>
                    <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                      {intervals?.[1]}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-0.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 transition hover:bg-amber-500/20"
                    onClick={() => void handleRate(2)}
                  >
                    <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      2
                    </span>
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      Difícil
                    </span>
                    <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                      {intervals?.[2]}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-0.5 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 transition hover:bg-emerald-500/20"
                    onClick={() => void handleRate(3)}
                  >
                    <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      3
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                      Bueno
                    </span>
                    <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                      {intervals?.[3]}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-0.5 rounded-2xl border border-[var(--ch-accent)]/40 bg-[var(--ch-accent-soft)] px-3 py-2.5 transition hover:opacity-90"
                    onClick={() => void handleRate(4)}
                  >
                    <span className="font-mono text-[10px] font-bold text-[var(--ch-accent)]">
                      4
                    </span>
                    <span className="text-xs font-semibold text-[var(--ch-accent)]">Fácil</span>
                    <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                      {intervals?.[4]}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

