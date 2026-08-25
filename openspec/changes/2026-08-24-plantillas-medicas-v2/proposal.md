# Propuesta: Plantillas Médicas Maestras Versión 2 (11 Formatos, Tipografía Roboto, Paleta Teal/Navy y Maquetación 2 Columnas)

## Why

Las plantillas clínicas iniciales (v1) contaban con 10 formatos basados en un documento preliminar. Con la evolución del modelo de síntesis de conocimiento médico de SINDECON, se han generado los 11 formatos maestros oficiales en formato Microsoft Word (`plantillas_sindecon/`), introduciendo:

1. **Nueva Plantilla Oncológica:** `Patología oncológica / Cáncer` para abordaje integral de histología, estadificación TNM, biomarcadores y tratamiento según estadio.
2. **Nomenclatura y Secciones Refinadas:** Títulos más descriptivos (`Síndrome clínico / Diagnóstico sindromático`, `Procedimiento / Técnica / Exploración clínica`, etc.) e incorporación de secciones clave como *"Hallazgos normales y patológicos (si aplica)"*.
3. **Diseño Editorial Clínico en 2 Columnas:** Los documentos Word están estructurados en 2 columnas simétricas (`cols num="2"`), con tipografía `Roboto`, títulos principales en Deep Navy (`#142337`), encabezados de sección en Teal Médico (`#008080`) y cuerpo en carbón suave (`#1E1E1E`).
4. **Optimización de Lectura y Consulta:** Necesidad de replicar esta experiencia visual en el visor de artículos (`ArticleReader`) y en la exportación/impresión a PDF sin sacrificar la versatilidad de edición en Markdown ni la responsividad en teléfonos móviles durante la guardia.

## What Changes

- **Catálogo de Plantillas Maestras v2 (`src/db/templates.ts`):**
  - Actualización a los 11 formatos maestros oficiales con sus secciones y tipos de bloque semilla (tablas de fármacos/dosis, algoritmos Mermaid y listas de perlas clínicas).
  - Clave de migración `seeded_templates_v2` con siembra idempotente que actualiza la carpeta del sistema `Plantillas/` y añade la nueva plantilla oncológica sin sobreescribir ediciones previas del usuario.
- **Tipografía y Paleta Oficial en CSS (`src/index.css`):**
  - Aplicación de tipografía `Roboto` en toda la interfaz de lectura y redacción.
  - Colores exactos de las plantillas Word:
    - Títulos H1: `#142337` (Light) / `#F1F5F9` (Dark).
    - Encabezados H2: `#008080` (Light) / `#2DD4BF` (Dark).
    - Subtítulos H3: `#00ACA8` / `#334155`.
    - Texto de párrafos: `#1E1E1E` (Light) / `#E2E8F0` (Dark).
- **Modo de Lectura a 2 Columnas en `ArticleReader.tsx`:**
  - Soporte de maquetación en 2 columnas (`columns: 2`, `column-gap: 2.25rem`, `column-rule: 1px solid var(--border-subtle)`).
  - Título principal abarcando el ancho superior (`column-span: all`).
  - Protección de cortes en bloques (`break-inside: avoid`) para secciones, tablas, callouts e imágenes.
  - Adaptación responsive automática (1 columna en móviles, 2 columnas en pantallas amplias) y selector de vista en la cabecera del lector.
  - Soporte de impresión en 2 columnas (`@media print`).
- **Pruebas y Validación (`src/db/templates.test.ts`):**
  - Cobertura de tests unitarios actualizada para verificar las 11 plantillas v2 y su generación Markdown.

## Capabilities

### Modified Capabilities
- `templates`: Actualización del requisito de siembra a los 11 formatos maestros v2 y especificación de maquetación en 2 columnas con la paleta tipográfica clínica.

## Impact
- **Archivos modificados:** `app/src/db/templates.ts`, `app/src/db/templates.test.ts`, `app/src/components/reader/ArticleReader.tsx`, `app/src/index.css`, `openspec/specs/templates/spec.md`.
- **Nuevos archivos OpenSpec:** `openspec/changes/2026-08-24-plantillas-medicas-v2/proposal.md`, `design.md`, `specs/templates/spec.md`, `tasks.md`.
- **Riesgo:** Cero pérdida de datos; la migración `v2` sólo añade las nuevas plantillas del sistema y mantiene intactos los artículos existentes.
