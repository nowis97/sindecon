## Why

El personal médico y de estudio almacena con frecuencia guías clínicas, consentimientos, algoritmos y artículos científicos en formato PDF. Actualmente, Sindecon permite importar texto desde Word o archivos Markdown y exportar a PDF, pero no cuenta con un mecanismo para cargar directamente uno o múltiples documentos PDF a la base de conocimientos, conservando su nombre original o permitiendo personalizarlo, ni para visualizarlos de manera cómoda y nativa sin salir de la aplicación offline.

## What Changes

- **Modal dedicado de subida de PDFs (`UploadPdfModal`)**:
  - Permite arrastrar o seleccionar uno o varios archivos `.pdf` (soporte multi-archivo).
  - Presenta una lista de los PDFs seleccionados con su tamaño, nombre original y un campo de entrada editable para cambiar opcionalmente el título de cada documento antes de guardarlo.
  - Permite eliminar archivos individuales de la lista antes de procesar la subida.
  - Permite elegir la carpeta destino en el árbol de conocimientos (con preselección automática de la carpeta activa o abierta).
- **Puntos de acceso intuitivos**:
  - Opción "📄 Subir PDFs" en el menú contextual (`···`) de cualquier carpeta del árbol de conocimientos.
  - Botón de acción "📄 Subir PDF" en la cabecera y barra de herramientas de la vista exploradora de carpeta (`FolderExplorerView`).
- **Almacenamiento local persistente**:
  - Cada archivo PDF se almacena de forma íntegra en la base de datos IndexedDB local (tabla `assets` con MIME `application/pdf`).
  - Se crea un nodo de tipo `article` en la jerarquía del árbol para cada PDF, asociándolo con la referencia al asset local (`asset://<id>`).
- **Visualizador nativo de PDF en el lector de artículos**:
  - Al abrir un artículo que contiene un documento PDF, el lector de artículos (`ArticleReader`) renderiza un visor PDF nativo y responsivo (`<object data={blobUrl} type="application/pdf">` / `<iframe>`) que aprovecha los controles del navegador (navegación de páginas, zoom, búsqueda, impresión y descarga).
  - Incluye barra de herramientas complementaria con botones para "Descargar PDF" y "Abrir en pestaña nueva" para máxima compatibilidad con dispositivos móviles y navegadores que no admitan incrustación inline.
  - Permite renombrar el artículo con normalidad desde la cabecera del visor.

## Capabilities

### Modified Capabilities

- `knowledge-tree`: Añade flujo de subida de uno o varios archivos PDF a carpetas del árbol mediante diálogo modal con edición opcional de títulos y asignación jerárquica.
- `content-editing`: Incorpora soporte para visualización interactiva de documentos PDF en el visor de artículos a través de referencias a assets locales.

## Impact

- **Modelos y Base de Datos**: Reutiliza la tabla existente `assets` (almacenando blobs `application/pdf`) y `nodes`/`articles`. No requiere migraciones destructivas de Dexie ni cambios en el esquema de sincronización.
- **Componentes de UI**:
  - Nuevo componente `UploadPdfModal.tsx` en `src/components/portability/` o `src/components/tree/`.
  - Nuevo componente `PdfDocumentViewer.tsx` integrado en `ArticleReader.tsx`.
  - Modificación de `TreeView.tsx` y `FolderExplorerView.tsx` para incorporar las opciones de disparo de subida.
- **Rendimiento y dependencias**: No requiere añadir librerías pesadas externas (como `pdfjs-dist`); aprovecha las capacidades nativas de renderizado de PDF del navegador y `URL.createObjectURL(blob)`.
