# Design: UX/UI Fase 2 - Modo Oscuro, Navegación Móvil y Callouts

## Arquitectura y Componentes

### 1. Hook de Tema (`useTheme.ts`)
- Mantiene estado `theme: 'light' | 'dark'`.
- Detecta `window.matchMedia('(prefers-color-scheme: dark)')` como fallback inicial.
- Guarda cambios en clave `'cuaderno-theme'` de `localStorage`.
- Modifica el atributo `document.documentElement.setAttribute('data-theme', theme)`.

### 2. Barra Inferior Móvil (`MobileBottomBar.tsx`)
- Renderizado condicional en pantallas `< 768px` (`.mobile-bottom-bar`).
- Botón central elevado (*Floating Action Button*) para Captura Rápida a 1 toque.
- Badge numérico en el icono de Inbox para avisar al usuario si existen fotos o notas pendientes de clasificar.

### 3. Parser de Callouts en Markdown (`ArticleReader.tsx`)
- Detección de líneas consecutivas que comienzan con `>` y encabezado `[!TIPO]`.
- Mapeo de tipos:
  - `warning` / `alerta` / `red-flags` / `caution` → Icono 🚨, clase `.callout-warning`
  - `tip` / `perla` → Icono 💡, clase `.callout-tip`
  - `dosis` / `farmaco` → Icono 💊, clase `.callout-dosage`
  - `important` / `diagnostico` / `note` → Icono 📋, clase `.callout-important`
  - Citas normales → `.reader-blockquote`
