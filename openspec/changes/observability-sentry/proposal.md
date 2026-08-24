# Proposal: Observabilidad, Telemetría de Errores y Crash Reporting con Sentry

## Why
En una aplicación médica de uso clínico en tiempo real (*Local-First* / PWA), es vital identificar y resolver de forma proactiva cualquier excepción, fallo de renderizado o error de sincronización antes de que afecte la experiencia del médico. Integrar Sentry permite capturar crashes en producción con stack traces detallados preservando al 100% la privacidad clínica del paciente.

## What Changes
- Instalación e integración del SDK oficial `@sentry/react` en la aplicación Vite/React.
- Configuración de `VITE_SENTRY_DSN` a través de variables de entorno y soporte para inicialización condicional.
- Creación de un componente `<MedicalErrorBoundary>` protector con pantalla amigable de recuperación, botón de reintento y copiado de diagnóstico técnico.
- Implementación de sanitizador estricto en `beforeSend` para filtrar y eliminar cualquier dato sensible (títulos de notas, contenidos clínicos, tokens) antes del envío a la nube.
- Captura estructurada de errores globales no controlados (`unhandledrejection`, fallos de IndexedDB o caídas de sincronización).

## Capabilities

### New Capabilities
- `observability`: Captura y reporte seguro de errores en tiempo de ejecución, métricas de renderizado y pantalla de rescate amigable ante excepciones no controladas.

### Modified Capabilities
- `offline-shell`: Incorporación del ErrorBoundary en la raíz de la aplicación para proteger la interfaz ante fallos inesperados de componentes.

## Impact
- **Dependencias:** Incorporación de `@sentry/react`.
- **Configuración:** Variable de entorno `VITE_SENTRY_DSN` en `app/.env`, `.env.example` y Cloudflare Pages.
- **Componentes:** Inclusión de `MedicalErrorBoundary.tsx` envolviendo la app principal en `App.tsx` / `main.tsx`.
