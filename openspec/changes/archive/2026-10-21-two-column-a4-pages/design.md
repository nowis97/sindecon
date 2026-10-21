# Design: Paginación en Hojas A4 para Modo Vista a Dos Columnas

## Context

En la versión actual de `ArticleReader.tsx`, la maquetación a 2 columnas (`.article-reader-view.a4-sheet.layout-two-columns`) utiliza las propiedades CSS `columns: 2` sobre un único contenedor sin límite de altura. Esto provoca que el navegador intente equilibrar las dos columnas a lo largo de toda la longitud del artículo en una sola pieza vertical interminable, en lugar de simular páginas físicas individuales. Además, los márgenes interiores de la hoja (`padding: 24mm 20mm`) son mucho más amplios que los márgenes acotados de exportación (`7mm 10.5mm`), desperdiciando espacio útil.

Este diseño define cómo paginar de forma determinista el contenido en hojas A4 discretas (210mm × 297mm), con márgenes acotados idénticos a los de exportación y separación física visible entre páginas consecutivas.

## Goals / Non-Goals

**Goals:**
- Distribuir el contenido médico en modo 2 columnas en una secuencia de hojas A4 independientes (`.a4-sheet`).
- Aplicar márgenes acotados de `padding: 7mm 10.5mm` en las hojas de 2 columnas, igualando los parámetros de `@page { margin: 7mm 10.5mm; }` del PDF de exportación.
- Establecer una separación física visible entre hojas sucesivas (brecha de 32px, sombra de elevación sobre el lienzo de fondo, borde sutil e indicador de número de página "Página X").
- Aplicar tipografía e interlineado compactos de alta densidad (~1.2 / 1.15) coherentes con la exportación clínica.
- Mantener compatibilidad total con reglas horizontales `---` como saltos de página explícitos obligatorios.
- Garantizar adaptación responsiva en pantallas móviles (< 820px) colapsando a 1 columna.

**Non-Goals:**
- No alterar el motor de exportación a PDF directo (`@media print`), que ya cuenta con su propio renderizado nativo.
- No alterar el modo editor WYSIWYG (`MarkdownEditor.tsx`).

## Decisions

### 1. Algoritmo de partición en hojas A4 (`paginateBlocksForTwoColumns`)
- **Decisión**: Se implementa una función de partición determinista en `ArticleReader.tsx` que estima la carga vertical de cada bloque y los distribuye en páginas A4 discretas.
- **Métricas de capacidad A4**:
  - Hoja A4: 297mm de alto (~1123px).
  - Menos márgenes superior e inferior (7mm + 7mm = 14mm ≈ 53px): Altura útil por columna = **~1070px** (283mm).
  - Capacidad de 2 columnas por hoja: 2 × 1070px = **~2140px equivalentes de contenido vertical**.
- **Reglas de corte**:
  - Cada bloque aporta un peso de altura estimado:
    - Encabezados: h1 (~50px), h2 (~40px), h3 (~30px).
    - Párrafos y citas: estimación basada en número de caracteres / ancho de columna (~45 caracteres por línea en 2 columnas, ~20px por línea).
    - Tablas: filas × 28px + encabezado.
    - Imágenes y diagramas Mermaid: altura estimada de 180px–240px.
    - Callouts: altura según líneas de contenido + título (~60px base).
  - Cuando la suma acumulada de bloques supera la capacidad de una hoja (o se encuentra un bloque `hr`), se cierra la hoja actual y se comienza una nueva `.a4-sheet`.
  - Si la vista está en 1 columna, se utiliza la partición estándar por `hr`.

### 2. Dimensiones y Márgenes de Hoja A4 en Modo 2 Columnas
- **Decisión**:
  - `max-width: 210mm; width: 100%;`
  - `min-height: 297mm;` (proporción física de hoja A4).
  - `padding: 7mm 10.5mm;` (márgenes acotados idénticos a exportación).
  - `column-count: 2; column-gap: 1.5rem; column-rule: 1px solid var(--border-subtle);`
  - `column-fill: auto;` (el texto llena secuencialmente la columna izquierda y luego la derecha).

### 3. Separación física real entre hojas
- **Decisión**:
  - El contenedor `.a4-sheet-container` establece `gap: 32px` entre hojas.
  - Entre cada hoja se muestra un separador físico (`.a4-sheet-break`) con línea sutil y badge centrado: "Página 1", "Página 2", etc.
  - Cada hoja A4 cuenta con sombra perimetral de elevación: `box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);` (y versión de alto contraste para dark mode).

### 4. Interlineado y densidad
- **Decisión**: En `.article-reader-view.a4-sheet.layout-two-columns`, se reduce el interlineado a `line-height: 1.2` (similar al 1.15 de exportación) y los márgenes de párrafos a `margin-bottom: 6px` para una lectura médica de alta densidad.

## Risks / Trade-offs

- **[Variación de altura real por fuentes del sistema o imágenes]** → *Mitigación*: Se usa `min-height: 297mm` con tolerancia de desborde y márgenes conservadores para que los bloques no queden partidos ni truncados si hay ligeras variaciones de renderizado.
- **[Dispositivos móviles]** → *Mitigación*: En `@media (max-width: 820px)`, la visualización colapsa a 1 columna continua con padding de 16px, evitando desbordamientos horizontales.
