# Changelog

All notable changes to SINDECON are documented in this file.

## [1.3.0] - 2026-11-25

### Added
- **Autenticación con Google (`openid email profile`) Separada de Drive (`googleAuth.ts`, `/api/auth/google|session|logout`)**: Acceso directo con cuenta Google mediante cookie `HttpOnly` cifrada en `AES-256-GCM` (`sindecon_auth_session`), fallback transparente a GIS `initTokenClient` en desarrollo local sin Worker y activación opcional de respaldo en Google Drive desde dentro de la app (`SecuritySettingsModal` / `GoogleDriveModal`).
- **Llaves Biométricas / Passkeys FIDO2 WebAuthn (`webauthnCrypto.ts`, `fidoAuth.ts`, `/api/auth/fido/*`)**: Registro y desbloqueo biométrico híbrido online/offline con verificación criptográfica `ES256` (`P-256`) y `RS256` (`RSASSA-PKCS1-v1_5`), challenge de un uso vinculado en `/enroll` y `/verify`, y detección anti-clonación de `signCount` conforme a W3C WebAuthn.
- **PIN de Guardia con `PBKDF2-SHA256` y Bloqueo Exponencial (`pinAuth.ts`, `useAuth.ts`, `LoginView.tsx`, `SecuritySettingsModal.tsx`)**: Soporte de PIN de 4 o 6 dígitos (`150_000` iteraciones, salt aleatorio de 16 bytes, comparación constante), pausa exponencial persistente desde el 5.º intento fallido (`30s`→`2m`→`5m`→`15m`) espejada entre `localStorage` e IndexedDB (`db.meta`), migración de PIN legado y botón global **"Seguridad"** en `ClinicalStationHeader`.
- **Cobertura de Pruebas y E2E WebAuthn Virtual (`auth-fido-pin.spec.ts`)**: Nuevas suites unitarias y de Worker (`webauthnCrypto.test.ts`, `auth.test.ts`, `fido.test.ts`, `pinAuth.test.ts`, `fidoAuth.test.ts`, `googleAuth.test.ts`, `useAuth.test.ts`, `LoginView.test.ts`) más prueba E2E con autenticador virtual CDP `ctap2` en Chromium.

### Changed
- **Bloqueo Estricto al Configurar Protección (`auth.ts`, `LoginView.tsx`, `App.tsx`)**: Al definir un PIN personalizado o registrar una passkey FIDO2 (`protectionConfigured = true`), la pantalla de acceso oculta los accesos de demostración (`1234`, `Credenciales` y `Ingreso directo — Urgencias`), habilita recuperación vía Google exclusivamente para el `ownerEmail` vinculado o restablecimiento local explícito sin borrar notas clínicas, y evita el desbloqueo automático desde sesión pasiva cuando el terminal fue bloqueado.

## [1.2.5] - 2026-11-24

### Added
- **Exportación Masiva a PDF desde Selección Múltiple (`FolderExplorerView.tsx`, `BulkExportPdfModal.tsx`, `App.tsx`)**: Añadido el botón **`Exportar PDF`** en la barra flotante de selección por lote (junto a `Exportar (.md)`), visible en todos los tamaños de pantalla y conectado con el estado `bulkExportPdfSelectedIds` para abrir `BulkExportPdfModal` preseleccionado exactamente con los artículos marcados (`initialSelectedIds`).
- **Pruebas de Contrato y Preselección (`BulkExportPdfModal.test.ts`, `FolderExplorerView.test.ts`)**: Nuevos tests para prioridad de `initialSelectedIds` en `getInitialSelectedArticleIds` y firma `onBulkExportPdf(folderId, selectedIds?)`.

### Changed
- **Preservación de Selección en Dock, Menú `+` y Modal de Compendio (`FolderExplorerView.tsx`, `BulkExportPdfModal.tsx`)**: Unificación con `handleOpenBulkPdf` para que **`Compendio PDF`** del dock (visible desde `md`) o del menú `+` también conserve los artículos seleccionados cuando el modo selección está activo; además `BulkExportPdfModal` usa `lastOpenScopeRef` para no sobrescribir ajustes manuales dentro del modal y restablece filtros previos al abrir.

## [1.2.4] - 2026-11-24

### Added
- **Soporte Unificado de Nombres Propios y Corchetes en Perlas (`callouts.ts`, `callouts.test.ts`)**: Nuevo módulo compartido (`resolveBracketCallout`, `matchNaturalPearlParagraph`, `stripWrappingBrackets`, `normalizeCalloutMarkdownEscapes`) para preservar el nombre dado en todas sus variantes (`> [!PERLA] Nombre`, `> [!PERLA] [Nombre]`, `> [!PERLA: Nombre]`, `> [!Nombre]`, `> [!PERLA]\n> [Nombre]...`, `> [!PERLA]\n> **Nombre:** ...`, y párrafos naturales como `**Perla de ECG:** ...`), limpiando los corchetes externos sin afectar `[links](url)` ni `[[wikilinks]]`.
- **Cobertura End-to-End en Pruebas (`ArticleReader.test.ts`, `markdownGdocsParser.test.ts`, `smartImport.test.ts`, `cardExtractor.test.ts`, `FlashcardMarkdown.test.ts`)**: Nuevos tests para renderizado SSR de tarjetas con cabecera `💡`, listas internas, exportación Google Docs/Word, SmartImport y extracción/renderizado de flashcards con escapes de Milkdown (`\[!`).

### Changed
- **Tarjetas con Cabecera `💡 Nombre dado` y Listas Internas (`ArticleReader.tsx`, `index.css`)**: Las perlas con nombre propio se muestran con `.callout-header` (`💡` + título dado) y soporte de viñetas/listas numeradas (`renderCalloutBody`, estilos en pantalla e impresión), reservando el estilo inline compacto `Perla clínica:` únicamente como respaldo cuando no se especificó nombre.
- **Editor Orb, SmartImport, Docs y Flashcards (`ArticleWorkspaceView.tsx`, `smartImport.ts`, `markdownGdocsParser.ts`, `cardExtractor.ts`, `FlashcardMarkdown.tsx`)**: Actualización del snippet del Orb (`> [!PERLA] Nombre de la perla`), preservación de etiquetas propias al importar (`PERLA DE ECG:`, `PERLA [Criterio]:`, `CONSEJO:`, `RECOMENDACIÓN:`), paridad en exportación Word/Docs y reconocimiento de `[!PERLA]` en español en flashcards.

## [1.2.3] - 2026-11-23

### Added
- **Ruta de Retorno Jerárquica Destacada (`ClinicalBackTrail`)**: Nuevo componente compartido (`ClinicalBackTrail.tsx` y pruebas en `ClinicalBackTrail.test.ts`) que muestra botones de regreso visibles (`34px`) en orden explícito de salida: **`Artículo → [Subcarpeta(s) → Carpeta] → Página principal`** (`←`), destacando en color sólido el paso inmediato hacia atrás y separando el selector desplegable (`Explorar ▾` / `Cambiar especialidad ▾`).

### Changed
- **Cabecera y Dock Inferior en Artículos (`ArticleWorkspaceView.tsx`)**: Separación en dos franjas limpias para que títulos largos no oculten la ruta de retorno, más botón directo **`← Carpeta`** / **`← Inicio`** en el dock inferior `ClinicalBottomDock`.
- **Subcarpetas en Cadena (`FolderExplorerView.tsx`, `App.tsx`)**: Soporte multinivel completo de ancestros con botón directo a carpeta padre, carpetas superiores y `Página principal` (`onGoHome`).

## [1.2.2] - 2026-11-23

### Changed
- **Maquetación por Bandas en Lector A4 2 Columnas (`ArticleReader.tsx`, `index.css`)**: Reemplazo de `.a4-sheet-content` con altura congelada (`syncSheetHeights`) y `column-fill: auto` por bandas alternadas sin desborde horizontal: `.a4-sheet-flow-band` (`columns: 2; column-fill: balance`), `.a4-sheet-fullwidth-band` (mantiene encabezado introductorio e intro corta ≤ 320 caracteres junto a su Mermaid, tabla ≥ 3 cols o bloque `:::columns` y leyenda) y `.a4-sheet-solo-figure-band` (centrado de imágenes sueltas entre bloques anchos).
- **Figuras Atómicas (`AssetImage.tsx`, `ArticleReader.tsx`)**: Soporte nativo de `caption` como `<figcaption className="reader-caption">` dentro de `<figure className="reader-image-figure">` (`break-inside: avoid`) para que imagen y leyenda permanezcan inseparables entre columnas y hojas.
- **Paginación A4 y Contención Visual de Gráficos (`ArticleReader.tsx`, `MermaidViewer.tsx`, `index.css`)**: Cálculo de presupuesto doble (`2×`) en `paginateTwoColumnBlocks` para bloques `fullWidth`, límites verticales proporcionados en lectura de pantalla para imágenes (`290px`/`360px`) y diagramas Mermaid (`382px` en 2 columnas, `520px` en 1 columna y `calc(92vh - 92px)` en pantalla completa, liberando la altura al hacer zoom), además de `.reader-print-fullwidth-group` para `@media print`.

### Fixed
- **Desborde Horizontal y Solapamientos Asíncronos**: Eliminación completa de columnas fantasmas (antes `scrollWidth: 3384px` en Lector y `3577px` en Dividido) y solapamientos de imágenes sobre diagramas Mermaid / pie de página tras cargas asíncronas.
- **Estilos de Pantalla y Pantalla Completa para Mermaid**: Adición de reglas CSS para `.mermaid-viewport`, `.mermaid-svg-wrapper`, `.mermaid-loading`, `.mermaid-error`, `.mermaid-fullscreen-overlay` (cierre con `Escape` y clic exterior), e hidratación limpia sin `setState` síncrono en `AssetImage.tsx`.

## [1.2.1] - 2026-11-22

### Fixed
- **Altura de Modales en Escritorio (`tailwind.css`, `Dashboard.tsx`, `FolderExplorerView.tsx`)**: Se retiró `min-height: 100dvh` de la clase compartida `.clinical-home` (utilizada también por `DialogModal`, `QuickCapture`, `StudyModal`, `CommandPalette`, `UpdateToast` y el modal `Mover a carpeta` para heredar variables `--ch-*`) y se aplicó `min-h-dvh` exclusivamente al contenedor raíz de página en `Dashboard` y `FolderExplorerView`, evitando que `min-height: 100dvh` anulara `max-height: 90vh` en escritorio.

## [1.2.0] - 2026-11-22

### Added
- **Cabecera Global Compartida (`ClinicalStationHeader`)**: Componente único reutilizado entre `Dashboard` y `FolderExplorerView` con los controles globales consistentes (`Drive`, `Instalar App`, `Guardia UCI / Turno Día`, `Bloquear terminal`) y ranura izquierda contextual.
- **Contrato Ampliado en `FolderExplorerView.test.ts`**: Cobertura para props opcionales de estación unificada (`theme`, `dueFlashcardsCount`, `onOpenStudy`, `templates`, `onCreateFromTemplate`).

### Changed
- **Explorador de Carpeta Unificado con `Inicio` (0 px de salto de ancho)**: `FolderExplorerView` adopta el cascarón full-bleed (`main.content.content-dashboard-home`), el contenedor centrado `max-w-[1220px]` y la grilla asimétrica `1.58fr / 1fr` (`703px / 445px` a `1440×900`), neutralizando la caja heredada de `1080px` en `index.css` y `tailwind.css`.
- **Panel Derecho y Dock Inferior Consistentes**: Riel derecho de `445px` con tarjetas `Repaso Activo SM-2` (consulta indexada `useLiveQuery` sobre artículos de la carpeta con respaldo al mazo general), `Índice rápido`, `Filtrar Triage` sin recorte (`Crítico`, `Prioridad`, `Verificado`), etiquetas `#tag` y selector `Crear aquí desde plantilla (17)…`; barra inferior `ClinicalBottomDock` alineada en memoria muscular (`Inicio | Captura | SM-2` + orb `+` con selector expandible de plantillas + `Seleccionar | Importar IA | Subir PDF | Compendio PDF`).

### Fixed
- **Continuidad de Fondo en Vistas Cortas**: Regla `min-height: 100dvh` en `.clinical-home` (`tailwind.css`) para evitar el corte inferior de fondo en carpetas con pocos elementos en **Turno Día** y **Guardia UCI**.
- **Pureza React en Conteo SM-2**: Eliminación de `Date.now()` durante el renderizado en `FolderExplorerView` trasladando el cálculo de flashcards vencidas a `useLiveQuery`.

## [1.1.0] - 2026-11-22

### Added
- **Copiloto Clínico en 3 Pestañas (`ArticleCopilotRail`)**: Columna derecha contextual en `ArticleWorkspaceView` con pestañas **`Índice` | `SM-2 (N)` | `Triage`**, permitiendo repasar, voltear y calificar tarjetas SM-2 en vivo (`Otra vez`, `Difícil`, `Bueno`, `Fácil`) sin salir de la lectura A4.
- **Menú de Protocolo en Cabecera (`···`) y Selector Modal de Carpeta**: Acciones directas **`Mover a carpeta…`**, **`Duplicar protocolo`** (`handleDuplicateArticle` en `App.tsx`), **`Exportar Markdown (.md)`** y **`Eliminar protocolo`** sin abandonar el apunte.
- **Tira de Triage Unificado en `Dashboard` y Badges en `Ctrl+K`**: Filtros rápidos (`Todos`, `Inbox`, `Críticos`, `Prioridad`, `Verificados`) con cola inline, badges de estado en `Modificados recientemente`, carpetas expandidas y resultados de `CommandPalette`.
- **Utilitarios Compartidos (`clinicalMarks.ts` y `exportMarkdown.ts`)**: Consolidación única de lectura/escritura sincronizada de marcas clínicas (`CLINICAL_MARK_META`, filtros/conteos) y descarga Markdown (.md) con pruebas unitarias en `clinicalMarks.test.ts`.

### Changed
- **Dock Contextual y Selector Real de Plantillas (`Dashboard` y `ArticleWorkspaceView`)**: Reemplazo del botón duplicado `Crear` por acceso directo **`Inbox`**, apertura de las 17 plantillas reales en el cajón `+` del Dashboard, y menú contextual en el orb `+` del artículo (`Lector`: marcas 1-tap, flashcards, favoritos, columnas; `Editor`/`Dividido`: bloques clínicos Markdown).
- **Panel Derecho Accionable en Carpetas (`FolderExplorerView`) y Apertura a 1 Toque**: Reemplazo de la leyenda pasiva `"Marcas Clínicas (Menú ⋮)"` por filtros clicables de triage (`Crítico`, `Prioridad`, `Verificado`) y etiquetas de carpeta (`Etiquetas aquí`), además de botón explícito `Abrir carpeta` de 1 toque en los popovers de especialidad.

## [1.0.2] - 2026-11-22

### Changed
- **Dock Inferior Compartido (`ClinicalBottomDock`)**: Unificación de las barras inferiores de `Dashboard`, `FolderExplorerView` y `ArticleWorkspaceView` con grilla simétrica (`1fr auto 1fr`, `max-w 1080px`) para mantener el botón `+` exactamente centrado horizontal y verticalmente en escritorio y móvil.
- **Barra de Visor PDF (`PdfDocumentViewer`)**: Distribución en 3 columnas en escritorio (`md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`) para centrar los controles de zoom sin depender del ancho del título.

### Fixed
- **Estilos y Responsividad del Dock en Tailwind v4**: Reemplazo del bloque `@layer components` descartado en `tailwind.css` por utilidades directas, separación de `inline-flex` vs. `hidden sm:inline-flex` y ajuste de etiqueta `"Imprimir PDF"` (`hidden xl:inline`) eliminando barras de scroll horizontales y solapamientos en móvil.

## [1.0.1] - 2026-11-22

### Changed
- **Unificación Tipográfica `SINDECON Clínico`**: Carga de `Plus Jakarta Sans`, `Inter` y `JetBrains Mono` en `index.html`, mapeo de `--font-sans`, `--font-display`, `--font-mono` en Tailwind y `--font-main` en CSS, y reemplazo de `font-serif` y escalas heredadas de Milkdown Crepe (`Noto Serif` 42px) por encabezados y texto clínico consistentes entre Dashboard, Carpetas, Lector A4, Editor, Impresión y Modales.
- **Barras Inferiores Cohesivas (Ghost Pills)**: Estandarización del dock flotante inferior en `FolderExplorerView` y `ArticleWorkspaceView` con clases compartidas `.clinical-dock`, `.clinical-dock-btn` y `.clinical-dock-orb` (en `@layer components`), preservando la visibilidad adaptativa en móviles y añadiendo margen inferior (`pb-36 sm:pb-40`) para evitar solapamientos.
- **Encabezado y Tabla de Carpeta**: Alineación horizontal de filtros clínicos y selector `Orden:` en una sola fila en escritorio, y reemplazo de `⋮` visible por texto accesible en cabecera de tabla.

### Fixed
- **Contraste en Modo Oscuro (`Guardia UCI`)**: Separación entre `--ch-accent-solid` (`#0f766e` para botones primarios con texto blanco) y `--ch-accent` (`#2dd4bf` para pestañas activas, iconos, enlaces y bordes en tema oscuro), además de mejor contraste en botones deshabilitados y badge de cabecera de `Dashboard`.
- **Diagramas Mermaid dentro de Hoja A4 en Modo Oscuro**: Conservación de superficie y tinta claras dentro de `.a4-sheet .mermaid-viewer-card` y `.mermaid-tag` para que `"Algoritmo / Esquema"` permanezca legible sobre la ficha blanca A4.
- **Hidratación Limpia en Editor y Copy Coherente**: Ajuste de `isArticleReady` en `App.tsx` para esperar la carga del artículo seleccionado antes de montar `MarkdownEditor`, localización de placeholder de Crepe al español, soporte de tema oscuro para Crepe (`--crepe-color-*`) y corrección de texto `"Editar"` -> `"Editor"` en `ArticleReader.tsx`.

## [1.0.0] - 2026-11-22

### Added
- **Estación Clínica SINDECON v1.0 (`SINDECON Clínico`)**: Nuevo panel principal en dos columnas (`Dashboard`) con repositorio filtrable, tarjeta de repaso SM-2, acceso rápido a plantillas y dock inferior flotante.
- **Espacio de Artículo sin Barra Lateral Fija**: Nuevo componente `ArticleWorkspaceView` con selector desplegable superior de carpetas/protocolos, barra de herramientas deduplicada, cajón flotante de bloques clínicos e índice contextual lateral.
- **Explorador de Carpeta Clínica**: Vista interior rediseñada en `FolderExplorerView` con búsqueda en vivo, índice compacto de protocolos y selector de marca clínica rápida.
- **Shell Compartida de Modales y Toasts (`BaseModal`)**: Contenedor unificado con cápsulas de bordes `22px`, botones píldora (`PILL_BTN_PRIMARY`, `PILL_BTN_SECONDARY`, `PILL_BTN_DANGER`), campos unificados e íconos vectoriales de Lucide en `DialogModal.tsx`.
- **Persistencia de Marcas Clínicas**: Guardado dual en `localStorage` + IndexedDB (`db.meta['clinical_marks']`) y respaldo automático/restauración tolerante a fallos en archivos `_clinical_marks.json` dentro de exportaciones ZIP.

### Changed
- **Unificación Visual Integral (Dirección A)**: Migración de todos los modales, diálogos, toasts, selector `[[Wiki-link]]`, captura rápida y barras del visor PDF/Mermaid a `SINDECON Clínico` (`clinical-home`) con temas claro y oscuro coherentes.
- **Botones y Controles Consistentes**: Eliminación de emojis crudos en títulos de diálogos, toasts, vista previa de flashcards, breadcrumbs, visor PDF y barra de navegación móvil, sustituidos por iconografía Lucide uniforme.

### Fixed
- **Resiliencia en Backup ZIP de Marcas Clínicas**: Sanitización segura al leer y restaurar marcas clínicas desde `localStorage` o `_clinical_marks.json`, evitando fallos de exportación/importación ante JSON corrupto o estructuras no tabulares.
- **Integración OAuth y Estado de Sincronización en UI**: Unificación del indicador de estado pendiente (`Pendiente`, `Última consulta`, reintento con refresco silencioso BFF y fix en `getDefaultGoogleClientId` para respetar overrides vacíos en `VITE_GOOGLE_CLIENT_ID`).
- **Contrato de Importación Masiva**: Corrección de propiedades pasadas a `importBulkArticles` en `BulkImportModal.tsx`.
