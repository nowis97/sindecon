import { db, type NodeRow } from '../db/db'

export type ClinicalMark = 'warning' | 'critical' | 'verified'
export type ClinicalTriageFilter = 'all' | 'inbox' | ClinicalMark

export const CLINICAL_MARKS_STORAGE_KEY = 'sindecon_article_marks'

export interface ClinicalMarkMeta {
  label: string
  shortLabel: string
  description: string
  badgeClass: string
}

export const CLINICAL_MARK_META: Record<ClinicalMark, ClinicalMarkMeta> = {
  critical: {
    label: 'Crítico',
    shortLabel: 'Crítico',
    description: 'Protocolo o conducta de alto riesgo vital',
    badgeClass:
      'border-[var(--cl-danger-border)] bg-[var(--cl-danger-soft)] text-[var(--cl-danger)]',
  },
  warning: {
    label: 'Prioridad',
    shortLabel: 'Prioridad',
    description: 'Pendiente de revisión o actualización',
    badgeClass:
      'border-[var(--cl-warn-border)] bg-[var(--cl-warn-soft)] text-[var(--cl-warn)]',
  },
  verified: {
    label: 'Verificado',
    shortLabel: 'Verificado',
    description: 'Protocolo revisado y validado',
    badgeClass:
      'border-[var(--cl-success-border)] bg-[var(--cl-success-soft)] text-[var(--cl-success)]',
  },
}

function isValidClinicalMark(val: unknown): val is ClinicalMark {
  return val === 'warning' || val === 'critical' || val === 'verified'
}

export function sanitizeClinicalMarks(raw: unknown): Record<string, ClinicalMark> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Record<string, ClinicalMark> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidClinicalMark(v)) {
      result[k] = v
    }
  }
  return result
}

export function readAllClinicalMarks(): Record<string, ClinicalMark> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CLINICAL_MARKS_STORAGE_KEY)
    if (!raw) return {}
    return sanitizeClinicalMarks(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function saveAllClinicalMarks(marks: Record<string, ClinicalMark>): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CLINICAL_MARKS_STORAGE_KEY, JSON.stringify(marks))
    } catch {
      // Ignore storage quota errors
    }
  }
  void db.meta.put({ key: 'clinical_marks', value: marks }).catch(() => {})
}

export function writeArticleMark(
  nodeId: string,
  mark: ClinicalMark | null,
  currentMarks?: Record<string, ClinicalMark>,
): Record<string, ClinicalMark> {
  const next = { ...(currentMarks ?? readAllClinicalMarks()) }
  if (!mark) {
    delete next[nodeId]
  } else {
    next[nodeId] = mark
  }
  saveAllClinicalMarks(next)
  return next
}

export function mergeClinicalMarks(
  metaValue: unknown,
  localMarks: Record<string, ClinicalMark>,
): Record<string, ClinicalMark> {
  return {
    ...sanitizeClinicalMarks(metaValue),
    ...localMarks,
  }
}

export function matchesTriageFilter(
  node: NodeRow,
  marks: Record<string, ClinicalMark>,
  inboxFolderId: string | null | undefined,
  filter: ClinicalTriageFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'inbox') {
    return Boolean(inboxFolderId && node.parent_id === inboxFolderId)
  }
  return marks[node.id] === filter
}

export function filterArticlesByTriage(
  articles: NodeRow[],
  marks: Record<string, ClinicalMark>,
  inboxFolderId: string | null | undefined,
  filter: ClinicalTriageFilter,
): NodeRow[] {
  if (filter === 'all') return articles
  return articles.filter((art) => matchesTriageFilter(art, marks, inboxFolderId, filter))
}

export function countArticlesByTriage(
  articles: NodeRow[],
  marks: Record<string, ClinicalMark>,
  inboxFolderId: string | null | undefined,
): Record<ClinicalTriageFilter, number> {
  const counts: Record<ClinicalTriageFilter, number> = {
    all: articles.length,
    inbox: 0,
    critical: 0,
    warning: 0,
    verified: 0,
  }
  for (const art of articles) {
    if (inboxFolderId && art.parent_id === inboxFolderId) {
      counts.inbox += 1
    }
    const mark = marks[art.id]
    if (mark) {
      counts[mark] += 1
    }
  }
  return counts
}
