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

  // Pre-indexar carpetas y plantillas locales de sistema para evitar duplicados
  // causados por UUIDs aleatorios entre distintos clientes/dispositivos.
  const localInbox = local.nodes.find(
    (n) =>
      n.kind === 'folder' &&
      n.deleted_at === null &&
      (n.system === 'inbox' || (n.title === 'Inbox' && n.parent_id === null)),
  )

  const localTemplatesFolder = local.nodes.find(
    (n) =>
      n.kind === 'folder' &&
      n.deleted_at === null &&
      (n.system === 'templates' || (n.title === 'Plantillas' && n.parent_id === null)),
  )

  const localTemplateArticles = new Map<string, NodeRow>()
  if (localTemplatesFolder) {
    for (const n of local.nodes) {
      if (
        n.kind === 'article' &&
        n.parent_id === localTemplatesFolder.id &&
        n.deleted_at === null
      ) {
        localTemplateArticles.set(n.title, n)
      }
    }
  }

  // Mapa de remapeo de IDs para nodos entrantes de sistema que ya existen localmente con otro ID
  const remappedIds = new Map<string, string>()

  // 1. Identificar equivalencias de carpetas de sistema en incoming
  for (const inc of incoming.nodes) {
    if (inc.deleted_at !== null) continue

    // A) Carpeta Inbox
    if (
      inc.kind === 'folder' &&
      (inc.system === 'inbox' || (inc.title === 'Inbox' && inc.parent_id === null))
    ) {
      if (localInbox && localInbox.id !== inc.id) {
        remappedIds.set(inc.id, localInbox.id)
      }
    }

    // B) Carpeta Plantillas
    if (
      inc.kind === 'folder' &&
      (inc.system === 'templates' || (inc.title === 'Plantillas' && inc.parent_id === null))
    ) {
      if (localTemplatesFolder && localTemplatesFolder.id !== inc.id) {
        remappedIds.set(inc.id, localTemplatesFolder.id)
      }
    }
  }

  // C) Artículos de plantilla
  for (const inc of incoming.nodes) {
    if (inc.deleted_at !== null || inc.kind !== 'article') continue
    const effectiveParentId = inc.parent_id
      ? remappedIds.get(inc.parent_id) ?? inc.parent_id
      : null
    const isTemplateArticle =
      inc.system === 'templates' ||
      (localTemplatesFolder && effectiveParentId === localTemplatesFolder.id)

    if (isTemplateArticle) {
      const match = localTemplateArticles.get(inc.title)
      if (match && match.id !== inc.id) {
        remappedIds.set(inc.id, match.id)
      }
    }
  }

  // 2. Fusionar nodos aplicando remapeo de padres e IDs
  for (let inc of incoming.nodes) {
    // Si este nodo entrante fue remapeado a un nodo local existente:
    const targetLocalId = remappedIds.get(inc.id)
    if (targetLocalId) {
      const cur = mergedNodes.get(targetLocalId)
      if (cur) {
        if (inc.updated_at > cur.updated_at) {
          mergedNodes.set(targetLocalId, {
            ...cur,
            updated_at: inc.updated_at,
          })
          report.nodesUpdated++
        } else {
          report.nodesSkipped++
        }
      }
      continue
    }

    // Remapear parent_id si el padre fue unificado
    if (inc.parent_id && remappedIds.has(inc.parent_id)) {
      inc = { ...inc, parent_id: remappedIds.get(inc.parent_id)! }
    }

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
      // Local es igual o más reciente: intacto
      report.nodesSkipped++
    }
  }

  // 3. Artículos: siguen la vida de su nodo dueño y su updated_at.
  const liveNodes = new Map(
    [...mergedNodes.values()].filter((n) => n.deleted_at === null).map((n) => [n.id, n]),
  )
  const mergedArticles = new Map<string, ArticleRow>()
  for (const a of local.articles) {
    if (liveNodes.has(a.node_id)) mergedArticles.set(a.node_id, a)
  }

  for (let inc of incoming.articles) {
    const targetNodeId = remappedIds.get(inc.node_id) ?? inc.node_id
    inc = { ...inc, node_id: targetNodeId }

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

  // 4. Assets
  const mergedAssets = new Map(local.assets.map((a) => [a.id, a]))
  for (let inc of incoming.assets) {
    if (inc.node_id && remappedIds.has(inc.node_id)) {
      inc = { ...inc, node_id: remappedIds.get(inc.node_id)! }
    }
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
