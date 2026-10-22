# Proposal

## Why

Actualmente, durante el proceso de sincronización con Google Drive, la aplicación únicamente muestra una etiqueta estática o indeterminada ("Sincronizando…") en el chip de cabecera y en el modal de Drive. En cuadernos médicos con decenas de artículos, fichas y adjuntos clínicos (radiografías, fotos, diagramas), la sincronización puede tardar varios segundos sin que el usuario sepa qué etapa se está ejecutando (comprobación remota, compresión de notas, subida de archivos o actualización de manifiesto) ni qué porcentaje se ha completado. Esto genera incertidumbre sobre si la aplicación está activa o detenida.

Una barra de progreso visual con etapas claras y porcentaje en tiempo real tanto en el modal de Drive como en el chip de la cabecera brinda transparencia, retroalimentación inmediata y confianza durante el respaldo de notas médicas.

## What Changes

- **Motor de Sincronización con Seguimiento de Progreso**: Agregar un contrato de callback (`SyncProgressCallback`) y cálculo de etapas a `performGoogleDriveSync` en `syncEngine.ts`, emitiendo hitos y porcentajes (`checking`, `preparing`, `transferring`, `finalizing`).
- **Estado de Progreso en Hook de Sincronización**: Exponer `syncProgress: { percent: number; stage: string }` en `useGoogleSync` para que cualquier componente de la aplicación pueda consultar el avance.
- **Barra de Progreso en Modal de Google Drive**: Renderizar una barra de progreso animada con porcentaje visible (0% a 100%) y descripción de la fase actual (ej. *"Comprimiendo respaldo local..."*, *"Subiendo a Google Drive..."*) dentro de `GoogleDriveModal.tsx`.
- **Porcentaje Dinámico en Chip de Cabecera**: Actualizar `SyncIndicator.tsx` para mostrar el porcentaje dinámico en el botón de estado (ej. *"🔄 45%"* o *"Sync 45%"*) con indicador visual durante la sincronización activa.
- **Estilos Visuales**: Agregar estilos CSS en `index.css` para la barra de progreso, transición fluida de porcentaje y estados de sincronización.

## Capabilities

### Modified Capabilities

- `data-portability`: Se modifica para requerir retroalimentación visual de progreso (barra de avance, porcentaje y descripción de fase) durante los ciclos de sincronización con Google Drive, tanto dentro del diálogo de gestión como en el indicador de estado de la cabecera.

## Impact

- `app/src/pwa/syncEngine.ts`: Incorporación de tipo `SyncProgress` y ejecución de callbacks en cada fase de subida/descarga/fusión.
- `app/src/hooks/useGoogleSync.ts`: Gestión del estado `syncProgress` y propagación a los componentes consumidores.
- `app/src/components/portability/GoogleDriveModal.tsx`: Visualización de barra de progreso y descripción de etapa.
- `app/src/components/portability/SyncIndicator.tsx`: Indicador de porcentaje dinámico en la barra superior.
- `app/src/index.css`: Clases CSS para `.sync-progress-bar`, animación de carga y tipografía de estado.
