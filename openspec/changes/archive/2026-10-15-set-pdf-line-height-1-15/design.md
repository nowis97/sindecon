# Design: Ajuste de Interlineado a 1.15 en Párrafos Impresos

## Context

En [`app/src/index.css`](file:///c:/Users/NOWIS/Documents/sindecon/app/src/index.css#L4642-L5115), las reglas de impresión `@media print` establecen:
- `.print-layout-single .print-reader-view`: `line-height: 1 !important;`
- `.print-layout-two-columns .print-reader-view`: `line-height: 1 !important;`
- `.reader-paragraph`: `line-height: 1 !important;`

Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Actualizar el interlineado de los párrafos (`.reader-paragraph`) en `@media print` a `1.15` (`line-height: 1.15 !important;`).
- Actualizar los contenedores de maquetación de 1 y 2 columnas (`.print-layout-single`, `.print-layout-two-columns`) a `line-height: 1.15 !important;` para que todo el texto herede un ritmo vertical uniforme y legible.
- Mantener las propiedades ya configuradas de tamaño base (`9pt`), texto justificado (`text-align: justify`), guionado automático (`hyphens: auto`) y márgenes `@page` (`7mm 9mm`).

**Non-Goals:**
- No alterar la vista de lectura o edición en pantalla.
- No modificar el interlineado de títulos (`H1`, `H2`, `H3`) ni cabeceras.

## Decisions

### Decisión 1: Interlineado unitless `1.15`
- Aplicar `line-height: 1.15 !important;` en `.reader-paragraph`, `.print-layout-single .print-reader-view` y `.print-layout-two-columns .print-reader-view`.
- *Rationale*: Un valor de 1.15 es el punto óptimo recomendado en tipografía editorial compacta, evitando el contacto entre líneas contiguas en textos médicos sin consumir páginas adicionales innecesarias.

### Decisión 2: Pipeline de finalización post-implementación
- Tras aplicar y verificar las reglas en `app/src/index.css`:
  1. Ejecutar tests (`vitest`) y linter (`oxlint`).
  2. Incrementar versión a `v0.16.7` en `app/package.json`.
  3. Sincronizar especificación en `openspec/specs/data-portability/spec.md`.
  4. Archivar el cambio en OpenSpec.
  5. Crear commit y realizar push a `origin/master`.

## Risks / Trade-offs

- **[Riesgo]**: Un interlineado de 1.15 aumenta ligeramente la altura vertical respecto a 1.0.
  → **Mitigación**: El texto base permanece en 9pt, el margen inferior de párrafos en 4pt y los márgenes de página en 7mm 9mm, por lo que la ganancia de legibilidad compensa con creces el mínimo aumento de espacio.
