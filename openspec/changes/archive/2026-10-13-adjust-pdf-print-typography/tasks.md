# Tasks

## 1. Ajustes Tipográficos y de Espaciado en `@media print`

- [x] 1.1 Actualizar el tamaño de fuente base de los contenedores de lectura de impresión (`.print-layout-single .print-reader-view`, `.print-layout-two-columns .print-reader-view`, etc.) a `9pt !important;` en `app/src/index.css` y verificar que ambas columnas adopten `9pt`.
- [x] 1.2 Configurar `font-size: 9pt !important;` y `line-height: 1 !important;` en `.reader-paragraph` dentro de `@media print` en `app/src/index.css` para compactar el cuerpo del texto.
- [x] 1.3 Reducir los márgenes y espaciados inferiores de `.print-article-header` (a `margin-bottom: 6pt`, `padding-bottom: 4pt`), `.print-article-title` (a `margin: 2pt 0`) y `.print-tags-row` (a `margin-bottom: 4pt`) en `app/src/index.css` para minimizar el espacio tras el título.

## 2. Verificación y Validación

- [x] 2.1 Ejecutar verificación de linter y suites de pruebas en `app/` (`npm run lint` y `npm run test`) confirmando que no existan regresiones.
- [x] 2.2 Validar la conformidad del cambio con `openspec validate adjust-pdf-print-typography`.
