## Why

Cuando se despliega una nueva versión en Cloudflare Pages, los navegadores y PWAs instaladas pueden tardar hasta 24 horas o requerir reinicios forzados para detectar los cambios debido a las políticas de caché por defecto y a la falta de un ciclo de sondeo activo en el Service Worker. En una aplicación médica, es vital que las mejoras y correcciones de errores lleguen de forma expedita y sin interrumpir la redacción clínica activa.

## What Changes

- **Control de Caché en Cloudflare Pages (`public/_headers`)**: Reglas explícitas para prohibir caché (`no-cache, no-store, must-revalidate`) en `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` e `index.html`, y caché inmutable a largo plazo para assets versionados (`/assets/*`).
- **Sondeo Proactivo de Service Worker**: Comprobación periódica cada 3 minutos en segundo plano (`setInterval`) y cada vez que el usuario regresa a la pestaña o abre la app (`document.visibilitychange` / `window.onfocus`).
- **Notificación Toast Flotante de Actualización**: Componente/banner flotante discreto ("✨ Nueva versión lista. [Actualizar ahora]") cuando hay un nuevo Service Worker instalado y listo, permitiendo al usuario recargar en 1 clic cuando le sea oportuno sin riesgo de perder cambios en curso.
- **Hook/Controlador de Ciclo de Vida PWA**: Integración con `vite-plugin-pwa` y Workbox para orquestar la detección, actualización y recarga controlada.

## Capabilities

### Modified Capabilities
- `offline-shell`: Añade requisitos para la detección proactiva de actualizaciones del Service Worker (sondeo cada 3 min y en `visibilitychange`), reglas de no-caché en Cloudflare para descriptores de app, y visualización de un Toast flotante no invasivo para aplicar la nueva versión.

## Impact

- `app/vite.config.ts`: Configuración de `vite-plugin-pwa` para integración de actualización proactiva.
- `app/public/_headers`: Nuevo archivo de cabeceras HTTP para Cloudflare Pages.
- `app/src/components/pwa/UpdateToast.tsx`: Nuevo componente Toast de aviso y recarga de versión.
- `app/src/pwa/updateChecker.ts` / `usePWAUpdate.ts`: Lógica de sondeo (3 min + visibility change).
- `app/src/App.tsx`: Montaje del aviso Toast de actualización.
