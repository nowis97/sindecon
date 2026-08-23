import type { NodeRow, ArticleRow, AssetRow } from '../db/db'

// Fusión por uuid (design D6): la misma lógica sirve para el
// import manual de hoy y para el sync automático futuro.
// Regla central: last-write-wins por updated_at, a nivel de nodo.

export interface DbSnapshot {
  nodes: NodeRow[]
  articles: ArticleRow[]
  assets: AssetRow[]
}

export interface MergeReport {
  nodesAdded: number
  nodesUpdated: number
  nodesDeleted: number
  nodesSkipped: number
  articlesAdded: number
  articlesUpdated: number
  articlesSkipped: number
  assetsAdded: number
  assetsSkipped: number
}

const zeroReport = (): MergeReport => ({
  nodesAdded: 0,
  nodesUpdated: 0,
  nodesDeleted: 0,
  nodesSkipped: 0,
  articlesAdded: 0,
  articlesUpdated: 0,
  articlesSkipped: 0,
  assetsAdded: 0,
  assetsSkipped: 0,
})

export function mergeDatabase(
  local: DbSnapshot,
  incoming: DbSnapshot,
): { result: DbSnapshot; report: MergeReport } {
  const report = zeroReport()
  const localNodes = new Map(local.nodes.map((n) => [n.id, n]))
  const mergedNodes = new Map<string, NodeRow>(local.nodes.map((n) => [n.id, n]))

  for (const inc of incoming.nodes) {
    const cur = mergedNodes.get(inc.id)
    if (!cur) {
      // Tombstone de algo que nunca tuvimos: nada que hacer.
      if (inc.deleted_at !== null) continue
      mergedNodes.set(inc.id, inc)
      report.nodesAdded++
    } else if (inc.updated_at > cur.updated_at) {
      if (inc.deleted_at !== null && cur.deleted_at === null) {
        // Gana el tombstone entrante: conservar metadatos locales,
        // solo marcar la eliminación.
        mergedNodes.set(inc.id, {
          ...cur,
          deleted_at: inc.deleted_at,
          updated_at: inc.updated_at,
        })
        report.nodesDeleted++
      } else {
        mergedNodes.set(inc.id, inc)
        report.nodesUpdated++
      }
    } else {
      // Local es igual o más reciente: intacto (incluye "resurrecciones"
      // entrantes más viejas que nuestra eliminación).
      report.nodesSkipped++
    }
  }

  // Artículos: siguen la vida de su nodo dueño y su updated_at.
  const liveNodes = new Map(
    [...mergedNodes.values()].filter((n) => n.deleted_at === null).map((n) => [n.id, n]),
  )
  const mergedArticles = new Map<string, ArticleRow>()
  for (const a of local.articles) {
    if (liveNodes.has(a.node_id)) mergedArticles.set(a.node_id, a)
    // artículos de nodos muertos se descartan (la cascada ya los mató)
  }
  for (const inc of incoming.articles) {
    const owner = liveNodes.get(inc.node_id)
    if (!owner) continue
    const cur = mergedArticles.get(inc.node_id)
    if (!cur) {
      mergedArticles.set(inc.node_id, inc)
      report.articlesAdded++
    } else {
      const localOwner = localNodes.get(inc.node_id)
      if (!localOwner || owner.updated_at > localOwner.updated_at) {
        mergedArticles.set(inc.node_id, inc)
        report.articlesUpdated++
      } else {
        report.articlesSkipped++
      }
    }
  }

  // Assets: sin timestamp todavía (llegan con 3.2); si no existe, se añade.
  const mergedAssets = new Map(local.assets.map((a) => [a.id, a]))
  for (const inc of incoming.assets) {
    if (mergedAssets.has(inc.id)) {
      report.assetsSkipped++
    } else {
      mergedAssets.set(inc.id, inc)
      report.assetsAdded++
    }
  }

  return {
    result: {
      nodes: [...mergedNodes.values()],
      articles: [...mergedArticles.values()],
      assets: [...mergedAssets.values()],
    },
    report,
  }
}
