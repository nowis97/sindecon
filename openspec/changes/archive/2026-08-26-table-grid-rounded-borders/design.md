# Diseño Técnico: Cuadrícula y Esquinas Redondeadas en Tablas Médicas

## Context

En SINDECON, las tablas se renderizan en el lector de artículos mediante .reader-table-wrapper y .reader-table. Actualmente solo tienen líneas horizontales inferiores sin división vertical de columnas, y el contenedor exterior requiere garantizar el redondeo sin sangrado de fondos. Ver proposal.md para la motivación.

## Goals / Non-Goals

**Goals:**
- Proporcionar una cuadrícula nítida con bordes grises (order-subtle) en todas las celdas horizontales y verticales (	h y 	d).
- Redondear el contorno exterior mediante .reader-table-wrapper con order-radius: var(--radius-md) y overflow: hidden.
- Mantener compatibilidad total con tema claro y tema oscuro mediante variables de color del design system (--border-subtle, --border-strong, --bg-muted, --bg-card-hover).
- Evitar artefactos visuales de doble borde en las esquinas y los extremos mediante reglas :last-child.

**Non-Goals:**
- No alterar la sintaxis de almacenamiento Markdown GFM.
- No modificar el algoritmo de parseo de tablas en ArticleReader.tsx.

## Decisions

### 1. Modelo de Bordes con order-collapse: separate y order-spacing: 0

- **Decisión:** Usar order-collapse: separate; border-spacing: 0; en .reader-table combinado con overflow: hidden en .reader-table-wrapper.
  *Razón:* En CSS, order-collapse: collapse en ocasiones no respeta el order-radius del elemento contenedor en algunos motores de renderizado web, provocando esquinas cuadradas en la cabecera 	h. Con order-collapse: separate; border-spacing: 0;, las esquinas se recortan perfectamente.

### 2. Cuadrícula de Celdas (Grid Lines)

`css
.reader-table th,
.reader-table td {
  padding: 10px 14px;
  border-right: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.reader-table th:last-child,
.reader-table td:last-child {
  border-right: none;
}

.reader-table tr:last-child td {
  border-bottom: none;
}
`

### 3. Encabezados y Efectos de Fila

- Cabecera destacada con ackground: var(--bg-muted) y borde inferior reforzado con ar(--border-strong).
- Resaltado suave en hover de filas (	body tr:hover { background: var(--bg-card-hover); }) para mejorar la lectura clínica de tablas densas.

## Risks / Trade-offs

- **[Riesgo]** Tablas con scroll horizontal en móviles podrían recortar la sombra exterior.
  → *Mitigación:* Se encapsula el scroll dentro de .reader-table-wrapper con overflow-x: auto manteniendo el borde exterior intacto.
