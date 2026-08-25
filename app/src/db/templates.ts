import { db } from './db'
import type { NodeRow } from './db'
import { createNode } from './nodes'

// Sembrados según plantillas_sindecon/ (11 plantillas maestras v2 en formato Word).
// Inyecta tablas, algoritmos Mermaid y listas de perlas clínicas según corresponda.

interface Section {
  title: string
  kind?: 'text' | 'table' | 'algorithm' | 'list'
  tableHeaders?: string[]
}

interface Template {
  title: string
  sections: Section[]
}

export const TEMPLATES: Template[] = [
  {
    title: 'Patología / Enfermedad',
    sections: [
      { title: 'Definición' },
      { title: 'Epidemiología' },
      { title: 'Etiología y factores de riesgo' },
      { title: 'Fisiopatología' },
      { title: 'Clasificación' },
      { title: 'Manifestaciones clínicas' },
      { title: 'Diagnóstico' },
      { title: 'Diagnóstico diferencial' },
      {
        title: 'Tratamiento',
        kind: 'table',
        tableHeaders: ['Fármaco / Medida', 'Dosis / Esquema', 'Vía', 'Notas'],
      },
      { title: 'Complicaciones' },
      { title: 'Pronóstico y seguimiento' },
      { title: 'Perlas clínicas', kind: 'list' },
    ],
  },
  {
    title: 'Síndrome clínico / Diagnóstico sindromático',
    sections: [
      { title: 'Definición' },
      { title: 'Mecanismo fisiopatológico' },
      { title: 'Etiologías principales' },
      { title: 'Manifestaciones clínicas' },
      { title: 'Semiología y examen físico' },
      { title: 'Hallazgos característicos' },
      { title: 'Exámenes orientadores' },
      { title: 'Diagnóstico diferencial' },
      { title: 'Enfoque diagnóstico' },
      { title: 'Criterios de gravedad o alarma' },
      { title: 'Perlas clínicas', kind: 'list' },
    ],
  },
  {
    title: 'Síntoma / Motivo de consulta',
    sections: [
      { title: 'Definición' },
      { title: 'Caracterización del síntoma' },
      { title: 'Etiologías por categorías' },
      { title: 'Banderas rojas' },
      { title: 'Anamnesis dirigida' },
      { title: 'Examen físico dirigido' },
      { title: 'Diagnóstico diferencial' },
      { title: 'Exámenes iniciales' },
      { title: 'Algoritmo de estudio', kind: 'algorithm' },
      { title: 'Conducta inicial' },
      { title: 'Criterios de derivación u hospitalización' },
    ],
  },
  {
    title: 'Urgencia / Emergencia',
    sections: [
      { title: 'Reconocimiento inmediato' },
      { title: 'Evaluación ABCDE' },
      { title: 'Criterios de gravedad' },
      { title: 'Diagnósticos diferenciales críticos' },
      { title: 'Monitorización' },
      { title: 'Exámenes urgentes' },
      { title: 'Manejo inicial' },
      {
        title: 'Fármacos y dosis',
        kind: 'table',
        tableHeaders: ['Fármaco', 'Dosis', 'Vía', 'Notas'],
      },
      { title: 'Intervenciones o procedimientos' },
      { title: 'Reevaluación y metas de respuesta' },
      { title: 'Destino: alta, observación, hospitalización o UCI' },
      { title: 'Algoritmo y errores frecuentes', kind: 'algorithm' },
    ],
  },
  {
    title: 'Procedimiento / Técnica / Exploración clínica',
    sections: [
      { title: 'Definición y objetivo' },
      { title: 'Indicaciones' },
      { title: 'Contraindicaciones' },
      { title: 'Preparación del paciente' },
      { title: 'Materiales necesarios' },
      { title: 'Anatomía o referencias relevantes' },
      { title: 'Técnica paso a paso' },
      { title: 'Confirmación de correcta ejecución' },
      { title: 'Hallazgos normales y patológicos (si aplica)' },
      { title: 'Complicaciones' },
      { title: 'Cuidados posteriores' },
      { title: 'Errores frecuentes y perlas técnicas', kind: 'list' },
    ],
  },
  {
    title: 'Examen / Prueba / Interpretación diagnóstica',
    sections: [
      { title: 'Qué evalúa' },
      { title: 'Indicaciones' },
      { title: 'Preparación y obtención' },
      { title: 'Técnica o principios básicos' },
      { title: 'Valores o hallazgos normales' },
      { title: 'Interpretación sistemática' },
      { title: 'Patrones patológicos principales' },
      { title: 'Diagnósticos asociados' },
      { title: 'Limitaciones y falsos positivos/negativos' },
      { title: 'Cuándo repetir o complementar' },
      { title: 'Perlas de interpretación', kind: 'list' },
    ],
  },
  {
    title: 'Concepto / Anatomía / Fisiología / Fisiopatología',
    sections: [
      { title: 'Definición' },
      { title: 'Estructuras o componentes' },
      { title: 'Organización o clasificación' },
      { title: 'Funcionamiento normal' },
      { title: 'Mecanismos de regulación' },
      { title: 'Relaciones funcionales' },
      { title: 'Fisiopatología o alteraciones relevantes' },
      { title: 'Correlación clínica' },
      { title: 'Aplicaciones diagnósticas o terapéuticas' },
      { title: 'Conceptos clave para recordar', kind: 'list' },
    ],
  },
  {
    title: 'Prevención / Tamizaje / Control clínico',
    sections: [
      { title: 'Objetivo' },
      { title: 'Población objetivo' },
      { title: 'Factores de riesgo' },
      { title: 'Evaluación inicial' },
      { title: 'Tamizaje o prestaciones' },
      { title: 'Periodicidad' },
      { title: 'Interpretación de resultados' },
      { title: 'Intervenciones preventivas' },
      { title: 'Educación y consejería' },
      { title: 'Signos de alarma' },
      { title: 'Criterios de derivación' },
      { title: 'Seguimiento y normativa aplicable' },
    ],
  },
  {
    title: 'Terapéutica / Estrategia de tratamiento',
    sections: [
      { title: 'Objetivos terapéuticos' },
      { title: 'Indicaciones para iniciar tratamiento' },
      { title: 'Medidas no farmacológicas' },
      { title: 'Tratamiento de primera línea' },
      { title: 'Alternativas y segunda línea' },
      { title: 'Escalamiento o desescalamiento' },
      {
        title: 'Dosis y esquemas relevantes',
        kind: 'table',
        tableHeaders: ['Fármaco', 'Esquema', 'Notas'],
      },
      { title: 'Contraindicaciones y precauciones' },
      { title: 'Monitorización de respuesta y seguridad' },
      { title: 'Fracaso terapéutico y cambio de estrategia' },
      { title: 'Situaciones especiales' },
      { title: 'Algoritmo terapéutico', kind: 'algorithm' },
    ],
  },
  {
    title: 'Fármaco / Ficha farmacológica',
    sections: [
      { title: 'Grupo farmacológico' },
      { title: 'Mecanismo de acción' },
      { title: 'Indicaciones clínicas' },
      {
        title: 'Dosis en adultos y vía de administración',
        kind: 'table',
        tableHeaders: ['Presentación', 'Dosis', 'Vía', 'Frecuencia'],
      },
      { title: 'Preparación, dilución y administración' },
      { title: 'Inicio y duración de acción' },
      { title: 'Semivida, metabolismo y eliminación' },
      { title: 'Reacciones adversas importantes' },
      { title: 'Contraindicaciones y precauciones' },
      { title: 'Interacciones' },
      { title: 'Ajuste renal y hepático' },
      { title: 'Monitorización' },
      { title: 'Perlas clínicas', kind: 'list' },
    ],
  },
  {
    title: 'Patología oncológica / Cáncer',
    sections: [
      { title: 'Definición' },
      { title: 'Epidemiología' },
      { title: 'Factores de riesgo' },
      { title: 'Etiología y patogenia' },
      { title: 'Anatomía patológica / histología' },
      { title: 'Clasificación y subtipos' },
      { title: 'Manifestaciones clínicas' },
      { title: 'Diagnóstico' },
      { title: 'Estudio de extensión' },
      {
        title: 'Estadificación / TNM',
        kind: 'table',
        tableHeaders: ['Categoría / Estadio', 'Definición', 'Criterios clínicos'],
      },
      { title: 'Factores pronósticos y biomarcadores' },
      { title: 'Diagnóstico diferencial' },
      { title: 'Tratamiento' },
      {
        title: 'Tratamiento según estadio',
        kind: 'table',
        tableHeaders: ['Estadio', 'Estrategia', 'Esquema de referencia'],
      },
      { title: 'Complicaciones' },
      { title: 'Seguimiento y vigilancia' },
      { title: 'Pronóstico' },
      { title: 'Perlas clínicas', kind: 'list' },
    ],
  },
]

/** Construye el cuerpo Markdown vacío de un template. */
export function buildTemplateBody(template: Template): string {
  const lines: string[] = ['# {título}', '']
  for (const s of template.sections) {
    lines.push(`## ${s.title}`, '')
    if (s.kind === 'algorithm') {
      lines.push(
        '```mermaid',
        'flowchart TD',
        '    A[Inicio] --> B{TBD}',
        '```',
        '',
      )
    } else if (s.kind === 'table' && s.tableHeaders) {
      lines.push(
        '| ' + s.tableHeaders.join(' | ') + ' |',
        '| ' + s.tableHeaders.map(() => '---').join(' | ') + ' |',
        '',
      )
    } else if (s.kind === 'list') {
      lines.push('- ', '')
    } else {
      lines.push('Escribe aquí.', '')
    }
  }
  return lines.join('\n')
}

/** Reemplaza {título} por el nombre real del artículo creado. */
export function fillTitlePlaceholder(body: string, title: string): string {
  return body.replace(/\{título\}/g, title)
}

export const SYSTEM_TEMPLATES_FOLDER_ID = 'sys-folder-templates'

/** Genera un ID determinista y estable para cada plantilla maestra. */
export function getTemplateId(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `sys-tpl-${slug}`
}

const SEED_KEY = 'seeded_templates_v2'

/**
 * Siembra la carpeta "Plantillas" con los 11 formatos oficiales de forma determinista e idempotente.
 * No pisa ediciones del usuario.
 */
export async function seedTemplatesIfNeeded(): Promise<boolean> {
  const marker = await db.meta.get(SEED_KEY)
  if (marker?.value) return false

  let plantillas = await db.nodes.get(SYSTEM_TEMPLATES_FOLDER_ID)
  if (!plantillas || plantillas.deleted_at !== null) {
    const existingFolder = await db.nodes
      .filter(
        (n) =>
          (n.system === 'templates' || (n.title === 'Plantillas' && n.parent_id === null)) &&
          n.kind === 'folder' &&
          n.deleted_at === null,
      )
      .first()

    if (existingFolder) {
      plantillas = existingFolder
    } else {
      plantillas = await createNode({
        id: SYSTEM_TEMPLATES_FOLDER_ID,
        kind: 'folder',
        title: 'Plantillas',
        system: 'templates',
        parent_id: null,
      })
    }
  }

  const now = Date.now()
  let anySeeded = false
  for (const t of TEMPLATES) {
    const tplId = getTemplateId(t.title)
    const existingTpl = await db.nodes.get(tplId)
    if (!existingTpl || existingTpl.deleted_at !== null) {
      const existingByTitle = await db.nodes
        .filter(
          (n) =>
            n.parent_id === plantillas.id &&
            n.title === t.title &&
            n.deleted_at === null,
        )
        .first()

      if (!existingByTitle) {
        const nodo = await createNode({
          id: tplId,
          kind: 'article',
          title: t.title,
          parent_id: plantillas.id,
          system: 'templates',
        })
        await db.articles.put({
          node_id: nodo.id,
          body_md: buildTemplateBody(t),
          tags: [],
        })
        await db.nodes.update(nodo.id, { created_at: now, updated_at: now })
        anySeeded = true
      }
    }
  }
  await db.meta.put({ key: SEED_KEY, value: true })
  return anySeeded || true
}

/** Lista de plantillas vivas (nodo + cuerpo). Vacía si no hay siembra. */
export async function listTemplates(): Promise<
  { node: NodeRow; body: string }[]
> {
  const carpetas = await db.nodes
    .filter(
      (n) =>
        n.system === 'templates' &&
        n.deleted_at === null &&
        n.kind === 'folder',
    )
    .toArray()
  if (carpetas.length === 0) return []
  const parentId = carpetas[0].id
  const items = (
    await db.nodes
      .filter(
        (n) =>
          n.parent_id === parentId &&
          n.kind === 'article' &&
          n.deleted_at === null,
      )
      .toArray()
  ).sort((a, b) => a.order - b.order)
  const articles = await db.articles.bulkGet(items.map((n) => n.id))
  return items.map((node, i) => ({
    node,
    body: articles[i]?.body_md ?? '',
  }))
}