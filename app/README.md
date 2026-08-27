# 🩺 SINDECON — Cuaderno Médico

> **Sistema de Información y Notas para Decisiones Clínicas**  
> *Base de conocimientos médica personal, offline-first, segura y ultrarrápida para profesionales y estudiantes de la salud.*

[![Version](https://img.shields.io/badge/version-v0.2.20-blue.svg)](https://github.com/nowis97/sindecon/releases/tag/v0.2.20)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-emerald.svg)](https://vite-pwa-org.netlify.app/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6.svg)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Dexie.js-IndexedDB-orange.svg)](https://dexie.org/)
[![Tests](https://img.shields.io/badge/Vitest-74%20passed-success.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📖 Índice

1. [Visión y Propósito Clínico](#-visión-y-propósito-clínico)
2. [Características Principales](#-características-principales)
   - [Árbol de Conocimientos y Drag & Drop](#1-árbol-de-conocimiento-clínico-jerárquico)
   - [Editor Markdown Médico y Fórmulas](#2-editor-markdown-médico-fórmulas-y-diagramas)
   - [Motor de Plantillas Clínicas V2](#3-motor-de-plantillas-clínicas-v2)
   - [Búsqueda Ultrarrápida y Command Palette](#4-búsqueda-ultrarrápida-y-command-palette-ctrlk)
   - [PWA Offline-First y Actualizaciones Proactivas](#5-pwa-offline-first-y-actualización-automática-proactiva)
   - [Portabilidad y Sincronización con Google Drive](#6-portabilidad-y-sincronización-con-google-drive)
   - [Diseño Obsidian / Notion y Navegación Móvil](#7-diseño-moderno-modo-oscuro-y-dock-móvil)
   - [Resiliencia y Telemetría Segura](#8-resiliencia-y-observabilidad-clínica)
3. [Arquitectura del Sistema](#-arquitectura-del-sistema)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Guía de Inicio Rápido](#-guía-de-inicio-rápido)
6. [Despliegue en Cloudflare Pages](#-despliegue-en-cloudflare-pages)
7. [Variables de Entorno](#-variables-de-entorno)
8. [Comandos y Scripts](#-comandos-y-scripts)
9. [Privacidad y Seguridad de Datos](#-privacidad-y-seguridad-de-datos)
10. [Metodología OpenSpec](#-metodología-openspec)
11. [Licencia](#-licencia)

---

## 🎯 Visión y Propósito Clínico

Durante una guardia médica de urgencias, en salas de hospitalización o en la consulta ambulatoria, el acceso a la información clínica debe ser **inmediato, sin fricción y 100% disponible**, incluso en sótanos o zonas rurales con señal nula.

**SINDECON** fue diseñado desde cero para solucionar los problemas habituales del software clínico tradicional:
- **Cero dependencia de internet:** Los datos viven en el dispositivo del profesional (IndexedDB), asegurando velocidad instantánea y funcionamiento offline permanente.
- **Privacidad estricta:** No existen servidores intermediarios que recopilen o almacenen datos de pacientes.
- **Estructuración médica flexible:** Combina la libertad del formato Markdown con la potencia de esquemas diagnósticos en Mermaid, fórmulas de dosificación en KaTeX y plantillas estructuradas (SOAP, Epicrisis, RCP, Ingreso).

---

## ✨ Características Principales

### 1. 🌳 Árbol de Conocimiento Clínico Jerárquico
- **Organización infinita:** Estructura anidada de carpetas, subcarpetas y artículos clínicos.
- **Drag & Drop Tridimensional de Alta Precisión:**
  - **Centro (50% central):** Arrastra para mover un elemento **DENTRO** de la carpeta (`🟦`).
  - **Borde Superior (25% superior):** Mueve **AL MISMO NIVEL / RAÍZ (Arriba)** con indicador de línea azul horizontal (`──`).
  - **Borde Inferior (25% inferior):** Mueve **AL MISMO NIVEL / RAÍZ (Abajo)** con indicador de línea azul horizontal (`──`).
  - Detección síncrona sin pérdida de eventos y auto-expansión al soltar.
- **Menú Contextual Inteligente (`···`):** Con auto-flip placement hacia arriba cuando se abre cerca del borde inferior de la pantalla.
- **Mover con Cancelación:** Modo de traslado interactivo con banners flotantes y cancelación con `Esc`.
- **Bandeja de Entrada (`Inbox`):** Carpeta especial del sistema para capturas rápidas durante la guardia y clasificación posterior.
- **Favoritos / Protocolos Clave:** Sección de acceso rápido fijada en el lateral para algoritmos de soporte vital (ACLS/BLS), shock o sedoanalgesia.

### 2. 📝 Editor Markdown Médico, Fórmulas y Diagramas
- **Editor WYSIWYG Moderno:** Basado en Milkdown (Crepe) y ProseMirror, permitiendo edición fluida con atajos de teclado tipo Notion.
- **Fórmulas y Dosificación Clínica (KaTeX):** Renderizado de expresiones matemáticas y ecuaciones farmacológicas (ej. cálculo de clearance de creatinina, déficit de agua libre, dosis por kg).
- **Algoritmos y Flujos Diagnósticos (Mermaid.js):** Renderizado de árboles de decisión clínica directamente en el texto.
- **Enlaces Bidireccionales (`[[WikiLinks]]`):** Interconecta conceptos médicos y navega con un solo clic.
- **Ficha Clínica en 2 Columnas para Impresión:** Formato de impresión en papel/PDF optimizado en 2 columnas estilo "ficha de bolsillo".

### 3. 📋 Motor de Plantillas Clínicas V2
- **Plantillas Maestras Protegidas:** Carpeta `Plantillas` aislada y blindada contra traslados accidentales.
- **Sustitución Inteligente de Variables:**
  - `{{date}}` (Fecha actual)
  - `{{time}}` (Hora actual)
  - `{{datetime}}` (Fecha y hora completas)
  - `{{title}}` (Título de la nota)
  - `{{author}}` (Nombre del médico)
- **Plantillas Preinstaladas:**
  - *Evolución Clínica SOAP* (Subjetivo, Objetivo, Análisis, Plan)
  - *Epicrisis y Alta Médica*
  - *Ingreso Hospitalario de Urgencia*
  - *Protocolo de Reanimación Cardiopulmonar (RCP Avanzado)*
  - *Evaluación Inicial y Manejo del Dolor Agudo*

### 4. 🔍 Búsqueda Ultrarrápida y Command Palette (`Ctrl+K`)
- **Motor MiniSearch en Memoria:** Indexación instantánea de títulos, cuerpo completo de artículos y etiquetas.
- **Búsqueda por Tags:** Filtrado rápido mediante etiquetas médicas (`#urgencias`, `#cardiologia`, `#pediatria`).
- **Command Palette (`Ctrl+K` / `Cmd+K`):** Buscador global flotante tipo Spotlight para saltar entre notas sin levantar las manos del teclado.
- **Panel de Backlinks:** Descubre automáticamente qué artículos enlazan a la nota actual.

### 5. ⚡ PWA Offline-First y Actualización Automática Proactiva
- **Instalable en Cualquier Dispositivo:** Funciona como aplicación nativa en Windows, macOS, Linux, Android e iOS.
- **Sondeo Proactivo de Nuevas Versiones:**
  - Comprobación en segundo plano cada **3 minutos**.
  - Comprobación instantánea al **volver a la pestaña** (`document.visibilitychange`).
  - Comprobación al **reenfocar la ventana** (`window.onfocus`) o **recuperar internet** (`window.ononline`).
- **Aviso Toast Flotante ("✨ Nueva versión lista"):** Notificación discreta con botón de `🔄 Actualizar ahora` que aplica la nueva versión en 1 clic **sin interrumpir** al médico mientras escribe.
- **Políticas Estrictas de Caché en Cloudflare Pages (`public/_headers`):** Prohíbe la retención de descriptores (`/sw.js`, `index.html`) e inmuta los assets versionados (`/assets/*`).

### 6. ☁️ Portabilidad y Sincronización con Google Drive
- **Exportación e Importación:** Formatos JSON completo (backup de toda la base de datos) o archivos Markdown individuales y empaquetados en ZIP.
- **Importación Inteligente:** Soporte para importar archivos Word (`.docx`), HTML y texto enriquecido.
- **Sincronización Privada con Google Drive:** Integración con OAuth 2.0 PKCE directamente contra la API de Google Drive v3, con resolución inteligente de conflictos y control de versiones.
- **Almacenamiento Persistente:** Solicita `navigator.storage.persist()` para proteger los datos locales contra limpiezas automáticas del navegador por falta de espacio.

### 7. 🎨 Diseño Moderno, Modo Oscuro y Dock Móvil
- **Temas Visuales:**
  - *Obsidian Dark* (`#0f141c`): Ideal para guardias nocturnas, reduce la fatiga visual y ahorra batería en pantallas OLED.
  - *Notion Light* (`#ffffff`): Limpio, nítido y de alto contraste para consulta diurna.
- **Dock de Navegación Móvil (Glassmorphism):** Barra inferior flotante con desenfoque de cristal (`backdrop-filter: blur(16px)`), botón central de captura rápida y accesos a búsqueda, temas y sincronización.
- **Accesibilidad y Movimiento Reducido:** Soporte nativo para `prefers-reduced-motion: reduce`.

### 8. 🩺 Resiliencia y Observabilidad Clínica
- **Medical Error Boundary:** Envoltorio de seguridad que intercepta excepciones en componentes de interfaz sin cerrar la app ni comprometer los datos locales en Dexie.
- **Telemetría Segura (Sentry):** Reporte de errores opcional y seguro, sin recolección de PII ni datos confidenciales de salud.

---

## 📐 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTERFAZ DE USUARIO (UI)                          │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌────────────────┐  │
│  │   TreeView (Árbol)   │  │ MarkdownEditor (Crepe)  │  │  ArticleReader │  │
│  │  Drag & Drop Preciso │  │    KaTeX + Mermaid.js   │  │   Vista Ficha  │  │
│  └──────────┬───────────┘  └────────────┬────────────┘  └───────┬────────┘  │
│             │                           │                       │           │
│             └─────────────────────┬─────┴───────────────────────┘           │
│                                   ▼                                         │
│                      HOOKS REACTIVOS Y ESTADO                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │   useNodes()    │ │ usePWAUpdate()  │ │ useSearch()  │ │useGoogleSync()│ │
│  └────────┬────────┘ └────────┬────────┘ └──────┬───────┘ └──────┬───────┘  │
└───────────┼───────────────────┼─────────────────┼────────────────┼──────────┘
            │                   │                 │                │
            ▼                   ▼                 ▼                ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│    BASE DE DATOS     │ │SERVICE WORKER│ │MOTOR BÚSQUEDA│ │GOOGLE DRIVE SYNC │
│       LOCAL          │ │ (PWA Offline)│ │ (MiniSearch) │ │   (OAuth PKCE)   │
│  IndexedDB (Dexie)   │ │Workbox + CDN │ │ In-Memory FT │ │  Drive API v3    │
└──────────────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘
```

---

## 📂 Estructura del Proyecto

```text
sindecon/
├── app/                              # Aplicación cliente React + Vite
│   ├── public/
│   │   ├── _headers                  # Reglas de caché HTTP para Cloudflare Pages
│   │   ├── icons/                    # Iconos PWA (192x192, 512x512)
│   │   └── manifest.webmanifest      # Manifiesto de la PWA
│   ├── src/
│   │   ├── components/
│   │   │   ├── capture/              # Modal de Captura Rápida
│   │   │   ├── common/               # Diálogos modales, Toasts y Error Boundary
│   │   │   ├── dashboard/            # Panel de bienvenida y estadísticas
│   │   │   ├── editor/               # MarkdownEditor (Milkdown) y SmartImport
│   │   │   ├── navigation/           # MobileBottomBar (Dock de cristal móvil)
│   │   │   ├── portability/          # Sincronización Google Drive y Backup
│   │   │   ├── pwa/                  # UpdateToast (Aviso flotante de actualización)
│   │   │   ├── reader/               # ArticleReader (Vista de lectura e impresión)
│   │   │   ├── search/               # SearchBox, CommandPalette y TagInput
│   │   │   └── tree/                 # TreeView (Árbol clínico con Drag & Drop)
│   │   ├── db/                       # Capa de datos IndexedDB con Dexie.js
│   │   │   ├── db.ts                 # Esquema de tablas y tipos
│   │   │   ├── nodes.ts              # CRUD de carpetas y artículos
│   │   │   ├── articles.ts           # Guardado de cuerpos Markdown
│   │   │   ├── inbox.ts              # Inicialización de carpeta Inbox
│   │   │   ├── templates.ts          # Sembrado y renderizado de plantillas
│   │   │   └── exportImport.ts       # Exportación/Importación JSON/MD
│   │   ├── domain/                   # Lógica pura de negocio (TypeScript puro)
│   │   │   ├── tree.ts               # Validación de movimientos y jerarquías
│   │   │   ├── merge.ts              # Resolución de conflictos en sincronización
│   │   │   ├── search.ts             # Indexador y buscador MiniSearch
│   │   │   ├── exportmd.ts           # Formateo y empaquetado Markdown
│   │   │   └── wikiLinks.ts          # Extracción y resolución de [[enlaces]]
│   │   ├── hooks/                    # Hooks reactivos (useNodes, usePWAUpdate, etc.)
│   │   ├── observability/            # Telemetría segura de Sentry
│   │   ├── pwa/                      # Persistencia y motor de sincronización PWA
│   │   ├── App.tsx                   # Componente raíz y orquestador del layout
│   │   ├── main.tsx                  # Punto de entrada de React
│   │   └── index.css                 # Sistema de diseño, temas y animaciones
│   ├── package.json                  # Dependencias y scripts
│   └── vite.config.ts                # Configuración de Vite, PWA y Workbox
├── openspec/                         # Especificaciones y control de cambios OpenSpec
│   ├── specs/                        # Especificaciones canónicas de capacidades
│   └── changes/                      # Historial de cambios y propuestas
└── README.md                         # Documentación general del proyecto
```

---

## 🚀 Guía de Inicio Rápido

### Requisitos Previos
- **Node.js**: v20.0.0 o superior
- **Gestor de paquetes**: `npm`, `pnpm` o `yarn`

### Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/nowis97/sindecon.git
   cd sindecon/app
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:5173/](http://localhost:5173/) en tu navegador.

4. **Ejecutar la suite de pruebas:**
   ```bash
   npm test
   ```

5. **Compilar para producción:**
   ```bash
   npm run build
   ```

---

## 🌐 Despliegue en Cloudflare Pages

El proyecto está 100% optimizado para desplegarse como sitio estático en **Cloudflare Pages**:

| Configuración | Valor |
| :--- | :--- |
| **Framework preset** | `Vite` |
| **Root directory** | `app` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Node.js version** | `20` o superior |

### Cabeceras HTTP de Cloudflare (`app/public/_headers`)
El archivo `_headers` se copia automáticamente a `dist/` en cada compilación:
```ini
/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
/registerSW.js
  Cache-Control: no-cache, no-store, must-revalidate
/manifest.webmanifest
  Cache-Control: no-cache, no-store, must-revalidate
/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

---

## 🔑 Variables de Entorno

Puedes crear un archivo `.env` en la raíz de `app/` para habilitar servicios opcionales:

```env
# Telemetría Sentry (Opcional)
VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0

# Google Drive Sync (Opcional - Para sincronización en la nube)
VITE_GOOGLE_CLIENT_ID=tu-cliente-id.apps.googleusercontent.com
```

---

## 🛠️ Comandos y Scripts

Desde la carpeta `app/`:

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo local con Hot Module Replacement (HMR). |
| `npm run build` | Valida TypeScript (`tsc -b`) y compila los assets optimizados en `dist/`. |
| `npm test` | Ejecuta la suite de pruebas unitarias y de dominio con Vitest. |
| `npm run test:e2e` | Ejecuta pruebas End-to-End en navegadores reales con Playwright. |
| `npm run lint` | Analiza el código con Oxlint para detectar errores y antipatrones. |
| `npm run preview` | Previsualiza localmente el build de producción antes de desplegar. |

---

## 🔒 Privacidad y Seguridad de Datos

- **Sin Servidor de Datos:** SINDECON no almacena notas en bases de datos remotas propias ni servidores de terceros.
- **Almacenamiento Aislado:** Todas las notas, carpetas y esquemas residen exclusivamente en el almacenamiento IndexedDB del navegador.
- **Sincronización Directa:** Si el usuario activa la sincronización con Google Drive, la conexión viaja de forma cifrada (HTTPS/TLS) directamente entre el navegador del usuario y los servidores de Google utilizando tokens OAuth 2.0 de corta duración.

---

## 📐 Metodología OpenSpec

El desarrollo de este proyecto se gestiona mediante el estándar de especificaciones **OpenSpec**, garantizando que cada nueva característica cuente con:
- `proposal.md`: Justificación, impacto y alcance.
- `specs/<capability>/spec.md`: Requisitos formales y escenarios de prueba (*Given/When/Then*).
- `design.md`: Decisiones arquitectónicas y análisis de riesgos.
- `tasks.md`: Plan detallado de implementación paso a paso.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

*Desarrollado con dedicación para apoyar la labor diaria de los profesionales de la salud.*
