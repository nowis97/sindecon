# Diseño: Integración Nativa de Google Calendar en SINDECON (Agenda Clínica Offline-First)

**Fecha:** 2026-11-26  
**Base:** `master` (`v1.4.0`)  
**Rama:** `feat/google-calendar`  
**Enfoque elegido:** Enfoque A — OAuth incremental sobre el BFF existente (`/api/oauth/*`) + ventana deslizante (`singleEvents=true`) + caché y cola offline en `Dexie` v4

---

## 1. Objetivo, Restricciones y Alcance

Permitir que el profesional médico consulte su calendario de Google y cree, edite o elimine turnos, guardias o recordatorios directamente **dentro de SINDECON** con una UI clínica nativa (tema claro + modo oscuro `Guardia UCI`), manteniendo operación fluida offline en `IndexedDB` y costo **$0/mes** en infraestructura.

### Restricciones del Proyecto
- **Stack:** React `^19.2.8`, TypeScript `~6.0.2` (`erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `noUnusedParameters: true`), Tailwind CSS `^4.3.5`, Dexie `^4.4.5`, `dexie-react-hooks` `^4.4.0`, `lucide-react` `^1.72.0`.
- **Sin backend pago / sin webhooks / sin dependencias RFC 5545:** toda la comunicación va directo desde el navegador hacia Google Calendar REST API v3 usando tokens renovados vía los endpoints Cloudflare Pages Functions ya existentes (`/api/oauth/*`). Las recurrencias las expande Google en servidor mediante `singleEvents=true`.
- **Aislamiento de backup médico:** las tablas de Google Calendar viven en `IndexedDB` local (`cuaderno-medico`), pero **NO** se exportan ni mezclan en el `.zip` ni en el snapshot de Google Drive KB ([exportImport.ts](../../../app/src/db/exportImport.ts), [syncEngine.ts](../../../app/src/pwa/syncEngine.ts)).
- **Textos de interfaz y nombres:** español clínico consistente con SINDECON; usar variables CSS existentes `--cl-*` y `--ch-*`.

---

## 2. Arquitectura Modular y Archivos Involucrados

### Backend BFF (`app/functions/api/oauth/`)
- **Modificar** [app/functions/api/oauth/exchange.ts](../../../app/functions/api/oauth/exchange.ts): incluir opcionalmente `scope` en la respuesta JSON cuando Google `oauth2.googleapis.com/token` lo devuelva (si falta, omitir la clave para preservar compatibilidad exacta de pruebas y contratos).
- **Modificar** [app/functions/api/oauth/refresh.ts](../../../app/functions/api/oauth/refresh.ts): incluir opcionalmente `scope` en la respuesta JSON cuando Google devuelva `scope`.

### Capa OAuth Cliente (`app/src/pwa/googleDrive.ts`)
- Mantener la infraestructura compartida de sesión OAuth (cookie HttpOnly `sindecon_gdrive_rt`, mutex single-flight en `ensureValidAccessToken`, fallback `initTokenClient` si no existe BFF), separando la activación de **Google Drive** (`cuaderno-gdrive-enabled`) de la de **Google Calendar** (`sindecon-gcal-enabled`) y registrando scopes concedidos (`sindecon-google-scopes`).

### Persistencia y Dominio Calendar (`app/src/db/`, `app/src/pwa/`)
- **Modificar** [app/src/db/db.ts](../../../app/src/db/db.ts): subir `KbDatabase` a `version(4)` agregando `calendar_list`, `calendar_events` y `calendar_outbox`.
- **Crear** `app/src/db/calendar.ts`: repositorio local Dexie + cola FIFO con coalescencia optimista offline (`enqueueCreateEvent`, `enqueueUpdateEvent`, `enqueueDeleteEvent`, `toggleCalendarSelected`, `clearLocalCalendarData`).
- **Crear** `app/src/pwa/googleCalendar.ts`: cliente HTTP puro Google Calendar API v3 + parseo seguro de fechas (`allDay` YYYY-MM-DD en hora local vs `dateTime` ISO) y rangos horarios.
- **Crear** `app/src/pwa/calendarSync.ts`: motor de sincronización `flushCalendarOutbox` + `pullGoogleCalendarWindow` con ventana móvil (`hoy - 30d` a `hoy + 120d`, expandible al navegar a otros meses online).
- **Crear** `app/src/hooks/useGoogleCalendar.ts`: hook React con `useLiveQuery`, auto-sync al montar, al volver `online`, al volver visible la pestaña (con cooldown), refresco proactivo con `ensureValidAccessToken` y manejo de sesión expirada / falta de permisos.

### Interfaz Clínica (`app/src/components/calendar/` y conexiones)
- **Crear** `app/src/components/calendar/CalendarGuardCard.tsx`: tarjeta compacta **"Agenda / Próximos turnos"** en la columna derecha (`Panel clínico de guardia`) de `Dashboard.tsx`.
- **Crear** `app/src/components/calendar/CalendarModal.tsx`: modal completo sobre `BaseModal` con vistas **`Agenda`**, **`Semana`** y **`Mes`**, filtro multi-calendario, navegación `Hoy / < / >`, estado offline/pending, botón `Sync`, `+ Evento` y ajuste de conexión/desconexión.
- **Crear** `app/src/components/calendar/CalendarEventFormModal.tsx`: modal para ver detalles, crear o editar un evento (título, todo el día / fecha y hora inicio-fin, calendario destino al crear, ubicación, descripción, eliminar con confirmación, abrir en Google Calendar).
- **Modificar** [app/src/components/dashboard/Dashboard.tsx](../../../app/src/components/dashboard/Dashboard.tsx), [app/src/components/tree/FolderExplorerView.tsx](../../../app/src/components/tree/FolderExplorerView.tsx), [app/src/components/common/ClinicalStationHeader.tsx](../../../app/src/components/common/ClinicalStationHeader.tsx), [app/src/App.tsx](../../../app/src/App.tsx), y [app/src/hooks/useAuth.ts](../../../app/src/hooks/useAuth.ts) (o callback en `App.tsx` al restablecer terminal local).

---

## 3. OAuth Incremental y Separación de Capacidades

### 3.1 Constantes y Flags en `app/src/pwa/googleDrive.ts`
- `export const GOOGLE_CALENDAR_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'`
- Nuevas claves en `localStorage`:
  - `GCAL_ENABLED_KEY = 'sindecon-gcal-enabled'`
  - `GOOGLE_SCOPES_KEY = 'sindecon-google-scopes'`
- Nuevas funciones exportadas:
  - `isCalendarSyncEnabled(): boolean`
  - `setCalendarSyncEnabled(enabled: boolean): void`
  - `getStoredScopes(): string[]` / `mergeStoredScopes(scopeStr?: string): void`
  - `hasCalendarScopes(): boolean`: verifica si `getStoredScopes()` contiene ambos scopes `calendar.events` y `calendar.calendarlist.readonly` (o el alias amplio `calendar`).
- Firma compatible hacia atrás en `setStoredToken`:
  ```ts
  export interface StoreTokenOptions {
    enableDrive?: boolean
    enableCalendar?: boolean
    scope?: string
  }

  export function setStoredToken(
    token: string,
    expiresInSeconds = 3600,
    email?: string,
    options?: StoreTokenOptions,
  ): void
  ```
  - Si `options` se omite (todos los callers existentes de Drive), mantiene `enableDrive = true`.
  - Si `options` se pasa, actualiza `GDRIVE_ENABLED_KEY` solo cuando `options.enableDrive === true` (o conserva su valor previo si `undefined`), y actualiza `GCAL_ENABLED_KEY` cuando `options.enableCalendar !== undefined`.
  - Dentro de `ensureValidAccessToken`: al recibir `data` de `/api/oauth/refresh`, llama `setStoredToken(data.access_token, expiresIn, data.email, { enableDrive: isGoogleSyncEnabled(), enableCalendar: isCalendarSyncEnabled(), scope: data.scope })`, evitando encender Drive accidentalmente si el usuario solo conectó Calendar (y manteniendo intactos los casos existentes cuando Drive ya estaba habilitado).
- Firma extendida de `initiateGoogleOAuthFlow`:
  ```ts
  export function initiateGoogleOAuthFlow(callbacks: {
    scopes?: string
    loginHint?: string
    includeGrantedScopes?: boolean
    onSuccess: (token: string, expiresIn: number, email?: string, scope?: string) => void
    onError: (message: string) => void
  }): void
  ```
  - Pasa `scope: callbacks.scopes || GOOGLE_DRIVE_SCOPES`, `include_granted_scopes: callbacks.includeGrantedScopes ?? true` y `login_hint: callbacks.loginHint ?? getStoredEmail() ?? undefined` a `initCodeClient` y a `triggerLegacyTokenFlow`.

### 3.2 Flujo OAuth entre Login, Drive y Calendar
1. **Usuario con Google Login o Google Drive ya conectado:** al tocar `"Conectar Google Calendar"`, GIS abre con `login_hint` = email actual e `include_granted_scopes: true`. El nuevo refresh token reemplazante en `sindecon_gdrive_rt` acumula los scopes anteriores + `calendar.*`.
2. **Usuario nuevo sin Drive:** conectar Calendar guarda `sindecon-gcal-enabled = 'true'`, mantiene `cuaderno-gdrive-enabled` apagado (`false`), y `useGoogleSync` (Drive) **no** se activa ni intenta escribir en `appDataFolder`.
3. **Desconexión:**
   - *"Desconectar Agenda"* desde Calendar: pone `setCalendarSyncEnabled(false)` y ejecuta `clearLocalCalendarData()`. **Solo** llama `clearStoredToken(true)` + `revokeServerOAuthSession()` si `!isGoogleSyncEnabled()` (si Drive sigue activo, mantiene la cookie y el respaldo intactos).
   - Al ejecutar `disconnectGoogle()` desde `GoogleDriveModal` y `!isCalendarSyncEnabled()`, se comporta exactamente igual que hoy (limpia todo y revoca BFF). Si `isCalendarSyncEnabled()` sigue activo cuando desconecta solo Drive, simplemente apaga Drive (`setGoogleSyncEnabled(false)`) o conserva Calendar según el alcance local; además, `resetLocalTerminalSecurity` en pantalla de login limpia también las tablas locales de Calendar + `GCAL_ENABLED_KEY`.

---

## 4. Modelo de Datos Offline (`Dexie v4` en `db.ts` y `db/calendar.ts`)

### 4.1 Tablas en `KbDatabase` (`version(4)`)
```ts
export type CalendarAccessRole = 'owner' | 'writer' | 'reader' | 'freeBusyReader'
export type CalendarSyncStatus = 'synced' | 'pending' | 'error'
export type CalendarEventStatus = 'confirmed' | 'tentative' | 'cancelled'
export type CalendarOutboxOp = 'create' | 'update' | 'delete'

export interface CalendarListRow {
  id: string
  summary: string
  primary: boolean
  backgroundColor: string
  accessRole: CalendarAccessRole
  selected: boolean
  timeZone?: string
}

export interface CalendarEventRow {
  id: string // googleEventId o 'local-<uuid>' antes de sincronizar
  calendarId: string
  summary: string
  description: string
  location: string
  startIso: string // 'YYYY-MM-DD' si allDay=true; RFC3339 si allDay=false
  endIso: string   // 'YYYY-MM-DD' exclusivo si allDay=true; RFC3339 si allDay=false
  startMs: number  // ms local inicio
  endMs: number    // ms local fin (exclusivo para allDay)
  allDay: boolean
  status: CalendarEventStatus
  recurringEventId?: string
  htmlLink?: string
  updatedAt: number
  syncStatus: CalendarSyncStatus
  syncError?: string
}

export interface CalendarEventDraft {
  calendarId: string
  summary: string
  description: string
  location: string
  startIso: string
  endIso: string
  allDay: boolean
  timeZone?: string
}

export interface CalendarOutboxRow {
  id?: number
  op: CalendarOutboxOp
  eventId: string
  calendarId: string
  payload?: CalendarEventDraft
  createdAt: number
  attempts: number
  lastError?: string
}
```
Esquema Dexie v4:
```ts
this.version(4).stores({
  calendar_list: 'id',
  calendar_events: 'id, calendarId, startMs, endMs, [calendarId+startMs]',
  calendar_outbox: '++id, eventId, createdAt',
})
```

### 4.2 Semántica de Fechas y Zonas Horarias (`pwa/googleCalendar.ts`)
- **Eventos de día completo (`allDay: true`):**
  - Google Calendar envía `start.date` (`'YYYY-MM-DD'`) y `end.date` exclusivo (`'YYYY-MM-DD'`, p.ej. 1 día: `start='2026-11-26'`, `end='2026-11-27'`).
  - Se parsea estrictamente como fecha local (`new Date(y, m - 1, d, 0, 0, 0, 0).getTime()`) — nunca `new Date('YYYY-MM-DD')` (que interpreta UTC medianoche y desplaza `-1 día` en UTC-3).
- **Eventos con horario (`allDay: false`):**
  - Al crear/editar desde la UI, se convierte `<input type="datetime-local">` usando `new Date(localStr)` a RFC 3339 (`formatLocalOffsetIso(date)` o `date.toISOString()`) y se adjunta `timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'`.
- **Cálculo de solapamiento para cualquier vista (`Agenda`, `Semana`, `Mes`, `Próximos`):**
  - Un evento pertenece a un rango `[rangeStartMs, rangeEndMs)` si `event.startMs < rangeEndMs && event.endMs > rangeStartMs` y `event.status !== 'cancelled'`. Esto resuelve uniformemente eventos puntuales, guardias de 24h nocturnas que cruzan medianoche y eventos `Todo el día`.

### 4.3 Cola Offline y Coalescencia (`db/calendar.ts`)
Todas las escrituras locales se ejecutan dentro de `db.transaction('rw', db.calendar_events, db.calendar_outbox, ...)`:
1. **`enqueueCreateEvent(draft)`**:
   - Genera `tempId = 'local-' + crypto.randomUUID()`.
   - Inserta `CalendarEventRow` con `syncStatus: 'pending'`.
   - Inserta `{ op: 'create', eventId: tempId, calendarId: draft.calendarId, payload: draft, createdAt: Date.now(), attempts: 0 }` en `calendar_outbox`.
2. **`enqueueUpdateEvent(eventId, draft)`**:
   - Actualiza la fila en `calendar_events` con `syncStatus: 'pending'`, `syncError: undefined`.
   - Si existe en `calendar_outbox` una entrada `op === 'create'` para `eventId`, **fusiona** el nuevo `payload` (y `calendarId`, si cambió antes de sincronizar) directamente dentro de esa entrada `'create'` (coalescencia: al reconectar solo hace un `POST`).
   - Si no, actualiza o inserta una entrada `op === 'update'` para ese `eventId`.
   - Nota: el editor deshabilita el selector de calendario una vez sincronizado con Google (`calendarId` es fijo en `events.patch`, pero editable mientras sea un borrador local `local-*`).
3. **`enqueueDeleteEvent(eventId)`**:
   - Lee la fila en `calendar_events` (o el outbox) para conocer `calendarId`.
   - Si existe `op === 'create'` pendiente para `eventId`: elimina la fila de `calendar_events` y elimina esa entrada de `calendar_outbox` sin generar petición HTTP (net zero).
   - Si no: elimina cualquier `'update'` pendiente para `eventId`, borra el evento de `calendar_events` e inserta `{ op: 'delete', eventId, calendarId, createdAt: Date.now(), attempts: 0 }` en `calendar_outbox`.

---

## 5. Motor de Sincronización (`calendarSync.ts`) y Hook (`useGoogleCalendar.ts`)

### 5.1 Flujo de `syncGoogleCalendar(token, options)`
1. **Fase Push (`flushCalendarOutbox`)**: recorre `calendar_outbox` ordenada por `id` ascendente (FIFO):
   - **`create`**: llama `POST /calendars/{calendarId}/events` con el `payload`. Al recibir el evento real creado (`remote.id`), dentro de una transacción Dexie elimina el registro `local-*`, guarda el `CalendarEventRow` remoto con `syncStatus: 'synced'` y elimina el ítem de `calendar_outbox`.
   - **`update`**: llama `PATCH /calendars/{calendarId}/events/{eventId}` con `payload`. Actualiza el registro local a `syncStatus: 'synced'` y elimina el ítem de outbox. Si Google responde **`404`** o **`410`** (borrado remoto concurrente), elimina el ítem obsoleto de outbox + caché y agrega una nota en `notices: string[]`.
   - **`delete`**: llama `DELETE /calendars/{calendarId}/events/{eventId}`. Tanto `200/204` como **`404`/`410`** se consideran éxito y limpian el ítem de outbox.
   - **Errores abortivos (`401` / `403` scope insuficiente)**: detienen inmediatamente el flush preservando la cola intacta y lanzan error tipado (`CalendarAuthError`) para refrescar token o pedir re-autorización.
   - **Errores transitorios (`5xx` / red)**: incrementan `attempts`, guardan `lastError` en `calendar_outbox`, marcan `calendar_events.syncStatus = 'error'` con `syncError`, y detienen el flush para reintentar más tarde sin desordenar operaciones.
2. **Fase Pull (`pullGoogleCalendarWindow`)**:
   - Ventana por defecto: `[startOfDay(hoy - 30d), endOfDay(hoy + 120d)]` (si el modal navega a un rango fuera de esa ventana estando online, pide expansión para cubrir `[visibleStart - 15d, visibleEnd + 45d]`).
   - Consulta `users/me/calendarList` y sincroniza `calendar_list`, preservando preferencias locales `selected` ya guardadas para IDs conocidos (los calendarios nuevos heredan `remote.selected ?? remote.primary`).
   - Para cada calendario con `selected === true`, consulta `/events?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin=...&timeMax=...` siguiendo `nextPageToken`.
   - Reconcilia dentro de transacción Dexie en el rango `[windowStartMs, windowEndMs]`:
     - Elimina o actualiza **únicamente** eventos del calendario cuyo `syncStatus === 'synced'` que caigan dentro de la ventana y ya no vengan (o hayan pasado a `status === 'cancelled'`).
     - **Nunca** sobrescribe eventos con `syncStatus === 'pending'` o `syncStatus === 'error'` mientras siga habiendo operaciones pendientes en `calendar_outbox`.

### 5.2 Hook `useGoogleCalendar`
Expone al árbol React (vía `App.tsx`):
- **Datos reactivos (`useLiveQuery`):** `calendars: CalendarListRow[]`, `events: CalendarEventRow[]`, `pendingCount: number` (desde `calendar_outbox.count()`).
- **Estado de conexión:** `isEnabled`, `hasRequiredScopes`, `isOnline`, `isSessionExpired`, `needsCalendarConsent` (`403` o scopes faltantes), `syncState: 'idle' | 'syncing' | 'offline' | 'error'`, `lastSyncedAt: Date | null`, `errorMessage: string | null`, `noticeMessage: string | null`.
- **Acciones:**
  - `connectCalendar()`: dispara `initiateGoogleOAuthFlow({ scopes: GOOGLE_CALENDAR_SCOPES, includeGrantedScopes: true, loginHint: resolvedEmail })` -> habilita Calendar -> ejecuta `triggerCalendarSync()`.
  - `disconnectCalendar()`: desactiva Calendar y limpia datos locales (revocando BFF solo si Drive no está conectado).
  - `triggerCalendarSync(rangeOverride?)`: protegida por mutex `syncInFlightRef` + `syncWithAutoRefresh`.
  - `createEvent(draft)`, `updateEvent(eventId, draft)`, `deleteEvent(eventId)`: escriben directo a `db/calendar.ts` (funcionando 100 % offline) y disparan `void triggerCalendarSync()` en segundo plano si `isOnline && !isSessionExpired`.
  - `toggleCalendarVisibility(calendarId, selected)` y `ensureRangeLoaded(rangeStartMs, rangeEndMs)` para navegación por otros meses.

---

## 6. Interfaz Clínica (Light + `Guardia UCI`)

### 6.1 `CalendarGuardCard.tsx` (Panel de Guardia — Columna Derecha en `Dashboard.tsx`)
Se ubica dentro de `<aside aria-label="Panel clínico de guardia">` (después de `Repaso Activo SM-2` y antes de `Modificados recientemente`, manteniéndose compacta):
- **Estado desconectado:** título `Agenda Google`, descripción corta (`"Visualiza tus turnos y recordatorios de Google Calendar offline."`) y botón `Conectar Google Calendar`.
- **Estado conectado:**
  - Cabecera con título `Agenda · Próximos turnos`, badge de estado (`Sin conexión` / `N pendientes` / `Sesión expirada` / `Al día`) y botón de `Sync` (`RefreshCw`) + botón **`+ Evento`**.
  - Lista de los **próximos 4 eventos activos** desde hoy en adelante (filtrados por calendarios `selected = true`): barra lateral con el `backgroundColor` del calendario, hora (`HH:mm` o `Todo el día`), fecha relativa (`Hoy`, `Mañana`, `Vie 28 nov`), título truncado y chip `Pendiente` si `syncStatus === 'pending'` (o `Error sync` si falló).
  - Clic sobre un evento abre `CalendarEventFormModal` en modo edición/detalle; botón al pie **`Ver agenda completa`** abre `CalendarModal`.
  - Si `needsCalendarConsent` o `isSessionExpired`, muestra barra de aviso inline con botón **`Reconectar`** sin ocultar los eventos cacheados en `IndexedDB`.

### 6.2 `CalendarModal.tsx` (Vista Completa sobre `BaseModal`)
- Tamaño amplio (`maxWidthClass="max-w-5xl"`), usando tokens `--cl-*` / `--ch-*` y respetando el tema activo (`data-home-theme={theme}` / `dark`).
- **Barra superior interna:**
  - Selector segmentado de vista: **`Agenda`** | **`Semana`** | **`Mes`** (en pantallas `< 640px`, arranca por defecto en `Agenda` para legibilidad rápida en teléfono de guardia).
  - Navegación temporal: botón **`Hoy`**, `<` / `>`, etiqueta legible del rango actual (p.ej. `"Noviembre 2026"` / `"23 – 29 nov"`).
  - Botón primario **`+ Nuevo evento`**, botón **`Sync`** con spinner y popover/panel colapsable **`Calendarios`** para tildar/destildar qué calendarios mostrar.
  - Acción secundaria discreta **"Desconectar Agenda"** y aviso si está offline o con sesión pausada.
- **Vistas:**
  - **Agenda:** lista cronológica de 14 días desde la fecha ancla agrupada por día (ocultando días vacíos o mostrando mensaje limpio si el período no tiene eventos), con tarjetas clickeables, ubicación y chip `Pendiente de sync`.
  - **Semana:** grilla de 7 columnas (`Lun`–`Dom`) con eventos de todo el día arriba y bloques ordenados cronológicamente por día, haciendo clic en un día vacío para prellenar fecha al pulsar `+` o directamente sobre un evento para editarlo.
  - **Mes:** grilla de 7x5/6 semanas con píldoras de color (hasta 3 por celda + `+N más`) y panel inferior del día seleccionado mostrando sus eventos completos para selección táctil cómoda (`min-h-[44px]`).
- **Acceso desde Header / Dock:**
  - En `ClinicalStationHeader.tsx` (opcional cuando `onOpenCalendar` se pasa desde `App.tsx`) se agrega una píldora compacta **`Agenda`** (con punto indicador si hay pendientes o sesión expirada) para abrir `CalendarModal` tanto desde el Dashboard como desde carpetas o lectura.

### 6.3 `CalendarEventFormModal.tsx` (Crear / Editar / Detalle)
- Campos clínicos accesibles (`CLINICAL_FIELD_CLASS` / `PILL_BTN_*`):
  - **Título** (obligatorio, validado antes de guardar).
  - Toggle **`Todo el día`**: intercambia inputs `date` vs `datetime-local` manteniendo inicio <= fin (validación inline si fin < inicio).
  - **Calendario** (habilitado al crear sobre calendarios donde `accessRole` es `'owner'` o `'writer'`; solo lectura si el evento ya existe o proviene de calendario compartido).
  - **Ubicación** (ej. `"UCI Adultos · Piso 3"`).
  - **Descripción / Notas** (`textarea`).
  - Aviso informativo cuando se edita una instancia de serie recurrente (`recurringEventId` presente: `"Estás editando esta ocurrencia puntual de una serie recurrente"` + enlace externo `"Abrir en Google Calendar"` cuando `htmlLink` existe).
  - Botones: `Guardar` / `Crear evento`, `Eliminar` (con confirmación inline para evitar borrados accidentales en guardia) y `Cancelar`.

---

## 7. Manejo de Errores y Casos Borde

1. **Solo lectura en calendarios suscriptos (`accessRole === 'reader' | 'freeBusyReader'`):** no ofrece guardar cambios sobre calendarios de solo lectura (muestra detalle en modo lectura + enlace a Google Calendar).
2. **Error `403` `insufficientPermissions`:** cambia `needsCalendarConsent = true` para mostrar botón **"Autorizar Calendario"** en lugar de reintentar en bucle.
3. **Eventos locales huérfanos en logout/reset:** `resetLocalTerminalSecurity` (en pantalla de bloqueo) limpia `calendar_list`, `calendar_events`, `calendar_outbox` y flags `sindecon-gcal-*`.
4. **Concurrencia de sync:** mutex `syncInFlightRef` en `useGoogleCalendar` garantiza que nunca corran dos flushes FIFO simultáneos sobre el mismo `local-*` ID (evitando duplicados en Google Calendar).
5. **Compatibilidad con Drive Backup:** `exportImport.ts` y `syncEngine.ts` solo tocan `nodes`, `articles`, `assets`, `flashcards`, `meta`, y `isGoogleSyncEnabled()` controla Drive independientemente de `isCalendarSyncEnabled()`.

---

## 8. Plan de Verificación y Pruebas

1. **BFF Handlers (`app/tests/oauth/handlers.test.ts`):** verificar que `/api/oauth/exchange` y `/api/oauth/refresh` reenvían `scope` si Google lo incluye y mantienen intacta la respuesta anterior si Google no lo incluye.
2. **OAuth Incremental (`app/src/pwa/googleDrive.test.ts`):** probar `setStoredToken` con `{ enableDrive: false, enableCalendar: true, scope }`, `isCalendarSyncEnabled`, `hasCalendarScopes` y `include_granted_scopes: true` sin encender `isGoogleSyncEnabled`.
3. **Parseo y Cliente REST (`app/src/pwa/googleCalendar.test.ts`):** parseo de `allDay` (sin corrimiento UTC-3), eventos nocturnos multi-día, creación/edición/borrado y mapeo de errores HTTP (`401`, `403`, `404`, `410`).
4. **Dexie Outbox y Motor Sync (`app/src/pwa/calendarSync.test.ts` con `fake-indexeddb`):** coalescencia `create->update`, `create->delete`, flush FIFO sustituyendo `local-*` por ID remoto real, preservación de eventos `pending` durante pull remoto, y recuperación limpia ante `404/410` y `5xx`.
5. **Contratos React (`Dashboard.test.ts` / `CalendarModal.test.ts`):** verificar props y render SSR básico de `CalendarGuardCard`, `CalendarModal` (Agenda/Semana/Mes) y `CalendarEventFormModal`.
6. **E2E (`app/e2e/google-calendar.spec.ts`):** flujo completo con Google Identity + Calendar API v3 mockeados: conectar Calendar sin encender Drive -> ver eventos en tarjeta del Panel de Guardia -> abrir modal completo -> cambiar vista Mes/Semana/Agenda -> crear/editar offline (`Pendiente`) -> volver online y verificar sincronización FIFO -> probar en modo claro y `Guardia UCI` oscuro.
7. **Gates obligatorios finales:** `npm test`, `npm run build`, `npm run lint` y `npx playwright test e2e/google-calendar.spec.ts` (en `app/`).
