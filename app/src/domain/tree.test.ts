import { describe, it, expect } from 'vitest'
import type { NodeRow } from '../db/db'
import { collectDescendantIds, canMove, pathTo, childrenOf, sortNodesBy } from './tree'

let seq = 0
function n(id: string, parent_id: string | null, order = 0): NodeRow {
  return {
    id,
    parent_id,
    kind: 'folder',
    title: id,
    order,
    system: null,
    created_at: ++seq,
    updated_at: seq,
    deleted_at: null,
  }
}

//   A ── B ── D
//   └─ C        E (raíz)
const rows = [n('A', null, 0), n('E', null, 1), n('B', 'A', 0), n('C', 'A', 1), n('D', 'B', 0)]

describe('domain/tree', () => {
  it('collectDescendantIds recoge toda la descendencia', () => {
    expect(collectDescendantIds(rows, 'A').sort()).toEqual(['B', 'C', 'D'])
    expect(collectDescendantIds(rows, 'B')).toEqual(['D'])
    expect(collectDescendantIds(rows, 'E')).toEqual([])
  })

  it('canMove rechaza ciclos y movimientos sobre sí mismo', () => {
    expect(canMove(rows, 'A', 'B')).toBe(false) // B es hijo de A
    expect(canMove(rows, 'A', 'D')).toBe(false) // D es nieto de A
    expect(canMove(rows, 'A', 'A')).toBe(false) // sí mismo
    expect(canMove(rows, 'A', null)).toBe(true) // a raíz
    expect(canMove(rows, 'D', 'C')).toBe(true) // mover hoja a otro padre
    expect(canMove(rows, 'B', 'E')).toBe(true) // rama bajo otra raíz
  })

  it('canMove protege la carpeta de plantillas y sus elementos', () => {
    const tplFolder: NodeRow = { ...n('tpl-folder', null), system: 'templates' }
    const tplArticle: NodeRow = { ...n('tpl-art', 'tpl-folder'), system: 'templates', kind: 'article' }
    const normalArticle: NodeRow = { ...n('art-1', null), kind: 'article' }
    const all = [...rows, tplFolder, tplArticle, normalArticle]

    // No se puede mover una plantilla ni la carpeta de plantillas
    expect(canMove(all, 'tpl-folder', 'A')).toBe(false)
    expect(canMove(all, 'tpl-art', 'A')).toBe(false)
    expect(canMove(all, 'tpl-art', null)).toBe(false)

    // No se puede mover un artículo o carpeta normal hacia la carpeta de plantillas
    expect(canMove(all, 'art-1', 'tpl-folder')).toBe(false)
    expect(canMove(all, 'A', 'tpl-folder')).toBe(false)
  })

  it('pathTo devuelve la ruta raíz → nodo', () => {
    expect(pathTo(rows, 'D').map((x) => x.id)).toEqual(['A', 'B', 'D'])
    expect(pathTo(rows, 'E').map((x) => x.id)).toEqual(['E'])
  })

  it('childrenOf ordena por order y excluye tombstones', () => {
    const conBorrado = [...rows, { ...n('X', 'A', 2), deleted_at: 999 }]
    expect(childrenOf(conBorrado, 'A').map((x) => x.id)).toEqual(['B', 'C'])
    expect(childrenOf(rows, null).map((x) => x.id)).toEqual(['A', 'E'])
  })

  it('canMove solo permite carpetas o null como destino', () => {
    const artTarget: NodeRow = { ...n('art-target', null), kind: 'article' }
    const all = [...rows, artTarget]
    expect(canMove(all, 'D', 'art-target')).toBe(false)
    expect(canMove(all, 'D', 'A')).toBe(true)
  })

  describe('sortNodesBy', () => {
    it('ordena alfabéticamente A-Z respetando acentos y secuencias numéricas en español', () => {
      const list: NodeRow[] = [
        { ...n('1', 'p'), kind: 'article', title: 'Zumo de naranja', order: 0 },
        { ...n('2', 'p'), kind: 'article', title: 'Ácido acetilsalicílico', order: 1 },
        { ...n('3', 'p'), kind: 'article', title: 'Aciclovir', order: 2 },
        { ...n('4', 'p'), kind: 'article', title: 'Fármaco 10', order: 3 },
        { ...n('5', 'p'), kind: 'article', title: 'Fármaco 2', order: 4 },
      ]

      const sorted = sortNodesBy(list, 'alpha-asc')
      expect(sorted.map((x) => x.title)).toEqual([
        'Aciclovir',
        'Ácido acetilsalicílico',
        'Fármaco 2',
        'Fármaco 10',
        'Zumo de naranja',
      ])
    })

    it('ordena alfabéticamente Z-A en orden inverso', () => {
      const list: NodeRow[] = [
        { ...n('1', 'p'), kind: 'article', title: 'Beta' },
        { ...n('2', 'p'), kind: 'article', title: 'Alfa' },
        { ...n('3', 'p'), kind: 'article', title: 'Gamma' },
      ]

      const sorted = sortNodesBy(list, 'alpha-desc')
      expect(sorted.map((x) => x.title)).toEqual(['Gamma', 'Beta', 'Alfa'])
    })

    it('ordena por fecha de modificación más reciente', () => {
      const list: NodeRow[] = [
        { ...n('1', 'p'), kind: 'article', title: 'Viejo', updated_at: 1000 },
        { ...n('2', 'p'), kind: 'article', title: 'Nuevo', updated_at: 5000 },
        { ...n('3', 'p'), kind: 'article', title: 'Medio', updated_at: 3000 },
      ]

      const sorted = sortNodesBy(list, 'recent')
      expect(sorted.map((x) => x.title)).toEqual(['Nuevo', 'Medio', 'Viejo'])
    })

    it('mantiene las carpetas agrupadas antes de los artículos si groupFoldersFirst es true', () => {
      const list: NodeRow[] = [
        { ...n('1', 'p'), kind: 'article', title: 'Asma' },
        { ...n('2', 'p'), kind: 'folder', title: 'Z-Carpeta' },
        { ...n('3', 'p'), kind: 'folder', title: 'A-Carpeta' },
        { ...n('4', 'p'), kind: 'article', title: 'Bronquitis' },
      ]

      const sorted = sortNodesBy(list, 'alpha-asc', true)
      expect(sorted.map((x) => x.title)).toEqual([
        'A-Carpeta',
        'Z-Carpeta',
        'Asma',
        'Bronquitis',
      ])
    })
  })
})
