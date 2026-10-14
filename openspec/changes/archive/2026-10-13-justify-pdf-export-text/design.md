# Design: Justificación de Texto en Exportación a PDF

## Context

En [`app/src/index.css`](file:///c:/Users/NOWIS/Documents/sindecon/app/src/index.css#L4642-L5115), la sección de impresión `@media print` estipula el tamaño de fuente base a `9pt` e interlineado a `1`, pero no declara explícitamente `text-align: justify` para los párrafos, por lo que heredan la alineación por defecto hacia la izquierda (`left`).

Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Configurar alineación justificada (`text-align: justify !important`) en todos los párrafos (`.reader-paragraph`) dentro del contenedor de impresión `#print-article-document` / `.print-reader-view`.
- Activar distribución inter-palabra (`text-justify: inter-word !important`) y separación de sílabas automática (`hyphens: auto !important`, `-webkit-hyphens: auto !important`) para prevenir ríos blancos o huecos excesivos entre palabras, especialmente en el modo de 2 columnas.
- Extender la justificación a bloques de texto continuo como citas (`.reader-blockquote`) y cuerpos de callouts clínicos (`.callout-body`).

**Non-Goals:**
- No justificar encabezados (`.reader-heading`, `.print-article-title`) ni celdas de tablas o etiquetas, que deben preservar su alineación natural a la izquierda o centrada.
- No alterar la alineación interactiva en pantalla en el modo editor o lector (este cambio se circunscribe estrictamente a `@media print`).

## Decisions

### Decisión 1: Justificación directa en `.reader-paragraph` y bloques de texto en `@media print`
- Añadir las reglas tipográficas en `.reader-paragraph`:
  ```css
  text-align: justify !important;
  text-justify: inter-word !important;
  hyphens: auto !important;
  -webkit-hyphens: auto !important;
  ```
- Asegurar que `.print-reader-view .reader-blockquote` y `.print-reader-view .callout-body` también apliquen justificación de texto.
- *Alternativa descartada*: Depender de la clase `.text-justified` de la vista interactiva. Descartada porque el usuario solicita que la exportación a PDF justifique el documento impreso de forma predeterminada y consistente.

### Decisión 2: Separación silábica mediante `hyphens: auto`
- En columnas angostas (como la maquetación de 2 columnas de ~80mm), la justificación estricta sin guionado puede crear espacios exagerados entre palabras con términos médicos largos (ej. "antiinflamatorio", "inmunosupresores").
- El uso de `hyphens: auto` permite al motor de renderizado de Chromium/WebKit partir palabras con guión en los límites de línea.

## Risks / Trade-offs

- **[Riesgo]**: En navegadores antiguos sin diccionario de guionado local, palabras muy largas podrían no separarse.
  → **Mitigación**: `text-justify: inter-word` distribuye el espacio suavemente, y `word-break: break-word` asegura que ninguna palabra se corte abruptamente fuera del contenedor.
