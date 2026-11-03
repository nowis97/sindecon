# Especificación de Diseño: Exportación Directa de Markdown y Mermaid a Google Docs con Estilo Clínico SINDECON

- **Fecha:** 2026-11-03
- **Estado:** Validado / Listo para Plan de Implementación
- **Autor:** Antigravity (Pair Programming) & Usuario

---

## 1. Contexto y Problema Clínico

Los profesionales de la salud utilizan ChatGPT para resumir literatura médica, sintetizar guías clínicas y generar esquemas diagnósticos y terapéuticos en formato Markdown. Con frecuencia, estos resúmenes incluyen diagramas de decisión clínica en formato `mermaid`, tablas de dosificación y alertas farmacológicas.

### Problema
1. Google Docs **no soporta Markdown al pegar** (lo pega como texto plano sin formato).
2. Google Docs **carece de motor para interpretar bloques `mermaid`** (los deja como código plano).
3. El cliente trabaja en **tablets Android**, donde Google Chrome bloquea extensiones de navegador y se utiliza la aplicación oficial nativa de Google Docs.
4. El cliente exige que el resultado en Google Docs conserve **la identidad visual y maquetación clínica exacta de SINDECON** (encabezado médico, colores Teal `#008080`, callouts y tablas).

### Solución
Integrar en SINDECON un motor de exportación directo que:
1. Renderice en el dispositivo (100% privado) los diagramas Mermaid a imágenes PNG de alta resolución (2x/3x).
2. Construya un documento estructurado en memoria con la identidad visual clínica de SINDECON.
3. Suba el documento a Google Drive mediante la API multipart con conversión automática a Google Doc (`application/vnd.google-apps.document`).
4. Proporcione un enlace directo para abrir el documento de inmediato en la app nativa de Google Docs en la tablet.

---

## 2. Decisiones de Arquitectura

| Dimensión | Decisión | Justificación |
| :--- | :--- | :--- |
| **Punto de Ejecución** | 100% en el cliente (Browser / PWA) | Preserva privacidad médica (cero servidores externos procesando notas clínicas). |
| **Formato Intermedio** | Paquete DOCX en memoria (`docx` + `jszip`) | Google Drive convierte DOCX a Google Docs con 100% de fidelidad, incrustando imágenes locales sin requerir URLs públicas de internet. |
| **Scope OAuth** | `https://www.googleapis.com/auth/drive.file` | Permite crear y gestionar archivos generados por la app; seguro, no invasivo y visible en Google Drive normal. |
| **Resolución Mermaid** | Canvas offscreen con escala Retina 2x / 3x | Evita diagramas borrosos o pixelados al verse en pantallas de alta densidad o imprimirse. |
| **Resiliencia Mermaid** | Degradación elegante a bloque de código | Si ChatGPT genera sintaxis Mermaid con errores, no se aborta la exportación del documento; el bloque se preserva como texto clínico. |
| **Modo Offline** | Descarga local directa de `.docx` | Si no hay conexión (sótanos/guardia), el médico puede descargar el archivo estilizado localmente. |

---

## 3. Puntos de Integración en la Interfaz de Usuario (UI)

### 3.1. Importador Inteligente (`SmartImportModal.tsx`)
* **Ubicación:** Selector de destinos al pegar texto de ChatGPT.
* **Opciones disponibles:**
  * Añadir a nota actual
  * Reemplazar nota actual
  * Crear nueva nota
  * Guardar en Inbox
  * **`📄 Exportar a Google Docs`** (Nuevo destino)
* **Acción:** Botón principal *"Generar Google Doc"*.

### 3.2. Visor de Artículo Clínico (`ArticleReader.tsx`)
* **Ubicación:** Barra de herramientas superior del artículo, contiguo al botón actual `🖨️ PDF`.
* **Botón:** `📄 Google Docs` (icono y tooltip descriptivo).
* **Acción:** Exporta el artículo activo actual directamente a Google Docs manteniendo su ruta de carpetas y metadatos.

### 3.3. Modal de Progreso y Resultado (`GoogleDocsExportModal.tsx`)
* **Estados visuales:**
  1. *Procesando:* Indicador de pasos ("Renderizando diagramas..." → "Generando documento..." → "Subiendo a Google Drive...").
  2. *Éxito:* Botón destacado **`Abrir en Google Docs ↗`** que lanza la app nativa en Android o una nueva pestaña en escritorio.
  3. *Error / Offline:* Mensaje explicativo y botón secundario **`💾 Descargar archivo .docx`**.

---

## 4. Sistema de Diseño Clínico SINDECON en Google Docs

El documento generado implementa fielmente los tokens de estilo de SINDECON (`app/src/index.css`):

1. **Encabezado Médico:**
   * Cintillo superior: `SINDECON • CUADERNO MÉDICO` (Fuente en negrita, mayúsculas, color Teal `#008080`) con fecha actual alineada a la derecha.
   * Título del artículo: Tipografía grande (18pt, bold, color `#0f172a`).
   * Breadcrumb: Ruta jerárquica de la carpeta clínica (ej: `📁 Urgencias / Cardiología`, color `#475569`, 9pt).
   * Etiquetas (*tags*): Formateadas como insignias o texto destacado (`#334155`).
   * Separador: Línea divisoria sólida de 2pt en color `#008080`.

2. **Tipografía y Jerarquía:**
   * **H1:** 14pt, color `#008080` (Teal), con borde inferior de acento.
   * **H2:** 12pt, color `#008080` (Teal), espacio superior adecuado.
   * **H3:** 10.5pt, color `#0f766e` (Teal oscuro).
   * **Cuerpo:** 9.5pt / 10pt, interlineado compacto y legible, color Slate oscuro `#1e293b`.

3. **Cajas de Alerta Clínica (Callouts):**
   * Alertas/Warning (`[!WARNING]`): Borde izquierdo naranja/ámbar (`#d97706`), fondo suave.
   * Dosificación (`[!DOSAGE]`): Borde izquierdo morado/azul (`#2563eb`), fondo suave.
   * Notas/Tips (`[!NOTE]`, `[!TIP]`): Borde izquierdo Teal (`#0d9488`), fondo suave.

4. **Tablas Clínicas:**
   * Cabecera con fondo gris azulado suave (`#f1f5f9`), texto en negrita (`#0f172a`), bordes sutiles (`#cbd5e1`).

5. **Diagramas Mermaid:**
   * Imágenes PNG centradas, con ancho máximo acotado al área imprimible (6.5 pulgadas / 16.5 cm) para evitar desbordes en páginas A4/Carta.

---

## 5. Arquitectura de Módulos y Flujo de Datos

### 5.1. Flujo de Datos
```
[Entrada Markdown (ChatGPT / Nota)]
                │
                ▼
   gdocsExporter.parseMarkdownToAst()
                │
        ┌───────┴────────────────────────┐
        ▼                                ▼
[Bloques Estándar]               [Bloques Mermaid]
(Títulos, Tablas, Callouts)              │
        │                                ▼
        │                 mermaidRenderer.renderToPngBlob()
        │                 (Canvas offscreen a escala 2.5x)
        │                                │
        └───────────────┬────────────────┘
                        ▼
          docxBuilder.buildClinicalDocx()
          (Construye el archivo DOCX con estilos SINDECON)
                        │
                        ▼
                   Blob binario
                        │
      ┌─────────────────┴──────────────────┐
      ▼ (Online)                           ▼ (Offline / Error)
googleDriveService.uploadToGoogleDocs()   Descarga local .docx
      │
      ▼
URL: docs.google.com/document/d/{fileId}/edit
(Abre app nativa en Tablet Android)
```

### 5.2. Archivos y Módulos Nuevos / Modificados

1. **`app/src/domain/gdocsExporter.ts` (Nuevo):**
   * Extracción de bloques de texto y diagramas.
   * Integración con `mermaid` para renderizado a canvas y PNG blob.
   * Construcción del documento `.docx` respetando los tokens de diseño clínico.

2. **`app/src/pwa/googleDrive.ts` (Modificado):**
   * Incorporación del scope `https://www.googleapis.com/auth/drive.file`.
   * Función `uploadDocxAsGoogleDoc(blob: Blob, fileName: string): Promise<{ id: string; url: string }>`.
   * Construcción de petición multipart (`multipart/related`) con metadatos JSON y payload binario.

3. **`app/src/components/portability/GoogleDocsExportModal.tsx` (Nuevo):**
   * Modal de interacción, progreso y apertura de Google Docs.

4. **`app/src/components/editor/SmartImportModal.tsx` (Modificado):**
   * Inclusión de opción "Exportar a Google Docs" en los destinos de importación.

5. **`app/src/components/reader/ArticleReader.tsx` y `app/src/App.tsx` (Modificados):**
   * Botón `📄 Google Docs` en barra de acciones del artículo activo.

---

## 6. Estrategia de Pruebas y Criterios de Aceptación

### 6.1. Pruebas Unitarias (Vitest)
* `gdocsExporter.test.ts`:
  * Mapeo correcto de H1, H2, listas y tablas a elementos DOCX.
  * Preservación de bloques Mermaid válidos y extracción de errores en sintaxis inválida sin lanzar excepciones fatales.
  * Formateo correcto de callouts médicos clínicos.
* `googleDrive.test.ts`:
  * Validación del formato de carga multipart (límite boundary, encabezado `application/vnd.google-apps.document`).

### 6.2. Criterios de Aceptación Clínicos
1. El documento en Google Docs muestra el cintillo `SINDECON • CUADERNO MÉDICO` y títulos en color Teal `#008080`.
2. Los diagramas Mermaid de ChatGPT se visualizan como imágenes nítidas (sin pixelado en zoom ni en pantallas Retina).
3. En tablet Android, pulsar el enlace abre la aplicación Google Docs instalada sin errores de navegador.
4. En modo sin conexión, el sistema permite descargar el `.docx` estilizado sin trabarse.
