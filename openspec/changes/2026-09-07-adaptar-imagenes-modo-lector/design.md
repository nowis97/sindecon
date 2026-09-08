## Context

En el modo Lector (`ArticleReader.tsx`) las imágenes se renderizan a través del componente `AssetImage.tsx`. El componente actual incluía un modal de ampliación no solicitado y carecía de estilos dedicados en `index.css`, provocando alineación arbitraria a la izquierda, desbordamiento en columnas y potencial partición vertical entre columnas de texto.

## Goals / Non-Goals

**Goals:**
- Centrar horizontalmente todas las imágenes en el modo Lector y en la vista de impresión/PDF.
- Escalar y adaptar de forma óptima cualquier imagen dentro de su columna (`max-width: 100%`, `height: auto`, `object-fit: contain`) tanto en vista de 1 columna como en 2 columnas (`layout-two-columns`) y bloques `:::columns`.
- Prevenir que las imágenes sean partidas entre columnas o páginas mediante `break-inside: avoid; page-break-inside: avoid;`.
- Eliminar de raíz la funcionalidad de zoom (remover estado `isZoomed`, modal, hint de zoom y eventos `onClick`).
- Mantener la imagen limpia sin pie de figura visible (preservando `alt` en el atributo de la etiqueta `img`).

**Non-Goals:**
- Modificar el plugin del editor WYSIWYG (`imageAssetView.ts`), el cual ya gestiona su propia vista previa en modo edición.
- Ofrecer controles de redimensionado manual o edición de imagen.

## Decisions

### 1. Simplificación de `AssetImage.tsx`
- Se reemplaza la estructura previa interactiva por un elemento semántico limpio:
  ```tsx
  <figure className="reader-image-figure">
    <img
      src={blobUrl}
      alt={alt || 'Imagen médica'}
      className="reader-image"
    />
  </figure>
  ```
- Se eliminan por completo el estado `isZoomed`, el manejador `onClick`, el hint `"🔍 Toca para ampliar"` y el modal `image-zoom-modal`.
- El cursor se mantiene como el cursor predeterminado de lectura (`default`), sin dar apariencia de enlace ni botón.

### 2. Reglas CSS en `index.css`
- Definición de estilos universales para el contenedor y la imagen:
  ```css
  .reader-image-figure {
    margin: 18px auto;
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .reader-image {
    display: block;
    max-width: 100%;
    height: auto;
    object-fit: contain;
    margin: 0 auto;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-subtle);
    background: var(--bg-card);
  }
  ```
- Inclusión de `.article-reader-view .reader-image-figure` en el bloque de exclusión de corte de columnas:
  ```css
  .article-reader-view .reader-image-figure {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  ```
- Soporte para vista de impresión / PDF (`.print-reader-view .reader-image-figure`).

## Risks / Trade-offs

- **[Riesgo]** Imágenes muy pequeñas podrían estirarse si se usara `width: 100%`.  
  → **Mitigación**: Se utiliza `max-width: 100%` con `height: auto` y `display: block`, permitiendo que las imágenes pequeñas conserven su resolución nítida y se ubiquen centradas sin pixelarse.
- **[Riesgo]** Imágenes panorámicas muy anchas en dos columnas podrían reducirse excesivamente.  
  → **Mitigación**: `object-fit: contain` y `max-width: 100%` respetan el aspecto nativo, permitiendo al usuario cambiar a 1 columna mediante el selector de barra del lector si requiere mayor amplitud de visualización.
