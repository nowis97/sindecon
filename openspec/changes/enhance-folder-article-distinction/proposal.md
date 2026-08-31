## Why

En un cuaderno de notas y conocimiento médico con decenas de especialidades, temas y fichas clínicas, los usuarios necesitan distinguir de forma instantánea e intuitiva si un elemento es una **Carpeta/Especialidad contenedora** o un **Artículo/Ficha de lectura y edición**.

Actualmente, tanto en la barra lateral (TreeView) como en el área principal cuando se selecciona una carpeta, la distinción visual es mínima (mismo fondo, simple emoji 📁 vs 📄 y una tarjeta genérica en el panel central que no muestra el contenido interior). Mejorar esta experiencia con una jerarquía visual clara, tarjetas de carpetas con contador de fichas, tarjetas de artículos con etiquetas y un explorador de carpetas interactivo en el panel principal acelerará la navegación clínica y reducirá la carga cognitiva.

## What Changes

- **Jerarquía Visual Elevada en el Árbol Lateral (TreeView.tsx)**:
  - Estilos visualmente contrastados e inconfundibles entre carpetas y artículos.
  - Las carpetas muestran indicador de expansión interactivo, badge de cantidad de elementos contenidos (ej. 3), peso tipográfico semibold y acento de carpeta.
  - Los artículos muestran icono distintivo de ficha médica, botón de favorito interactivo, sangría con guías conectoras de árbol y resaltado activo de lectura.
- **Vista de Explorador de Carpeta en el Panel Principal (FolderExplorerView)**:
  - Al hacer clic en cualquier carpeta, el área principal muestra un explorador visual completo:
    - Encabezado con título de la carpeta/especialidad, migas de pan y contador de contenidos (X subcarpetas • Y artículos).
    - Barra de acciones rápidas (+ Nuevo Artículo, + Subcarpeta, 🪄 Importar, Renombrar).
    - Cuadrícula de **Subcarpetas**: Tarjetas con diseño de pestaña de carpeta, recuento interno de fichas y navegación al hacer clic.
    - Cuadrícula/Lista de **Artículos Médicos**: Tarjetas de artículos con etiquetas clínicas, estrella de favorito y acceso directo.
    - Estado vacío ilustrado con atajos rápidos si la carpeta aún no tiene elementos.
- **Diferenciación en Migas de Pan (Breadcrumbs.tsx)**:
  - Distinción gráfica entre segmentos de carpetas intermedias (📁) y el artículo activo (📄).

## Capabilities

### Modified Capabilities
- knowledge-tree: Se amplían los requisitos de la vista de carpetas y navegación de árbol para incluir el explorador enriquecido de contenidos de carpetas en el panel principal y la diferenciación semántica/visual entre carpetas y artículos en el árbol y breadcrumbs.

## Impact

- **Componentes modificados**:
  - pp/src/components/tree/TreeView.tsx (estilos y badges de carpetas vs artículos).
  - pp/src/components/tree/Breadcrumbs.tsx (iconografía y semántica).
  - pp/src/App.tsx (integración del explorador de carpetas en el área principal).
  - Nuevo componente: pp/src/components/tree/FolderExplorerView.tsx (vista enriquecida del contenido de la carpeta).
  - pp/src/index.css (estilos de árbol y tarjetas de explorador).
- **APIs y Base de Datos**: Sin cambios en el esquema de IndexedDB (db.nodes se mantiene 100% compatible).
- **Riesgo de regresión**: Cero impacto en la persistencia o sincronización.
