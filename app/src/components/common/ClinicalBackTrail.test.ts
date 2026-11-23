import { describe, it, expect } from 'vitest'
import { ClinicalBackTrail, type ClinicalBackTrailProps } from './ClinicalBackTrail'
import { pathTo } from '../../domain/tree'
import type { NodeRow } from '../../db/db'

function makeNode(partial: Partial<NodeRow> & Pick<NodeRow, 'id' | 'kind' | 'title'>): NodeRow {
  return {
    parent_id: null,
    order: 0,
    system: null,
    created_at: 1732147200000,
    updated_at: 1732147200000,
    deleted_at: null,
    ...partial,
  }
}

describe('ClinicalBackTrail Component Contract', () => {
  it('exporta ClinicalBackTrail como componente funcional de React', () => {
    expect(typeof ClinicalBackTrail).toBe('function')
  })

  it('ordena los ancestros desde la subcarpeta inmediata hacia la carpeta raíz antes de Página principal', () => {
    const rootFolder = makeNode({ id: 'f-cardio', kind: 'folder', title: 'Cardiología' })
    const subFolder = makeNode({
      id: 'f-arritmias',
      parent_id: 'f-cardio',
      kind: 'folder',
      title: 'Arritmias',
    })
    const nestedSubFolder = makeNode({
      id: 'f-fa',
      parent_id: 'f-arritmias',
      kind: 'folder',
      title: 'Fibrilación Auricular',
    })
    const article = makeNode({
      id: 'a-fa',
      parent_id: 'f-fa',
      kind: 'article',
      title: 'Anticoagulación en FA',
    })

    const ancestors = pathTo([rootFolder, subFolder, nestedSubFolder, article], article.id).slice(0, -1)
    expect(ancestors.map((n) => n.title)).toEqual([
      'Cardiología',
      'Arritmias',
      'Fibrilación Auricular',
    ])

    // El orden inverso para retroceso (Artículo -> Subcarpeta -> Carpeta -> Página principal)
    expect([...ancestors].reverse().map((n) => n.title)).toEqual([
      'Fibrilación Auricular',
      'Arritmias',
      'Cardiología',
    ])

    let navigatedFolder: string | null = null
    let wentHome = false
    const props: ClinicalBackTrailProps = {
      currentKind: 'article',
      currentTitle: article.title,
      ancestors,
      onNavigateFolder: (id) => {
        navigatedFolder = id
      },
      onNavigateHome: () => {
        wentHome = true
      },
    }

    props.onNavigateFolder(ancestors[ancestors.length - 1]!.id)
    props.onNavigateHome()

    expect(navigatedFolder).toBe('f-fa')
    expect(wentHome).toBe(true)
  })
})
