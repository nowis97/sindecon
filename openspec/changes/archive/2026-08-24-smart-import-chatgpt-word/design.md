# Design: Asistente de Importación Inteligente (ChatGPT, IA y Word)

## Arquitectura de Transformación

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PIPELINE DE TRANSFORMACIÓN CLÍNICA                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   1. ENTRADA:                                                          │
│      - Texto plano / Markdown copiado de ChatGPT/Claude                │
│      - HTML del portapapeles con formato Word (MsoNormal, tags XML)    │
│      - Archivo binario .docx (ArrayBuffer / Blob)                      │
│                                                                        │
│   2. PARSING & SANITIZACIÓN (Local-First):                             │
│      - Si es .docx: mammoth.js / xml parser client-side -> HTML limpio │
│      - Si es HTML: TurndownService con reglas personalizadas de tablas │
│      - Limpieza de viñetas rotas (\uF0B7, ·), etiquetas basura y spans │
│                                                                        │
│   3. ENRIQUECIMIENTO CLÍNICO:                                          │
│      - Detección de patrones regex:                                    │
│        - "ADVERTENCIA: / OJO: / ALERTA: / RED FLAG:" -> > [!WARNING]   │
│        - "DOSIS: / POSOLOGÍA:"                       -> > [!DOSIS]     │
│        - "PERLA CLÍNICA: / TIP: / RECOMENDACIÓN:"   -> > [!TIP]       │
│        - "IMPORTANTE: / CRITERIO:"                   -> > [!IMPORTANT] │
│      - Detección y cierre de bloques Mermaid y KaTeX                   │
│                                                                        │
│   4. DESTINO & PERSISTENCIA EN INDEXEDDB:                              │
│      - Append: article.body_md + "\n\n" + importedContent              │
│      - Replace: saveArticle(article.id, importedContent)               │
│      - Create New: createNode() + saveArticle()                        │
│      - Inbox: createNode(parent=Inbox) + saveArticle()                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes

1. **`smartImport.ts` (Motor de Dominio):**
   - `cleanWordHtml(html: string): string`: Limpia fragmentos HTML pegados de Word y los convierte en Markdown.
   - `enrichClinicalMarkdown(markdown: string): string`: Detecta avisos, perlas y dosis y los transforma en callouts.
   - `extractSuggestedTitle(markdown: string): string`: Extrae el título principal del texto importado.
   - `parseDocxToMarkdown(file: File): Promise<string>`: Convierte archivos `.docx` utilizando `mammoth` en el navegador.

2. **`SmartImportModal.tsx` (Componente de UI):**
   - Pestañas o área única con switch entre *Texto pegado* y *Archivo Word*.
   - Vista previa con selector de modo de vista (Lector / Markdown crudo).
   - Selector de modo de destino con selector de carpeta (si es nuevo artículo).
   - Acciones de confirmación con feedback visual.

3. **Puntos de Lanzamiento:**
   - Botón `🪄 Importar` en la cabecera de artículos abiertos.
   - Command Palette: opción `🪄 Importar desde ChatGPT o Word`.
   - Botón en Dashboard.
