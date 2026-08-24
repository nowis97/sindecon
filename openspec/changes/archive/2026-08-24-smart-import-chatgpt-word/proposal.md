# Propuesta: Asistente de Importación Inteligente (ChatGPT, IA, Word .docx y Enriquecimiento de Artículos)

## Why

Los profesionales médicos y estudiantes recopilan y sintetizan información clínica de múltiples fuentes: resúmenes generados con asistentes de IA (**ChatGPT, Claude, Gemini**), guías de práctica clínica en formato **Microsoft Word (`.docx`)**, tablas de dosificación y documentos enriquecidos.

Actualmente, pegar texto de Microsoft Word o ChatGPT en un editor web produce inconsistencias de formato (estilos propietarios `mso-*` de Word que rompen la maquetación, o tablas y callouts de ChatGPT que requieren formateo manual). Además, no existe un flujo directo para importar contenido externo o archivos directamente **dentro de un artículo existente** para expandirlo o actualizarlo.

Esta propuesta introduce el **Asistente de Importación Inteligente (`SmartImportModal`)** y utilidades de transformación clínica *Local-First* en el navegador:
1. Limpieza y conversión automática de HTML de Word / Rich Text a Markdown limpio y tablas estructuradas.
2. Detección automática de Callouts clínicos (`> [!DOSIS]`, `> [!WARNING]`, etc.) y bloques Mermaid de IA.
3. Compatibilidad con importación de archivos `.docx`, `.md` y `.txt`.
4. Destinos flexibles: **Añadir al final del artículo actual**, **Reemplazar artículo actual**, **Crear nuevo artículo** o **Guardar en Inbox**.

## What Changes

- **Motor de Transformación y Sanitización Clínica (`src/domain/smartImport.ts`):**
  - Sanitizador de HTML de Word que elimina etiquetas XML/Mso y convierte a Markdown estándar con tablas limpias.
  - Conversor de bloques de advertencias, notas de dosis y perlas clínicas en Callouts estructurados (`[!WARNING]`, `[!DOSIS]`, `[!TIP]`).
  - Extractor de metadatos (título sugerido a partir del primer H1/H2 o primera línea en negrita).
  - Parser local de archivos Word `.docx` a Markdown en el navegador (100% del lado del cliente, sin servidores).
- **Asistente de Importación Modal (`SmartImportModal.tsx`):**
  - Área de texto para pegar libremente respuestas de ChatGPT o texto enriquecido.
  - Selector y zona *Drag & Drop* para archivos `.docx`, `.md` o `.txt`.
  - Vista previa en tiempo real renderizada antes de aplicar.
  - Opciones de destino contextuales:
    - Si un artículo está abierto: *"➕ Añadir al final del artículo actual"*, *"🔄 Reemplazar contenido"* o *"📄 Crear nuevo artículo"*.
    - Si estás en el Dashboard: *"📄 Crear nuevo artículo"* o *"📥 Enviar a Inbox"*.
- **Puntos de Integración en la Interfaz:**
  - Botón **`🪄 Importar`** en la cabecera y barra de herramientas de los artículos.
  - Acción rápida en la Command Palette (`Ctrl+K`).
  - Botón de acceso rápido en el Dashboard.

## Capabilities

### Modified Capabilities
- `content-editing`: Incorporación de importación inteligente de texto y documentos Word a artículos existentes o nuevos, con detección de tablas, callouts y diagramas.

## Impact
- **Nuevos archivos:** `src/domain/smartImport.ts`, `src/domain/smartImport.test.ts`, `src/components/editor/SmartImportModal.tsx`.
- **Archivos modificados:** `src/App.tsx`, `src/components/search/CommandPalette.tsx`, `src/components/dashboard/Dashboard.tsx`, `src/index.css`.
- **Pruebas:** Cobertura de tests unitarios para conversión de Word/ChatGPT a Markdown y tests E2E en Playwright.
