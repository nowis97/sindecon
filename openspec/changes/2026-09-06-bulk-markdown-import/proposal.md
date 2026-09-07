## Why

Los profesionales y estudiantes de medicina frecuentemente cuentan con decenas o cientos de apuntes, resúmenes y guías clínicas en formato Markdown (`.md`) organizados en carpetas locales en sus computadoras (exportados de Obsidian, Notion, Logseq, Typora, ChatGPT o repositorios de estudio). Actualmente, la importación en SINDECON requiere subir archivos de uno en uno a través del asistente o importar un archivo `.zip` completo de backup que sobreescribe/fusiona toda la base de datos.

Es necesario permitir la **importación masiva de archivos Markdown (`.md`) directamente hacia una carpeta específica o una nueva especialidad/carpeta**, extrayendo automáticamente títulos clínicos, respetando la jerarquía, procesando en lote y proporcionando control sobre duplicados.

## What Changes

- **Importación masiva multi-archivo y de carpetas**:
  - Soporte para selección múltiple de archivos `.md` / `.markdown` (`<input type="file" multiple />`).
  - Soporte para selección o arrastre de carpetas completas (`webkitdirectory` / Drag & Drop de carpetas y múltiples archivos).
  - Soporte opcional para importar un archivo `.zip` que contenga una colección de archivos `.md` sueltos o anidados.
- **Extracción inteligente de metadatos clínicos**:
  - Extracción de título del artículo en orden de prioridad: Frontmatter YAML (`title:`), primer encabezado `# Título`, o el nombre del archivo sanitizado.
  - Extracción de etiquetas/tags desde Frontmatter (`tags: [...]`) o hashtags `#tag` en el cuerpo.
  - Preservación íntegra de enlaces wiki internos `[[uuid|Título]]` / `[[Título]]`, tablas, callouts clínicos y diagramas Mermaid.
- **Puntos de entrada intuitivos**:
  - **Menú contextual de carpeta (`···`)**: Opción "📥 Importar archivos .md a esta carpeta".
  - **Explorador de Carpetas (`FolderExplorerView`)**: Botón en barra de herramientas "📥 Importar .md" y zona de soltar (Drag & Drop) de archivos.
  - **Asistente de Importación Inteligente (`SmartImportModal`)**: Pestaña "Subir Markdown / Carpeta" con selector múltiple y vista previa del lote.
- **Procesamiento por lotes y feedback visual**:
  - Modal de progreso durante la importación masiva con barra de porcentaje, contador (`Importando 18 de 45...`) y lista de artículos creados.
  - Manejo de colisiones de nombres: opción para sobreescribir existentes, omitir duplicados o crear con sufijo numérico automático (`(1)`, `(2)`).

## Capabilities

### Modified Capabilities

- `data-portability`: Añadir requisitos y especificación formal para la importación masiva de archivos Markdown sueltos, carpetas locales y paquetes comprimidos de notas hacia el árbol de conocimientos con políticas de resolución de nombres.
- `knowledge-tree`: Añadir acciones de importación masiva a nivel de nodo de carpeta (menú contextual, barra de carpeta y drag & drop de archivos del sistema operativo).
- `content-editing`: Ampliar las capacidades de carga de archivos en Smart Import para soportar lotes multi-archivo con previsualización resumida.

## Impact

- **Frontend / UI**: Modales de importación, menú contextual en `TreeView.tsx`, barra de acciones en `FolderExplorerView.tsx`, y nuevo modal/indicador de progreso de importación masiva `BulkImportModal.tsx`.
- **Lógica de Dominio / Base de Datos**: Nuevo módulo de procesamiento en lote `app/src/domain/bulkMarkdownImport.ts` y métodos en `app/src/db/nodes.ts` y `app/src/db/articles.ts` para inserción atómica masiva en IndexedDB.
- **Pruebas**: Nuevos tests unitarios en Vitest para parseo masivo de títulos/tags/frontmatter y pruebas E2E en Playwright.
