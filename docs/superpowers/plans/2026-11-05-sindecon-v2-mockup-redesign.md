# SINDECON V2 — Rediseño Basado en Mockup, Tailwind CSS v4 e Isotipo de Vitruvio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar SINDECON V2 dentro de `app/src/v2/` con Tailwind CSS v4, fidelidad a las 3 pantallas del mockup en PDF (Portada/Lanzadores, Repositorio, Detalle de Carpeta con menú contextual de 7 acciones), isotipo vectorial limpio del Hombre de Vitruvio y selector fluido para alternar entre V1 y V2.

**Architecture:** V2 se estructura como un módulo independiente en `app/src/v2/` con sus propios componentes y vistas, estilizado con Tailwind CSS v4 aislado mediante el contenedor `.sindecon-v2`. Se conecta directamente a la base de datos IndexedDB compartida (Dexie) mediante `useLiveQuery`, reutiliza la autenticación y sincronización de Google Drive (`pwa/googleDrive.ts`) y el editor clínico Markdown (Milkdown + KaTeX + Mermaid). `App.tsx` actúa como selector de versión controlado por `localStorage`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Dexie 4 (`dexie-react-hooks`), Vitest 4, Oxlint.

**Spec:** [`docs/superpowers/specs/2026-11-05-sindecon-v2-mockup-redesign-design.md`](file:///c:/Users/NOWIS/Documents/sindecon/docs/superpowers/specs/2026-11-05-sindecon-v2-mockup-redesign-design.md)

## Global Constraints

- Directorio base de la nueva versión: `app/src/v2/`
- Tailwind v4 debe aislarse bajo el contenedor `.sindecon-v2` para no alterar los estilos de V1 en `app/src/index.css`.
- Ambas versiones (V1 y V2) deben leer y escribir en la misma base de datos IndexedDB (`db.ts`).
- La versión activa se almacena en `localStorage.getItem('sindecon_ui_version')` ('v1' | 'v2').
- El isotipo del Hombre de Vitruvio debe ser vectorial (SVG) limpio, sin marcas de agua de Adobe Stock ni textura de pergamino, adaptable a tema claro y oscuro.
- Las 7 acciones del menú de notas de la Página 3 del mockup deben estar presentes: `Eliminar`, `Mover A`, `Exportar -> Editor`, `Imprimir`, `Etiqueta`, `Seleccionar`, `Marcar`.

---

### Task 1: Setup Tailwind CSS v4 y Configuración de Estilos V2

**Files:**
- Modify: `app/package.json`
- Modify: `app/vite.config.ts`
- Create: `app/src/v2/styles/v2.css`
- Test: `app/src/v2/styles/v2.test.ts`

**Interfaces:**
- Consumes: Vite configuration
- Produces: Tailwind v4 stylesheet loaded and scoped under `.sindecon-v2`

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/styles/v2.test.ts` para verificar la existencia del archivo de estilos V2 y que contenga la directiva `@import "tailwindcss";` y el selector raíz `.sindecon-v2`:

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Tailwind v4 styles configuration', () => {
  it('should have v2.css with tailwindcss import and scoped theme rules', () => {
    const cssPath = path.resolve(__dirname, 'v2.css')
    expect(fs.existsSync(cssPath)).toBe(true)
    const content = fs.readFileSync(cssPath, 'utf-8')
    expect(content).toContain('@import "tailwindcss"')
    expect(content).toContain('.sindecon-v2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/styles/v2.test.ts`
Expected: FAIL (file does not exist).

- [ ] **Step 3: Install Tailwind v4 dependencies and configure vite.config.ts**

Instalar `@tailwindcss/vite` y `tailwindcss` (v4):

Run: `npm --prefix app install @tailwindcss/vite@^4.0.0 tailwindcss@^4.0.0`

Actualizar `app/vite.config.ts` para incluir el plugin `@tailwindcss/vite`:

```typescript
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({ /* config existente */ })
  ]
})
```

Crear `app/src/v2/styles/v2.css`:

```css
@import "tailwindcss";

@layer base {
  .sindecon-v2 {
    color-scheme: light dark;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
}

.sindecon-v2 {
  min-height: 100vh;
  background-color: #f8fafc;
  color: #0f172a;
}

@media (prefers-color-scheme: dark) {
  .sindecon-v2 {
    background-color: #0b0f19;
    color: #f1f5f9;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/styles/v2.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/vite.config.ts app/src/v2/styles/v2.css app/src/v2/styles/v2.test.ts
git commit -m "feat(v2): configure tailwind css v4 and scoped v2 styles"
```

---

### Task 2: Branding e Isotipo del Hombre de Vitruvio (SVG y Componente React)

**Files:**
- Create: `app/src/v2/components/VitruvianLogo.tsx`
- Create: `app/public/vitruvian-logo.svg`
- Test: `app/src/v2/components/VitruvianLogo.test.tsx`

**Interfaces:**
- Consumes: React
- Produces: `export function VitruvianLogo({ className, size }: { className?: string; size?: number }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/components/VitruvianLogo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { VitruvianLogo } from './VitruvianLogo'

describe('VitruvianLogo Component', () => {
  it('renders svg with proper attributes', () => {
    const { container } = render(<VitruvianLogo size={48} className="text-teal-600" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('width')).toBe('48')
    expect(svg?.getAttribute('height')).toBe('48')
    expect(svg?.getAttribute('aria-label')).toBe('SINDECON Vitruvian Logo')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/components/VitruvianLogo.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement VitruvianLogo and public SVG asset**

Crear `app/src/v2/components/VitruvianLogo.tsx` con la silueta anatómica y geométrica limpia de Da Vinci (círculo de proporción áurea, cuadrado de cuadratura humana, figura humana expandida con 4 brazos y 4 piernas en trazos vectoriales SVG precisos, sin marcas de agua ni fondos de papel):

```tsx
import React from 'react'

export interface VitruvianLogoProps {
  size?: number
  className?: string
}

export const VitruvianLogo: React.FC<VitruvianLogoProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="SINDECON Vitruvian Logo"
      className={className}
    >
      {/* Círculo proporcional */}
      <circle cx="50" cy="50" r="46" strokeWidth="1.2" opacity="0.85" />
      {/* Cuadrado de proporciones humanas */}
      <rect x="12" y="12" width="76" height="76" strokeWidth="1.2" opacity="0.75" />
      
      {/* Cabeza */}
      <circle cx="50" cy="27" r="5" strokeWidth="1.5" />
      
      {/* Tronco y columna */}
      <line x1="50" y1="32" x2="50" y2="58" strokeWidth="1.8" />
      {/* Hombros y pelvis */}
      <line x1="42" y1="36" x2="58" y2="36" strokeWidth="1.5" />
      <line x1="44" y1="58" x2="56" y2="58" strokeWidth="1.5" />

      {/* Brazos horizontales (posición en cruz) */}
      <line x1="14" y1="36" x2="86" y2="36" strokeWidth="1.5" />
      
      {/* Brazos elevados (tocando el círculo superior) */}
      <line x1="50" y1="36" x2="20" y2="22" strokeWidth="1.5" />
      <line x1="50" y1="36" x2="80" y2="22" strokeWidth="1.5" />

      {/* Piernas rectas (posición suelo) */}
      <line x1="46" y1="58" x2="44" y2="88" strokeWidth="1.5" />
      <line x1="54" y1="58" x2="56" y2="88" strokeWidth="1.5" />

      {/* Piernas abiertas (tocando el círculo inferior) */}
      <line x1="46" y1="58" x2="25" y2="82" strokeWidth="1.5" />
      <line x1="54" y1="58" x2="75" y2="82" strokeWidth="1.5" />
    </svg>
  )
}
```

Crear también `app/public/vitruvian-logo.svg` como asset independiente para favicon y PWA.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/components/VitruvianLogo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/v2/components/VitruvianLogo.tsx app/src/v2/components/VitruvianLogo.test.tsx app/public/vitruvian-logo.svg
git commit -m "feat(v2): add clean vector Vitruvian Man logo component and svg asset"
```

---

### Task 3: Switcher de Versión y Orquestación Dual en `App.tsx`

**Files:**
- Create: `app/src/v2/components/VersionSwitcher.tsx`
- Create: `app/src/v2/V2App.tsx`
- Modify: `app/src/App.tsx`
- Test: `app/src/v2/components/VersionSwitcher.test.tsx`

**Interfaces:**
- Consumes: `localStorage`, `useState`
- Produces: `export function VersionSwitcher({ currentVersion, onToggle }: VersionSwitcherProps): JSX.Element`, `export function V2App(): JSX.Element`

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/components/VersionSwitcher.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VersionSwitcher } from './VersionSwitcher'

describe('VersionSwitcher Component', () => {
  it('renders switch button and fires onToggle callback', () => {
    const handleToggle = vi.fn()
    render(<VersionSwitcher currentVersion="v2" onToggle={handleToggle} />)
    const button = screen.getByRole('button', { name: /vista clásica v1/i })
    expect(button).toBeDefined()
    fireEvent.click(button)
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/components/VersionSwitcher.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement VersionSwitcher, V2App and integrate in App.tsx**

Crear `app/src/v2/components/VersionSwitcher.tsx`:

```tsx
import React from 'react'

export interface VersionSwitcherProps {
  currentVersion: 'v1' | 'v2'
  onToggle: () => void
  className?: string
}

export const VersionSwitcher: React.FC<VersionSwitcherProps> = ({
  currentVersion,
  onToggle,
  className = '',
}) => {
  const isV2 = currentVersion === 'v2'
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-sm ${
        isV2
          ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
          : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
      } ${className}`}
      title={isV2 ? 'Cambiar a diseño clásico V1' : 'Probar nuevo diseño V2'}
    >
      <span>{isV2 ? '⏪' : '✨'}</span>
      <span>{isV2 ? 'Vista Clásica V1' : 'Probar Vista V2'}</span>
    </button>
  )
}
```

Crear `app/src/v2/V2App.tsx` (shell inicial con el wrapper `.sindecon-v2` importando `styles/v2.css`):

```tsx
import React, { useState } from 'react'
import './styles/v2.css'
import { VersionSwitcher } from './components/VersionSwitcher'
import { VitruvianLogo } from './components/VitruvianLogo'

export interface V2AppProps {
  onSwitchToV1: () => void
}

export const V2App: React.FC<V2AppProps> = ({ onSwitchToV1 }) => {
  return (
    <div className="sindecon-v2 min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <VitruvianLogo size={32} className="text-teal-600 dark:text-teal-400" />
          <h1 className="text-xl font-bold tracking-tight">SINDECON V2</h1>
        </div>
        <VersionSwitcher currentVersion="v2" onToggle={onSwitchToV1} />
      </header>
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Renderiza las vistas según estado */}
      </main>
    </div>
  )
}
```

Modificar `app/src/App.tsx`:
- Añadir lectura/escritura de `localStorage.getItem('sindecon_ui_version')` ('v1' | 'v2').
- Si la versión es `'v2'`, renderizar `<V2App onSwitchToV1={() => setVersion('v1')} />`.
- En el header de V1, renderizar `<VersionSwitcher currentVersion="v1" onToggle={() => setVersion('v2')} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/components/VersionSwitcher.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/v2/components/VersionSwitcher.tsx app/src/v2/components/VersionSwitcher.test.tsx app/src/v2/V2App.tsx app/src/App.tsx
git commit -m "feat(v2): implement version switcher and dual-view orchestration in App.tsx"
```

---

### Task 4: Componentes Compartidos (BottomNav con FAB, QuickLauncherGrid y Modal de Creación)

**Files:**
- Create: `app/src/v2/components/BottomNav.tsx`
- Create: `app/src/v2/components/QuickLauncherGrid.tsx`
- Create: `app/src/v2/components/CreateItemModal.tsx`
- Test: `app/src/v2/components/SharedComponents.test.tsx`

**Interfaces:**
- Consumes: React, Tailwind v4
- Produces:
  - `BottomNav({ onFabClick, onNavigateHome, onOpenSearch, activeTab })`
  - `QuickLauncherGrid()` (6 lanzadores: Drive, ChatGPT, Outlook, Canvas, Mi Currículum, Gmail)
  - `CreateItemModal({ isOpen, onClose, onCreateFolder, onCreateNote })`

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/components/SharedComponents.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomNav } from './BottomNav'
import { QuickLauncherGrid } from './QuickLauncherGrid'

describe('Shared V2 Components', () => {
  it('renders BottomNav with central FAB button', () => {
    const handleFab = vi.fn()
    render(<BottomNav onFabClick={handleFab} onNavigateHome={() => {}} />)
    const fab = screen.getByRole('button', { name: /acción principal/i })
    expect(fab).toBeDefined()
    fireEvent.click(fab)
    expect(handleFab).toHaveBeenCalled()
  })

  it('renders QuickLauncherGrid with 6 tools from the mockup', () => {
    render(<QuickLauncherGrid />)
    expect(screen.getByText(/drive/i)).toBeDefined()
    expect(screen.getByText(/chatgpt/i)).toBeDefined()
    expect(screen.getByText(/outlook/i)).toBeDefined()
    expect(screen.getByText(/canvas/i)).toBeDefined()
    expect(screen.getByText(/mi currículum/i)).toBeDefined()
    expect(screen.getByText(/gmail/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/components/SharedComponents.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement BottomNav, QuickLauncherGrid and CreateItemModal**

Crear `app/src/v2/components/BottomNav.tsx`:
- Barra de navegación fija inferior `fixed bottom-0 inset-x-0` con diseño elegante con glassmorphism `backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800`.
- Botón central circular prominente `( + )` estilo `---( O )---` del mockup con icono `+` de alta accesibilidad.

Crear `app/src/v2/components/QuickLauncherGrid.tsx`:
- Lista de 6 herramientas:
  1. Google Drive (`https://drive.google.com`)
  2. ChatGPT (`https://chatgpt.com`)
  3. Outlook (`https://outlook.office.com`)
  4. Canvas LMS (`https://canvas.instructure.com`)
  5. Mi Currículum (`https://www.linkedin.com` o portal clínico)
  6. Gmail (`https://mail.google.com`)
- Cada tarjeta con icono representativo, bordes suaves, hover interactivo y `target="_blank"`.

Crear `app/src/v2/components/CreateItemModal.tsx`:
- Diálogo modal accesible para elegir entre *"📁 Crear Nueva Carpeta"* o *"📄 Crear Nueva Nota Médica"*.
- Para carpetas: input de texto para el nombre.
- Para notas: input de título y selector opcional de plantilla médica (En blanco, SOAP, Epicrisis, Ingreso Urgencias).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/components/SharedComponents.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/v2/components/BottomNav.tsx app/src/v2/components/QuickLauncherGrid.tsx app/src/v2/components/CreateItemModal.tsx app/src/v2/components/SharedComponents.test.tsx
git commit -m "feat(v2): implement BottomNav with FAB, QuickLauncherGrid and CreateItemModal"
```

---

### Task 5: Pantalla 1 — Portada y Acceso (`LandingView.tsx`)

**Files:**
- Create: `app/src/v2/views/LandingView.tsx`
- Test: `app/src/v2/views/LandingView.test.tsx`

**Interfaces:**
- Consumes: `VitruvianLogo`, `QuickLauncherGrid`, `googleDrive.ts`
- Produces: `export function LandingView({ onEnterRepository, onSwitchToV1 }: LandingViewProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/views/LandingView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LandingView } from './LandingView'

describe('LandingView (Mockup Page 1)', () => {
  it('renders user, password inputs, enter button and launcher grid', () => {
    const handleEnter = vi.fn()
    render(<LandingView onEnterRepository={handleEnter} onSwitchToV1={() => {}} />)
    
    expect(screen.getByLabelText(/usuario/i)).toBeDefined()
    expect(screen.getByLabelText(/contraseña/i)).toBeDefined()
    
    const userInput = screen.getByLabelText(/usuario/i)
    fireEvent.change(userInput, { target: { value: 'Dr. House' } })
    
    const enterBtn = screen.getByRole('button', { name: /entrar al repositorio/i })
    fireEvent.click(enterBtn)
    
    expect(handleEnter).toHaveBeenCalledWith('Dr. House')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/views/LandingView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement LandingView**

Crear `app/src/v2/views/LandingView.tsx`:
- Encabezado con `VitruvianLogo` + título tipográfico `SINDECON`.
- Formulario de `Usuario` y `Contraseña`:
  - Campo `Usuario` guarda el valor en `localStorage.getItem('sindecon_user_name')`.
  - Campo `Contraseña` opcional con PIN/clave local.
  - Botón *"Conectar con Google Drive"* para sincronización opcional con OAuth.
  - Botón de submit *"Entrar al Repositorio"*.
- Renderizado de `<QuickLauncherGrid />` con las 6 herramientas del mockup debajo del formulario.
- Enlace para cambiar a V1.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/views/LandingView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/v2/views/LandingView.tsx app/src/v2/views/LandingView.test.tsx
git commit -m "feat(v2): implement LandingView matching mockup page 1"
```

---

### Task 6: Pantalla 2 — "Mi Repositorio" (`RepositoryView.tsx`)

**Files:**
- Create: `app/src/v2/views/RepositoryView.tsx`
- Test: `app/src/v2/views/RepositoryView.test.tsx`

**Interfaces:**
- Consumes: `db.ts` (`nodes`), `BottomNav`, `CreateItemModal`
- Produces: `export function RepositoryView({ userName, onSelectFolder, onSwitchToV1 }: RepositoryViewProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/views/RepositoryView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RepositoryView } from './RepositoryView'

describe('RepositoryView (Mockup Page 2)', () => {
  it('displays user greeting, Drive button and search input', () => {
    render(<RepositoryView userName="Dr. House" onSelectFolder={() => {}} onSwitchToV1={() => {}} />)
    expect(screen.getByText(/¡hola dr\. house!/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/buscar/i)).toBeDefined()
    expect(screen.getByText(/mi repositorio/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/views/RepositoryView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement RepositoryView**

Crear `app/src/v2/views/RepositoryView.tsx`:
- Cabecera:
  - Saludo `¡Hola [userName]!` con tipografía limpia y moderna.
  - Botón superior derecho de **Drive** mostrando estado de conexión/sincronización y disparador de respaldo.
  - Botón de VersionSwitcher para volver a V1.
- Sección "Mi Repositorio":
  - Barra de búsqueda (`🔍 Buscar`) que filtra en vivo la lista de carpetas y artículos.
  - Grilla/lista de carpetas obtenidas de `db.nodes.where({ parent_id: null, kind: 'folder' })` vía `useLiveQuery`.
  - Cada carpeta muestra: icono de carpeta médica, título, conteo de notas hijas y fecha.
  - Al hacer clic, ejecuta `onSelectFolder(folderId)`.
- Barra inferior `BottomNav` con el botón central `+` (FAB) que abre `CreateItemModal` para crear nuevas carpetas o notas en la raíz.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/views/RepositoryView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/v2/views/RepositoryView.tsx app/src/v2/views/RepositoryView.test.tsx
git commit -m "feat(v2): implement RepositoryView matching mockup page 2"
```

---

### Task 7: Pantalla 3 — Detalle de Carpeta y Menú Contextual de Notas (`FolderDetailView.tsx` y `NoteContextMenu.tsx`)

**Files:**
- Create: `app/src/v2/components/NoteContextMenu.tsx`
- Create: `app/src/v2/views/FolderDetailView.tsx`
- Test: `app/src/v2/views/FolderDetailView.test.tsx`

**Interfaces:**
- Consumes: `db.ts` (`nodes`, `articles`), `BottomNav`
- Produces:
  - `NoteContextMenu({ noteId, onAction, position, onClose })` con las 7 acciones (`Eliminar`, `Mover A`, `Exportar -> Editor`, `Imprimir`, `Etiqueta`, `Seleccionar`, `Marcar`)
  - `FolderDetailView({ folderId, onBack, onOpenEditor })`

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/views/FolderDetailView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NoteContextMenu } from '../components/NoteContextMenu'

describe('NoteContextMenu (Mockup Page 3 Actions)', () => {
  it('renders all 7 actions from the mockup', () => {
    const handleAction = vi.fn()
    render(<NoteContextMenu noteId="test-1" onAction={handleAction} onClose={() => {}} />)
    
    expect(screen.getByText(/eliminar/i)).toBeDefined()
    expect(screen.getByText(/mover a/i)).toBeDefined()
    expect(screen.getByText(/exportar -> editor/i)).toBeDefined()
    expect(screen.getByText(/imprimir/i)).toBeDefined()
    expect(screen.getByText(/etiqueta/i)).toBeDefined()
    expect(screen.getByText(/seleccionar/i)).toBeDefined()
    expect(screen.getByText(/marcar/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/views/FolderDetailView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement NoteContextMenu and FolderDetailView**

Crear `app/src/v2/components/NoteContextMenu.tsx`:
- Menú popover accesible con las 7 opciones exactas del mockup:
  1. `🗑️ Eliminar`
  2. `📂 Mover A`
  3. `📝 Exportar -> Editor`
  4. `🖨️ Imprimir`
  5. `🏷️ Etiqueta`
  6. `☑️ Seleccionar`
  7. `🚩 Marcar` (con selector de marcador: ▲ Urgente, ● Pendiente, ■ Completado).

Crear `app/src/v2/views/FolderDetailView.tsx`:
- Cabecera: `← Volver a Mi Repositorio`, icono de carpeta, título de carpeta y contador de notas.
- Tabla / lista principal:
  - Columnas: `Documento`, `Fecha Creación`, `Etiqueta`, `Acciones (···)`.
  - Consulta en tiempo real las notas de la carpeta (`nodes.where({ parent_id: folderId, kind: 'article' })`).
  - Obtiene el array de etiquetas de `articles` correspondiente a cada nota.
- Panel lateral derecho:
  - Campo de búsqueda contextual de notas.
  - Lista de etiquetas activas de la carpeta para filtrado inmediato.
- Integración de `NoteContextMenu` al hacer clic en `···`.
- Al hacer clic en el título de la nota o en *"Exportar -> Editor"*, invoca `onOpenEditor(noteId)`.
- Barra inferior `BottomNav` con FAB `+` para crear notas directamente en esta carpeta.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/views/FolderDetailView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/v2/components/NoteContextMenu.tsx app/src/v2/views/FolderDetailView.tsx app/src/v2/views/FolderDetailView.test.tsx
git commit -m "feat(v2): implement FolderDetailView and NoteContextMenu with 7 actions matching mockup page 3"
```

---

### Task 8: Integración del Editor Clínico en V2, Orquestación de V2App y Verificación Final

**Files:**
- Create: `app/src/v2/views/EditorWrapperView.tsx`
- Modify: `app/src/v2/V2App.tsx`
- Test: `app/src/v2/V2App.test.tsx`

**Interfaces:**
- Consumes: Milkdown editor component (o vista de edición clínica existente), `db.ts`
- Produces: Complete navigable V2 application with full CRUD and editor integration

- [ ] **Step 1: Write the failing test**

Crear `app/src/v2/V2App.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { V2App } from './V2App'

describe('V2App Navigation Flow', () => {
  it('navigates from LandingView to RepositoryView and allows returning', () => {
    render(<V2App onSwitchToV1={() => {}} />)
    // Inicialmente en LandingView
    expect(screen.getByText(/sindecon/i)).toBeDefined()
    const enterBtn = screen.getByRole('button', { name: /entrar al repositorio/i })
    fireEvent.click(enterBtn)
    
    // Ahora en RepositoryView
    expect(screen.getByText(/mi repositorio/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app test src/v2/V2App.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement EditorWrapperView and complete V2App orchestration**

Crear `app/src/v2/views/EditorWrapperView.tsx`:
- Conecta el editor Markdown clínico de SINDECON con soporte completo KaTeX, Mermaid y plantillas.
- Proporciona barra de herramientas con botón *"← Volver a la Carpeta"*, guardado automático en IndexedDB y título de la nota editable.

Actualizar `app/src/v2/V2App.tsx`:
- Estado de navegación:
  - `activeView`: `'landing' | 'repository' | 'folder' | 'editor'`
  - `selectedFolderId`: `string | null`
  - `selectedNoteId`: `string | null`
  - `userName`: string persistido en `localStorage`
- Orquestar transiciones suaves entre las 3 pantallas y el editor.
- Manejar creación de carpetas y notas conectadas a `db.nodes` y `db.articles`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix app test src/v2/V2App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full project verification**

Run: `npm --prefix app test`
Expected: All tests pass.

Run: `npm --prefix app run build`
Expected: TypeScript and Vite build succeeds without errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/v2/views/EditorWrapperView.tsx app/src/v2/V2App.tsx app/src/v2/V2App.test.tsx
git commit -m "feat(v2): complete V2App flow with clinical editor and navigation"
```
