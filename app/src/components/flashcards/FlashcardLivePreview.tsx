import React, { useState } from 'react'
import { FlashcardMarkdown } from './FlashcardMarkdown'

export interface FlashcardLivePreviewProps {
  front: string
  back: string
  articleTitle?: string
  sourceType?: 'manual' | 'structural' | 'cloud_ai' | 'local_ai'
  initialFlipped?: boolean
  onFlipToggle?: (flipped: boolean) => void
  className?: string
}

export const FlashcardLivePreview: React.FC<FlashcardLivePreviewProps> = ({
  front,
  back,
  articleTitle = 'Tema Clínico',
  sourceType = 'manual',
  initialFlipped = false,
  onFlipToggle,
  className = '',
}) => {
  const [isFlipped, setIsFlipped] = useState(initialFlipped)

  const handleFlip = () => {
    const nextState = !isFlipped
    setIsFlipped(nextState)
    if (onFlipToggle) {
      onFlipToggle(nextState)
    }
  }

  const getSourceBadge = () => {
    switch (sourceType) {
      case 'structural':
        return { icon: '⚡', label: 'Estructural' }
      case 'local_ai':
        return { icon: '🧠', label: 'IA Local Qwen' }
      case 'cloud_ai':
        return { icon: '✨', label: 'IA Cloud' }
      case 'manual':
      default:
        return { icon: '✍️', label: 'Manual' }
    }
  }

  const sourceBadge = getSourceBadge()
  const hasFront = Boolean(front.trim())
  const hasBack = Boolean(back.trim())

  return (
    <div
      className={`flashcard-live-preview-container ${className}`}
      onClick={handleFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleFlip()
        }
      }}
      aria-label="Vista previa de flashcard. Haz clic o presiona espacio para voltear."
    >
      <div className={`preview-card-flipper ${isFlipped ? 'flipped' : ''}`}>
        {/* CARA ANVERSO (PREGUNTA) */}
        <div className="preview-card-face preview-card-front">
          <div className="preview-card-header">
            <div className="preview-topic-info">
              <span className="preview-topic-icon">🩺</span>
              <span className="preview-topic-title" title={articleTitle}>
                {articleTitle}
              </span>
            </div>
            <div className="preview-badges-row">
              <span className="preview-source-badge">
                {sourceBadge.icon} {sourceBadge.label}
              </span>
              <span className="preview-face-badge front">Pregunta</span>
            </div>
          </div>

          <div className="preview-card-body">
            {hasFront ? (
              <FlashcardMarkdown content={front} />
            ) : (
              <p className="preview-empty-hint">
                ✍️ <em>Escribe una pregunta, síntoma cardinal, criterio o dosis en el campo de texto...</em>
              </p>
            )}
          </div>

          <div className="preview-card-footer">
            <span className="preview-flip-hint">
              🔄 <strong>Toca la tarjeta</strong> para ver la respuesta
            </span>
          </div>
        </div>

        {/* CARA REVERSO (RESPUESTA) */}
        <div className="preview-card-face preview-card-back">
          <div className="preview-card-header">
            <div className="preview-topic-info">
              <span className="preview-topic-icon">🩺</span>
              <span className="preview-topic-title" title={articleTitle}>
                {articleTitle}
              </span>
            </div>
            <div className="preview-badges-row">
              <span className="preview-source-badge">
                {sourceBadge.icon} {sourceBadge.label}
              </span>
              <span className="preview-face-badge back">Respuesta</span>
            </div>
          </div>

          <div className="preview-card-body">
            {hasBack ? (
              <FlashcardMarkdown content={back} />
            ) : (
              <p className="preview-empty-hint">
                ✍️ <em>Escribe la respuesta médica, conducta, fármaco o tabla de dosis...</em>
              </p>
            )}
          </div>

          <div className="preview-card-footer">
            <span className="preview-flip-hint">
              🔄 <strong>Toca la tarjeta</strong> para ver la pregunta
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
