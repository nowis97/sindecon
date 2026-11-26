# Google Calendar Native Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar visualización y edición/creación nativa de Google Calendar dentro de SINDECON (`Panel clínico de guardia` + modal `Agenda / Semana / Mes` + formulario de eventos) con caché en `IndexedDB` (`Dexie v4`), cola offline FIFO con coalescencia y autorización OAuth incremental sobre `/api/oauth/*`.

**Architecture:** Reutiliza la infraestructura BFF existente (`/api/oauth/exchange`, `/api/oauth/refresh`) añadiendo reenvío opcional de `scope` para habilitar autorizaciones incrementales (`include_granted_scopes: true`) sin acoplar Drive Backup con Calendar. Todo el estado visible proviene de tres tablas Dexie nuevas (`calendar_list`, `calendar_events`, `calendar_outbox`) servidas vía `useLiveQuery`, mientras un motor separado (`calendarSync.ts`) vacía mutaciones locales FIFO antes de sincronizar eventos expandidos (`singleEvents=true`) en una ventana móvil `[−30d, +120d]`.

**Tech Stack:** React `^19.2.8`, TypeScript `~6.0.2`, Tailwind CSS `^4.3.5`, Dexie `^4.4.5` + `dexie-react-hooks`, `lucide-react`, Vitest `^4.1.11` (`environment: 'node'` + `fake-indexeddb/auto`), Playwright `^1.62.1`, oxlint `^1.75.0`.

**Spec:** [docs/superpowers/specs/2026-11-26-google-calendar-design.md](../specs/2026-11-26-google-calendar-design.md)

## Global Constraints

- **Strict TypeScript (`tsconfig.app.json` & `tsconfig.functions.json`):** `erasableSyntaxOnly: true` (prohibido usar `enum` o parameter properties en clases), `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`.
- **Zero paid backend / Zero RRULE parser deps:** no agregar dependencias externas nuevas en `package.json`; usar `singleEvents=true` en Google Calendar REST API v3.
- **Data isolation:** NO modificar `app/src/db/exportImport.ts` ni `getLocalMaxTimestamp()` en `app/src/pwa/syncEngine.ts`; el respaldo médico `.zip`/Drive queda intacto y separado de Calendar.
- **Theme compatibility:** toda la UI nueva usa variables `--cl-*` y `--ch-*` más `BaseModal`, `PILL_BTN_*`, `CLINICAL_FIELD_CLASS` para funcionar igual en tema claro y `Guardia UCI` oscuro.
- **Timezone safety for all-day events:** las fechas `YYYY-MM-DD` de eventos `allDay: true` nunca se parsean con `new Date('YYYY-MM-DD')` (UTC); siempre se construyen en hora local para evitar corrimiento `-1 día` en `UTC-3`.
- **Vitest environment:** `vite.config.ts` usa `environment: 'node'` sin DOM ni Testing Library; usar `fake-indexeddb/auto` para tests de Dexie y `react-dom/server` (`renderToStaticMarkup`) para contratos JSX, dejando interacciones DOM completas para `app/e2e/google-calendar.spec.ts`.

---

### Task 1: BFF Scope Forwarding (`/api/oauth/exchange` & `/api/oauth/refresh`)

**Files:**
- Modify: `app/functions/api/oauth/exchange.ts`
- Modify: `app/functions/api/oauth/refresh.ts:13-106`
- Test: `app/tests/oauth/handlers.test.ts`

**Interfaces:**
- Consumes: `GoogleTokenResponse` / `GoogleRefreshResponse` returned by `https://oauth2.googleapis.com/token`.
- Produces: JSON payload from `POST /api/oauth/exchange` and `POST /api/oauth/refresh` carrying optional `scope?: string` when Google returns a non-empty `scope` field (omitted otherwise so existing callers remain identical).

- [ ] **Step 1: Write failing tests in `app/tests/oauth/handlers.test.ts`**

Inspect the end of the `POST /api/oauth/exchange` and `POST /api/oauth/refresh` describe blocks in `app/tests/oauth/handlers.test.ts` and add two unit tests (using existing `TEST_ENV`, `fetchMock`, and `encryptCookiePayload`):

```ts
    it('reenvía scope opcional en POST /api/oauth/exchange solo cuando Google lo incluye', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.cal-scope',
            expires_in: 3600,
            refresh_token: '1//0g-cal-rt',
            id_token: makeFakeJwt({ email: 'doc@hospital.cl' }),
            scope: 'openid email https://www.googleapis.com/auth/calendar.events',
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/exchange', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code-cal' }),
      })

      const res = await exchangeOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.cal-scope',
        expires_in: 3600,
        email: 'doc@hospital.cl',
        persistent: true,
        scope: 'openid email https://www.googleapis.com/auth/calendar.events',
      })
    })
```

And inside `describe('POST /api/oauth/refresh', ...)`:

```ts
    it('reenvía scope opcional en POST /api/oauth/refresh cuando Google lo incluye', async () => {
      const sealed = await encryptCookiePayload(
        { rt: '1//0g-rt', email: 'doc@hospital.cl', iat: Date.now() },
        TEST_ENV.OAUTH_COOKIE_SECRET!,
      )
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'ya29.refreshed-cal',
            expires_in: 3500,
            scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
          }),
          { status: 200 },
        ),
      )

      const req = new Request('https://sindecon.pages.dev/api/oauth/refresh', {
        method: 'POST',
        headers: {
          Origin: 'https://sindecon.pages.dev',
          Cookie: `${COOKIE_NAME}=${encodeURIComponent(sealed)}`,
        },
      })

      const res = await refreshOnRequest({ request: req, env: TEST_ENV })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        access_token: 'ya29.refreshed-cal',
        expires_in: 3500,
        email: 'doc@hospital.cl',
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
      })
    })
```

- [ ] **Step 2: Run test to verify it fails**

Run from `app/`: `npx vitest run tests/oauth/handlers.test.ts`
Expected: FAIL — `scope` property missing from JSON response.

- [ ] **Step 3: Implement minimal scope forwarding in `exchange.ts` and `refresh.ts`**

In `app/functions/api/oauth/exchange.ts`:
1. Ensure `GoogleTokenResponse` includes `scope?: string`.
2. Normalize `const grantedScope = typeof tokenData.scope === 'string' && tokenData.scope.trim() ? tokenData.scope.trim() : undefined`.
3. Add `...(grantedScope ? { scope: grantedScope } : {})` to both `return jsonResponse(...)` bodies (non-persistent and persistent).

In `app/functions/api/oauth/refresh.ts`:
1. Add `scope?: string` to `GoogleRefreshResponse` (line 13).
2. Normalize `const grantedScope = typeof tokenData.scope === 'string' && tokenData.scope.trim() ? tokenData.scope.trim() : undefined`.
3. Add `...(grantedScope ? { scope: grantedScope } : {})` inside the `jsonResponse` at lines 96-101.

- [ ] **Step 4: Run OAuth handler tests & verify clean**

Run from `app/`: `npx vitest run tests/oauth/handlers.test.ts`
Expected: PASS (all tests including existing ones unchanged).

- [ ] **Step 5: Commit**

```bash
git add app/functions/api/oauth/exchange.ts app/functions/api/oauth/refresh.ts app/tests/oauth/handlers.test.ts
git commit -m "feat(oauth): forward optional granted scope in exchange and refresh endpoints"
```

---

### Task 2: Incremental OAuth Scopes & Feature Separation (`app/src/pwa/googleDrive.ts`)

**Files:**
- Modify: `app/src/pwa/googleDrive.ts:1-289,308-395`
- Test: `app/src/pwa/googleDrive.test.ts`

**Interfaces:**
- Consumes: `fetch('/api/oauth/exchange')`, `fetch('/api/oauth/refresh')`, `window.google.accounts.oauth2`.
- Produces (exported from `app/src/pwa/googleDrive.ts`):
  - `GOOGLE_CALENDAR_SCOPES`: `'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'`
  - `GCAL_ENABLED_KEY`: `'sindecon-gcal-enabled'`
  - `GOOGLE_SCOPES_KEY`: `'sindecon-google-scopes'`
  - `export interface StoreTokenOptions { enableDrive?: boolean; enableCalendar?: boolean; scope?: string }`
  - `isCalendarSyncEnabled(): boolean`
  - `setCalendarSyncEnabled(enabled: boolean): void`
  - `getStoredScopes(): string[]`
  - `mergeStoredScopes(scopeStr?: string): string[]`
  - `hasCalendarScopes(): boolean`
  - Backward-compatible `setStoredToken(token: string, expiresInSeconds?: number, email?: string, options?: StoreTokenOptions): void`
  - Updated `exchangeOAuthCode(code: string): Promise<{ accessToken: string; expiresIn: number; email?: string; persistent: boolean; scope?: string } | null>`
  - Updated `initiateGoogleOAuthFlow(callbacks: { scopes?: string; loginHint?: string; includeGrantedScopes?: boolean; onSuccess: (token: string, expiresIn: number, email?: string, scope?: string) => void; onError: (message: string) => void }): void`

- [ ] **Step 1: Write failing unit tests in `app/src/pwa/googleDrive.test.ts`**

Append tests verifying:
1. Calling `setStoredToken('ya29.cal', 3600, 'med@hospital.cl', { enableDrive: false, enableCalendar: true, scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly' })` sets `isCalendarSyncEnabled() === true`, `hasCalendarScopes() === true`, does NOT flip `isGoogleSyncEnabled()` to `true`, and accumulates scopes on subsequent calls (`drive.file` merged with `calendar.*`).
2. `ensureValidAccessToken(true)` when only Calendar is enabled (`isGoogleSyncEnabled() === false && isCalendarSyncEnabled() === true`) refreshes via `/api/oauth/refresh`, saves returned `scope`, and keeps `isGoogleSyncEnabled() === false`.
3. `initiateGoogleOAuthFlow({ scopes: GOOGLE_CALENDAR_SCOPES, includeGrantedScopes: true, loginHint: 'doc@uci.cl', onSuccess, onError })` passes `scope: GOOGLE_CALENDAR_SCOPES`, `include_granted_scopes: true`, `login_hint: 'doc@uci.cl'` to `initCodeClient` and forwards `session.scope` to `onSuccess`; falls back cleanly to `initTokenClient` with `include_granted_scopes` when BFF returns `404`.
4. `clearStoredToken(true)` clears `GCAL_ENABLED_KEY` and `GOOGLE_SCOPES_KEY`.

- [ ] **Step 2: Run test to verify it fails**

Run from `app/`: `npx vitest run src/pwa/googleDrive.test.ts`
Expected: FAIL — `GOOGLE_CALENDAR_SCOPES` / `isCalendarSyncEnabled` not exported.

- [ ] **Step 3: Implement incremental OAuth & scope tracking in `app/src/pwa/googleDrive.ts`**

1. Export constants near lines 11-28:
```ts
export const GOOGLE_CALENDAR_SCOPES =
  'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'
export const GCAL_ENABLED_KEY = 'sindecon-gcal-enabled'
export const GOOGLE_SCOPES_KEY = 'sindecon-google-scopes'
```
2. Add scope & calendar enable helpers:
```ts
export interface StoreTokenOptions {
  enableDrive?: boolean
  enableCalendar?: boolean
  scope?: string
}

export function isCalendarSyncEnabled(): boolean {
  return localStorage.getItem(GCAL_ENABLED_KEY) === 'true'
}

export function setCalendarSyncEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(GCAL_ENABLED_KEY, 'true')
  } else {
    localStorage.removeItem(GCAL_ENABLED_KEY)
  }
}

export function getStoredScopes(): string[] {
  const raw = localStorage.getItem(GOOGLE_SCOPES_KEY)
  if (!raw) return []
  return raw.split(/\s+/).filter(Boolean)
}

export function mergeStoredScopes(scopeStr?: string): string[] {
  const set = new Set(getStoredScopes())
  if (scopeStr) {
    for (const part of scopeStr.split(/\s+/)) {
      const trimmed = part.trim()
      if (trimmed) set.add(trimmed)
    }
  }
  const merged = Array.from(set)
  if (merged.length > 0) {
    localStorage.setItem(GOOGLE_SCOPES_KEY, merged.join(' '))
  } else {
    localStorage.removeItem(GOOGLE_SCOPES_KEY)
  }
  return merged
}

export function hasCalendarScopes(): boolean {
  const scopes = new Set(getStoredScopes())
  if (scopes.has('https://www.googleapis.com/auth/calendar')) return true
  return (
    scopes.has('https://www.googleapis.com/auth/calendar.events') &&
    scopes.has('https://www.googleapis.com/auth/calendar.calendarlist.readonly')
  )
}
```
3. Update `setStoredToken(token, expiresInSeconds = 3600, email?: string, options?: StoreTokenOptions)`:
   - Legacy 1-3 args (`options === undefined`): preserve `localStorage.setItem(GDRIVE_ENABLED_KEY, 'true')`.
   - With `options`: only set `GDRIVE_ENABLED_KEY` if `options.enableDrive === true` (if `options.enableDrive === false`, leave `GDRIVE_ENABLED_KEY` as-is unless explicitly calling `setGoogleSyncEnabled(false)`). Wait: specifically when `options.enableDrive === true` call `setGoogleSyncEnabled(true)`; if `options.enableDrive === false` call `setGoogleSyncEnabled(false)`; if `undefined`, preserve current `GDRIVE_ENABLED_KEY`! Similarly for `options.enableCalendar`. Wait — check Case 2 above: if Drive was false and caller passes `{ enableDrive: false, enableCalendar: true }`, keeping `setGoogleSyncEnabled(false)` (or not setting true) leaves `isGoogleSyncEnabled()` false! Wait: what if caller passes `{ enableCalendar: true }` while Drive was ALREADY enabled (`true`)? Leaving `enableDrive: undefined` preserves Drive `true`, and leaves Drive `false` if Drive wasn't enabled! That's even cleaner:
     - `if (options === undefined || options.enableDrive === true) localStorage.setItem(GDRIVE_ENABLED_KEY, 'true')`
     - `else if (options.enableDrive === false) localStorage.removeItem(GDRIVE_ENABLED_KEY)`
     - `if (options?.enableCalendar !== undefined) setCalendarSyncEnabled(options.enableCalendar)`
     - `if (options?.scope) mergeStoredScopes(options.scope)`
4. Update `clearStoredToken(disconnectExplicit = false)`: when `disconnectExplicit` is `true`, also `localStorage.removeItem(GCAL_ENABLED_KEY)` and `localStorage.removeItem(GOOGLE_SCOPES_KEY)`.
5. Update `exchangeOAuthCode` to return `...(scope ? { scope } : {})` when present in JSON response, and update `ensureValidAccessToken` to extract optional `scope?: string` and pass `{ enableDrive: isGoogleSyncEnabled(), enableCalendar: isCalendarSyncEnabled(), scope: data.scope }` to `setStoredToken`.
6. Update `GisOAuth2Namespace` (`include_granted_scopes?: boolean`), `triggerLegacyTokenFlow`, and `initiateGoogleOAuthFlow` to accept optional `scopes`, `loginHint`, `includeGrantedScopes` (default `true`), and pass `scope` to `onSuccess(token, expiresIn, email, scope)` (when using code client: `session.scope ?? requestedScopes`; when using legacy token client: `requestedScopes`).

- [ ] **Step 4: Run tests to verify all old and new tests pass**

Run from `app/`: `npx vitest run src/pwa/googleDrive.test.ts tests/oauth/handlers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/pwa/googleDrive.ts app/src/pwa/googleDrive.test.ts
git commit -m "feat(oauth): add incremental Calendar scopes and separate Drive vs Calendar flags"
```

---

### Task 3: Dexie v4 Schema & Offline Outbox Repository (`db.ts`, `db/calendar.ts`)

**Files:**
- Modify: `app/src/db/db.ts:90-115`
- Create: `app/src/db/calendar.ts`
- Test: `app/src/db/calendar.test.ts`

**Interfaces:**
- Consumes: `db` (`KbDatabase`), `Dexie` from `dexie`.
- Produces:
  - In `app/src/db/db.ts`: types `CalendarAccessRole`, `CalendarSyncStatus`, `CalendarEventStatus`, `CalendarOutboxOp`, `CalendarListRow`, `CalendarEventRow`, `CalendarEventDraft`, `CalendarOutboxRow`; `KbDatabase` v4 tables `calendar_list`, `calendar_events`, `calendar_outbox`.
  - In `app/src/db/calendar.ts`:
    - `computeDraftEventTimes(draft: CalendarEventDraft): { startMs: number; endMs: number }`
    - `enqueueCreateEvent(draft: CalendarEventDraft): Promise<CalendarEventRow>`
    - `enqueueUpdateEvent(eventId: string, draft: CalendarEventDraft): Promise<CalendarEventRow>`
    - `enqueueDeleteEvent(eventId: string): Promise<void>`
    - `toggleCalendarSelected(calendarId: string, selected: boolean): Promise<void>`
    - `getPendingOutboxItems(): Promise<CalendarOutboxRow[]>`
    - `clearLocalCalendarData(): Promise<void>`
    - `upsertCalendarList(remoteCalendars: Array<Omit<CalendarListRow, 'selected'> & { selected?: boolean }>): Promise<CalendarListRow[]>`
    - `reconcileRemoteEventsWindow(params: { calendarId: string; windowStartMs: number; windowEndMs: number; remoteEvents: Omit<CalendarEventRow, 'syncStatus' | 'syncError'>[] }): Promise<void>`

- [ ] **Step 1: Write failing repository unit tests in `app/src/db/calendar.test.ts`**

Create `app/src/db/calendar.test.ts` starting with `import 'fake-indexeddb/auto'` testing:
1. `enqueueCreateEvent` creates a `local-*` row in `db.calendar_events` (`syncStatus: 'pending'`) and `'create'` entry in `db.calendar_outbox`.
2. `enqueueUpdateEvent` on an unsynced `local-*` event coalesces payload (and changed `calendarId`) into the existing `'create'` outbox entry instead of appending an `'update'` row.
3. `enqueueDeleteEvent` on an unsynced `local-*` event deletes both event row and `'create'` outbox row cleanly (0 outbox items remaining).
4. `enqueueUpdateEvent` followed by `enqueueDeleteEvent` on a synced event removes `'update'` from outbox and inserts a single `'delete'` outbox row while removing the event from `db.calendar_events`.
5. `reconcileRemoteEventsWindow` removes obsolete `syncStatus === 'synced'` events inside `[windowStartMs, windowEndMs]`, keeps synced events outside that window, and preserves `syncStatus === 'pending'` and `syncStatus === 'error'` rows inside that window.
6. `upsertCalendarList` preserves prior `selected` preference when `selected` already existed locally.

- [ ] **Step 2: Run test to verify it fails**

Run from `app/`: `npx vitest run src/db/calendar.test.ts`
Expected: FAIL — `src/db/calendar.ts` does not exist.

- [ ] **Step 3: Upgrade `app/src/db/db.ts` to v4 and implement `app/src/db/calendar.ts`**

1. In `app/src/db/db.ts`, define and export `CalendarAccessRole`, `CalendarSyncStatus`, `CalendarEventStatus`, `CalendarOutboxOp`, `CalendarListRow`, `CalendarEventRow`, `CalendarEventDraft`, `CalendarOutboxRow`, add typed table properties to `KbDatabase`, and add:
```ts
    this.version(4).stores({
      calendar_list: 'id',
      calendar_events: 'id, calendarId, startMs, endMs, [calendarId+startMs]',
      calendar_outbox: '++id, eventId, createdAt',
    })
```
3. Implement `app/src/db/calendar.ts` with exact types & coalescing logic:
```ts
export async function enqueueCreateEvent(draft: CalendarEventDraft): Promise<CalendarEventRow> {
  const { startMs, endMs } = computeDraftEventTimes(draft)
  const now = Date.now()
  const row: CalendarEventRow = {
    id: `local-${crypto.randomUUID()}`,
    calendarId: draft.calendarId,
    summary: draft.summary.trim(),
    description: draft.description,
    location: draft.location,
    startIso: draft.startIso,
    endIso: draft.endIso,
    startMs,
    endMs,
    allDay: draft.allDay,
    status: 'confirmed',
    updatedAt: now,
    syncStatus: 'pending',
  }
  await db.transaction('rw', db.calendar_events, db.calendar_outbox, async () => {
    await db.calendar_events.put(row)
    await db.calendar_outbox.add({
      op: 'create',
      eventId: row.id,
      calendarId: row.calendarId,
      payload: { ...draft, summary: row.summary },
      createdAt: now,
      attempts: 0,
    })
  })
  return row
}
```
   - `enqueueUpdateEvent(eventId, draft)`: inside `db.transaction('rw', ...)`, coalesce if `outbox` has `'create'` for `eventId` (update both `payload` and `calendarId` on that `'create'` item + `calendar_events` row); otherwise update or insert an `'update'` item and set `syncStatus: 'pending'`, `syncError: undefined`.
   - `enqueueDeleteEvent(eventId)`: inside `db.transaction('rw', ...)`, read `existingOutbox = await db.calendar_outbox.where('eventId').equals(eventId).toArray()`. If any entry has `op === 'create'`, delete the event and all outbox rows for `eventId` (net zero!). Otherwise read `existingEvent = await db.calendar_events.get(eventId)`, resolve `calendarId = existingEvent?.calendarId || existingOutbox[0]?.calendarId || 'primary'`, remove any pending `'update'` outbox rows for `eventId`, delete `eventId` from `calendar_events`, and add `{ op: 'delete', eventId, calendarId, createdAt: Date.now(), attempts: 0 }` to `calendar_outbox`.
   - `clearLocalCalendarData()`: runs `Promise.all([db.calendar_list.clear(), db.calendar_events.clear(), db.calendar_outbox.clear()])` inside a rw transaction.

- [ ] **Step 4: Run tests to verify `calendar.test.ts` and `exportImport.test.ts` pass**

Run from `app/`: `npx vitest run src/db/calendar.test.ts src/db/exportImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/db/db.ts app/src/db/calendar.ts app/src/db/calendar.test.ts
git commit -m "feat(db): add Dexie v4 calendar tables and coalescing offline outbox"
```

---

### Task 4: Google Calendar REST API v3 Client & Date Helpers (`app/src/pwa/googleCalendar.ts`)

**Files:**
- Create: `app/src/pwa/googleCalendar.ts`
- Test: `app/src/pwa/googleCalendar.test.ts`

**Interfaces:**
- Consumes: `CalendarAccessRole`, `CalendarEventDraft`, `CalendarEventRow`, `CalendarEventStatus`, `CalendarListRow` from `../db/db`.
- Produces (exported from `app/src/pwa/googleCalendar.ts`):
  - `export type CalendarApiErrorReason = 'unauthorized' | 'insufficient_scope' | 'not_found' | 'gone' | 'rate_limited' | 'transient' | 'bad_request'`
  - `export class CalendarApiError extends Error { readonly status: number; readonly reason: CalendarApiErrorReason; ... }` (NOTE: remember `erasableSyntaxOnly: true` — declare explicit class fields `readonly status: number` and assign inside constructor, do NOT use `constructor(readonly status: number)` parameter properties!)
  - `parseLocalDateYmd(ymd: string): number`
  - `formatLocalDateYmd(dateOrMs: Date | number): string`
  - `addDaysToYmd(ymd: string, days: number): string`
  - `formatLocalDateTimeInput(dateOrMs: Date | number): string`
  - `buildDraftIsoRange(input: { allDay: boolean; startValue: string; endValue: string }): { startIso: string; endIso: string; timeZone: string }`
  - `parseCalendarEventTimes(start: GoogleEventTime, end: GoogleEventTime): { startIso: string; endIso: string; startMs: number; endMs: number; allDay: boolean }`
  - `eventOverlapsRange(ev: Pick<CalendarEventRow, 'startMs' | 'endMs' | 'status'>, rangeStartMs: number, rangeEndMs: number): boolean`
  - `getDefaultSyncWindow(nowMs?: number): { startMs: number; endMs: number }` (`−30 días` inicio del día a `+120 días` fin del día)
  - `fetchCalendarList(token: string, fetchFn?: typeof fetch): Promise<Array<Omit<CalendarListRow, 'selected'> & { defaultSelected: boolean }>>`
  - `fetchCalendarEventsWindow(token: string, calendarId: string, timeMinMs: number, timeMaxMs: number, fetchFn?: typeof fetch): Promise<Array<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>>>`
  - `createRemoteCalendarEvent(token: string, calendarId: string, draft: CalendarEventDraft, fetchFn?: typeof fetch): Promise<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>>`
  - `patchRemoteCalendarEvent(token: string, calendarId: string, eventId: string, draft: CalendarEventDraft, fetchFn?: typeof fetch): Promise<Omit<CalendarEventRow, 'syncStatus' | 'syncError'>>`
  - `deleteRemoteCalendarEvent(token: string, calendarId: string, eventId: string, fetchFn?: typeof fetch): Promise<void>`

- [ ] **Step 1: Write failing tests in `app/src/pwa/googleCalendar.test.ts`**

Cover:
1. `parseCalendarEventTimes` parses `{ date: '2026-11-26' }` + `{ date: '2026-11-27' }` strictly as local midnight-to-midnight without shifting day under negative UTC offsets, and sets `allDay: true`.
2. `buildDraftIsoRange` validates and builds inclusive-UI `YYYY-MM-DD` (`endValue: '2026-11-26'`) -> exclusive Google Calendar `endIso: '2026-11-27'` when `allDay: true`, and RFC3339 timestamps when `allDay: false`.
3. `eventOverlapsRange` matches overnight events (`22:00` day N to `08:00` day N+1) on both day N and day N+1, matches single all-day events only on their exact local calendar day, and ignores `'cancelled'` events.
4. `fetchCalendarList` paginates and sorts primary calendar first; `fetchCalendarEventsWindow` passes `singleEvents=true`, `orderBy=startTime`, `timeMin`, `timeMax`, and follows `nextPageToken`.
5. `createRemoteCalendarEvent` / `patchRemoteCalendarEvent` / `deleteRemoteCalendarEvent` map `401 -> 'unauthorized'`, `403` with `insufficientPermissions` -> `'insufficient_scope'`, `404 -> 'not_found'`, `410 -> 'gone'`, `500/503 -> 'transient'` into `CalendarApiError`.

- [ ] **Step 2: Run test to verify it fails**

Run from `app/`: `npx vitest run src/pwa/googleCalendar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/src/pwa/googleCalendar.ts`**

Write clean HTTP wrapper and pure date helpers respecting `erasableSyntaxOnly: true` (regular explicit fields on `CalendarApiError extends Error`). Encode `calendarId` and `eventId` via `encodeURIComponent(...)` in every URL path.

- [ ] **Step 4: Run test to verify it passes**

Run from `app/`: `npx vitest run src/pwa/googleCalendar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/pwa/googleCalendar.ts app/src/pwa/googleCalendar.test.ts
git commit -m "feat(calendar): add Google Calendar REST client and timezone-safe date helpers"
```

---

### Task 5: Outbox Sync Engine & `useGoogleCalendar` Hook (`calendarSync.ts`, `useGoogleCalendar.ts`)

**Files:**
- Create: `app/src/pwa/calendarSync.ts`
- Create: `app/src/hooks/useGoogleCalendar.ts`
- Test: `app/src/pwa/calendarSync.test.ts`

**Interfaces:**
- Consumes: `db/calendar.ts`, `pwa/googleCalendar.ts`, `pwa/googleDrive.ts` (`ensureValidAccessToken`, `initiateGoogleOAuthFlow`, `isCalendarSyncEnabled`, `setCalendarSyncEnabled`, `hasCalendarScopes`, `isGoogleSyncEnabled`, `clearStoredToken`, `revokeServerOAuthSession`, `getStoredEmail`, `getStoredToken`, `isTokenExpired`, `GOOGLE_CALENDAR_SCOPES`, `GOOGLE_AUTH_CHANGE_EVENT`), `hooks/useGoogleSync.ts` (`syncWithAutoRefresh`, `shouldAttemptBackgroundSync`, `computeIsSessionExpired`).
- Produces:
  - In `app/src/pwa/calendarSync.ts`:
    - `flushCalendarOutbox(token: string, deps?: CalendarSyncDeps): Promise<{ syncedCount: number; notices: string[] }>`
    - `pullGoogleCalendarWindow(token: string, windowRange?: { startMs: number; endMs: number }, deps?: CalendarSyncDeps): Promise<{ calendarsCount: number; eventsCount: number }>`
    - `performGoogleCalendarSync(token: string, options?: { startMs?: number; endMs?: number; deps?: CalendarSyncDeps }): Promise<{ timestamp: number; syncedOutboxCount: number; eventsCount: number; notices: string[] }>`
    - `getLastCalendarSyncTime()` / `setLastCalendarSyncTime()` (`localStorage` key `'sindecon-gcal-last-sync'`)
  - In `app/src/hooks/useGoogleCalendar.ts`:
    - Pure helper `isCalendarSessionError(message: string): boolean` & `canWriteCalendar(calendar?: Pick<CalendarListRow, 'accessRole'>): boolean`
    - Hook `useGoogleCalendar(opts?: { fallbackEmail?: string | null })` returning `{ isEnabled, isOnline, isSessionExpired, needsCalendarConsent, syncState, lastSyncedAt, errorMessage, noticeMessage, pendingCount, calendars, events, connectCalendar, disconnectCalendar, triggerSync, createEvent, updateEvent, deleteEvent, toggleCalendarVisibility, ensureRangeLoaded, clearNotice }`.

- [ ] **Step 1: Write failing tests in `app/src/pwa/calendarSync.test.ts`**

With `import 'fake-indexeddb/auto'`:
1. `flushCalendarOutbox` replays FIFO `[create local-1, update existing-2, delete existing-3]`, replaces `local-1` with returned remote `id` in `db.calendar_events`, marks `existing-2` as `'synced'`, and empties `db.calendar_outbox`.
2. On `404`/`410` during `update` or `delete`, clears stale outbox item (and stale event on update) + collects readable notice string without stalling subsequent FIFO operations.
3. On `401` (`CalendarApiError('...', 401, 'unauthorized')`) or `403 insufficient_scope`, aborts immediately keeping remaining outbox items intact and rethrows the `CalendarApiError`.
4. On `503 transient`, increments `attempts`, stores `lastError`, updates event `syncStatus = 'error'`, keeps item in outbox, and stops following dependent ops.
5. `performGoogleCalendarSync` pushes outbox first, then pulls calendar list + selected calendars' events into Dexie while preserving any concurrent `'pending'` items.
6. Pure helpers (`canWriteCalendar`, `isCalendarSessionError`) work as expected for `'owner'`/`'writer'` vs `'reader'`/`'freeBusyReader'`.

- [ ] **Step 2: Run test to verify it fails**

Run from `app/`: `npx vitest run src/pwa/calendarSync.test.ts`
Expected: FAIL — `calendarSync.ts` does not exist.

- [ ] **Step 3: Implement `calendarSync.ts` and `useGoogleCalendar.ts`**

Notes for clean implementation:
- In `useGoogleCalendar.ts`:
  - Wrap `performGoogleCalendarSync` with an object implementing the adapter expected by `syncWithAutoRefresh` (from `useGoogleSync.ts`) so token refresh + single retry on 401 works identically to Drive sync!
  - Expose `needsCalendarConsent` whenever an error with `insufficient_scope` happens (or when enabled without required scopes). Calling `connectCalendar()` opens `initiateGoogleOAuthFlow({ scopes: GOOGLE_CALENDAR_SCOPES, includeGrantedScopes: true, loginHint: getStoredEmail() || opts?.fallbackEmail || undefined, ... })`, stores token via `setStoredToken(token, expiresIn, resolvedEmail, { enableCalendar: true, scope })` (note `enableDrive` left `undefined` so existing Drive state is untouched!), clears `needsCalendarConsent` and `serverSessionExpired`, and triggers sync.
  - `disconnectCalendar()` calls `setCalendarSyncEnabled(false)`, clears `lastSyncTime`, awaits `clearLocalCalendarData()`, and calls `clearStoredToken(true)` + `void revokeServerOAuthSession()` **only when `!isGoogleSyncEnabled()`**.
  - On `ensureRangeLoaded(startMs, endMs)`: tracks loaded `[loadedStartMs, loadedEndMs]` ref; if online and requested bounds exceed cached window, runs `triggerSync({ startMs: Math.min(...), endMs: Math.max(...) })`.

- [ ] **Step 4: Run tests to verify pass**

Run from `app/`: `npx vitest run src/pwa/calendarSync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/pwa/calendarSync.ts app/src/pwa/calendarSync.test.ts app/src/hooks/useGoogleCalendar.ts
git commit -m "feat(calendar): implement outbox FIFO sync engine and useGoogleCalendar hook"
```

---

### Task 6: UI Components Light / `Guardia UCI` (`CalendarGuardCard.tsx`, `CalendarModal.tsx`, `CalendarEventFormModal.tsx`)

**Files:**
- Create: `app/src/components/calendar/CalendarEventFormModal.tsx`
- Create: `app/src/components/calendar/CalendarGuardCard.tsx`
- Create: `app/src/components/calendar/CalendarModal.tsx`
- Test: `app/src/components/calendar/CalendarModal.test.ts`

**Interfaces:**
- Consumes: `BaseModal`, `PILL_BTN_PRIMARY`, `PILL_BTN_SECONDARY`, `PILL_BTN_DANGER`, `CLINICAL_FIELD_CLASS` from `../common/DialogModal`; types from `../../db/db`; date helpers from `../../pwa/googleCalendar`; `Theme` from `../../hooks/useTheme`.
- Produces:
  - `CalendarGuardCard` (`data-testid="calendar-guard-card"`): compact Dashboard right-rail card showing disconnected CTA or next 4 visible events + pending/offline pill + `+ Evento` (`data-testid="calendar-quick-add-btn"`) + `Sync` + `Ver agenda completa` (`data-testid="calendar-open-modal-btn"`).
  - `CalendarModal` (`data-testid="calendar-modal"`): `Agenda | Semana | Mes` views (`data-testid="calendar-view-agenda"`, `-week`, `-month`), calendar filter toggles, `Hoy / < / >` navigation, notice/error banners, `Desconectar Agenda`, clickable event cards & day selection. Export pure layout helpers (`getMonthGridDays`, `getWeekDays`, `groupAgendaDays`, `getUpcomingEventsPreview`) so Vitest tests verify calendar date grid math cleanly in node!
  - `CalendarEventFormModal` (`data-testid="calendar-event-form-modal"`): create/edit/view event modal with `Todo el día` toggle, writable calendar dropdown on create, inline delete confirmation, recurring instance notice (`recurringEventId`), read-only guard when `accessRole` is `'reader'`/`'freeBusyReader'`, and client validation (`title.trim()`, `end >= start`).

- [ ] **Step 1: Write failing unit & SSR contract tests in `app/src/components/calendar/CalendarModal.test.ts`**

Using `renderToStaticMarkup` from `'react-dom/server'` + pure grid helper imports:
1. `getMonthGridDays(new Date(2026, 10, 15))` builds a Monday-first 35- or 42-day grid covering Nov 2026 cleanly without DST gaps; `getWeekDays` builds 7 Monday-Sunday days.
2. `getUpcomingEventsPreview(events, calendars, nowMs, limit = 4)` filters hidden calendars & past/cancelled events and orders chronologically.
3. `renderToStaticMarkup` of `CalendarGuardCard` renders `"Conectar Google Calendar"` when disconnected, and renders upcoming event summary + `"Pendiente"` badge + `"Sin conexión"` pill when connected offline with pending event.
4. `renderToStaticMarkup` of `CalendarModal` (`isOpen={true}`) renders `Agenda` / `Semana` / `Mes` view tabs cleanly.
5. `renderToStaticMarkup` of `CalendarEventFormModal` (`isOpen={true}`) renders creation inputs (`title`, all-day toggle, start/end) and recurring warning when `recurringEventId` is set.

- [ ] **Step 2: Run test to verify it fails**

Run from `app/`: `npx vitest run src/components/calendar/CalendarModal.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `CalendarEventFormModal.tsx`, `CalendarGuardCard.tsx`, and `CalendarModal.tsx`**

Guidelines:
- Keep pure helper functions (`getUpcomingEventsPreview`, `getMonthGridDays`, `getWeekDays`, `groupAgendaDays`, `formatEventTimeRange`, `formatRelativeDayLabel`) in a clean exported section or small module without side effects.
- Render all cards using existing SINDECON tokens: `--cl-surface`, `--cl-surface-warm`, `--cl-surface-muted`, `--cl-border`, `--cl-fg`, `--cl-muted`, `--cl-accent`, `--cl-warn-*`, `--ch-*`.
- Calendar color dot/stripe renders inline `style={{ backgroundColor: calendarColor }}` on a small vertical bar (`w-1 rounded-full`) or `w-2.5 h-2.5 rounded-full` dot next to theme-contrast text (`text-[var(--cl-fg)]`), guaranteeing contrast in both light and `Guardia UCI` dark themes.
- Give interactive controls clear `data-testid`s for reliable E2E selection (`calendar-guard-card`, `calendar-connect-btn`, `calendar-quick-add-btn`, `calendar-open-modal-btn`, `calendar-sync-btn`, `calendar-modal`, `calendar-view-agenda`, `calendar-view-week`, `calendar-view-month`, `calendar-event-form-modal`, `calendar-event-title-input`, `calendar-event-allday-toggle`, `calendar-event-submit-btn`, `calendar-event-delete-btn`, `calendar-disconnect-btn`).

- [ ] **Step 4: Run test to verify it passes**

Run from `app/`: `npx vitest run src/components/calendar/CalendarModal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/calendar/CalendarEventFormModal.tsx app/src/components/calendar/CalendarGuardCard.tsx app/src/components/calendar/CalendarModal.tsx app/src/components/calendar/CalendarModal.test.ts
git commit -m "feat(calendar): build CalendarGuardCard, CalendarModal, and CalendarEventFormModal UI"
```

---

### Task 7: Integration Wiring (`App.tsx`, `Dashboard.tsx`, `FolderExplorerView.tsx`, `ClinicalStationHeader.tsx`, Reset Cleanup) & Playwright E2E

**Files:**
- Modify: `app/src/components/common/ClinicalStationHeader.tsx:6-24,67-186`
- Modify: `app/src/components/dashboard/Dashboard.tsx:70-165,405-425,1059-1095`
- Modify: `app/src/components/tree/FolderExplorerView.tsx:85-160,547-566`
- Modify: `app/src/hooks/useGoogleSync.ts:445-460`
- Modify: `app/src/App.tsx:110-165,765-775,850-975,1045-1085`
- Modify: `app/src/components/dashboard/Dashboard.test.ts`
- Create: `app/e2e/google-calendar.spec.ts`

**Interfaces:**
- Consumes: `useGoogleCalendar` from `./hooks/useGoogleCalendar`, `CalendarGuardCard`, `CalendarModal`, `CalendarEventFormModal`, `clearLocalCalendarData` from `./db/calendar`, `setCalendarSyncEnabled`, `GOOGLE_SCOPES_KEY` from `./pwa/googleDrive`.
- Produces: Complete end-to-end wiring from Dashboard `Panel clínico de guardia` and `ClinicalStationHeader` (`Agenda` button) into `CalendarModal` and `CalendarEventFormModal`, plus full cache/flag wipe in `onResetTerminal`.

- [ ] **Step 1: Add failing integration checks (`Dashboard.test.ts`) + Playwright E2E spec (`app/e2e/google-calendar.spec.ts`)**

1. Update `app/src/components/dashboard/Dashboard.test.ts` to verify `DashboardProps` accepts optional calendar props (`calendarEnabled`, `calendarCalendars`, `calendarEvents`, `calendarPendingCount`, `onOpenCalendar`, `onQuickCreateCalendarEvent`, etc.) and `CalendarGuardCard` renders inside `DashboardProps` contract.
2. Create `app/e2e/google-calendar.spec.ts`:
   - Onboard via clean 4-digit PIN in `LoginView` to reach Dashboard.
   - Mock `window.google.accounts.oauth2.initCodeClient`, `/api/oauth/exchange`, `/api/oauth/refresh`, and `https://www.googleapis.com/calendar/v3/**` via Playwright `page.route` (keeping an in-memory stateful mock array of calendars + events so `POST`, `PATCH`, `DELETE`, and `GET` behave authentically!).
   - Verify:
     1. Dashboard `Panel clínico de guardia` displays `calendar-guard-card` with `"Conectar Google Calendar"` without activating Drive backup (`cuaderno-gdrive-enabled` stays `null`).
     2. Clicking `calendar-connect-btn` connects Calendar and immediately shows seeded events (`"Guardia UCI Noche"`) inside `calendar-guard-card`.
     3. Opening `calendar-open-modal-btn` opens `calendar-modal`; switch between `Agenda`, `Semana`, `Mes`, verify events display in both light theme and `Guardia UCI` dark theme.
     4. Offline outbox test: flip offline (`context.setOffline(true)`), create a new event (`"Pase de Sala UCI"`) -> verify `"Pendiente"` badge renders immediately -> edit its title while offline -> verify coalesced change persists -> reconnect online (`context.setOffline(false)`) and trigger/wait sync -> verify remote `POST` fired once with updated title, `Pendiente` cleared, and reload keeps cached synced event.
     5. Delete event from modal -> verify removal locally & remotely (`DELETE`).

- [ ] **Step 2: Run E2E spec before wiring to confirm it fails**

Run from `app/`: `npx vitest run src/components/dashboard/Dashboard.test.ts` and check E2E expects wiring (`npx playwright test e2e/google-calendar.spec.ts` will fail because `calendar-guard-card` is not yet wired).

- [ ] **Step 3: Wire Header, Dashboard, FolderExplorerView, and `App.tsx`**

1. `ClinicalStationHeader.tsx`: add optional `onOpenCalendar?: () => void`, `calendarEnabled?: boolean`, `calendarPendingCount?: number`, `calendarSessionExpired?: boolean`; render compact `Agenda` pill button (`<CalendarDays className="w-3.5 h-3.5" />`, `data-testid="header-calendar-btn"`) beside `Drive` when `onOpenCalendar` is provided, with small status dot (amber if pending > 0 or expired, green if enabled).
2. `Dashboard.tsx`: add optional Calendar props + pass `onOpenCalendar` etc. to `ClinicalStationHeader`; render `<CalendarGuardCard ... />` directly inside `<aside aria-label="Panel clínico de guardia">` after `Repaso Activo SM-2`.
3. `FolderExplorerView.tsx`: add optional `onOpenCalendar`, `calendarEnabled`, `calendarPendingCount`, `calendarSessionExpired` and forward them to `ClinicalStationHeader`.
4. `App.tsx`:
   - Instantiate `const calendar = useGoogleCalendar({ fallbackEmail: ownerEmail })`.
   - Manage `isCalendarModalOpen` and `calendarFormState: { isOpen: boolean; event?: CalendarEventRow | null; initialDateYmd?: string }`.
   - In `onResetTerminal` handler (line 770): also call `await clearLocalCalendarData()`, `setCalendarSyncEnabled(false)`, `localStorage.removeItem(GOOGLE_SCOPES_KEY)`.
   - Also wrap `disconnectGoogle` if needed so existing Drive disconnect preserves Drive/Calendar separation cleanly (or check `googleDrive.ts`: only revoke server cookie if neither Drive nor Calendar remains enabled!). Wait: verify `useGoogleSync.ts` line 445 (`disconnect`)! Right now `useGoogleSync.ts:448` calls `clearStoredToken(true)` and `revokeServerOAuthSession()`. Update `useGoogleSync.ts` `disconnect` (or `disconnectGoogle` passed to `GoogleDriveModal`): if `isCalendarSyncEnabled()` is `true`, only call `setGoogleSyncEnabled(false)` (leaving shared token/BFF cookie active for Calendar); if Calendar is not connected, keep exact existing behavior `clearStoredToken(true)` + `revokeServerOAuthSession()`! That preserves 100% isolation in both directions!
   - Mount `<CalendarModal ... />` and `<CalendarEventFormModal ... />` alongside the other modals in `App.tsx`.
   - Surface `calendar.noticeMessage` / sync feedback via `setToastMessage`.

- [ ] **Step 4: Run complete verification suite**

Run from `app/`:
```powershell
npm test; if ($LASTEXITCODE -eq 0) { npm run lint }; if ($LASTEXITCODE -eq 0) { npm run build }; if ($LASTEXITCODE -eq 0) { npx playwright test e2e/google-calendar.spec.ts e2e/auth-fido-pin.spec.ts }
```
Expected: ALL Vitest test files pass, 0 oxlint errors, clean `tsc -b && vite build`, and Playwright tests pass 100%.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/common/ClinicalStationHeader.tsx app/src/components/dashboard/Dashboard.tsx app/src/components/dashboard/Dashboard.test.ts app/src/components/tree/FolderExplorerView.tsx app/src/hooks/useGoogleSync.ts app/src/App.tsx app/e2e/google-calendar.spec.ts
git commit -m "feat(calendar): wire Google Calendar UI across Dashboard, Header, and App with E2E coverage"
```
