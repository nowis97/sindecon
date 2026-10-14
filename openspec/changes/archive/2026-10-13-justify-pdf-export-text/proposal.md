# Proposal: Justificar texto en la exportación a PDF

## Why

Al exportar o imprimir artículos médicos a PDF, el texto alineado a la izquierda deja un margen irregular a la derecha que resta profesionalismo a los documentos impresos y desaprovecha espacio en columnas angostas. Justificar el texto (`text-align: justify`) con guionado tipográfico automático (`hyphens: auto`) proporciona una maquetación editorial simétrica de alta calidad, similar a guías clínicas, revistas médicas y fichas académicas impresas.

## What Changes

- Justificar el texto de los párrafos (`.reader-paragraph`) en la vista de impresión (`@media print`).
- Habilitar `text-justify: inter-word` y separación de sílabas automática (`hyphens: auto` y `-webkit-hyphens: auto`) para asegurar que el espaciado entre palabras sea uniforme tanto en 1 como en 2 columnas, evitando ríos blancos antiestéticos.
- Extender la alineación justificada a bloques de texto clínico continuo en impresión (como citas `.reader-blockquote`, cuerpos de callout y listas) dentro de `#print-article-document`.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capacidad -->

### Modified Capabilities
- `data-portability`: Se modifica el requisito de *Exportación de artículos individuales a PDF con selección de maquetación* para exigir alineación de texto justificada con soporte de guionado automático en el documento impreso.

## Impact

- `app/src/index.css`: Reglas `@media print` para `.reader-paragraph` y bloques de texto en `#print-article-document`.
- No requiere librerías adicionales ni cambios en la base de datos IndexedDB.
