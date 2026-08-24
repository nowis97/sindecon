# Design: Rediseño Visual y UI/UX Estilo Obsidian & Notion

## Context
Ver `proposal.md` y `specs/`. Sindecon es una PWA cliente *Local-First* con base de datos Dexie (IndexedDB), búsqueda local en memoria, sincronización con Google Drive y visor/editor Markdown médico.

## Goals / Non-Goals

**Goals:**
- Implementar un sistema de diseño coherente basado en tokens CSS para los temas **Obsidian Dark** y **Notion Light**.
- Rediseñar la barra lateral como un **Obsidian Vault Tree** limpio, sin botones redundantes deshabilitados.
- Rediseñar el **Dashboard** con un grid simétrico 2x2 Notion-like para acciones rápidas y chips de plantillas con colores funcionales.
- Transformar la barra de herramientas del artículo en un **Segmented Tab Control** y corregir el contraste de etiquetas y formularios en modo oscuro.
- Mejorar el **Mobile Dock** con efecto Glassmorphism (`backdrop-filter: blur(16px)`), botón FAB central con resplandor suave y accesos limpios.
- Mantener compatibilidad total con todas las suites de pruebas unitarias (Vitest) y E2E (Playwright).

**Non-Goals:**
- Modificar el esquema de base de datos o el motor de sincronización.
- Introducir librerías pesadas de componentes CSS (usar CSS nativo y CSS variables para máxima velocidad y cero bloat).

## Decisions

### 1. Variables de Diseño y Tokens CSS
- **Decisión:** Definir tokens centralizados en `app/src/index.css`:
  - `--bg-vault`: `#0f141c` (Dark) / `#ffffff` (Light)
  - `--bg-card`: `#161f2c` (Dark) / `#ffffff` (Light)
  - `--border-subtle`: `rgba(255, 255, 255, 0.08)` (Dark) / `#e2e8f0` (Light)
  - `--accent-primary`: `#6366f1` (Índigo Obsidian)
  - `--accent-gradient`: `linear-gradient(135deg, #6366f1 0%, #4338ca 100%)`

### 2. Segmented Control en Article Header
- **Decisión:** Sustituir los botones planos por un contenedor `pill-tabs` con estado activo iluminado y radio redondeado (`rounded-lg`).

### 3. Glassmorphism en Mobile Dock
- **Decisión:** La barra inferior móvil usará `background: rgba(15, 20, 28, 0.85)` con `backdrop-filter: blur(16px)` y soporte para Safe Area Inset de iOS (`env(safe-area-inset-bottom)`).

## Risks / Trade-offs

- **[Compatibilidad de backdrop-filter]** → Soportado en el 98%+ de navegadores modernos. Se incluye fallback con fondo opaco sólido para navegadores legacy.
- **[Selectores de Tests E2E]** → Asegurar que los `aria-label`, `role` y textos de botones en Playwright sigan coincidiendo para que las 14 pruebas E2E pasen sin fricción.
