## Why

En el modo Lector y en la vista de exportación a PDF de SINDECON, las imágenes clínicas actualmente carecen de estilos CSS dedicados que garanticen su centrado y contención proporcional. Como consecuencia, imágenes médicas de alta resolución (como radiografías o tomografías) se muestran alineadas a la izquierda y desbordan el ancho disponible, especialmente al activar la maquetación a 2 columnas (`layout-two-columns`) o dentro de bloques multicolumna (`:::columns`). Además, el componente `AssetImage` incluye de forma predeterminada un botón interactivo de ampliación ("🔍 Toca para ampliar") y un modal de zoom que distraen de la lectura y rompen la estética editorial limpia de un libro o ficha médica.

## What Changes

- **Centrado y adaptación fluida de imágenes en modo Lector:**
  - Envolver la imagen médica en un contenedor centrado (`.reader-image-figure`) con `margin: 18px auto`, `display: flex; justify-content: center; align-items: center;`.
  - Aplicar `max-width: 100%; height: auto; object-fit: contain;` para que la imagen escale y se contenga automáticamente dentro de una sola columna o en la mitad de la página en la vista de 2 columnas.
  - Asegurar la propiedad `break-inside: avoid; page-break-inside: avoid;` para prevenir que una imagen sea cortada verticalmente entre columnas o páginas.
- **Eliminación de la opción de ampliación (Zoom Modal):**
  - Remover el estado `isZoomed`, los manejadores de eventos `onClick`, el cursor de mano y la etiqueta `"🔍 Toca para ampliar"`.
  - Remover el modal flotante `.image-zoom-modal` y su botón de cierre.
  - Presentar la imagen limpia, sin pie de figura visible (preservando el atributo HTML `alt` para accesibilidad).
- **Consistencia en Exportación e Impresión PDF:**
  - Extender las mismas reglas de centrado, contención y anti-corte a la vista de impresión `.print-reader-view`.

## Capabilities

### Modified Capabilities
- `content-editing`: Modificar el requisito "Vista lector" para especificar el centrado, auto-ajuste en columnas y renderizado estático sin controles de zoom intrusivos de imágenes médicas.

## Impact

- **Componentes Afectados:**
  - `app/src/components/reader/AssetImage.tsx` (simplificación del componente, eliminación de estado de zoom y modal).
  - `app/src/index.css` (adición de reglas `.reader-image-figure`, `.reader-image` y `break-inside: avoid`).
- **Pruebas y Verificación:**
  - Tests unitarios en `app/src/components/reader/ArticleReader.test.ts`.
  - Prueba E2E en Playwright validando la contención de imagen en 2 columnas y ausencia de pistas o modales de zoom.
