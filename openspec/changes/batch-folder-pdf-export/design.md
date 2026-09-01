## Context

SINDECON cuenta con estilos `@media print` y una estructura DOM para imprimir artículos individuales (`#print-article-document`). Para exportar una carpeta completa o selección de múltiples artículos, se extenderá esta arquitectura sin requerir librerías pesadas en el bundle del cliente (como jsPDF o Puppeteer), aprovechando el motor de renderizado del navegador (`window.print()`) y las capacidades CSS Paged Media (`@page`, `break-after: page`, `@media print`).

## Goals / Non-Goals

**Goals:**
- Permitir la exportación de carpetas completas y sus artículos hijos/descendientes con 1 clic.
- Ofrecer un modal de selección interactivo donde el usuario pueda deseleccionar artículos específicos y elegir maquetación (1 o 2 columnas).
- Generar un documento consolidado de alta calidad con portada, índice temático (TOC), renderizado Markdown completo y saltos de página limpios.
- Nombre automático sugerido en el guardado de PDF: `<Carpeta> - Compendio SINDECON.pdf`.

**Non-Goals:**
- Generación de PDF binario en servidor o worker (todo se procesa en el cliente usando las APIs nativas del navegador para máxima privacidad y funcionamiento 100% offline).
- Edición WYSIWYG del índice antes de imprimir.

## Decisions

1. **Carga por Lote desde IndexedDB (`Dexie.bulkGet`)**:
   - *Decisión*: Al abrir la exportación o confirmar la impresión, se realiza un `bulkGet` de los artículos seleccionados por sus IDs para evitar lecturas individuales redundantes.
   - *Alternativa descartada*: Mantener todos los cuerpos de artículos en memoria global (innecesario consumo de RAM).

2. **Renderizado Secuencial con `ArticleReader` (`isPrintView`)**:
   - *Decisión*: Reutilizar el componente `ArticleReader` con la bandera `isPrintView` para cada artículo del lote, garantizando que el parseo de Markdown, tablas clínicas, callouts, alertas y fórmulas KaTeX sea 100% idéntico y consistente.
   - *Alternativa descartada*: Reimplementar un renderer secundario para PDF.

3. **Paginación y Estructura CSS Paged Media**:
   - *Decisión*: Usar `.print-batch-article-block { break-after: page; page-break-after: always; }` y portada separada `.print-batch-cover { break-after: page; }`.
   - *Alternativa descartada*: Unir el texto en un solo bloque continuo (provocaría que los temas comiencen a mitad de hoja).

## Risks / Trade-offs

- **[Riesgo] Carpetas con decenas de artículos extensos (>50 artículos)** → *Mitigación*: `Dexie.bulkGet` es casi instantáneo (<50ms para 100 artículos) y el DOM de impresión se monta solo durante la llamada a `window.print()` y se desmonta inmediatamente después en `afterprint`.
- **[Riesgo] Fórmulas KaTeX o diagramas Mermaid en impresión por lote** → *Mitigación*: El componente `ArticleReader` ya procesa KaTeX síncronamente y los bloques de código se imprimen con formato limpio y tipografía monoespaciada sin desbordamiento.
