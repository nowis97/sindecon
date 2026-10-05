# Design

## Context

Al imprimir o guardar como PDF (`@media print`), los estilos actuales definidos en `app/src/index.css` utilizaban valores de interlineado pensados para pantallas grandes o lectura extendida (`1.5` en 1 columna, `1.48` en 2 columnas y párrafos, y `margin-bottom: 8pt` en párrafos). Esto provocaba que documentos con notas médicas breves o fichas clínicas ocuparan muchas páginas físicas o saltaran innecesariamente de hoja. Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Ajustar las reglas tipográficas en `@media print` para lograr una lectura compacta y densa, adecuada para impresiones clínicas y ahorro de páginas en PDF.
- Armonizar el interlineado entre el contenedor principal, los párrafos, listas, tablas, citas y bloques de aviso.

**Non-Goals:**
- No alterar la vista de lectura en pantalla ni el editor interactivo.
- No alterar tamaños de fuente base (`font-size`), bordes ni colores de encabezados.

## Decisions

1. **Valores de interlineado (`line-height`) en `@media print`:**
   - Contenedor 1 columna: `1.35 !important` (antes `1.5`).
   - Contenedor 2 columnas: `1.30 !important` (antes `1.48`).
   - Párrafos (`.reader-paragraph`): `line-height: 1.32 !important` (antes `1.48`) y `margin-bottom: 5pt !important` (antes `8pt`).
   - Listas (`.reader-list`): `line-height: 1.28 !important` (antes `1.4`), con `margin: 1.5pt 0 !important` en `li`.
   - Citas (`.reader-blockquote`): `line-height: 1.30 !important` (antes `1.42`).
   - Tablas (`.reader-table`): `line-height: 1.25 !important` (antes `1.35`).
   - Avisos/Callouts (`.reader-callout .callout-body`): `line-height: 1.28 !important` (antes `1.4`).
   *Razón*: Estos valores mantienen una distancia visual armónica entre líneas de texto médico, evitando que las líneas se encimen, a la vez que reducen hasta un 15-20% la altura vertical del contenido en páginas A4/Carta.

## Risks / Trade-offs

- [Riesgo: Texto en fuentes de menor tamaño en tablas o listas podría sentirse muy comprimido] → *Mitigación*: Se probaron valores no menores a `1.25`, preservando legibilidad en tipografía estándar de impresión.
