# Design: Renderizado de Hojas Tamaño A4 en Modo Vista

## Context

Actualmente, `ArticleReader.tsx` renderiza los bloques de Markdown parseados dentro de un único elemento contenedor `.article-reader-view`, el cual reside dentro de `.article-container` con un ancho máximo genérico de 900px. No existe concepto de hoja física ni proporciones basadas en estándares de papelería como A4.

El usuario ha seleccionado la opción de **hojas de página A4 con proporción estándar, márgenes y separación visual entre páginas**. Esta arquitectura garantiza una estética de documento real (similar a Google Docs o Word en modo página), permitiendo visualizar hojas independientes sin la fragilidad técnica de un motor complejo de partición de nodos DOM.

## Goals / Non-Goals

**Goals:**
- Estructurar el visor de lectura para que presente el contenido en una o más hojas estilizadas con dimensiones estándar A4 (`210mm` de ancho nominal, proporción 1:1.414).
- Permitir la división visual en múltiples hojas A4 utilizando saltos de página naturales (por ejemplo, reglas horizontales `---` o bloques delimitadores de sección).
- Configurar márgenes perimetrales de hoja (20mm a 25mm en desktop), fondo de hoja elevado (`--bg-card`) y sombras realistas sobre el fondo del lienzo.
- Mantener total compatibilidad con la vista a 2 columnas (`.layout-two-columns`), texto justificado y esquemas Mermaid.
- Garantizar diseño 100% responsivo que en pantallas móviles (< 768px) adapte la hoja al ancho completo sin desbordamientos.

**Non-Goals:**
- No implementar corte forzado milimétrico de nodos (cortar párrafos o celdas de tablas a la mitad de altura fija de 297mm en tiempo real), lo cual introduciría errores de renderizado y rotura de componentes interactivos.
- No modificar el modo de edición WYSIWYG (`MarkdownEditor.tsx`), el cual continúa enfocado en redacción fluida.
- No alterar la exportación de PDF directa (`@media print`), la cual ya cuenta con sus propias reglas `@page`.

## Decisions

### 1. Representación modular en el DOM (`.a4-sheet`)
- **Decisión**: Dentro de `ArticleReader.tsx`, los bloques de contenido se organizarán en una o más hojas con la clase `.a4-sheet` dentro del contenedor principal `.article-reader-container`.
- **Lógica de partición**:
  - Si el documento contiene reglas horizontales (`type: 'hr'`), estas funcionarán como saltos de página explícitos, cerrando la hoja actual y abriendo una nueva `.a4-sheet`.
  - Si no hay reglas horizontales, todo el contenido se presenta en una elegante hoja A4 principal continua cuya altura mínima es `297mm`.
- **Alternativas consideradas**:
  - *Contenedor único sin soporte de múltiples hojas*: Descartado porque no cumplía el requerimiento de separación visual entre hojas.
  - *Medición virtual de altura por script*: Descartado por ser propenso a desajustes tras la carga asíncrona de fuentes, diagramas Mermaid o imágenes locales.

### 2. Estilos y métricas de hoja A4 en CSS
- **Decisión**:
  - `max-width: 210mm` (~794px a 96 DPI).
  - `min-height: 297mm` (~1123px a 96 DPI) para garantizar la proporción A4 vertical incluso con poco texto.
  - `padding: 24mm 20mm` (o `2rem 1.75rem`) en pantallas grandes.
  - `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);` para resaltar la hoja como papel físico sobre el fondo.
  - Separación inter-hoja: `margin-bottom: 28px` con línea o brecha visual.
- **Alternativas consideradas**:
  - *Ancho fijo `width: 210mm`*: Descartado porque rompe en pantallas móviles de menos de 800px. Se usa `width: 100%; max-width: 210mm; margin: 0 auto;`.

### 3. Modo de 2 Columnas y Alineación dentro de la Hoja A4
- **Decisión**: La clase `.layout-two-columns` y la clase `.text-justified` se aplicarán a nivel de cada `.a4-sheet`, permitiendo que el texto a dos columnas respete fielmente los márgenes laterales de la hoja A4.

### 4. Responsividad móvil
- **Decisión**: En pantallas `< 768px`, las reglas de `.a4-sheet` reducen sus márgenes internos (`padding: 18px 16px`), eliminan el `min-height: 297mm` para evitar espacios vacíos innecesarios en teléfonos, y ajustan el ancho al 100% de la pantalla.

## Risks / Trade-offs

- **[Tablas o diagramas Mermaid anchos en 210mm]** → *Mitigación*: Se preserva `overflow-x: auto` en los contenedores de tablas y el soporte de desplazamiento/zoom táctil en diagramas Mermaid.
- **[Documentos muy breves con mucho espacio vacío]** → *Mitigación*: La proporción `min-height: 297mm` asegura que se vea como una hoja A4 formal; en móvil se relaja a `min-height: auto`.
- **[Modo oscuro]** → *Mitigación*: La hoja A4 adopta `var(--bg-card)` con borde sutil `var(--border-subtle)` y sombra adaptada, garantizando legibilidad óptima tanto en temas claros como oscuros.
