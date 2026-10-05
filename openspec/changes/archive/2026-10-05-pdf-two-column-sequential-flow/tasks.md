# Tasks

## 1. Flujo continuo en el PDF de 2 columnas

- [x] 1.1 En `app/src/index.css`, bloque `@media print`, quitar `column-span: all !important;` de la regla `.reader-heading.h1` (dejar el resto: color, borde, márgenes, `break-after: avoid`). Verificar con `git diff` que es el único cambio en esa regla.
- [x] 1.2 En el test e2e 18 de `app/e2e/vital.spec.ts`, después de confirmar la exportación en 2 columnas, emular `print` (`page.emulateMedia({ media: 'print' })`) y comprobar que un `#print-article-document .reader-heading.h1` tiene `getComputedStyle(...).columnSpan === 'none'`. Verificar con `npx playwright test -g "18."` en `app/`.
- [x] 1.3 Verificación manual: abrir "Síndromes hipertensivos del embarazo", Exportar PDF → 2 Columnas, y confirmar en la vista previa de Chrome que las secciones (Preeclampsia, HELLP…) siguen dentro de la columna, en el mismo orden que la "Vista 2 Columnas (Word)", y que el encabezado del documento sigue a ancho completo.
