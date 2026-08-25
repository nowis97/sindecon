## Context

La aplicación Cuaderno Médico (SINDECON) opera como una PWA offline-first distribuida en Cloudflare Pages. Utiliza `vite-plugin-pwa` con Workbox (`generateSW`). Actualmente, cuando se publica un nuevo commit en Cloudflare, los clientes abiertos no detectan la actualización de inmediato porque:
1. No existe sondeo recurrente ni al re-enfocar la pestaña.
2. No hay reglas HTTP explícitas en Cloudflare (`_headers`) para invalidar la caché de `/sw.js` e `index.html`.
3. No hay un componente visual (Toast) que alerte al usuario de que una nueva versión está lista para ser aplicada.

## Goals / Non-Goals

**Goals**:
- Invalidar la caché HTTP en Cloudflare Pages para `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` e `index.html`.
- Ejecutar `registration.update()` automáticamente cada 3 minutos y cada vez que el documento pase a `document.visibilityState === 'visible'`.
- Mostrar un Toast flotante discreto (`UpdateToast`) con botón `Actualizar ahora (🔄)` y botón de posponer/cerrar (`✕`).
- Permitir la recarga controlada en 1 clic aplicando `skipWaiting()` y `window.location.reload()`.

**Non-Goals**:
- No forzar recargas automáticas destructivas que puedan interrumpir la redacción de notas médicas en curso.
- No depender de websockets ni servidores dedicados de backend; el sondeo es 100% estático contra Cloudflare Pages.

## Decisions

1. **Cloudflare `public/_headers`**:
   Cloudflare Pages lee de forma nativa el archivo `public/_headers`. Añadiremos:
   ```ini
   /sw.js
     Cache-Control: no-cache, no-store, must-revalidate
   /registerSW.js
     Cache-Control: no-cache, no-store, must-revalidate
   /manifest.webmanifest
     Cache-Control: no-cache, no-store, must-revalidate
   /index.html
     Cache-Control: no-cache, no-store, must-revalidate

   /assets/*
     Cache-Control: public, max-age=31536000, immutable
   ```

2. **Sondeo Activo mediante Hook `usePWAUpdate`**:
   - Se crea `src/hooks/usePWAUpdate.ts` utilizando la API de registro de Service Worker (`virtual:pwa-register` o `navigator.serviceWorker`).
   - Escucha eventos:
     - `visibilitychange`: cuando `document.visibilityState === 'visible'`, ejecuta `registration.update()`.
     - `focus`: cuando la ventana recupera el foco.
     - `setInterval`: cada 3 minutos (180,000 ms).
   - Mantiene el estado `needRefresh: boolean` y la función `updateServiceWorker(reloadPage?: boolean)`.

3. **Componente `UpdateToast`**:
   - Renderiza un banner flotante con animación sutil en la esquina inferior/superior.
   - Botón principal: `Actualizar ahora` (llama a `updateServiceWorker(true)`).
   - Botón secundario: `✕` (cierra el toast temporalmente hasta el siguiente ciclo).

## Risk Assessment

- **Riesgo**: Consumo excesivo de batería o datos en móviles por sondeo continuo.
  - **Mitigación**: 3 minutos es un intervalo muy ligero (sólo comprueba el header ETag/304 de `/sw.js` de ~1KB). Si la pestaña está oculta o en segundo plano prolongado, `setInterval` se modula por el navegador, y al volver se dispara `visibilitychange`.
- **Riesgo**: Recarga durante la escritura de una nota.
  - **Mitigación**: Al usar un Toast flotante manual, el usuario decide el momento exacto en que desea recargar.
