# Design: Observabilidad y Crash Reporting con Sentry y ErrorBoundary

## Context
Ver `proposal.md`. La aplicación Sindecon es una PWA cliente *Local-First* construida con React 19, Vite y Dexie (IndexedDB), desplegada en Cloudflare Pages y sincronizada opcionalmente con Google Drive AppData.

## Goals / Non-Goals

**Goals:**
- Integrar `@sentry/react` de forma condicional: solo se activa si `VITE_SENTRY_DSN` está presente en las variables de entorno.
- Envolver la aplicación en un `<MedicalErrorBoundary>` amigable que atrape excepciones de React, muestre detalles técnicos limpios y permita reiniciar/recuperar la app con 1 clic.
- Sanitizar de forma estricta los eventos enviados a Sentry (`beforeSend`), bloqueando la transmisión de títulos de notas, contenido de Markdown, tokens de autenticación o datos sensibles.
- Capturar excepciones no atrapadas (`window.onerror`, `unhandledrejection`) y registrar errores de sincronización o IndexedDB.

**Non-Goals:**
- Session replay con grabación visual de pantalla (desactivado para proteger la privacidad clínica y no sobrecargar el bundle).
- Almacenamiento persistente pesado de logs en el backend de Cloudflare.

## Decisions

### 1. Inicialización de Sentry mediante SDK `@sentry/react`
- **Decisión:** Usar `Sentry.init` en `main.tsx` o módulo dedicado `sentry.ts`.
- **Condición:** Si `import.meta.env.VITE_SENTRY_DSN` está vacío, Sentry no se inicializa (permitiendo desarrollo local completamente desconectado sin errores).
- **Alternativas consideradas:**
  - *Cloudflare Workers log endpoint*: Requiere backend adicional y no tiene stack traces con sourcemaps automáticos.
  - *Telegram Bot*: Muy bueno para alertas en tiempo real, pero carece de agrupación de issues, conteo de ocurrencias y desglose por versión/OS.

### 2. Máscara de Privacidad Médica en `beforeSend`
- **Decisión:** Implementar un hook en `beforeSend` que sanitice URLs, elimine query params y bloquee payloads de datos clínicos.
- **Detalle:** Solo se envían: nombre del error, stack trace, componente afectado, navegador, sistema operativo y versión de la app.

### 3. Componente `<MedicalErrorBoundary>`
- **Decisión:** Crear un componente de recuperación ante fallos con diseño consistente (soporte tema claro/oscuro) con botones:
  - 🔄 **Recargar aplicación**: Refresca el estado de la vista manteniendo intacta la base de datos local IndexedDB.
  - 📋 **Copiar código de error**: Permite al usuario reportar el error si lo desea.

## Risks / Trade-offs

- **[Tamaño del bundle]** → El SDK de Sentry añade unos pocos KB al bundle. Se mitiga configurando `@sentry/react` con integraciones mínimas (sin session replay pesado).
- **[Falsos positivos de red offline]** → PWA trabaja frecuentemente offline en hospitales. Los fallos de red tipo `Failed to fetch` durante offline se filtran en `beforeSend` para no consumir la cuota de eventos de Sentry.
