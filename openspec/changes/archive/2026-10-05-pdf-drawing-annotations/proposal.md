## Why

Los profesionales médicos y estudiantes de medicina que consultan guías clínicas, papers, algoritmos y atlas en formato PDF en SINDECON (tanto en escritorio como en tablets) necesitan subrayar, rodear conceptos clave, hacer notas manuscritas o trazar diagramas rápidos directamente sobre las páginas del documento con un lápiz óptico (Apple Pencil, stylus) o con el dedo/ratón.

Actualmente, el visor de PDF renderiza las páginas en lienzos `<canvas>` con PDF.js en modo solo lectura, sin permitir interactividad gráfica ni toma de apuntes visuales. Incorporar una capa de anotaciones a mano alzada (lápiz, marcador/resaltador y borrador) persistente y no destructiva transforma el visor de PDF en una herramienta de estudio médico de primer nivel.

## What Changes

- **Barra de herramientas de anotación en el visor PDF (`PdfDocumentViewer`):**
  - Botón de alternancia para activar/desactivar el modo de anotación a mano alzada (`✏️ Modo Lápiz / Anotar`).
  - Paleta de herramientas de anotación:
    - **Lápiz / Pluma:** Trazo fino y opaco en colores seleccionables (negro, azul clínico, rojo alerta, verde).
    - **Resaltador:** Trazo grueso semitransparente (`rgba(...)` o modo `multiply`) para destacar texto (amarillo fluorescente, verde, rosa).
    - **Borrador:** Permite borrar trazos realizados sobre la página.
    - **Acciones:** Deshacer último trazo (`Undo`), rehacer (`Redo`) y limpiar anotaciones de la página actual.
- **Capa de dibujo interactiva por página (Canvas Overlay):**
  - Cada página PDF incluye un lienzo de dibujo transparente superpuesto con la misma resolución y dimensiones que la página PDF.
  - Manejo de `PointerEvents` (`pointerdown`, `pointermove`, `pointerup`) con soporte táctil y de stylus (`touch-action: none` cuando el modo de dibujo está activo para evitar desplazamientos accidentales).
  - Trazos almacenados en coordenadas vectoriales normalizadas (escala base 1.0) para que al cambiar el zoom del PDF (50%, 100%, 150%) las anotaciones se escalen proporcionalmente sin distorsión y permanezcan fijadas al contenido de la página.
- **Persistencia local no destructiva en IndexedDB / Dexie:**
  - Los trazos de cada página se guardan de forma persistente en almacenamiento local asociado al artículo/documento PDF.
  - Al cerrar la aplicación, recargar o navegar entre artículos, las anotaciones de cada página se restauran automáticamente.
  - El archivo PDF original no se corrompe ni se modifica binariamente.

## Capabilities

### Modified Capabilities
- `content-editing`: Extender los requisitos de visualización y estudio de documentos médicos para incluir anotaciones manuscritas a mano alzada (lápiz/resaltador) sobre documentos PDF con persistencia local.

## Impact

- **Componentes Afectados:**
  - `app/src/components/reader/PdfDocumentViewer.tsx`: Incorporación de toolbar de dibujo, canvas overlay por página y lógica de eventos de puntero.
  - `app/src/db/db.ts`: Esquema o tabla Dexie para persistir trazos de anotación (`pdf_annotations`).
  - `app/src/index.css`: Estilos de la barra de dibujo, paleta de colores, cursor de lápiz y capas superpuestas.
- **Pruebas y Verificación:**
  - Tests unitarios para cálculo y normalización de coordenadas vectoriales en zoom.
  - Tests unitarios en base de datos Dexie para persistencia y recuperación de trazos.
  - Pruebas E2E en Playwright validando activación de modo lápiz, trazo en canvas, cambio de color y persistencia tras recargar.
