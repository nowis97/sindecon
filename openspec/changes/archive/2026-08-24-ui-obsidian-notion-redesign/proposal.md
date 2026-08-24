# Proposal: Rediseño Visual y UI/UX Estilo Obsidian & Notion (Web & Mobile)

## Why
El Cuaderno Médico actual cuenta con todas sus funcionalidades core (IndexedDB, Google Drive sync, PWA offline, búsqueda instantánea, importación IA), pero su interfaz visual presenta botones toscos, grids asimétricos, redundancia de controles y bugs de contraste en Dark Mode. Aplicar una estética inspirada en **Obsidian Vault** y **Notion Workspace** transformará la aplicación en una herramienta clínica moderna, minimalista, con alta densidad de información, excelente tipografía editorial y sensación de app nativa en móviles.

## What Changes
- **Paleta de Diseño y Superficies (Obsidian Dark / Notion Light):**
  - Dark Mode: Fondos slate profundos (`#0f141c`), tarjetas elevadas (`#161f2c`), bordes translúcidos ultra-finos (`1px solid rgba(255,255,255,0.07)`) y acentos índigo/púrpura (`#6366f1` / `#818cf8`).
  - Light Mode: Blancos limpios tipo Notion (`#ffffff`), fondos sutiles (`#f8fafc`), bordes definidos y badges color pastel.
  - Corrección de bugs de contraste (input de tags en modo oscuro, inputs de búsqueda en móvil).
- **Sidebar & Árbol de Conocimientos (Obsidian Vault Style):**
  - Encabezado minimalista del Vault con nombre y acciones compactas (`🔍`, `⭐`, `☁️`, `🌙`).
  - Eliminación de botones redundantes de la barra de herramientas (`Renombrar`, `Mover`, `Eliminar`) en favor del menú contextual `...`.
  - Chevrons animados estilizados para expandir/colapsar carpetas con hover highlight suave.
  - Pie de Vault con estado de almacenamiento y sincronización Google Drive.
- **Dashboard Principal (Notion Workspace Style):**
  - Grid de Acciones Rápidas armónico 2x2 en desktop (4x1 en móvil) con micro-interacciones hover y colores clínicos distintivos.
  - Chips de Plantillas Médicas con estilo de pastillas Notion (`badge-pill`) categorizadas.
  - Métricas de resumen con tarjetas pulidas e iconos translúcidos.
- **Vista de Artículo y Lectura (Notion Page & Callouts Médicos):**
  - Segmented control tipo pestaña para alternar `[ 👁️ Lector | ✏️ Editor | 🪄 Importar ]`.
  - Tags tipo pastilla interactivos con soporte completo en Dark/Light mode.
  - Callouts médicos destacados (`[!URGENCIA]`, `[!DOSIS]`, `[!TIP]`, `[!INFO]`) con bordes laterales y tipografía clínica clara (interlineado 1.75).
- **Navegación Móvil (Floating Glassmorphism Dock):**
  - Dock inferior con desenfoque de cristal (`backdrop-filter: blur(16px)`).
  - Eliminación del botón duplicado de tema y reemplazo por accesos rápidos (`[ 📁 Vault ] [ ⭐ Favoritos ] ( ⚡ FAB ) [ 📥 Inbox ] [ ⚙️ Sync ]`).
  - Header móvil optimizado para evitar cortes en inputs o chips.

## Capabilities

### Modified Capabilities
- `offline-shell`: Modernización de tokens CSS globales, layout responsivo, floating bottom dock móvil y header optimizado.
- `knowledge-tree`: Rediseño del árbol estilo Obsidian Vault, eliminación de botones redundantes y simplificación del footer.
- `content-editing`: Segmented tabs tipo Notion, pill tags con soporte de contraste y callouts clínicos editoriales.

## Impact
- **CSS / Estilos:** Actualización completa de variables en `app/src/index.css` (tokens de color, radio de bordes, sombras, transiciones y glassmorphism).
- **Componentes:**
  - Refactor de `Sidebar.tsx` (árbol limpio estilo Obsidian).
  - Refactor de `Dashboard.tsx` (grid 2x2 Notion-like).
  - Refactor de `ArticleView.tsx` / `ReaderView.tsx` (segmented tabs y tags corregidos).
  - Refactor de `BottomNav.tsx` y `TopBar.tsx` (dock móvil elegante).
