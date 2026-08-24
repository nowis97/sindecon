## 1. Dependencias y Configuración

- [x] 1.1 Instalar `@sentry/react` en `app/package.json` y verificar compilación limpia
- [x] 1.2 Agregar `VITE_SENTRY_DSN` a `app/.env` y `app/.env.example`

## 2. Inicialización y Sanitización de Privacidad

- [x] 2.1 Crear módulo `app/src/observability/sentry.ts` con inicialización condicional y filtro `beforeSend` para privacidad médica
- [x] 2.2 Crear pruebas unitarias para la lógica de sanitización médica en `app/src/observability/sentry.test.ts`
- [x] 2.3 Inicializar Sentry en `app/src/main.tsx`

## 3. Error Boundary y Recuperación de Interfaz

- [x] 3.1 Crear componente `MedicalErrorBoundary.tsx` con soporte de tema oscuro/claro y botón de reintento/copiado
- [x] 3.2 Envolver la aplicación en `main.tsx` o `App.tsx` con `MedicalErrorBoundary`
- [x] 3.3 Agregar estilos CSS para la tarjeta de rescate ante errores en `app/src/index.css`

## 4. Verificación y Despliegue

- [x] 4.1 Ejecutar suite completa de pruebas unitarias (`vitest`) y pruebas E2E (`playwright`)
- [x] 4.2 Ejecutar `npm run build` para verificar generación de PWA y bundle sin advertencias
- [x] 4.3 Subir cambios a GitHub para despliegue automático en Cloudflare Pages
