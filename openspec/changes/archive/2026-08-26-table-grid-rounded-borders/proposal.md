# Propuesta: Bordes Grises y Esquinas Exteriores Redondeadas en Tablas Médicas

## Why

Las tablas clínicas (esquemas de dosificación de fármacos, estadificación TNM, diagnósticos diferenciales y criterios de gravedad) requieren una cuadrícula nítida con líneas divisorias grises tanto horizontales como verticales para facilitar la lectura columna a columna. Asimismo, el contenedor exterior debe lucir un acabado pulido con esquinas redondeadas (order-radius) y recorte de desbordamiento (overflow: hidden) coherente con la estética moderna de Notion y Obsidian.

## What Changes

- **Bordes Exteriores Redondeados y Recorte**: El contenedor envolvente de tablas (.reader-table-wrapper) incorpora order-radius: var(--radius-md) y overflow: hidden con un borde exterior gris sutil (order: 1px solid var(--border-subtle) / ar(--border-strong)).
- **Cuadrícula Completa de Celdas (Grid Lines Grises)**: Las celdas de encabezado (	h) y datos (	d) cuentan con bordes divisorios grises (order: 1px solid var(--border-subtle)) garantizando una matriz clara tanto horizontal como verticalmente.
- **Jerarquía y Contraste de Encabezados**: Las celdas de encabezado (	h) mantienen un fondo distintivo (ar(--bg-muted)), tipografía destacada y borde inferior reforzado.
- **Modo Claro y Oscuro**: Los colores de los bordes se adaptan automáticamente a las variables del tema (--border-subtle y --border-strong).

## Capabilities

### Modified Capabilities
- content-editing: Actualizar la especificación de tablas en el sistema de lectura y edición para requerir cuadrícula completa de bordes grises y contorno exterior redondeado.

## Impact

- **CSS**: pp/src/index.css en las clases .reader-table-wrapper, .reader-table, 	h y 	d.
- **Componentes**: ArticleReader.tsx y vista de tablas del editor.
