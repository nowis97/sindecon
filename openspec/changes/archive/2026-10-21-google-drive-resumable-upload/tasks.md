# Tasks

## 1. Protocolo de Subida Resumable por Bloques en Google Drive (`googleDrive.ts`)

- [x] 1.1 Implementar la iniciación de sesión resumable (`uploadType=resumable` con `X-Upload-Content-Type` y `X-Upload-Content-Length`) y el cacheo temporal de la URI de sesión (`Location`) en `localStorage`, verificando que compile sin errores con `npx tsc --noEmit`.
- [x] 1.2 Implementar el bucle de subida por bloques (`DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024` bytes) con cabecera `Content-Range`, manejo de respuestas `308 Resume Incomplete` (lectura de cabecera `Range`), consulta de estado (`Content-Range: bytes */<total>`) y reintentos automáticos ante fallos de red o `5xx` en `uploadAppDataFile`, verificando que soporte opciones `onUploadProgress` y `chunkSize`.
- [x] 1.3 Añadir pruebas unitarias para `uploadAppDataFile` (subida multi-bloque con `308`, recuperación tras fallo de red consultando `Range`, invalidación `404`/`410` de sesión expirada y callback `onUploadProgress`) y verificar que pasen con `npm --prefix app test`.

## 2. Integración de Progreso por Bloques y Megabytes en `syncEngine.ts`

- [x] 2.1 Añadir formateo de tamaño transferido (`MB` / `KB`) e interpolación de porcentaje en tiempo real dentro de `performGoogleDriveSync` (`app/src/pwa/syncEngine.ts`) al invocar `uploadAppDataFile` en los flujos de subida inicial, fusión y subida incremental, verificando con `npx tsc --noEmit`.
- [x] 2.2 Actualizar y ampliar `app/src/pwa/syncEngine.test.ts` para verificar que `performGoogleDriveSync` emite eventos de progreso incrementales con el detalle de bytes/MB transferidos durante la subida resumable, ejecutando `npm --prefix app test` y `npm --prefix app run build`.
