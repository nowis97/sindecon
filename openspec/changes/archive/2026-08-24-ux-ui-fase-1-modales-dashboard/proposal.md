# Propuesta: UX/UI Fase 1 - Modales Integrados, Dashboard de Bienvenida y Menú Contextual del Árbol

## Why

La versión inicial del Cuaderno Médico Personal utilizaba llamadas nativas del navegador (`window.prompt`, `window.confirm`, `window.alert`) para operaciones fundamentales (creación de carpetas, artículos, plantillas, renombrado, eliminación y reportes de importación). Esto generaba fricción en dispositivos móviles, rompía la estética visual de la PWA y no permitía validaciones estructuradas. Asimismo, el estado vacío (*empty state*) consistía en un simple texto estático sin utilidad para el estudio o la navegación rápida.

## What Changes

- Reemplazar todos los cuadros de diálogo nativos por componentes modales React (`DialogModal.tsx`: `PromptDialog`, `ConfirmDialog`, `AlertDialog`) con foco automático, validación de texto no vacío, confirmación con tecla Enter y cancelación con Escape.
- Implementar un panel de inicio interactivo (*Dashboard*) que actúa como *Empty State* enriquecido cuando no hay ningún nodo seleccionado:
  - Estadísticas clínicas (total de artículos, carpetas, capturas en Inbox con badge de pendientes, y total de tags).
  - Accesos directos a Captura Rápida, Nuevo Artículo y Nueva Carpeta.
  - Accesos rápidos en un click a las 10 plantillas médicas maestras.
  - Lista de artículos recientemente modificados con navegación inmediata.
- Incorporar un menú contextual (`···`) en cada fila del árbol de conocimientos (`TreeView.tsx`) para realizar acciones directas (crear subelementos, renombrar, mover o eliminar).
- Actualizar la barra de portabilidad (`PortabilityBar.tsx`) para presentar reportes de importación en diálogos estructurados.
- Modernizar el sistema visual en `index.css` con estética clínica limpia y responsive.

## Capabilities

### New Capabilities
- `dashboard-shell`: Panel de bienvenida interactivo con métricas clínicas en tiempo real, accesos rápidos de creación y lista de notas recientes.

### Modified Capabilities
- `knowledge-tree`: Integración de menú contextual por fila (`···`) y gestión de operaciones del árbol mediante modales nativos sin `window.prompt`/`confirm`.
- `data-portability`: Reportes estructurados de importación mediante `AlertDialog`.

## Impact
- **Código modificado:** `App.tsx`, `TreeView.tsx`, `PortabilityBar.tsx`, `QuickCapture.tsx`, `index.css`.
- **Código nuevo:** `src/components/common/DialogModal.tsx`, `src/components/dashboard/Dashboard.tsx`.
- **Pruebas:** Actualización de `vital.spec.ts` para validar la interacción con los nuevos modales y el Dashboard.
