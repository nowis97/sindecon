## 1. Tokens de Diseño CSS y Superficies Obsidian / Notion

- [x] 1.1 Actualizar las variables globales y tokens en `app/src/index.css` (paletas Obsidian Dark `#0f141c` / Notion Light `#ffffff`, tipografía y bordes sutiles)
- [x] 1.2 Corregir estilos de contraste en modo oscuro para inputs de etiquetas, búsqueda y placeholders

## 2. Sidebar & Árbol de Conocimientos (Obsidian Vault)

- [x] 2.1 Refactorizar `Sidebar.tsx` para simplificar la cabecera del Vault y eliminar botones redundantes (`Renombrar`, `Mover`, `Eliminar`)
- [x] 2.2 Estilizar los elementos del árbol con chevrons modernos, hover suave y footer de Vault para estado de almacenamiento y sync

## 3. Dashboard Principal (Notion Workspace)

- [x] 3.1 Refactorizar `Dashboard.tsx` para implementar un grid simétrico 2x2 de Acciones Rápidas con tarjetas interactivas
- [x] 3.2 Estilizar los chips de plantillas médicas con tags tipo pastilla Notion categorizados por color

## 4. Header de Artículo, Tabs y Navegación Móvil

- [x] 4.1 Refactorizar `ArticleView.tsx` / `ReaderView.tsx` con segmented control moderno `[Lector | Editor | Importar]` y tags pulidos
- [x] 4.2 Refactorizar `BottomNav.tsx` y `TopBar.tsx` con floating glassmorphism dock y eliminación del botón duplicado de tema
- [x] 4.3 Estilizar callouts clínicos médicos y tablas en `app/src/index.css`

## 5. Verificación Visual y Despliegue

- [x] 5.1 Ejecutar suite de pruebas unitarias (`vitest`) y pruebas E2E (`playwright`) para garantizar cero regresiones
- [x] 5.2 Compilar el bundle de producción con `npm run build`
- [x] 5.3 Validar visualmente con `chrome-devtools` en viewport Desktop y Mobile
- [x] 5.4 Subir los cambios a GitHub para despliegue automático en Cloudflare Pages
