# Proposal

## Why

Al exportar o imprimir artículos médicos en formato de dos columnas ("Ficha médica"), el PDF generado presenta defectos críticos de maquetación y renderizado: botones interactivos de la interfaz (`+`, `-`, `100%`, `⛶`) que se imprimen sobre los diagramas, diagramas horizontales comprimidos en 80 mm volviéndose ilegibles, columnas enteras vacías por cortes huérfanos entre cabeceras y diagramas (págs. 5 y 8), solapamiento de texto en el inicio de página (pág. 10), y fallas en el parser que dejan callouts clínicos sin renderizar mostrando texto en bruto como `\[!DOSIS]`.

Es prioritario corregir estos defectos para que la exportación a 2 columnas genere documentos de calidad editorial médica profesional, legibles y aptos para estudio e impresión.

## What Changes

- **Ocultar controles interactivos en impresión**: Ocultar por completo `.mermaid-controls`, botones de zoom y fullscreen en `@media print`, mostrando únicamente el diagrama o un pie de figura sobrio.
- **Soporte de diagramas de ancho completo (`column-span: all`)**: Permitir que diagramas Mermaid y tablas anchas se expandan a lo ancho de ambas columnas cuando sea necesario en el layout de 2 columnas, o rediseñar su contención para evitar que se compriman a niveles microscópicos.
- **Control de saltos de página y prevención de columnas huérfanas**: Reestructurar las reglas de `break-inside`, `break-after` y contención en `.mermaid-viewer-card` y encabezados para evitar que los contenedores se dividan dejando columnas en blanco con cabeceras huérfanas.
- **Corrección del solapamiento de texto en saltos de columna**: Corregir los márgenes y paddings en elementos superiores de columna para evitar colisiones tipográficas en Chromium Print (como la observada en la página 10).
- **Normalización del parser para Callouts clínicos (`\[!TIPO]`)**: Desescapar corchetes `\[` en `parseMarkdownBlocks` para que callouts generados con backslash (ej. `\[!DOSIS]`, `\[!WARNING]`) se interpreten y estilicen correctamente como tarjetas clínicas con sus íconos y bordes respectivos.
- **Evitar desbordamiento y fragmentación de listas**: Evitar que títulos como `Evitar:` se separen de sus primeros elementos de lista entre columnas y páginas.

## Capabilities

### Modified Capabilities

- `data-portability`: Corrección del renderizado, diagramas Mermaid, callouts y saltos de columna en la exportación a PDF a 2 columnas.

## Impact

- `app/src/components/reader/ArticleReader.tsx`: Normalización de caracteres escapados (`\[`) y mejoras en el agrupamiento de bloques para impresión.
- `app/src/components/reader/MermaidViewer.tsx`: Estructura apta para impresión sin controles interactivos huérfanos.
- `app/src/index.css`: Reglas de `@media print` para dos columnas, `column-span: all`, ocultación de controles, corrección de solapamiento de texto y control de flujo.
