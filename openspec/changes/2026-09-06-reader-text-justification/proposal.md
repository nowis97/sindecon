## Why

En el modo Lector y en la vista de impresión/exportación PDF de artículos médicos de SINDECON, el texto de los párrafos, listas, notas al pie, citas y callouts actualmente se alinea a la izquierda por defecto. Para profesionales médicos y estudiantes que estudian fichas clínicas densas o artículos formateados en múltiples columnas, la alineación justificada (`text-align: justify`) proporciona una apariencia editorial pulida, homogénea y descansada a la vista (similar a libros de texto médicos y publicaciones académicas).

Asimismo, contar con un control interactivo opcional en la barra de herramientas del lector permite alternar entre alineación justificada y alineación a la izquierda según la preferencia ergonómica del usuario, persistiendo dicha preferencia en `localStorage`.

## What Changes

- **Justificación tipográfica en modo Lector:**
  - Aplicar estilos de texto justificado (`text-align: justify`, `text-justify: inter-word`, `hyphens: auto`) en párrafos (`.reader-paragraph`), citas (`.reader-blockquote`), elementos de lista (`.reader-list li`), callouts clínicos (`.reader-callout-text`) y bloques de columnas en `ArticleReader.tsx` y `index.css`.
- **Control de alternancia de alineación:**
  - Añadir un botón o selector en la barra superior del modo Lector (`reader-toolbar-row`) para alternar entre texto justificado (`↔️ Justificado`) y alineación a la izquierda (`⬅️ Alinear a la izquierda`).
  - Persistir la preferencia de justificación en `localStorage` con la clave `sindecon_reader_text_align` (por defecto activado/justificado).
- **Alineación justificada en Exportación e Impresión PDF:**
  - Garantizar que la maquetación de alta fidelidad para impresión y exportación PDF (`.print-reader-view`) mantenga el texto justificado para fichas médicas limpias.

## Capabilities

### Modified Capabilities
- `content-editing`: Modificar el requisito de "Vista lector" para incluir soporte de alineación justificada y control de alternancia tipográfica.

## Impact

- **Componentes Afectados:**
  - `app/src/components/reader/ArticleReader.tsx` (estado de alineación, botón en toolbar, clases dinámicas y estilos).
  - `app/src/index.css` (reglas tipográficas de justificación, espaciado de palabras y guionado silábico con `hyphens: auto`).
- **Pruebas y Verificación:**
  - Tests unitarios en `app/src/components/reader/ArticleReader.test.ts`.
  - Prueba E2E en Playwright validando el botón de justificación en la barra del lector y la aplicación de estilos de texto.
