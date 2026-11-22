import { describe, it, expect } from 'vitest'
import type { NodeRow } from '../db/db'
import {
  CLINICAL_MARK_META,
  countArticlesByTriage,
  filterArticlesByTriage,
  mergeClinicalMarks,
  sanitizeClinicalMarks,
  type ClinicalMark,
} from './clinicalMarks'

function makeArticle(id: string, title: string, parent_id: string | null = 'f1'): NodeRow {
  return {
    id,
    parent_id,
    kind: 'article',
    title,
    order: 0,
    system: null,
    created_at: 1000,
    updated_at: 2000,
    deleted_at: null,
  }
}

describe('clinicalMarks helpers', () => {
  it('sanitiza marcas válidas y descarta valores inválidos', () => {
    const clean = sanitizeClinicalMarks({
      a1: 'critical',
      a2: 'warning',
      a3: 'verified',
      a4: 'unknown',
      a5: 123,
    })
    expect(clean).toEqual({
      a1: 'critical',
      a2: 'warning',
      a3: 'verified',
    })
    expect(sanitizeClinicalMarks(['critical'])).toEqual({})
  })

  it('combina marcas locales sobre metadata de IndexedDB sin perder claves', () => {
    const merged = mergeClinicalMarks(
      { a1: 'warning', a2: 'verified' },
      { a1: 'critical', a3: 'warning' },
    )
    expect(merged).toEqual({
      a1: 'critical',
      a2: 'verified',
      a3: 'warning',
    })
  })

  it('calcula conteos y filtra por triage clínico e Inbox uniformemente', () => {
    const inboxId = 'sys-folder-inbox'
    const articles = [
      makeArticle('a1', 'Edema Pulmonar Agudo', 'f-cardio'),
      makeArticle('a2', 'ECG Taquicardia Guardia', inboxId),
      makeArticle('a3', 'Sepsis Reanimación', 'f-uci'),
      makeArticle('a4', 'Nota rápida urgencias', inboxId),
    ]
    const marks: Record<string, ClinicalMark> = {
      a1: 'critical',
      a2: 'warning',
      a3: 'verified',
    }

    const counts = countArticlesByTriage(articles, marks, inboxId)
    expect(counts).toEqual({
      all: 4,
      inbox: 2,
      critical: 1,
      warning: 1,
      verified: 1,
    })

    expect(filterArticlesByTriage(articles, marks, inboxId, 'all')).toHaveLength(4)
    expect(filterArticlesByTriage(articles, marks, inboxId, 'inbox').map((a) => a.id)).toEqual([
      'a2',
      'a4',
    ])
    expect(filterArticlesByTriage(articles, marks, inboxId, 'critical').map((a) => a.id)).toEqual([
      'a1',
    ])
    expect(filterArticlesByTriage(articles, marks, inboxId, 'warning').map((a) => a.id)).toEqual([
      'a2',
    ])
    expect(filterArticlesByTriage(articles, marks, inboxId, 'verified').map((a) => a.id)).toEqual([
      'a3',
    ])
  })

  it('expone metadatos consistentes para todas las marcas clínicas', () => {
    expect(CLINICAL_MARK_META.critical.label).toBe('Crítico')
    expect(CLINICAL_MARK_META.warning.label).toBe('Prioridad')
    expect(CLINICAL_MARK_META.verified.label).toBe('Verificado')
  })
})
