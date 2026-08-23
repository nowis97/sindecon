# Design: UX/UI Fase 3 - Command Palette, Favoritos y Filtro de Etiquetas

## Arquitectura y Componentes

### 1. Command Palette (`CommandPalette.tsx`)
- Listener global para atajos de teclado: `keydown` capturando `(e.metaKey || e.ctrlKey) && e.key === 'k'`.
- Modal flotante con input de texto enfocado automáticamente, búsqueda con debounce o reactiva en memoria sobre nodos de tipo `article` y `actions`.
- Navegación con teclado: índice activo `selectedIndex`, tecla `ArrowDown`, `ArrowUp`, `Enter` para ejecutar, `Escape` para cerrar.
- Acciones rápidas predefinidas:
  - 📝 "Nuevo Artículo" → Lanza prompt de nuevo artículo.
  - 📁 "Nueva Carpeta" → Lanza prompt de nueva carpeta.
  - ⚡ "Captura Rápida" → Abre modal de captura a Inbox.
  - 🌓 "Alternar Modo Oscuro/Claro" → Ejecuta `toggleTheme()`.
  - 🏠 "Ir al Inicio / Dashboard" → Deselecciona nodo activo.
  - 📥 "Ir a Bandeja Inbox" → Selecciona la carpeta Inbox.

### 2. Gestión de Favoritos (`useFavorites.ts`)
- Almacenamiento de un array de IDs de nodos favoritos `favoriteIds: string[]` en `localStorage` (`cuaderno-favorites`).
- Funciones `isFavorite(id)`, `toggleFavorite(id)`.
- Integración en:
  - Cabecera del artículo: botón de estrella ⭐/☆.
  - Menú contextual del árbol (`TreeView.tsx`): opción "⭐ Anclar a Favoritos" / "Desanclar".
  - Sección en el árbol: Renderiza bloque colapsable "⭐ Favoritos" antes de la raíz de carpetas cuando hay al menos 1 favorito.

### 3. Filtro Interactivo de Etiquetas (`TagFilterBar.tsx` / `Dashboard.tsx`)
- Al seleccionar una etiqueta (ej. desde el Dashboard o al hacer click en un tag chip), se activa una vista de resultados filtrados que lista todos los artículos que contienen ese tag.
- Posibilidad de limpiar el filtro para volver a la vista normal.
