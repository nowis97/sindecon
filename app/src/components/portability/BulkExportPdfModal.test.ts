import { describe, it, expect } from 'vitest'
import type { NodeRow } from '../../db/db'
import {
  filterArticlesForExport,
  getInitialSelectedArticleIds,
} from './BulkExportPdfModal'

describe('BulkExportPdfModal Logic & Helpers', () => {
  const mockNodes: NodeRow[] = [
    {
      id: 'folder-root',
      parent_id: null,
      kind: 'folder',
      title: 'Pediatría',
      order: 1,
      system: null,
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
    },
    {
      id: 'folder-sub',
      parent_id: 'folder-root',
      kind: 'folder',
      title: 'Infectología',
      order: 1,
      system: null,
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
    },
    {
      id: 'art-1',
      parent_id: 'folder-root',
      kind: 'article',
      title: 'Bronquiolitis Aguda',
      order: 1,
      system: null,
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
    },
    {
      id: 'art-2',
      parent_id: 'folder-sub',
      kind: 'article',
      title: 'Neumonía Adquirida en la Comunidad (NAC)',
      order: 2,
      system: null,
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
    },
    {
      id: 'art-3',
      parent_id: null,
      kind: 'article',
      title: 'Shock Séptico en Urgencias',
      order: 3,
      system: null,
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
    },
  ]

  const articles = mockNodes.filter((n) => n.kind === 'article')
  const tagsByNode = new Map<string, string[]>([
    ['art-1', ['respiratorio', 'urgencias']],
    ['art-2', ['respiratorio', 'infectologia', 'antibioticos']],
    ['art-3', ['urgencias', 'hemodinamia']],
  ])

  describe('filterArticlesForExport', () => {
    it('filtra artículos por texto en el título insensible a mayúsculas', () => {
      const res = filterArticlesForExport(articles, 'bronquio', 'all', 'all', mockNodes, tagsByNode)
      expect(res.map((a) => a.id)).toEqual(['art-1'])

      const res2 = filterArticlesForExport(articles, 'nac', 'all', 'all', mockNodes, tagsByNode)
      expect(res2.map((a) => a.id)).toEqual(['art-2'])
    })

    it('filtra artículos por carpeta incluyendo sus subcarpetas', () => {
      // 'folder-root' contiene directamente art-1 y a través de 'folder-sub' a art-2
      const res = filterArticlesForExport(articles, '', 'folder-root', 'all', mockNodes, tagsByNode)
      expect(res.map((a) => a.id)).toEqual(['art-1', 'art-2'])

      // 'folder-sub' contiene solo art-2
      const resSub = filterArticlesForExport(articles, '', 'folder-sub', 'all', mockNodes, tagsByNode)
      expect(resSub.map((a) => a.id)).toEqual(['art-2'])
    })

    it('filtra artículos por etiqueta clínica', () => {
      const resUrgencias = filterArticlesForExport(articles, '', 'all', 'urgencias', mockNodes, tagsByNode)
      expect(resUrgencias.map((a) => a.id)).toEqual(['art-1', 'art-3'])

      const resInfecto = filterArticlesForExport(articles, '', 'all', 'infectologia', mockNodes, tagsByNode)
      expect(resInfecto.map((a) => a.id)).toEqual(['art-2'])
    })

    it('combina búsqueda de texto con filtro de etiqueta', () => {
      // Filtrar por etiqueta 'respiratorio' y buscar 'neumonía'
      const res = filterArticlesForExport(articles, 'neumonía', 'all', 'respiratorio', mockNodes, tagsByNode)
      expect(res.map((a) => a.id)).toEqual(['art-2'])
    })
  })

  describe('getInitialSelectedArticleIds', () => {
    it('selecciona todos los artículos si no se especifica una carpeta inicial', () => {
      const ids = getInitialSelectedArticleIds(mockNodes, articles, null)
      expect(ids).toEqual(['art-1', 'art-2', 'art-3'])
    })

    it('preselecciona únicamente los artículos contenidos en la carpeta y subcarpetas si se provee initialFolderId', () => {
      const ids = getInitialSelectedArticleIds(mockNodes, articles, 'folder-root')
      expect(ids).toEqual(['art-1', 'art-2'])

      const subIds = getInitialSelectedArticleIds(mockNodes, articles, 'folder-sub')
      expect(subIds).toEqual(['art-2'])
    })

    it('excluye artículos protegidos del sistema (plantillas maestras) si se abre a nivel raíz', () => {
      const nodesWithTemplates: NodeRow[] = [
        ...mockNodes,
        {
          id: 'tpl-1',
          parent_id: 'sys-folder-templates',
          kind: 'article',
          title: 'Patología / Enfermedad',
          order: 1,
          system: 'templates',
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
        },
      ]
      const nonTemplateArticles = nodesWithTemplates.filter(
        (n) => n.kind === 'article' && n.system !== 'templates'
      )
      const ids = getInitialSelectedArticleIds(nodesWithTemplates, nonTemplateArticles, null)
      expect(ids).toEqual(['art-1', 'art-2', 'art-3'])
      expect(ids).not.toContain('tpl-1')
    })
  })
})
