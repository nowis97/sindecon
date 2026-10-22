# Design

## Context

Actualmente `uploadAppDataFile` en `app/src/pwa/googleDrive.ts` construye un cuerpo `multipart/related` y lo envía en una sola llamada `fetch` a `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`. Ver `proposal.md` para la motivación completa.

La API de Google Drive v3 soporta `uploadType=resumable` para crear (`POST`) o actualizar (`PATCH`) archivos en `appDataFolder`. El protocolo oficial de Google Drive Resumable Upload consta de:
1. **Petición de inicio de sesión**:
   - `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable` (si es archivo nuevo, con `parents: ['appDataFolder']` en el body JSON) o `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=resumable` (si actualiza un archivo existente).
   - Headers:
     - `Authorization: Bearer <token>`
     - `Content-Type: application/json; charset=UTF-8`
     - `X-Upload-Content-Type: <mimeType>`
     - `X-Upload-Content-Length: <totalBytes>`
   - Respuesta `200 OK` con cabecera `Location: <upload_session_uri>`.
2. **Transferencia de bloques (Chunking)**:
   - Tamaño de bloque: múltiplo de 256 KB (`256 * 1024`), excepto el último bloque que puede ser de cualquier tamaño menor. Usaremos `DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024` (2 MB) por defecto, configurable para tests.
   - Por cada bloque `[offset, endExclusive)`:
     - `PUT <upload_session_uri>`
     - Headers:
       - `Content-Length: <chunkSize>`
       - `Content-Range: bytes <offset>-<endExclusive - 1>/<totalBytes>`
     - Body: `blob.slice(offset, endExclusive)`
   - Si la respuesta es `308 Resume Incomplete`:
     - Se lee la cabecera `Range` (ej. `bytes=0-2097151`) si está presente para determinar con exactitud el siguiente `offset = upperBound + 1`; si no está presente, `offset = endExclusive`.
     - Se invoca `onUploadProgress?.(offset, totalBytes)`.
   - Si la respuesta es `200 OK` o `201 Created`:
     - La subida ha finalizado; se invoca `onUploadProgress?.(totalBytes, totalBytes)` y se retorna el JSON `GoogleDriveFile`.
3. **Recuperación ante fallos de red / `5xx`**:
   - Si el `PUT` de un bloque lanza excepción de red o devuelve `500`, `502`, `503`, `504`:
     - Se espera con backoff exponencial (`retryDelayMs * 2^attempt`, máx 3 reintentos por bloque).
     - Se envía una petición de consulta de estado a `<upload_session_uri>`:
       - `PUT <upload_session_uri>` con body vacío y cabecera `Content-Range: bytes */<totalBytes>`.
       - Si responde `308 Resume Incomplete`: se lee la cabecera `Range: bytes=0-<lastByte>` y se ajusta `offset = lastByte + 1` (o `0` si no hay cabecera `Range` porque aún no se recibió ningún byte).
       - Si responde `200 OK` o `201 Created`: el archivo ya se había completado y se retorna el resultado.
       - Si responde `404 Not Found` o `410 Gone`: la sesión expiró, se limpia la sesión cacheada y se reinicia una nueva sesión resumable.

## Goals / Non-Goals

**Goals:**
- Implementar el protocolo `uploadType=resumable` con particionamiento en bloques (`2 MB` por defecto) y soporte de reanudación automática en `app/src/pwa/googleDrive.ts`.
- Soportar un callback `onUploadProgress?: (uploadedBytes: number, totalBytes: number) => void` en `uploadAppDataFile`.
- Conectar el progreso de bytes en `performGoogleDriveSync` (`app/src/pwa/syncEngine.ts`) para interpolar el porcentaje de la fase `transferring` y mostrar los megabytes subidos y totales (`X.X MB / Y.Y MB`).
- Persistir temporalmente la URI de sesión resumable en `localStorage` durante la subida de `cuaderno-backup.zip` (con firma de `name`, `existingFileId`, `size`) y limpiarla al finalizar con éxito, permitiendo reutilizarla si una subida del mismo tamaño se reintenta inmediatamente tras un corte.

**Non-Goals:**
- Modificar el formato interno del archivo `.zip` o `sync-manifest.json`.
- Cambiar la interfaz visual de `GoogleDriveModal` o `SyncIndicator` (ya soportan porcentajes dinámicos de 0 a 100 y textos descriptivos).

## Decisions

### 1. Tamaño de bloque de 2 MB (`2 * 1024 * 1024` bytes)
- **Decisión**: Usar 2 MB como tamaño de fragmento predeterminado (múltiplo exacto de 256 KB requerido por Google Drive API).
- **Racional**: Un bloque de 2 MB ofrece un equilibrio ideal entre sobrecarga de peticiones HTTP y granularidad de progreso / recuperación en conexiones móviles 4G/LTE. Para archivos menores a 2 MB (como `sync-manifest.json` o `ai-config.json`, o respaldos pequeños), el protocolo resumable envía el archivo completo en un único bloque `PUT` tras iniciar la sesión, manteniendo el código unificado y simple.
- **Alternativa descartada**: Mantener dos implementaciones separadas (`multipart` vs `resumable`). Unificar en `uploadType=resumable` elimina la construcción manual de cuerpos MIME `multipart/related` con delimitadores boundary en texto y simplifica el cliente.

### 2. Uso de `fetch` por bloques frente a `XMLHttpRequest`
- **Decisión**: Usar `fetch` enviando `Blob.slice(offset, end)` por cada bloque en lugar de `XMLHttpRequest`.
- **Racional**: Al dividir en bloques con `uploadType=resumable`, `fetch` permite leer el estado HTTP `308 Resume Incomplete` y la cabecera `Range` de cada bloque de forma nativa con `async/await`, funciona de forma idéntica en navegadores y en tests con Vitest, y reporta progreso real al completarse cada bloque (y en el inicio/fin).

### 3. Interpolación del porcentaje y formato de MB en `syncEngine.ts`
- **Decisión**: Crear un helper `formatMegabytes(bytes: number): string` (o KB si es `< 0.1 MB`) y mapear la fracción `uploadedBytes / totalBytes` dentro del intervalo porcentual de la etapa `transferring`:
  - Subida inicial (Caso A): `50%` → `85%`.
  - Subida tras fusión (Caso B con cambios locales): `80%` → `95%`.
  - Subida incremental (Caso C): `40%` → `85%`.
- **Racional**: Garantiza que el porcentaje nunca retroceda ni se quede estancado durante subidas de varios megabytes.

## Risks / Trade-offs

- **[Risk] CORS en cabeceras `Location` y `Range` de Google Drive API** → **Mitigación**: Google Drive v3 API expone `Location` en el inicio de `uploadType=resumable` y `Range` en respuestas `308` para orígenes autorizados con CORS estándar. Además, si la cabecera `Range` no es legible o viene vacía, el cliente usa el `endExclusive` del bloque confirmado como fallback seguro.
- **[Risk] Sesiones resumables huérfanas en `localStorage`** → **Mitigación**: Guardar la sesión con un TTL máximo (ej. 24 horas) y validarla contra el tamaño del blob y `existingFileId`; borrarla siempre al completar o ante `404`/`410`.
