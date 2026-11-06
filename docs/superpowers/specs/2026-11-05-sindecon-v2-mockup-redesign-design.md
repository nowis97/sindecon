# Especificación de Diseño: SINDECON V2 — Rediseño Basado en Mockup, Tailwind CSS v4 e Isotipo de Vitruvio

- **Fecha:** 2026-11-05
- **Estado:** Validado / Listo para Revisión
- **Autor:** Antigravity (Pair Programming) & Usuario

---

## 1. Contexto y Objetivos del Proyecto

El usuario ha proporcionado un mockup en PDF de 3 páginas que define una nueva estructura visual y de navegación para **SINDECON** (Sistema de Información y Notas para Decisiones Clínicas), junto con un boceto del Hombre de Vitruvio de Leonardo da Vinci para utilizar como nuevo isotipo y logo de la aplicación.

### Objetivos Principales:
1. **Implementar SINDECON V2 en el mismo repositorio pero de forma modular y separada**, permitiendo al usuario alternar libremente entre la versión clásica (V1) y la nueva versión (V2) con un solo clic.
2. **Adoptar Tailwind CSS v4** para la capa visual de V2, garantizando un diseño limpio, moderno, clínico y de alto rendimiento sin colisionar con los estilos heredados de V1.
3. **Limpiar y vectorizar el Hombre de Vitruvio**, eliminando la textura de papel antiguo y la marca de agua de Adobe Stock, convirtiéndolo en un isotipo SVG monocromático moderno y responsivo para el branding, cabecera y favicon.
4. **Implementar con fidelidad las 3 pantallas del mockup:**
   - **Página 1:** Portada / Inicio de sesión, integración de cuenta y bandeja de 6 lanzadores clínicos y académicos (Drive, ChatGPT, Outlook, Canvas, Mi Currículum, Gmail).
   - **Página 2:** "Mi Repositorio" con saludo personalizado, estado de Google Drive, lista de carpetas clínicas, buscador y barra inferior con botón central circular (FAB).
   - **Página 3:** Vista de detalle de carpeta con listado de notas (Título, Fecha de Creación, Etiquetas, Acciones), panel lateral de búsqueda/filtros, menú contextual desplegable con las 7 acciones especificadas (`Eliminar`, `Mover A`, `Exportar -> Editor`, `Imprimir`, `Etiqueta`, `Seleccionar`, `Marcar`) y barra inferior con FAB.

---

## 2. Decisiones de Arquitectura

| Dimensión | Decisión | Justificación |
| :--- | :--- | :--- |
| **Ubicación del Código** | `app/src/v2/` | Mantiene el código dentro del mismo proyecto compartiendo dependencias y tipos, pero estrictamente modularizado. |
| **Motor de Estilos** | **Tailwind CSS v4** (`@tailwindcss/vite`) | Utiliza la última versión de Tailwind con imports `@import "tailwindcss";` y arquitectura de capas `@theme`. Se aísla bajo `.sindecon-v2` para no afectar a V1. |
| **Mecanismo de Alternancia** | Switcher reactivo en `localStorage` (`sindecon_ui_version: 'v1' \| 'v2'`) | Permite pasar de V1 a V2 (y viceversa) instantáneamente sin recarga de página, manteniendo el estado de la PWA. |
| **Base de Datos** | Compartida 1:1 en IndexedDB (Dexie) | Cero duplicación. Tanto V1 como V2 consultan y modifican las mismas tablas (`nodes`, `articles`, `templates`). |
| **Reactividad** | `useLiveQuery` de `dexie-react-hooks` | Toda creación, edición o borrado de carpetas y notas se refleja en tiempo real en la UI. |
| **Autenticación / Sesión** | Perfil local + Reutilización de Google Drive | Modo offline-first por defecto; si el usuario conecta Google Drive (usando `pwa/googleDrive.ts`), se extrae automáticamente su correo y nombre para el saludo. |
| **Lanzador de Herramientas** | Hub de enlaces directos configurables | Abre herramientas médicas y académicas en nueva pestaña, con URLs predeterminadas y posibilidad de personalización. |
| **Editor Clínico** | Reutilización de Milkdown Crepe (V1) | Permite editar notas con fórmulas KaTeX, árboles Mermaid y plantillas médicas sin reescribir el editor WYSIWYG. |

---

## 3. Identidad Visual e Isotipo: Hombre de Vitruvio

1. **Procesamiento del Gráfico:**
   - Vectorización y limpieza del boceto anatómico de Da Vinci.
   - Eliminación del fondo de papel pergamino marrón y de la marca de agua `Adobe Stock | #10875137`.
   - Conversión a gráfico vectorial SVG escalable (`<svg>`) con trazos nítidos.
2. **Componente `VitruvianLogo.tsx`:**
   - Admite propiedades de tamaño (`size`), clase CSS (`className`) y color adaptativo (`currentColor`).
   - Se adapta automáticamente al modo claro (tinta gris pizarra/azul petróleo) y modo oscuro (blanco/cian médico).
3. **Favicon y PWA:**
   - Generación de `favicon.svg` y actualización del icono de la PWA en `public/`.

---

## 4. Especificación Detallada de Vistas y Componentes

### 4.1. Portada y Lanzador (`LandingView.tsx` — Página 1 del Mockup)

* **Encabezado y Marca:**
  - Logotipo del Hombre de Vitruvio + tipografía refinada `SINDECON`.
  - Subtítulo: *Cuaderno Médico y Repositorio Clínico*.
* **Formulario de Acceso:**
  - Campo `Usuario`: Permite ingresar el nombre del profesional (ej. "Dr. Gómez"). Se guarda en `localStorage` (`sindecon_user_name`).
  - Campo `Contraseña`: Entrada protegida para PIN de privacidad local opcional.
  - Botón *"Conectar con Google Drive"*: Dispara el flujo OAuth de Google Drive ya implementado en `googleDrive.ts`.
  - Botón principal *"Entrar al Repositorio"*: Valida y transiciona a `RepositoryView`.
* **Bandeja de Lanzadores Clínicos y Académicos:**
  - Cuadrícula de 6 tarjetas interactivas con iconos estilizados:
    1. **Google Drive:** `https://drive.google.com` (o sincronización de respaldo).
    2. **ChatGPT:** `https://chatgpt.com` (apoyo para síntesis clínica).
    3. **Outlook:** `https://outlook.office.com` (correo hospitalario / institucional).
    4. **Canvas:** `https://canvas.instructure.com` (plataforma docente / académica).
    5. **Mi Currículum:** Portal de desarrollo profesional / CV médico.
    6. **Gmail:** `https://mail.google.com`.
  - Cada tarjeta incluye efecto hover con Tailwind v4 y apertura segura en nueva pestaña (`target="_blank" rel="noopener noreferrer"`).
  - Selector en la esquina para alternar a *"Vista Clásica V1"*.

---

### 4.2. "Mi Repositorio" (`RepositoryView.tsx` — Página 2 del Mockup)

* **Barra Superior:**
  - Saludo: `¡Hola [Nombre de Usuario]!` (tomado del perfil local o de la cuenta Google conectada).
  - Indicador de estado de **Drive** (conectado/sincronizado o botón para conectar) en la esquina superior derecha.
  - Botón para cambiar a *"Vista Clásica V1"*.
* **Barra de Búsqueda Global:**
  - Input con icono de lupa (`🔍 Buscar`) conectado al motor en memoria `MiniSearch`.
  - Filtra instantáneamente carpetas y contenidos.
* **Listado de Carpetas ("Mi Repositorio"):**
  - Consulta en tiempo real las carpetas de nivel superior (`nodes` donde `parent_id === null && kind === 'folder'`).
  - Muestra tarjetas o filas interactivas con:
    - Icono de carpeta estilizado.
    - Título de la carpeta.
    - Contador de notas que contiene.
    - Fecha de última modificación.
  - Al hacer clic en una carpeta, se abre `FolderDetailView`.
* **Barra Inferior con Botón FAB (`---( O )---`):**
  - Barra de navegación fija con efecto translúcido.
  - Botón central circular prominente (`+`):
    - Al hacer clic, abre un menú flotante para:
      - 📁 *Nueva Carpeta* (solicita nombre y la crea en IndexedDB).
      - 📄 *Nueva Nota Médica* (permite crear nota en blanco o seleccionar plantilla).

---

### 4.3. Detalle de Carpeta y Acciones de Notas (`FolderDetailView.tsx` — Página 3 del Mockup)

* **Cabecera de Carpeta:**
  - Botón de retorno: `← Volver a Mi Repositorio`.
  - Icono de carpeta + Título de la carpeta actual.
  - Contador de notas activas.
* **Tabla / Lista de Notas Clínicas:**
  - **Columnas:**
    1. **Documento / Título:** Icono de nota + Título clínico. Al hacer clic, abre el editor.
    2. **Fecha Creación:** Fecha legible (ej. *05 Nov 2026, 14:30*).
    3. **Etiqueta:** Chips/badges redondeados para los tags asociados (`#urgencias`, `#cardiologia`).
    4. **Acciones (`···`):** Botón para desplegar el menú contextual inteligente.
* **Menú Contextual Inteligente (`···`):**
  - Implementa exactamente las opciones del mockup:
    1. 🗑️ **Eliminar:** Envía la nota a papelera o eliminación definitiva con confirmación.
    2. 📂 **Mover A:** Abre modal con árbol de carpetas para trasladar la nota.
    3. 📝 **Exportar -> Editor:** Abre la nota en el editor clínico de SINDECON.
    4. 🖨️ **Imprimir:** Dispara la impresión médica en 2 columnas estilo ficha de bolsillo.
    5. 🏷️ **Etiqueta:** Modal/popover para añadir o remover etiquetas.
    6. ☑️ **Seleccionar:** Marca la nota en modo selección múltiple.
    7. 🚩 **Marcar:** Asigna un indicador de estado visual:
       - ▲ *Urgente / Prioritario* (triángulo ámbar/rojo).
       - ● *En Proceso / Pendiente* (círculo azul/teal).
       - ■ *Completado / Validado* (cuadrado verde).
* **Panel Lateral / Buscador de Carpeta:**
  - Campo de búsqueda contextual para filtrar las notas de la carpeta actual.
  - Filtro rápido por etiquetas presentes en la carpeta.
* **Barra Inferior con FAB:**
  - Permite crear rápidamente una nueva nota dentro de la carpeta actual con un solo toque en el botón central `+`.

---

### 4.4. Integración del Editor Clínico (`EditorView.tsx`)

* Reutiliza la suite de edición clínica de SINDECON:
  - Soporte completo Markdown GFM.
  - Fórmulas matemáticas y de dosificación vía KaTeX.
  - Diagramas y árboles de decisión clínica vía Mermaid.
  - Inserción de plantillas preconfiguradas (SOAP, Epicrisis, Ingreso Urgencias).
* Botón de cabecera *"← Volver a la Carpeta"* para regresar fluidamente a `FolderDetailView`.

---

## 5. Estructura de Archivos del Proyecto

```text
app/
├── src/
│   ├── v2/
│   │   ├── components/
│   │   │   ├── VitruvianLogo.tsx          # Isotipo vectorial del Hombre de Vitruvio
│   │   │   ├── VersionSwitcher.tsx        # Botón para alternar entre V1 y V2
│   │   │   ├── BottomNav.tsx              # Barra inferior fija con FAB central (---( O )---)
│   │   │   ├── QuickLauncherGrid.tsx      # Los 6 lanzadores (Drive, ChatGPT, Outlook, etc.)
│   │   │   ├── NoteContextMenu.tsx        # Menú contextual desplegable con las 7 acciones
│   │   │   └── CreateItemModal.tsx        # Modal de creación rápida (Carpeta / Nota)
│   │   ├── views/
│   │   │   ├── LandingView.tsx            # Página 1 del Mockup (Login + Lanzadores)
│   │   │   ├── RepositoryView.tsx         # Página 2 del Mockup (Mi Repositorio + Carpetas)
│   │   │   └── FolderDetailView.tsx       # Página 3 del Mockup (Tabla de Notas + Acciones)
│   │   ├── styles/
│   │   │   └── v2.css                     # Configuración de Tailwind CSS v4 para V2
│   │   └── V2App.tsx                      # Componente raíz orquestador de V2
│   ├── App.tsx                            # Selector raíz que renderiza V1 o V2App
│   ├── db/                                # Base de datos Dexie compartida (existente)
│   └── pwa/                               # Módulos PWA y Google Drive (existente)
```

---

## 6. Pruebas y Criterios de Aceptación

1. **Aislamiento y Switcher:**
   - El usuario puede alternar entre V1 y V2 en cualquier momento sin recargar la página.
   - El estado de la versión activa persiste en `localStorage`.
   - Los estilos de Tailwind v4 en V2 no alteran los estilos visuales de V1.
2. **Persistencia e IndexedDB:**
   - Una carpeta o nota creada en V2 aparece inmediatamente en V1 y viceversa.
   - El cuerpo de la nota se guarda correctamente en la tabla `articles`.
3. **Fidelidad al Mockup:**
   - **Página 1:** Formulario de usuario/clave funcional, conexión con Google Drive y 6 lanzadores accesibles.
   - **Página 2:** Saludo personalizado, estado de Drive en cabecera, listado de carpetas, búsqueda y botón FAB inferior funcional.
   - **Página 3:** Listado de notas con columnas correctas, panel de búsqueda/etiquetas a la derecha, menú contextual con las 7 acciones y apertura en editor clínico.
4. **Isotipo de Vitruvio:**
   - Renderizado vectorial nítido sin marcas de agua ni fondos de papel, adaptable a tema claro y oscuro.
5. **Calidad de Código:**
   - `tsc -b` compila sin errores.
   - `oxlint` valida sin advertencias.
   - Pruebas unitarias en Vitest pasando al 100%.
