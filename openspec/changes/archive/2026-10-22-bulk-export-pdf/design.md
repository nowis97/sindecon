# Design

## Context

SINDECON cuenta con un motor de impresión y exportación a PDF basado en CSS `@media print` y `window.print()` (especificado en `data-portability`). Actualmente, `#print-article-document` en `App.tsx` solo renderiza el artículo individual activo (`selected?.kind === 'article'`).

Para permitir la exportación masiva o compendio de múltiples artículos seleccionados por el usuario, se diseñará un modal de selección (`BulkExportPdfModal`) análogo al existente `BulkImportModal`, y un contenedor exclusivo de impresión multidocumento (`#print-bulk-document`) que renderiza de manera secuencial todos los artículos elegidos manteniendo las mismas reglas tipográficas clínicas (`9pt`, `line-height: 1.15`, alineación justificada, soporte de 1 y 2 columnas).

## Goals / Non-Goals

**Goals:**
- Proveer un modal interactivo (`BulkExportPdfModal`) para explorar, buscar, filtrar y seleccionar múltiples artículos clínicos de la base de datos local.
- Permitir configurar la maquetación del compendio (1 columna vs 2 columnas, cabecera médica, etiquetas y saltos de página inter-artículo).
- Renderizar secuencialmente los artículos seleccionados en `#print-bulk-document` y disparar `window.print()` con el nombre sugerido de compendio en `document.title`.
- Añadir el disparador en `PortabilityBar` y en el menú contextual / cabecera de carpetas en la barra lateral.

**Non-Goals:**
- Generar archivos PDF usando librerías binarias pesadas del lado del cliente (como jsPDF o pdfmake), preservando la estrategia nativa sin dependencias adicionales (`window.print()` del navegador a través de `@media print`, que es 100% fiel al renderizado web, ligero y soporta Mermaid, KaTeX y callouts sin overhead).
- Modificar el formato de exportación ZIP Markdown existente.

## Decisions

### 1. Reutilización del motor `@media print` nativo frente a dependencias pesadas
- **Decisión**: Usar el motor `@media print` existente de SINDECON con un contenedor `#print-bulk-document`.
- **Racional**: En consonancia con la regla *Ponytail* (no dependencias adicionales, aprovechar capacidades nativas de la plataforma), el navegador genera PDFs vectoriales perfectos mediante `window.print()`, preservando estilos CSS avanzados como `column-count: 2`, `break-before: page`, KaTeX y diagramas.
- **Alternativa descartada**: Instalar `jspdf` o `html2canvas` (añadiría megabytes al bundle, rompe el estilo de dos columnas y desalinea tipografías matemáticas y diagramas).

### 2. Estructura de `#print-bulk-document` y separación de páginas
- **Decisión**: Encapsular cada artículo seleccionado en un contenedor `.print-bulk-article-item`.
- **Racional**: Permite aplicar `break-before: page` (y fallback `page-break-before: always`) entre notas cuando el usuario mantenga habilitada la opción de salto de página, o permitir lectura continua encadenada si se desmarca.
- Cada elemento reutiliza internamente los estilos ya auditados y probados de `.print-article-header`, `.print-tags-row` y `<ArticleReader isPrintView={true} />`.

### 3. Carga eficiente de artículos seleccionados desde IndexedDB
- **Decisión**: Consultar únicamente los artículos seleccionados mediante `db.articles.where('node_id').anyOf(selectedIds).toArray()` al momento de confirmar la exportación, en lugar de mantener en memoria los cuerpos Markdown de todas las notas.
- **Racional**: Minimiza el uso de memoria en dispositivos móviles, cargando el texto solo de los artículos que efectivamente van a ser impresos.

### 4. Nomenclatura del archivo PDF generado
- **Decisión**: Durante la preparación de la impresión, asignar `document.title = compilationTitle.trim() || 'Compendio Medico - SINDECON'`, y restaurar el título previo en el listener `afterprint`.
- **Racional**: Todos los navegadores modernos (Chromium, Safari, Firefox) usan `document.title` como nombre de archivo por defecto en el diálogo "Guardar como PDF".

## Risks / Trade-offs

- **[Risk] Demora en renderizado si se seleccionan decenas de artículos con diagramas o imágenes pesadas** → **Mitigación**: Mostrar un indicador breve de preparación antes de invocar `window.print()` (150-250ms) para garantizar que el DOM esté completamente pintado antes del diálogo de impresión.
- **[Risk] Selección accidental de carpetas o notas eliminadas** → **Mitigación**: Filtrar estrictamente `node.deleted_at === null` y `node.kind === 'article'` en la lista seleccionable del modal.
