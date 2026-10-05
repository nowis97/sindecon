## 1. Estilos de Tablas Médicas

- [x] 1.1 Actualizar .reader-table-wrapper en pp/src/index.css con order: 1px solid var(--border-subtle), order-radius: var(--radius-md), overflow: hidden, ackground: var(--bg-card) y sombra sutil.
- [x] 1.2 Configurar .reader-table en pp/src/index.css con order-collapse: separate, order-spacing: 0, celdas 	h y 	d con order-right: 1px solid var(--border-subtle) y order-bottom: 1px solid var(--border-subtle), y exclusión en :last-child.
- [x] 1.3 Configurar estilos de encabezado 	h con ackground: var(--bg-muted), color: var(--text-primary), y efecto hover en filas 	body tr:hover.

## 2. Validación y Pruebas

- [x] 2.1 Ejecutar suite de pruebas automatizadas (
pm test) y verificar que todos los tests pasen sin fallos.
- [x] 2.2 Ejecutar compilación de producción (
pm run build) para verificar bundle PWA limpio.
