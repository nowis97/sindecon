## Context

El visor de documentos PDF (`PdfDocumentViewer`) utiliza PDF.js para renderizar cada página en un elemento `<canvas>` nativo dentro de un contenedor `.pdf-page-canvas-wrapper`. La aplicación opera bajo una arquitectura *local-first* con IndexedDB (Dexie) para almacenamiento persistente y offline.

Actualmente, las páginas del PDF son de solo lectura. Para permitir anotaciones tipo lápiz y resaltador (especialmente en tablets con stylus/dedo y en escritorio con ratón), se requiere una capa gráfica interactiva que no altere el binario original del PDF y mantenga los trazos nítidos independientemente del nivel de zoom.

## Goals / Non-Goals

**Goals:**
- Proporcionar una experiencia fluida de dibujo a mano alzada (baja latencia, trazos suaves con curvas de Bézier cuadráticas) directamente sobre cada página del PDF.
- Soportar herramientas esenciales:
  - **Lápiz / Pluma:** Trazos continuos y opacos con selección de colores clínicos (Negro, Azul, Rojo, Verde) y grosor configurable.
  - **Resaltador:** Trazos anchos translúcidos (`rgba` o composición `multiply`) en amarillo, verde y rosa para destacar texto sin ocultarlo.
  - **Borrador:** Eliminación selectiva de trazos al pasar sobre ellos.
  - **Acciones:** Deshacer (`Undo`), Rehacer (`Redo`) y Limpiar anotaciones de la página.
- Representación vectorial independiente de la resolución: los trazos se almacenan en coordenadas normalizadas (escala base 1.0) para que al ampliar o reducir el zoom (ej. 75% a 200%) las notas se reposicionen y redibujen con exactitud milimétrica.
- Persistencia automática en IndexedDB (Dexie) asociada al `articleId` y `pageNumber`.
- Soporte ergonómico táctil y de stylus (`PointerEvents`, `touch-action: none` en modo dibujo para prevenir scroll no intencionado).

**Non-Goals:**
- Modificar o reescribir el binario original del PDF (el PDF original permanece inmutable).
- Reconocimiento óptico de escritura a mano (OCR de manuscritos).
- Exportación o quemado de trazos dentro del flujo nativo de descarga de PDF.js (se mantiene el archivo PDF limpio original; la exportación con anotaciones quemadas queda fuera de alcance de esta fase).

## Decisions

### 1. Modelo de datos vectorial (`Stroke[]`) vs Mapas de bits rasterizados
- **Decisión:** Almacenar las anotaciones como arrays de objetos vectoriales:
  ```ts
  export interface AnnotationPoint {
    x: number // Coordenada x en escala 1.0 (puntos PDF)
    y: number // Coordenada y en escala 1.0 (puntos PDF)
    pressure?: number
  }

  export interface AnnotationStroke {
    id: string
    tool: 'pen' | 'highlighter' | 'eraser'
    color: string
    width: number
    points: AnnotationPoint[]
  }

  export interface PageAnnotationsRecord {
    id?: number
    articleId: string
    pageNumber: number
    strokes: AnnotationStroke[]
    updatedAt: number
  }
  ```
- **Razón:** Los vectores ocupan pocos kilobytes de JSON (frente a megabytes por página de imágenes rasterizadas), permiten `Undo`/`Redo` atómico, borrado preciso de trazos y redibujado perfecto a cualquier nivel de escala (`scale`) y densidad de píxeles (`devicePixelRatio`).
- **Alternativas consideradas:** Guardar PNGs o WebP por página en Dexie; descartado porque multiplicaría el tamaño de la base de datos y provocaría pixelación severa al hacer zoom.

### 2. Capa Canvas Overlay por página (`PdfAnnotationLayer`)
- **Decisión:** Cada `.pdf-page-canvas-wrapper` contendrá dos capas `<canvas>` superpuestas:
  1. `<canvas className="pdf-page-canvas">` (renderizado de PDF.js, fondo).
  2. `<canvas className="pdf-annotation-canvas">` (capa de dibujo interactiva, frente, posicionada absolutamente).
  Cuando el modo lápiz está inactivo, la capa tiene `pointer-events: none` permitiendo seleccionar o inspeccionar el contenido subyacente. Cuando está activo, tiene `pointer-events: auto` y `touch-action: none`.
- **Razón:** Garantiza sincronización espacial perfecta 1:1 con la página del PDF sin depender de cálculos de scroll global complejos.
- **Alternativas consideradas:** Un único canvas flotante global sobre todo el visor; descartado por fragilidad al hacer scroll virtual o renderizar múltiples páginas.

### 3. Persistencia desacoplada con guardado por evento (`pointerup`)
- **Decisión:** Durante el arrastre del puntero (`pointermove`), los trazos se acumulan en memoria y se dibujan usando `requestAnimationFrame` con curvas suavizadas. Al completar el trazo (`pointerup`), se actualiza el estado local y se persiste de manera asíncrona en Dexie.
- **Razón:** Elimina la latencia de entrada y evita sobrecargar la base de datos con escrituras en cada frame de dibujo.

## Risks / Trade-offs

- **[Riesgo] Pérdida de fluidez táctil en tablets al dibujar trazos rápidos.**
  - *Mitigación:* Usar coordenadas suavizadas por interpolación cuadrática simple (`quadraticCurveTo`), evitando cálculos pesados de splines, y mantener el buffer de trazo en memoria durante el trazo activo.
- **[Riesgo] Desplazamiento accidental de la página al apoyar la mano (palm rejection).**
  - *Mitigación:* Establecer `touch-action: none` en la capa de anotación activa y filtrar eventos `pointerdown` con `e.isPrimary` o tipo de puntero.
- **[Riesgo] Crecimiento excesivo de datos si se dibujan miles de trazos.**
  - *Mitigación:* Simplificación ligera de puntos colineales muy cercanos (distancia euclidiana mínima de 2px en escala base) antes de almacenar el trazo.
