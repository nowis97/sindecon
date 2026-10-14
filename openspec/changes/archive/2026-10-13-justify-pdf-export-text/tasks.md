# Tasks

## 1. Justificación Tipográfica en `@media print`

- [x] 1.1 Configurar `text-align: justify !important;`, `text-justify: inter-word !important;`, `hyphens: auto !important;` y `-webkit-hyphens: auto !important;` en `.reader-paragraph` dentro de `@media print` en `app/src/index.css`.
- [x] 1.2 Extender la alineación justificada a bloques de texto continuo (`.reader-blockquote`, `.callout-body`, `.reader-list li`) dentro de la vista de impresión en `app/src/index.css`.

## 2. Verificación y Validación

- [x] 2.1 Ejecutar verificación de linter y suites de pruebas en `app/` (`npm run lint` y `npm run test`) confirmando que no existan regresiones.
- [x] 2.2 Validar la conformidad del cambio con `openspec validate justify-pdf-export-text`.
