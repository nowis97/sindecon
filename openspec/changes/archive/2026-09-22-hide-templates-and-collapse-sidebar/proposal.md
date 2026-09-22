## Why

Actualmente, la barra lateral ocupa un ancho fijo constante de 320px en pantallas de escritorio sin posibilidad de colapsarse, reduciendo el espacio útil para la lectura profunda de artículos médicos complejos, tablas y algoritmos. Además, la carpeta del sistema "Plantillas" permanece fija y visible de forma permanente en la raíz del árbol de conocimientos, generando ruido visual para usuarios que solo crean artículos desde el selector superior de plantillas y prefieren mantener su árbol enfocado exclusivamente en sus temas y especialidades clínicas.

## What Changes

- **Colapsar y expandir barra lateral en escritorio**:
  - Incorporar un botón en la cabecera de la barra lateral (`sidebar-header-desktop`) para colapsarla hacia la izquierda.
  - Añadir un botón flotante/trigger discreto o en la barra superior cuando la barra lateral está colapsada para reabrirla con un solo clic.
  - Permitir alternar el colapso mediante el atajo de teclado `Ctrl+B` (o `Cmd+B` en macOS).
  - Persistir la preferencia de colapso de la barra lateral en `localStorage` para restaurarla entre recargas.
  - Expandir el contenedor principal (`content`) al 100% del ancho cuando la barra lateral está colapsada, con transiciones fluidas.

- **Ocultar/Mostrar la carpeta de plantillas en el árbol**:
  - Incorporar una opción/toggle de visualización (por ejemplo, en la barra de herramientas del árbol o en las opciones del sidebar) para alternar la visibilidad de la carpeta "Plantillas".
  - Persistir el estado de visibilidad en `localStorage` (por defecto visible, con posibilidad de ocultarla con un clic).
  - Cuando esté oculta, filtrar la carpeta "Plantillas" del `TreeView` y de la vista exploradora raíz, garantizando que el selector "+ desde plantilla", el buscador y la creación de notas a partir de plantillas sigan funcionando al 100%.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capacidad -->

### Modified Capabilities
- `knowledge-tree`: Incorporar el filtrado y alternancia de visibilidad de carpetas protegidas del sistema (carpeta "Plantillas") en el árbol de navegación.
- `offline-shell`: Añadir soporte de colapso/expansión de la barra lateral en el shell de escritorio con persistencia local y soporte de atajo de teclado.

## Impact

- `app/src/App.tsx`: Estado y controles para colapsar/expandir la barra lateral en escritorio y visibilidad de plantillas.
- `app/src/components/tree/TreeView.tsx`: Filtrado condicional del nodo de plantillas en la raíz según la preferencia activa.
- `app/src/index.css`: Clases CSS para estado `.sidebar-collapsed`, transición suave del ancho, y botón de reapertura flotante/topbar.
