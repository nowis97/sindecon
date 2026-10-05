## Context

Actualmente SINDECON cuenta con un sistema de exportación/importación de backup completo en ZIP (`exportImport.ts`) y un modal de importación individual (`SmartImportModal.tsx`). Sin embargo, los usuarios médicos que migran desde Obsidian, Notion o repositorios de apuntes en carpetas necesitan importar lotes enteros de archivos `.md` directamente dentro de una carpeta clínica existente o nueva sin sobrescribir la base de datos completa.

## Goals / Non-Goals

**Goals:**
- Permitir la selección y carga por lotes de archivos Markdown (`.md`, `.markdown`), carpetas enteras de archivos locales y archivos `.zip` de notas.
- Extracción robusta de metadatos clínicos (Frontmatter YAML, H1, tags) con fallback a nombres de archivo limpios.
- Inserción atómica y de alto rendimiento en Dexie/IndexedDB mediante transacciones por lotes (`bulkPut`).
- Puntos de entrada naturales en la interfaz: menú de carpeta `···`, vista exploradora de carpetas y soltado de archivos (Drag & Drop).
- Políticas claras para resolución de duplicados (`skip`, `suffix`, `overwrite`).
- Modal con previsualización del lote y progreso en tiempo real.

**Non-Goals:**
- Importación de formatos binarios propietarios no soportados (ej. `.pdf`, `.epub`, `.pages`); `.docx` sigue manejándose a través de Mammoth en Smart Import individual.
- Sincronización continua bidireccional con el sistema de archivos del SO (SINDECON es una PWA Local-First en IndexedDB; la importación es una acción de ingestión puntual).

## Decisions

### 1. Extracción de Metadatos en Capa de Dominio Pura (`bulkMarkdownImport.ts`)
- **Decisión**: Crear funciones desacopladas de la UI para analizar y estructurar cada archivo:
  - `parseMarkdownArticle(rawText: string, filename: string): ParsedArticle`
  - `processMarkdownFiles(files: File[]): Promise<ParsedArticle[]>`
- **Razón**: Permite testear unitariamente todas las variantes (Frontmatter con tags, documentos sin encabezados, caracteres especiales en nombres, etc.) con 100% de cobertura en Vitest sin mocks de DOM.
- **Alternativas consideradas**: Parsear inline en el componente React. Descartado por mezclar lógica de presentación con reglas de negocio y dificultar pruebas.

### 2. Reutilización de `JSZip` para Lotes Comprimidos de Notas
- **Decisión**: Utilizar la dependencia ya instalada `jszip` para permitir que el usuario suba un `.zip` de apuntes (ej. un vault exportado de Obsidian) y extraer recursivamente todos los `.md`.
- **Razón**: `jszip` ya forma parte del bundle de producción (peso marginal 0) y resuelve la limitación de algunos navegadores móviles donde no se permite seleccionar carpetas con `webkitdirectory`.

### 3. Inserción Transaccional en Dexie con `db.transaction('rw')`
- **Decisión**: Realizar la creación de nodos y cuerpos de artículos dentro de una transacción `db.transaction('rw', [db.nodes, db.articles], ...)` agrupando inserciones en bloques de hasta 50 elementos.
- **Razón**: Asegura consistencia ACID en IndexedDB, evita re-renders individuales de React (`useLiveQuery` se dispara una sola vez al finalizar la transacción) y previene bloqueos de UI en lotes de más de 100 notas.

### 4. Estrategias de Colisión Configurables
- **Decisión**: Permitir tres políticas en el modal de importación:
  1. `suffix` (por defecto): Genera un título único agregando `(1)`, `(2)`.
  2. `skip`: Omite la creación si ya existe un artículo con el mismo título en la carpeta destino.
  3. `overwrite`: Actualiza el cuerpo del artículo existente conservando su ID, backlinks y fecha de creación.

## Risks / Trade-offs

- **[Riesgo] Archivos muy grandes o lotes masivos (>500 notas) bloqueando el hilo principal**
  - *Mitigación*: Procesamiento en chunks asíncronos con `await new Promise(requestAnimationFrame)` entre bloques para mantener la barra de progreso reactiva a 60 FPS.
- **[Riesgo] Frontmatter con sintaxis YAML malformada**
  - *Mitigación*: Parser tolerante a fallos mediante expresiones regulares que captura bloques `--- ... ---` sin arrojar excepciones; si el YAML no es válido, se descarta el bloque y se procesa el texto completo como cuerpo Markdown.
- **[Riesgo] Enlaces wiki relativos entre notas importadas**
  - *Mitigación*: El resolvedor de wiki-links de SINDECON (`[[Título]]`) funciona por búsqueda de títulos indexados, por lo que las referencias cruzadas entre notas importadas se activan automáticamente.
