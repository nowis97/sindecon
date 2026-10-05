# Design

## Context

La exportación de artículos clínicos a PDF en Sindecon utiliza la API estándar de impresión del navegador (`window.print()`) inyectando un contenedor clonado `#print-article-document` con maquetación configurada según la opción elegida por el usuario: `1` columna o `2` columnas (`column-count: 2`).

Actualmente, las reglas `@media print` en `app/src/index.css` y los componentes `ArticleReader.tsx` y `MermaidViewer.tsx` presentan deficiencias al combinarse con el motor de impresión de Chromium:
1. `MermaidViewer` renderiza controles interactivos (`.mermaid-controls` con botones `+`, `-`, `100%`, `⛶`) que no son filtrados en impresión.
2. Los diagramas Mermaid se fuerzan dentro de una columna de ~80 mm, encogiéndose hasta la ilegibilidad cuando son diagramas horizontales o complejos.
3. El motor multi-columna de Chromium produce saltos erráticos dejando columnas casi vacías cuando un bloque con `break-inside: avoid` no cabe en el espacio restante.
4. En saltos de columna se observan solapamientos tipográficos en la primera línea superior de la columna (página 10).
5. `ArticleReader` no desescapa los corchetes `\[`, lo que impide que la expresión regular reconozca callouts clínicos como `\[!DOSIS]`.

## Goals / Non-Goals

**Goals:**
- Ocultar completamente los controles de interfaz interactivos en diagramas y cards durante la exportación / impresión a PDF.
- Habilitar que diagramas Mermaid y tablas anchas puedan expandirse ocupando ambas columnas (`column-span: all`) o escalarse adecuadamente para mantener la legibilidad clínica.
- Corregir el parser de Markdown en `ArticleReader.tsx` para admitir callouts clínicos con corchetes escapados (`\[!DOSIS]`) o sin prefijo `>`, renderizándolos con su diseño distintivo.
- Evitar solapamientos tipográficos en cabeceras de columnas y reducir vacíos huérfanos entre páginas y columnas.

**Non-Goals:**
- No se reemplazará el motor de impresión nativo del navegador por generadores PDF de servidor (Node/Puppeteer) ni librerías pesadas como jsPDF o PDFKit.
- No se alterará el modo de visualización en pantalla ni la interactividad del lector habitual fuera de la impresión.

## Decisions

### Decisión 1: Ocultar controles interactivos y resetear transformaciones en `@media print`
- **Enfoque**: En `app/src/index.css`, ocultar `.mermaid-controls` y `.mermaid-buttons` en `@media print`. Además, forzar `transform: none !important;` en `.mermaid-svg-wrapper` para garantizar que desplazamientos o zooms manuales del usuario en pantalla no desplacen el diagrama fuera del papel.
- **Alternativa considerada**: Ocultar los controles vía un prop condicional `isPrintView` en `MermaidViewer.tsx`. Se combinarán ambas soluciones: el prop `isPrintView` en el componente y la regla CSS a prueba de fallos.

### Decisión 2: Soporte de expansión completa (`column-span: all`) en diagramas y tablas complejas
- **Enfoque**: En el layout de 2 columnas (`.print-layout-two-columns`), permitir que `.mermaid-viewer-card` y `.reader-table-wrapper` de gran tamaño utilicen `column-span: all !important`. De este modo, diagramas de flujo horizontales (como *Ligaduras de Pinard*, *BLEEDING* o el algoritmo quirúrgico de HPP) cruzan horizontalmente la página a ancho completo, reanudando el flujo en 2 columnas inmediatamente antes y después.
- **Alternativa considerada**: Forzar que todos los diagramas estén restringidos a 1 columna. Rechazado porque los diagramas clínicos de más de 3 niveles horizontales se vuelven microscópicos e ilegibles en 80 mm.

### Decisión 3: Normalización y tolerancia a escapes en el parser de Callouts (`ArticleReader.tsx`)
- **Enfoque**:
  1. En `parseMarkdownBlocks`, ampliar la limpieza inicial agregando `replace(/\\+\[/g, '[')` para revertir el escape de corchetes.
  2. Ajustar la detección de callouts para tolerar líneas directas `[!TIPO]` sin necesidad estricta de iniciar con `>`, o desescapar el prefijo `>` y corchetes en una sola pasada.
  3. Asegurar que los tipos `DOSIS`, `FARMACO`, etc. asignen la clase `.callout-dosage` con su ícono y paleta adecuados.

### Decisión 4: Optimización de saltos de página y prevención de solapamientos tipográficos
- **Enfoque**:
  1. Establecer `break-inside: avoid !important; page-break-inside: avoid !important;` de forma estricta en cada bloque indivisible.
  2. Aplicar `break-after: avoid !important` en encabezados y líneas introductorias (ej. `Evitar:`) para que no se separen de sus viñetas.
  3. Agregar `padding-top: 0` y resetear márgenes colapsables al inicio de columna para eliminar el solapamiento visual entre líneas.

## Risks / Trade-offs

- **[Riesgo] Compatibilidad de `column-span: all` en Chromium Print**:
  → *Mitigación*: En Chromium (Chrome, Edge), `column-span: all` es nativamente compatible para hijos directos de un contenedor multi-columna. En `ArticleReader`, los bloques (`blocks.map`) son hijos directos de `print-reader-view`.
- **[Riesgo] Diagramas muy verticales con `column-span: all` consumiendo demasiado espacio**:
  → *Mitigación*: Aplicar `column-span: all` a diagramas anchos o estructurados, manteniendo diagramas simples/estrechos dentro de la columna o aplicando un ancho máximo proporcional.
