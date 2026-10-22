# Proposal

## Why

Actualmente, `uploadAppDataFile` en `googleDrive.ts` utiliza el protocolo `uploadType=multipart` en una única petición HTTP `fetch`. A medida que el cuaderno clínico crece con adjuntos PDF e imágenes, los respaldos (`cuaderno-backup.zip`) superan varios megabytes y en redes móviles o inestables sufren de dos problemas críticos: (1) cualquier corte transitorio de red aborta toda la subida obligando a reiniciar desde cero, y (2) la barra de progreso se queda congelada en un valor fijo (50% o 60%) durante toda la transferencia porque `fetch` multipart no reporta el progreso por bloques ni bytes transferidos. Implementar el protocolo **Google Drive Resumable Upload (`uploadType=resumable`) por bloques (chunked)** permite reanudar subidas interrumpidas desde el último byte confirmado y actualizar la barra de progreso en tiempo real con los megabytes transferidos.

## What Changes

- **Protocolo de Subida Resumable por Bloques (`uploadType=resumable`)**:
  - Creación de sesión de subida resumable (`POST` o `PATCH` a `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`) que devuelve la URI de sesión en la cabecera `Location`.
  - Envío del archivo binario en fragmentos múltiplos de 256 KB (por defecto bloques de 2 MB = `2 * 1024 * 1024` bytes) mediante peticiones `PUT` con cabecera `Content-Range: bytes <start>-<end>/<total>`, procesando respuestas `308 Resume Incomplete` hasta el `200 OK` / `201 Created` final.
  - Consulta de estado de sesión (`PUT` vacío con `Content-Range: bytes */<total>`) y reanudación automática desde el byte exacto reportado por la cabecera `Range` de Google Drive cuando ocurre un fallo de red transitorio o código `5xx`, con backoff exponencial.
  - Persistencia ligera de la sesión activa en `localStorage` (asociada al nombre del archivo, tamaño y timestamp) para reanudar o limpiar sesiones previas si procede.
- **Progreso Real en Tiempo Real (Bytes / MB transferidos)**:
  - Extensión de `uploadAppDataFile` con un callback `onUploadProgress?: (uploadedBytes: number, totalBytes: number) => void`.
  - Integración en `performGoogleDriveSync` (`syncEngine.ts`) para mapear el avance real de los bloques subidos al rango porcentual de la fase `transferring` (ej. de 35% a 85%) y mostrar en el mensaje de progreso los megabytes transferidos (ej. `"Subiendo a Google Drive (2.0 MB / 6.4 MB)…"`).

## Capabilities

### New Capabilities

<!-- Ninguna capacidad nueva independiente; se amplía `data-portability`. -->

### Modified Capabilities

- `data-portability`: Se añade el requisito de subida resumable por bloques (`uploadType=resumable`) con reanudación automática ante cortes de red y se actualiza el requisito de barra de progreso para reflejar el progreso granular por bloques y megabytes transferidos durante la subida de respaldos a Google Drive.

## Impact

- **`app/src/pwa/googleDrive.ts`**: Implementación de la sesión resumable, envío por fragmentos (`chunkSize` múltiplo de 256 KB), consulta de offset y reintentos automáticos en `uploadAppDataFile` / `uploadAppDataFileResumable`.
- **`app/src/pwa/syncEngine.ts`**: Conexión del callback de progreso de bytes de `uploadAppDataFile` hacia `onProgress` para interpolar suavemente el porcentaje y mostrar MB subidos / totales.
- **`app/src/pwa/syncEngine.test.ts`**: Pruebas unitarias verificando la subida por bloques, manejo de `308 Resume Incomplete`, recuperación ante fallos de red consultando el offset `Range`, y reporte progresivo de MB/porcentaje.
