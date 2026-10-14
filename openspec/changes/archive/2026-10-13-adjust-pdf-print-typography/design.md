# Design: Ajustes Tipográficos en Exportación a PDF

## Context

Actualmente, las reglas de impresión en `@media print` dentro de [`app/src/index.css`](file:///c:/Users/NOWIS/Documents/sindecon/app/src/index.css#L4642-L5115) configuran el texto base en:
- `10pt` con `line-height: 1.35` en modo 1 Columna (`.print-layout-single`).
- `9.5pt` con `line-height: 1.30` en modo 2 Columnas (`.print-layout-two-columns`).
- Párrafos (`.reader-paragraph`) con `line-height: 1.32` y margen inferior de `5pt`.
- La cabecera médica (`.print-article-header`) tiene `margin-bottom: 14pt` y `padding-bottom: 8pt`, el título (`.print-article-title`) tiene `margin: 4pt 0`, y la fila de etiquetas (`.print-tags-row`) tiene `margin-bottom: 12pt`.

Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Unificar el tamaño de fuente base de los párrafos a `9pt` en maquetación de 1 columna y 2 columnas para PDF / impresión.
- Fijar el interlineado de los párrafos en `1` (`line-height: 1 !important`) en la vista de impresión.
- Reducir el espaciado vertical posterior al título principal y la cabecera médica en impresión, permitiendo que el contenido comience de inmediato.

**Non-Goals:**
- Modificar el modo de lectura en pantalla o la edición interactiva (los estilos en pantalla permanecen intactos).
- Alterar el tamaño de los encabezados clínicos (`H1`, `H2`, `H3`) ni de tablas o callouts, excepto para mantener coherencia si heredan el interlineado.
- Cambiar los márgenes de página `@page` (16mm 18mm se mantienen).

## Decisions

### Decisión 1: Unificación de tamaño base a 9pt
- Modificar tanto `.print-layout-single .print-reader-view` como `.print-layout-two-columns .print-reader-view` para usar `font-size: 9pt !important;`.
- Asegurar que `.reader-paragraph` declare explícitamente `font-size: 9pt !important;` en `@media print`.
- *Alternativa descartada*: Mantener tamaños diferentes entre 1 y 2 columnas. Descartada porque el usuario solicitó específicamente 9pt para ambas.

### Decisión 2: Interlineado unitless de valor 1 en párrafos
- Asignar `line-height: 1 !important;` directamente en `.reader-paragraph`.
- Actualizar los contenedores de maquetación (`.print-layout-single ...` y `.print-layout-two-columns ...`) para reflejar `line-height: 1 !important;` o un valor base equivalente.
- *Alternativa descartada*: Usar `line-height: 100%` o `1em`. `1` unitless es el estándar óptimo en CSS para evitar distorsiones al anidar.

### Decisión 3: Reducción del margen posterior al título y cabecera médica
- Reducir `.print-article-header` a `margin-bottom: 6pt !important;` y `padding-bottom: 4pt !important;` (antes 14pt y 8pt).
- Reducir `.print-article-title` a `margin: 2pt 0 2pt 0 !important;` (antes 4pt 0).
- Reducir `.print-tags-row` a `margin-bottom: 4pt !important;` (antes 12pt).
- *Alternativa descartada*: Eliminar totalmente los márgenes. Descartada porque causaría que el borde de separación `#008080` colisione visualmente con el texto del título y los primeros párrafos.

## Risks / Trade-offs

- **[Riesgo]**: Un interlineado de `1` en párrafos largos puede sentirse muy condensado si las líneas son muy anchas (en 1 columna).
  → **Mitigación**: Los párrafos retienen separación vertical de bloque (`margin-bottom: 4pt`) y las fuentes del sistema (San Francisco, Segoe UI, Roboto) mantienen buena legibilidad tipográfica a 9pt. En 2 columnas (ancho de columna ~80mm), la lectura es sumamente natural y económica en papel.
