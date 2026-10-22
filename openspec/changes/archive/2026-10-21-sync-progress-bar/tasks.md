# Tasks

## 1. Motor de Progreso de Sincronización en syncEngine.ts y useGoogleSync.ts

- [x] 1.1 Definir los tipos `SyncProgress` y `SyncProgressCallback` en `app/src/pwa/syncEngine.ts` y aceptar el callback opcional en `performGoogleDriveSync`.
- [x] 1.2 Emitir hitos de progreso con fases (`checking`, `preparing`, `transferring`, `finalizing`) y porcentajes calibrados (0% a 100%) durante la comprobación remota, compresión ZIP, descarga, fusión y subida.
- [x] 1.3 Integrar el estado `syncProgress` en `app/src/hooks/useGoogleSync.ts`, inicializándolo al arrancar `triggerSync`, actualizándolo en los callbacks y limpiándolo de forma fluida al pasar a `idle` o `error`.

## 2. Componentes de Interfaz de Usuario y Estilos

- [x] 2.1 Implementar la barra de progreso en `app/src/components/portability/GoogleDriveModal.tsx` con pista, barra de relleno animada, descripción de etapa y porcentaje numérico cuando `syncState === 'syncing'`.
- [x] 2.2 Actualizar `app/src/components/portability/SyncIndicator.tsx` para aceptar `syncProgress` opcional y renderizar el porcentaje dinámico (ej. *"🔄 45%"*) y título de etapa en el chip de la cabecera.
- [x] 2.3 Propagar la propiedad `syncProgress` desde `App.tsx` hacia `<SyncIndicator />` y `<GoogleDriveModal />`.
- [x] 2.4 Agregar estilos CSS en `app/src/index.css` para `.sync-progress-container`, `.sync-progress-track`, `.sync-progress-fill` y la animación visual de sincronización en el chip.

## 3. Pruebas y Verificación

- [x] 3.1 Agregar tests unitarios en `app/src/pwa/syncEngine.test.ts` que comprueben la emisión secuencial de callbacks de progreso con fases y porcentajes ascendentes.
- [x] 3.2 Ejecutar `npm --prefix app test` y `npm --prefix app run build` verificando que la suite completa pase y la compilación de producción se complete sin errores.
