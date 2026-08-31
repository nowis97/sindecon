import React, { useState, useEffect, useCallback } from 'react'
import type { FlashcardRow } from '../../db/db'
import { calculateNextSm2, getRatingIntervalLabels, type Sm2Rating } from '../../domain/sm2'
import { updateFlashcard } from '../../db/flashcards'
import { FlashcardMarkdown } from './FlashcardMarkdown'

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
      // Barajar aleatoriamente para repasar de forma no lineal
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

      // Actualizar métricas de sesión
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
    [currentCard, currentIndex, deck.length, onSessionComplete]
  )

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f)
  }, [])

  // Atajos de teclado para estudio rápido
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
          handleRate(1)
        } else if (e.key === '2') {
          e.preventDefault()
          handleRate(2)
        } else if (e.key === '3') {
          e.preventDefault()
          handleRate(3)
        } else if (e.key === '4') {
          e.preventDefault()
          handleRate(4)
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
  const progressPercent = deck.length > 0 ? ((currentIndex) / deck.length) * 100 : 0

  return (
    <div className="study-modal-overlay" onClick={onClose}>
      <div className="study-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera de Estudio */}
        <div className="study-modal-header">
          <div className="study-header-left">
            <span className="study-badge">🧠 Repaso Activo SM-2</span>
            {!isFinished && deck.length > 0 && (
              <span className="study-counter">
                Tarjeta {currentIndex + 1} de {deck.length}
              </span>
            )}
          </div>
          <div className="study-header-right">
            {currentCard && currentCard.node_id && onOpenArticle && (
              <button
                type="button"
                className="btn-study-article-link"
                onClick={() => {
                  onClose()
                  onOpenArticle(currentCard.node_id)
                }}
                title="Abrir apunte completo de este tema"
              >
                📖 Ver Artículo
              </button>
            )}
            <button className="btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Barra de Progreso */}
        {!isFinished && (
          <div className="study-progress-track">
            <div
              className="study-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Pantalla de Fin de Sesión */}
        {isFinished ? (
          <div className="study-finished-screen">
            <div className="finished-badge-icon">🎉</div>
            <h2>¡Sesión de Repaso Completada!</h2>
            <p className="finished-subtitle">
              Has repasado {sessionStats.total} tarjeta{sessionStats.total === 1 ? '' : 's'} hoy. Tu memoria a largo plazo te lo agradecerá en la práctica clínica.
            </p>

            <div className="study-stats-grid">
              <div className="stat-card again">
                <span className="stat-number">{sessionStats.again}</span>
                <span className="stat-label">🔴 Otra vez</span>
              </div>
              <div className="stat-card hard">
                <span className="stat-number">{sessionStats.hard}</span>
                <span className="stat-label">🟡 Difícil</span>
              </div>
              <div className="stat-card good">
                <span className="stat-number">{sessionStats.good}</span>
                <span className="stat-label">🟢 Bueno</span>
              </div>
              <div className="stat-card easy">
                <span className="stat-number">{sessionStats.easy}</span>
                <span className="stat-label">🔵 Fácil</span>
              </div>
            </div>

            <button type="button" className="btn-primary btn-finished-action" onClick={onClose}>
              ✓ Concluir y Volver
            </button>
          </div>
        ) : !currentCard ? (
          <div className="study-empty-state">
            <span className="empty-icon">✨</span>
            <p>No hay tarjetas pendientes para repasar en este momento.</p>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          /* Escenario de Tarjeta Flip 3D */
          <div className="study-card-arena">
            <div
              className={`flashcard-3d-wrapper ${isFlipped ? 'is-flipped' : ''}`}
              onClick={handleFlip}
            >
              {/* Cara Frontal (Pregunta) */}
              <div className="flashcard-face flashcard-front">
                <div className="flashcard-tag-row">
                  <span className="card-prompt-badge">PREGUNTA (Toca o pulsa Espacio)</span>
                  <span className="card-reps-badge">
                    {currentCard.reps === 0 ? '✨ Nueva' : `Racha: ${currentCard.reps}`}
                  </span>
                </div>
                <div className="flashcard-body-text">
                  <FlashcardMarkdown content={currentCard.front} />
                </div>
                <div className="flashcard-flip-prompt">
                  <span>🔄 Toca para voltear y ver respuesta</span>
                </div>
              </div>

              {/* Cara Trasera (Respuesta) */}
              <div className="flashcard-face flashcard-back">
                <div className="flashcard-tag-row">
                  <span className="card-answer-badge">RESPUESTA CLÍNICA</span>
                </div>
                <div className="flashcard-body-text">
                  <FlashcardMarkdown content={currentCard.back} />
                </div>
              </div>
            </div>

            {/* Controles de Calificación Inferiores */}
            <div className="study-controls-panel">
              {!isFlipped ? (
                <button
                  type="button"
                  className="btn-flip-action"
                  onClick={handleFlip}
                >
                  👁️ Mostrar Respuesta (Espacio)
                </button>
              ) : (
                <div className="rating-buttons-row">
                  <button
                    type="button"
                    className="btn-rate-again"
                    onClick={() => handleRate(1)}
                  >
                    <span className="rate-key">1</span>
                    <span className="rate-title">Otra vez</span>
                    <span className="rate-time">{intervals?.[1]}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-rate-hard"
                    onClick={() => handleRate(2)}
                  >
                    <span className="rate-key">2</span>
                    <span className="rate-title">Difícil</span>
                    <span className="rate-time">{intervals?.[2]}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-rate-good"
                    onClick={() => handleRate(3)}
                  >
                    <span className="rate-key">3</span>
                    <span className="rate-title">Bueno</span>
                    <span className="rate-time">{intervals?.[3]}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-rate-easy"
                    onClick={() => handleRate(4)}
                  >
                    <span className="rate-key">4</span>
                    <span className="rate-title">Fácil</span>
                    <span className="rate-time">{intervals?.[4]}</span>
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
