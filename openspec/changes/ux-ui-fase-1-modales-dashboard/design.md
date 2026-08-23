# Design: UX/UI Fase 1 - Modales Integrados, Dashboard y Menú Contextual

## Arquitectura

### 1. Sistema de Diálogos Modales (`DialogModal.tsx`)
- Componentes: `BaseModal`, `PromptDialog`, `ConfirmDialog`, `AlertDialog`.
- Implementación basada en React portals/overlays con `position: fixed`, `backdrop-filter`, captura de tecla Escape y submit de formulario con Enter.
- Foco automático en el input al abrir el modal mediante `useRef`.

### 2. Panel de Inicio / Dashboard (`Dashboard.tsx`)
- Contenedor de presentación que recibe la lista de `nodes`, `templates` y callbacks de navegación.
- Métricas calculadas en memoria con `useMemo`: conteo de artículos, carpetas, capturas pendientes en la carpeta Inbox (`system === 'inbox'` o `title === 'Inbox'`), y total de etiquetas únicas mediante `useAllTags()`.
- Ordenación cronológica de artículos recientes por `updated_at` descendente.

### 3. Menú Contextual en el Árbol (`TreeView.tsx`)
- Estado de menú activo `activeMenuId: string | null`.
- Cierre global mediante listeners de click en `window` y tecla `Escape`.
- Acciones contextuales por tipo de nodo (carpetas vs artículos).
