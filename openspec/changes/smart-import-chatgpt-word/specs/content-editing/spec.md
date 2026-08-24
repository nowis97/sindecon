# content-editing (Delta Spec: Importación Inteligente de ChatGPT y Word)

## ADDED REQUIREMENTS

### REQ-CE-005: Importación y Sanitización Inteligente de Contenido Externo
El sistema DEBE proveer un asistente de importación que procese texto pegado desde ChatGPT/IA, documentos Word (`.docx`) y texto enriquecido, convirtiéndolos en Markdown clínico estandarizado.

#### Scenario: Pegar y formatear respuesta de ChatGPT con tablas y advertencias
- **GIVEN** que el usuario copia una respuesta de ChatGPT con tablas, diagramas Mermaid y advertencias clínicas
- **WHEN** abre el Asistente de Importación y pega el contenido
- **THEN** el sistema DEBE generar una vista previa limpia en Markdown preservando la estructura de las tablas, los diagramas Mermaid y convirtiendo advertencias a callouts visuales (`> [!WARNING]`, `> [!DOSIS]`).

#### Scenario: Importar dentro de un artículo existente
- **GIVEN** que el usuario está visualizando o editando un artículo existente
- **WHEN** importa un fragmento de texto o tabla mediante el asistente
- **THEN** el sistema DEBE permitir elegir entre:
  1. Anexar el contenido al final del artículo actual con salto de sección.
  2. Reemplazar el contenido del artículo actual.
  3. Crear un nuevo artículo independiente.

#### Scenario: Importación de archivo Microsoft Word (.docx)
- **GIVEN** que el usuario selecciona o arrastra un archivo `.docx`
- **WHEN** el sistema procesa el documento en el navegador (Local-First)
- **THEN** el sistema DEBE extraer los encabezados, párrafos, listas y tablas sin estilos propietarios de Word y sugerir el nombre del archivo como título.
