# Design: Barra de Progreso e Indicador de Avance en la Sincronización

## Context

En la arquitectura actual de SINDECON, el proceso de sincronización con Google Drive se ejecuta a través de la función `performGoogleDriveSync` en `app/src/pwa/syncEngine.ts`. Dicha función realiza varias operaciones asíncronas consecutivas:
1. Comprobación de manifiesto remoto y archivos existentes en Google Drive (`getAppDataFileByName`).
2. Exportación y compresión de la base de datos local IndexedDB a un archivo ZIP (`exportToZip` vía `JSZip`).
3. Descarga del archivo ZIP remoto (`downloadAppDataFile`) si la nube tiene cambios.
4. Fusión de nodos y resolución de conflictos (`importFromZip` vía motor de merge).
5. Subida del archivo ZIP fusionado o actualizado (`uploadAppDataFile`).
6. Actualización del manifiesto de sincronización (`sync-manifest.json`).

El hook `useGoogleSync.ts` únicamente expone el estado booleano/categórico `syncState: 'idle' | 'checking' | 'syncing' | 'offline' | 'error'`. Por ello, los componentes visuales (`GoogleDriveModal.tsx` y `SyncIndicator.tsx`) solo pueden mostrar un texto genérico de "Sincronizando…" sin información sobre el avance porcentual ni la fase actual.

## Goals / Non-Goals

**Goals:**
- Proporcionar un contrato de callback `onProgress` en `performGoogleDriveSync` que reporte el porcentaje estimado (0 a 100) y la etapa de ejecución (`checking`, `preparing`, `transferring`, `finalizing`).
- Integrar el progreso porcentual con la compresión de `JSZip.generateAsync` para reflejar el avance real durante el empaquetado de notas y archivos médicos.
- Exponer el objeto de progreso `{ percent: number; message: string; phase: string }` a través de `useGoogleSync`.
- Renderizar una barra de progreso animada en `GoogleDriveModal.tsx` durante la sincronización activa con barra de llenado, etiqueta de fase y porcentaje numérico.
- Renderizar el porcentaje dinámico en el chip `SyncIndicator.tsx` de la cabecera (ej. *"🔄 45%"*) para que el usuario conozca el avance sin tener el modal abierto.
- Mantener una transición suave al completar el 100% antes de regresar al estado de reposo (*"Al día"*).

**Non-Goals:**
- No alterar el protocolo ni la estrategia de resolución de conflictos Last-Write-Wins (LWW) en `syncEngine.ts`.
- No implementar streaming crudo de bytes por chunks en `fetch` hacia Google Drive (la API REST multipart de Drive no garantiza reporte de progreso de subida nativo y consistente en todos los navegadores móviles; los hitos de etapa y compresión brindan una experiencia más predecible y fluida).

## Decisions

### 1. Estructura de Datos de Progreso (`SyncProgress`)
- **Decisión**: Se define la interfaz en `syncEngine.ts`:
  ```typescript
  export interface SyncProgress {
    phase: 'checking' | 'preparing' | 'transferring' | 'finalizing'
    percent: number // 0 a 100
    message: string
  }
  export type SyncProgressCallback = (progress: SyncProgress) => void
  ```
- **Hitos de calibración**:
  - `checking` (0% - 15%): "Comprobando archivos en Google Drive…"
  - `preparing` (15% - 40%): "Preparando y comprimiendo notas…" (conectado al callback de progreso de `JSZip`).
  - `transferring` (40% - 85%): "Subiendo / Descargando respaldo en Google Drive…"
  - `finalizing` (85% - 99%): "Actualizando manifiesto de sincronización…"
  - `100%`: "Sincronización completada"

### 2. Gestión de Estado en `useGoogleSync`
- **Decisión**: El hook mantendrá un estado `syncProgress: SyncProgress | null`.
  - Al iniciar `triggerSync`, se inicializa en `{ phase: 'checking', percent: 5, message: 'Iniciando sincronización…' }`.
  - Al completarse exitosamente, se emite `{ phase: 'finalizing', percent: 100, message: '¡Sincronización completada!' }`, y tras 600ms se restablece a `null` y `syncState: 'idle'`.
  - En caso de error o desconexión, se restablece inmediatamente a `null`.

### 3. Barra de Progreso en `GoogleDriveModal.tsx`
- **Decisión**: Si `syncState === 'syncing'` y `syncProgress` está presente, se renderiza una tarjeta de progreso visual:
  - Pista de barra (`.sync-progress-track`) con fondo sutil y radio redondeado.
  - Barra de llenado (`.sync-progress-fill`) con gradiente temático, transición fluida (`transition: width 0.25s ease-out`) y brillo de actividad.
  - Fila inferior con el mensaje de etapa a la izquierda y el porcentaje a la derecha (ej. `65%`).

### 4. Indicador en `SyncIndicator.tsx` (Chip de Cabecera)
- **Decisión**: Cuando `syncState === 'syncing'`, el chip muestra:
  - Icono de nube con rotación continua suave.
  - Etiqueta dinámica: `syncProgress ? `Sync ${Math.round(syncProgress.percent)}%` : 'Sincronizando…'`.
  - Título tooltip con el mensaje de etapa actual para que al pasar el cursor o mantener presionado en móvil se vea el detalle.

## Risks / Trade-offs

- **[Sincronizaciones ultrarrápidas cuando el cuaderno ya está al día]** → *Mitigación*: Si la comprobación detecta que no hay cambios, el progreso pasa a 100% de forma rápida y limpia antes de volver a "Al día", evitando parpadeos bruscos.
- **[Interrupción de red a mitad de subida]** → *Mitigación*: La captura de errores en `useGoogleSync` limpia inmediatamente la barra de progreso y muestra la alerta de error con la causa del fallo.
