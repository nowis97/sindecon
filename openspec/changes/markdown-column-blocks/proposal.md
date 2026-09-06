# Proposal: Bloques Multicolumna en Markdown Clínico (:::columns)

## Why

Actualmente, las notas clínicas en SINDECON se renderizan en una sola columna lineal. En la práctica médica y de estudio, con frecuencia es indispensable presentar información en columnas paralelas dentro del mismo artículo (ej. esquemas terapéuticos comparados, criterios diagnósticos mayores vs menores, diagnóstico diferencial de dos patologías, o listas de contraindicaciones enfrentadas). 

Introducir una sintaxis nativa de bloques multicolumna (`:::columns` con delimitador `|||`) permite a los profesionales y estudiantes estructurar contenido paralelo sin recurrir a HTML sucio ni romper la portabilidad de sus notas en texto plano.

## What Changes

- **Sintaxis de Bloque Multicolumna**: Reconocimiento de bloques `:::columns` y divisores de columna `|||` en el parser de bloques Markdown (`parseMarkdownBlocks`).
- **Markdown Completo Anidado**: Soporte para parseo recursivo completo dentro de cada columna (listas, tablas, fórmulas LaTeX, negritas, cursivas, enlaces wiki y callouts).
- **Renderizado Responsivo en Modo Lector**: Renderizado visual mediante CSS Grid (`.article-columns-grid`) con distribución en 2 o 3 columnas en desktop/tablet, y apilamiento vertical suave en pantallas móviles (< 640px).
- **Herramienta en Barra del Editor**: Botón de acceso directo `[ ◫ Columnas ]` en la barra de herramientas del editor para insertar la plantilla de dos columnas a 1 toque.
- **Soporte en Exportación a PDF e Impresión**: Renderizado de las columnas paralelas al exportar a PDF o imprimir la ficha médica.

## Capabilities

### New Capabilities
<!-- Ninguna capability completamente nueva; se extienden las capacidades centrales existentes de edición y portabilidad. -->

### Modified Capabilities
- `content-editing`: Incorpora la sintaxis `:::columns` / `|||` en el parser de bloques, renderizado visual responsivo en `ArticleReader`, y botón de inserción rápida en la barra de herramientas de `MarkdownEditor`.
- `data-portability`: Garantiza que los bloques `:::columns` se rendericen en columnas visuales legibles al imprimir o exportar a PDF.

## Impact

- `app/src/components/reader/ArticleReader.tsx`: Extensión del parser `parseMarkdownBlocks` con tipo de bloque `columns` y renderizado de sub-bloques recursivos.
- `app/src/components/editor/MarkdownEditor.tsx`: Botón en la barra de herramientas para insertar snippets de columnas.
- `app/src/index.css`: Clases `.article-columns-grid`, `.article-column-item` y media queries para móvil.
- `app/src/domain/exportmd.ts`: Limpieza y preservación transparente de bloques `:::columns` en exportaciones Markdown.
- Tests unitarios y E2E: Verificación de parseo de 2 y 3 columnas, elementos anidados y visualización.
