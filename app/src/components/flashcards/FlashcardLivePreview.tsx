import React, { useState } from 'react'
import {
  Zap,
  BrainCircuit,
  Sparkles,
  PenLine,
  Stethoscope,
  RotateCw,
} from 'lucide-react'
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
        return { icon: <Zap className="h-3 w-3" />, label: 'Estructural' }
      case 'local_ai':
        return { icon: <BrainCircuit className="h-3 w-3" />, label: 'IA Local Qwen' }
      case 'cloud_ai':
        return { icon: <Sparkles className="h-3 w-3" />, label: 'IA Cloud' }
      case 'manual':
      default:
        return { icon: <PenLine className="h-3 w-3" />, label: 'Manual' }
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
              <span className="preview-topic-icon inline-flex items-center text-[var(--ch-accent)]">
                <Stethoscope className="h-3.5 w-3.5" />
              </span>
              <span className="preview-topic-title" title={articleTitle}>
                {articleTitle}
              </span>
            </div>
            <div className="preview-badges-row">
              <span className="preview-source-badge inline-flex items-center gap-1">
                {sourceBadge.icon}
                <span>{sourceBadge.label}</span>
              </span>
              <span className="preview-face-badge front">Pregunta</span>
            </div>
          </div>

          <div className="preview-card-body">
            {hasFront ? (
              <FlashcardMarkdown content={front} />
            ) : (
              <p className="preview-empty-hint inline-flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                <em>Escribe una pregunta, síntoma cardinal, criterio o dosis en el campo de texto…</em>
              </p>
            )}
          </div>

          <div className="preview-card-footer">
            <span className="preview-flip-hint inline-flex items-center gap-1.5">
              <RotateCw className="h-3 w-3 text-[var(--ch-accent)]" />
              <span>
                <strong>Toca la tarjeta</strong> para ver la respuesta
              </span>
            </span>
          </div>
        </div>

        {/* CARA REVERSO (RESPUESTA) */}
        <div className="preview-card-face preview-card-back">
          <div className="preview-card-header">
            <div className="preview-topic-info">
              <span className="preview-topic-icon inline-flex items-center text-[var(--ch-accent)]">
                <Stethoscope className="h-3.5 w-3.5" />
              </span>
              <span className="preview-topic-title" title={articleTitle}>
                {articleTitle}
              </span>
            </div>
            <div className="preview-badges-row">
              <span className="preview-source-badge inline-flex items-center gap-1">
                {sourceBadge.icon}
                <span>{sourceBadge.label}</span>
              </span>
              <span className="preview-face-badge back">Respuesta</span>
            </div>
          </div>

          <div className="preview-card-body">
            {hasBack ? (
              <FlashcardMarkdown content={back} />
            ) : (
              <p className="preview-empty-hint inline-flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
                <em>Escribe la respuesta médica, conducta, fármaco o tabla de dosis…</em>
              </p>
            )}
          </div>

          <div className="preview-card-footer">
            <span className="preview-flip-hint inline-flex items-center gap-1.5">
              <RotateCw className="h-3 w-3 text-[var(--ch-accent)]" />
              <span>
                <strong>Toca la tarjeta</strong> para ver la pregunta
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
