## Context

Ver proposal.md para la motivación general del cambio. Actualmente TreeView.tsx renderiza las carpetas y los artículos con estilos similares y cuando se hace clic en una carpeta en App.tsx, se muestra un bloque mínimo sin el listado de contenidos de dicha carpeta.

## Goals / Non-Goals

**Goals:**
- Crear el componente FolderExplorerView.tsx para mostrar de manera visual y estructurada el contenido de cualquier carpeta (subcarpetas y artículos médicos).
- Presentar tarjetas de subcarpetas con diseño de carpeta y recuento interno de fichas.
- Presentar tarjetas de artículos con vista previa de etiquetas, indicador de favoritos y apertura rápida.
- Mejorar el diseño del árbol lateral TreeView.tsx agregando clases y estilos diferenciados para filas de carpetas (.tree-folder-row) y artículos (.tree-article-row), incluyendo chips contadores en carpetas.
- Mantener compatibilidad absoluta con Drag and Drop, menú contextual y navegación táctil en móviles.

**Non-Goals:**
- No se modifica la estructura de la base de datos IndexedDB ni la persistencia de nodos.
- No se alteran los motores de búsqueda, importación o exportación portable zip.

## Decisions

1. **Componente Modular FolderExplorerView**:
   - Se creará pp/src/components/tree/FolderExplorerView.tsx como componente especializado.
   - *Alternativa descartada*: Mantener JSX inline en App.tsx (aumentaba la complejidad de App.tsx y dificultaba los tests unitarios).

2. **Cálculo de Hijos en Memoria**:
   - Se utilizará la función utilitaria existente childrenOf(nodes, folderId) para filtrar subcarpetas y artículos directos sin realizar consultas asíncronas pesadas.

3. **Jerarquía Visual y Accesibilidad en TreeView**:
   - Clases explícitas .tree-folder-row y .tree-article-row.
   - Chevron giratorio con animación CSS para carpetas (.tree-folder-chevron).
   - Badge contador con clase .tree-folder-count-badge.
   - Botón de estrella accesible en artículos .tree-article-fav-btn.

## Risks / Trade-offs

- **[Riesgo: Carpetas muy pobladas con decenas de artículos]** → *Mitigación*: La vista de explorador organiza el contenido en dos secciones claramente delimitadas (Subcarpetas en cuadrícula compacta y Artículos en lista/cuadrícula responsiva) con scroll fluido.
- **[Riesgo: Espacio limitado en móvil]** → *Mitigación*: Reglas @media (max-width: 640px) para transformar las cuadrículas a 1 columna y optimizar el tamaño de los elementos táctiles.
