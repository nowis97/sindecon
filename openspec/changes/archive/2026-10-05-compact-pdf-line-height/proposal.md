# Proposal

## Why

Al exportar artículos médicos a PDF o imprimirlos en papel, el interlineado actual (`line-height: 1.5` en 1 columna y `1.48` en 2 columnas y párrafos) junto con márgenes verticales holgados genera documentos excesivamente extendidos con demasiadas páginas. En fichas clínicas, resúmenes farmacológicos y guías de guardia, se requiere una mayor densidad informativa y un interlineado compacto que optimice el espacio en papel sin comprometer la legibilidad.

## What Changes

- Reducir el interlineado en la exportación a PDF / impresión (`@media print`):
  - `.print-layout-single .article-reader-view`: de `1.5` a `1.35`.
  - `body.print-columns-2 #print-article-document .article-reader-view` y `.print-layout-two-columns`: de `1.48` a `1.30`.
  - `.reader-paragraph`: de `1.48` a `1.32`, y margen inferior de `8pt` a `5pt`.
  - `.reader-list`: interlineado de `1.4` a `1.28`, y margen vertical entre ítems de `2pt` a `1.5pt`.
  - `.reader-callout .callout-body`: de `1.4` a `1.28`.
  - `.reader-blockquote`: de `1.42` a `1.30`.
  - `.reader-table`: de `1.35` a `1.25`.
- La vista de lectura interactiva en pantalla (`screen`) permanece intacta con su tipografía y espaciado estándar.

## Capabilities

### New Capabilities

*(ninguna)*

### Modified Capabilities

- `data-portability`: Se modifica el requisito "Exportación de artículos individuales a PDF con selección de maquetación" para exigir tipografía compacta y reducción de interlineado en la impresión / PDF en ambos modos (1 y 2 columnas).

## Impact

- `app/src/index.css`: Ajustes en el bloque `@media print` para las clases de lectura y maquetación de impresión.
- `app/e2e/vital.spec.ts`: Actualización o verificación en las pruebas E2E de exportación a PDF para comprobar el interlineado compacto.
- Cero impacto en APIs, esquemas de base de datos o almacenamiento.
