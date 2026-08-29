# Diseño Técnico: Interlineado Compacto y Unificación Visual de H1/H2

## Context

En SINDECON, el contenido médico de los artículos se consulta en pantallas de diversos tamaños (guardias en móvil, laptops y monitores clínicos). El interlineado previo (line-height: 1.75) generaba una separación excesiva que aumentaba la necesidad de scroll vertical. Adicionalmente, el encabezado h1 utilizaba mayúsculas forzadas (	ext-transform: uppercase) y un subrayado gris tenue de ancho completo, contrastando con el diseño de h2 caracterizado por su color de acento teal y subrayado ceñido al texto (display: inline-block). Ver proposal.md para la motivación.

## Decisions

### 1. Interlineado Compacto en Lector y Editor
En pp/src/index.css:
- .article-reader-view, .editor-host: line-height: 1.48 (reducción desde 1.75).
- .reader-list: line-height: 1.38 (reducción desde 1.65).
- .reader-paragraph: margin-bottom: 9px (reducción desde 12px).
- Ajustes proporcionales en sangrías y márgenes de listas para mantener una lectura densa pero descansada.

### 2. Estilización de Heading 1 (h1) idéntica a Heading 2 (h2)
En pp/src/index.css:
`css
.reader-heading.h1 {
  color: var(--reader-h2-color);
  font-size: 1.48rem;
  border-bottom: 2px solid var(--reader-h2-color);
  padding-bottom: 4px;
  margin-top: 22px;
  margin-bottom: 8px;
  display: inline-block;
  text-transform: none;
  letter-spacing: -0.01em;
}
`
- **Tamaño comparativo**:
  - h1: 1.48rem (~23.7px)
  - h2: 1.22rem (~19.5px)
  - h3: 1.05rem (~16.8px)
- Se actualizan también las reglas de impresión @media print para mantener coherencia en exportaciones PDF/impresión física.

## Risks / Trade-offs

- **[Trade-off]** Un interlineado excesivamente estrecho (< 1.3) podría dificultar la lectura en bloques de texto muy largos.
  → *Mitigación:* Se establece 1.48 en párrafos y 1.38 en listas, que es el estándar óptimo de legibilidad densa (estilo Notion/Wikipedia).
