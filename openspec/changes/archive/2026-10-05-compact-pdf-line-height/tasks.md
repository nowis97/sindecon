# Tasks

## 1. Ajuste de interlineado compacto en PDF e Impresión

- [x] 1.1 En `app/src/index.css` bajo `@media print`, reducir los valores de interlineado y espaciado vertical: `.print-layout-single .article-reader-view` (`line-height: 1.35 !important`), contenedores de 2 columnas (`line-height: 1.30 !important`), `.reader-paragraph` (`line-height: 1.32 !important` y `margin-bottom: 5pt !important`), `.reader-list` (`line-height: 1.28 !important` y `li` con `margin: 1.5pt 0 !important`), `.reader-callout .callout-body` (`line-height: 1.28 !important`), `.reader-blockquote` (`line-height: 1.30 !important`) y `.reader-table` (`line-height: 1.25 !important`). Verificar con `git diff`.
- [x] 1.2 En `app/e2e/vital.spec.ts` (test 18), verificar que bajo `@media print` el estilo computado de los párrafos en el contenedor de impresión refleja el interlineado compacto. Comprobar ejecutando `npx playwright test -g "18\."`.
- [x] 1.3 Verificación manual en navegador: abrir un artículo clínico (ej. "Síndromes hipertensivos del embarazo"), presionar "Exportar PDF" en modo 1 y 2 columnas, y comprobar en la vista previa de impresión que el interlineado es visiblemente más compacto y optimiza el uso de la página.
