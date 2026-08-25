import { describe, it, expect } from 'vitest'
import { mergeDatabase, type DbSnapshot } from './merge'
import type { NodeRow, ArticleRow } from '../db/db'

let seq = 0
function node(id: string, over: Partial<NodeRow> = {}): NodeRow {
  seq++
  return {
    id,
    parent_id: null,
    kind: 'article',
    title: id,
    order: 0,
    system: null,
    created_at: seq * 1000,
    updated_at: seq * 1000,
    deleted_at: null,
    ...over,
  }
}

function article(nodeId: string, body = 'cuerpo'): ArticleRow {
  return { node_id: nodeId, body_md: body, tags: [] }
}

const empty: DbSnapshot = { nodes: [], articles: [], assets: [] }

describe('fusión por uuid (design D6)', () => {
  it('import sobre base vacía añade todo', () => {
    const incoming = { ...empty, nodes: [node('a'), node('b')], articles: [article('a'), article('b')] }
    const { result, report } = mergeDatabase(empty, incoming)
    expect(result.nodes).toHaveLength(2)
    expect(result.articles).toHaveLength(2)
    expect(report.nodesAdded).toBe(2)
    expect(report.articlesAdded).toBe(2)
  })

  it('re-import idéntico no cambia nada (todo skipped)', () => {
    const snap = { ...empty, nodes: [node('a')], articles: [article('a')] }
    const { result, report } = mergeDatabase(snap, structuredClone(snap))
    expect(result.nodes).toHaveLength(1)
    expect(report.nodesSkipped).toBe(1)
    expect(report.articlesSkipped).toBe(1)
    expect(report.nodesAdded + report.nodesUpdated).toBe(0)
  })

  it('entrante más reciente gana; local más reciente sobrevive', () => {
    const viejo = node('a', { updated_at: 1000 })
    const local = { ...empty, nodes: [node('b', { updated_at: 5000 })], articles: [] }
    const incoming = {
      ...empty,
      nodes: [
        { ...viejo, title: 'actualizado' }, // a: local no lo tiene → añade
        node('b', { updated_at: 2000, title: 'entrante viejo' }), // b: local gana
      ],
    }
    const { result } = mergeDatabase(local, incoming)
    const a = result.nodes.find((n) => n.id === 'a')!
    const b = result.nodes.find((n) => n.id === 'b')!
    expect(a.title).toBe('actualizado')
    expect(b.title).not.toBe('entrante viejo') // el local (más nuevo) queda
  })

  it('tombstone entrante elimina el nodo local vivo', () => {
    const local = { ...empty, nodes: [node('a', { updated_at: 1000 })], articles: [article('a')] }
    const incoming = { ...empty, nodes: [node('a', { updated_at: 2000, deleted_at: 2000 })] }
    const { result, report } = mergeDatabase(local, incoming)
    expect(result.nodes.find((n) => n.id === 'a')?.deleted_at).toBe(2000)
    expect(report.nodesDeleted).toBe(1)
    expect(result.articles).toHaveLength(0) // su artículo cae con él
  })

  it('eliminación local más reciente NO es resucitada por export viejo', () => {
    const local = { ...empty, nodes: [node('a', { updated_at: 5000, deleted_at: 5000 })] }
    const incoming = { ...empty, nodes: [node('a', { updated_at: 1000 })] } // vivo pero viejo
    const { result, report } = mergeDatabase(local, incoming)
    expect(result.nodes.find((n) => n.id === 'a')?.deleted_at).toBe(5000)
    expect(report.nodesSkipped).toBe(1)
    expect(report.nodesUpdated).toBe(0)
  })

  it('tombstone entrante de algo que nunca tuvimos se ignora', () => {
    const incoming = { ...empty, nodes: [node('fantasma', { deleted_at: 1000 })] }
    const { result } = mergeDatabase(empty, incoming)
    expect(result.nodes).toHaveLength(0)
  })

  it('los artículos siguen el updated_at de su nodo dueño', () => {
    const local = {
      ...empty,
      nodes: [node('a', { updated_at: 5000 })],
      articles: [article('a', 'versión local')],
    }
    const incoming = {
      ...empty,
      nodes: [node('a', { updated_at: 2000 })], // más viejo → local gana
      articles: [article('a', 'versión entrante')],
    }
    const { result } = mergeDatabase(local, incoming)
    expect(result.articles.find((a) => a.node_id === 'a')?.body_md).toBe('versión local')
  })

  it('artículos entrantes de nodos muertos no se importan', () => {
    const local = { ...empty, nodes: [node('a', { updated_at: 1000 })] }
    const incoming = {
      ...empty,
      nodes: [node('a', { updated_at: 2000, deleted_at: 2000 })],
      articles: [article('a', 'huérfano')],
    }
    const { result } = mergeDatabase(local, incoming)
    expect(result.articles).toHaveLength(0)
  })

  it('unifica carpetas Inbox de diferentes dispositivos sin duplicarlas y reubica capturas', () => {
    const local = {
      ...empty,
      nodes: [
        node('local-inbox-uuid', {
          kind: 'folder',
          title: 'Inbox',
          system: 'inbox',
          parent_id: null,
          updated_at: 1000,
        }),
      ],
      articles: [],
    }

    const incoming = {
      ...empty,
      nodes: [
        node('remote-inbox-uuid', {
          kind: 'folder',
          title: 'Inbox',
          system: 'inbox',
          parent_id: null,
          updated_at: 2000,
        }),
        node('remote-capture-1', {
          kind: 'article',
          title: 'Nota rápida remota',
          parent_id: 'remote-inbox-uuid',
          updated_at: 2000,
        }),
      ],
      articles: [article('remote-capture-1', 'Contenido de nota remota')],
    }

    const { result } = mergeDatabase(local, incoming)

    // Solo debe quedar 1 carpeta Inbox (la local)
    const inboxes = result.nodes.filter(
      (n) => n.kind === 'folder' && (n.system === 'inbox' || n.title === 'Inbox'),
    )
    expect(inboxes).toHaveLength(1)
    expect(inboxes[0].id).toBe('local-inbox-uuid')

    // La captura remota debe tener como parent_id el Inbox local
    const capture = result.nodes.find((n) => n.id === 'remote-capture-1')!
    expect(capture).toBeDefined()
    expect(capture.parent_id).toBe('local-inbox-uuid')
    expect(result.articles.find((a) => a.node_id === 'remote-capture-1')?.body_md).toBe(
      'Contenido de nota remota',
    )
  })

  it('unifica carpetas Plantillas y artículos de plantilla sin duplicar', () => {
    const local = {
      ...empty,
      nodes: [
        node('local-tpl-folder', {
          kind: 'folder',
          title: 'Plantillas',
          system: 'templates',
          parent_id: null,
          updated_at: 1000,
        }),
        node('local-patologia', {
          kind: 'article',
          title: 'Patología / Enfermedad',
          system: 'templates',
          parent_id: 'local-tpl-folder',
          updated_at: 1000,
        }),
      ],
      articles: [article('local-patologia', 'Plantilla local')],
    }

    const incoming = {
      ...empty,
      nodes: [
        node('remote-tpl-folder', {
          kind: 'folder',
          title: 'Plantillas',
          system: 'templates',
          parent_id: null,
          updated_at: 2000,
        }),
        node('remote-patologia', {
          kind: 'article',
          title: 'Patología / Enfermedad',
          system: 'templates',
          parent_id: 'remote-tpl-folder',
          updated_at: 3000,
        }),
      ],
      articles: [article('remote-patologia', 'Plantilla remota actualizada')],
    }

    const { result } = mergeDatabase(local, incoming)

    const tplFolders = result.nodes.filter(
      (n) => n.kind === 'folder' && (n.system === 'templates' || n.title === 'Plantillas'),
    )
    expect(tplFolders).toHaveLength(1)
    expect(tplFolders[0].id).toBe('local-tpl-folder')

    const patologiaArticles = result.nodes.filter(
      (n) => n.kind === 'article' && n.title === 'Patología / Enfermedad',
    )
    expect(patologiaArticles).toHaveLength(1)
    expect(patologiaArticles[0].id).toBe('local-patologia')
    expect(patologiaArticles[0].parent_id).toBe('local-tpl-folder')
    expect(result.articles.find((a) => a.node_id === 'local-patologia')?.body_md).toBe(
      'Plantilla remota actualizada',
    )
  })
})
