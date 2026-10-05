## 1. Ajustes de Tipografía e Interlineado en CSS

- [x] 1.1 Reducir line-height en .article-reader-view y .editor-host a 1.48, en .reader-list a 1.38, y ajustar margin-bottom de párrafos en pp/src/index.css.
- [x] 1.2 Actualizar .reader-heading.h1 en pp/src/index.css para aplicar el mismo estilo de .reader-heading.h2 (color teal, order-bottom: 2px solid var(--reader-h2-color), display: inline-block, 	ext-transform: none) con tamaño de fuente mayor (1.48rem).
- [x] 1.3 Actualizar reglas de @media print para alinear h1 con el estilo de h2 en impresiones y PDFs.

## 2. Validación y Pruebas

- [x] 2.1 Ejecutar suite de pruebas automatizadas (
pm test) y verificar que todos los tests pasen.
- [x] 2.2 Ejecutar compilación de producción (
pm run build).
- [x] 2.3 Validar mediante Chrome DevTools la legibilidad, espaciado y renderizado armónico de h1 y h2.
