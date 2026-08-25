# Tasks

## 1. Cloudflare Pages Caching Headers
- [x] 1.1 Crear `app/public/_headers` con directivas `no-cache, no-store, must-revalidate` para `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` e `index.html`.
- [x] 1.2 Configurar `Cache-Control: public, max-age=31536000, immutable` para `/assets/*` en `app/public/_headers`.

## 2. PWA Update Lifecycle & Polling Hook
- [x] 2.1 Configurar `vite-plugin-pwa` en `app/vite.config.ts` para habilitar el registro programable o recarga asistida.
- [x] 2.2 Crear `app/src/hooks/usePWAUpdate.ts` con sondeo cada 3 minutos y en `document.visibilitychange` / `window.onfocus`.
- [x] 2.3 Manejar el estado `needRefresh`, la función de recarga `updateServiceWorker()` y la escucha de eventos de activación.

## 3. UI Component & Visual Feedback
- [x] 3.1 Crear el componente flotante `app/src/components/pwa/UpdateToast.tsx` con estilos accesibles, botón de actualizar y cerrar.
- [x] 3.2 Añadir estilos CSS correspondientes en `app/src/index.css` con animaciones suaves.
- [x] 3.3 Integrar `UpdateToast` en `app/src/App.tsx`.

## 4. Verification & Testing
- [x] 4.1 Ejecutar suite de pruebas unitarias (`npm test`) y verificar que todos los tests pasen.
- [x] 4.2 Verificar el build de Vite y PWA con `npm run build` y comprobar que `_headers` se copie a `dist/`.
- [x] 4.3 Probar en navegador la respuesta de `visibilitychange` y simulación de actualización.
