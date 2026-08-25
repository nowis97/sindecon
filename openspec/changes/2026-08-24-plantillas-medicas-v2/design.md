# Diseño: Plantillas Médicas Maestras v2 y Maquetación a 2 Columnas

## Arquitectura de Plantillas y Base de Datos

### 1. Definición de las 11 Plantillas Maestras
En `src/db/templates.ts`, la constante `TEMPLATES` contendrá las 11 plantillas con sus secciones tipadas (`text`, `table`, `algorithm`, `list`):

1. **Patología / Enfermedad**: 12 secciones (Definición, Epidemiología, Etiología y factores de riesgo, Fisiopatología, Clasificación, Manifestaciones clínicas, Diagnóstico, Diagnóstico diferencial, Tratamiento [tabla], Complicaciones, Pronóstico y seguimiento, Perlas clínicas [lista]).
2. **Síndrome clínico / Diagnóstico sindromático**: 11 secciones (Definición, Mecanismo fisiopatológico, Etiologías principales, Manifestaciones clínicas, Semiología y examen físico, Hallazgos característicos, Exámenes orientadores, Diagnóstico diferencial, Enfoque diagnóstico, Criterios de gravedad o alarma, Perlas clínicas [lista]).
3. **Síntoma / Motivo de consulta**: 11 secciones (Definición, Caracterización del síntoma, Etiologías por categorías, Banderas rojas, Anamnesis dirigida, Examen físico dirigido, Diagnóstico diferencial, Exámenes iniciales, Algoritmo de estudio [algoritmo], Conducta inicial, Criterios de derivación u hospitalización).
4. **Urgencia / Emergencia**: 12 secciones (Reconocimiento inmediato, Evaluación ABCDE, Criterios de gravedad, Diagnósticos diferenciales críticos, Monitorización, Exámenes urgentes, Manejo inicial, Fármacos y dosis [tabla], Intervenciones o procedimientos, Reevaluación y metas de respuesta, Destino: alta, observación, hospitalización o UCI, Algoritmo y errores frecuentes [algoritmo]).
5. **Procedimiento / Técnica / Exploración clínica**: 12 secciones (Definición y objetivo, Indicaciones, Contraindicaciones, Preparación del paciente, Materiales necesarios, Anatomía o referencias relevantes, Técnica paso a paso, Confirmación de correcta ejecución, Hallazgos normales y patológicos (si aplica), Complicaciones, Cuidados posteriores, Errores frecuentes y perlas técnicas [lista]).
6. **Examen / Prueba / Interpretación diagnóstica**: 11 secciones (Qué evalúa, Indicaciones, Preparación y obtención, Técnica o principios básicos, Valores o hallazgos normales, Interpretación sistemática, Patrones patológicos principales, Diagnósticos asociados, Limitaciones y falsos positivos/negativos, Cuándo repetir o complementar, Perlas de interpretación [lista]).
7. **Concepto / Anatomía / Fisiología / Fisiopatología**: 10 secciones (Definición, Estructuras o componentes, Organización o clasificación, Funcionamiento normal, Mecanismos de regulación, Relaciones funcionales, Fisiopatología o alteraciones relevantes, Correlación clínica, Aplicaciones diagnósticas o terapéuticas, Conceptos clave para recordar [lista]).
8. **Prevención / Tamizaje / Control clínico**: 12 secciones (Objetivo, Población objetivo, Factores de riesgo, Evaluación inicial, Tamizaje o prestaciones, Periodicidad, Interpretación de resultados, Intervenciones preventivas, Educación y consejería, Signos de alarma, Criterios de derivación, Seguimiento y normativa aplicable).
9. **Terapéutica / Estrategia de tratamiento**: 12 secciones (Objetivos terapéuticos, Indicaciones para iniciar tratamiento, Medidas no farmacológicas, Tratamiento de primera línea, Alternativas y segunda línea, Escalamiento o desescalamiento, Dosis y esquemas relevantes [tabla], Contraindicaciones y precauciones, Monitorización de respuesta y seguridad, Fracaso terapéutico y cambio de estrategia, Situaciones especiales, Algoritmo terapéutico [algoritmo]).
10. **Fármaco / Ficha farmacológica**: 13 secciones (Grupo farmacológico, Mecanismo de acción, Indicaciones clínicas, Dosis en adultos y vía de administración [tabla], Preparación, dilución y administración, Inicio y duración de acción, Semivida, metabolismo y eliminación, Reacciones adversas importantes, Contraindicaciones y precauciones, Interacciones, Ajuste renal y hepático, Monitorización, Perlas clínicas [lista]).
11. **Patología oncológica / Cáncer**: 18 secciones (Definición, Epidemiología, Factores de riesgo, Etiología y patogenia, Anatomía patológica / histología, Clasificación y subtipos, Manifestaciones clínicas, Diagnóstico, Estudio de extensión, Estadificación / TNM, Factores pronósticos y biomarcadores, Diagnóstico diferencial, Tratamiento, Tratamiento según estadio, Complicaciones, Seguimiento y vigilancia, Pronóstico, Perlas clínicas [lista]).

### 2. Estrategia de Migración Idempotente
- `const SEED_KEY = 'seeded_templates_v2'`
- La función `seedTemplatesIfNeeded()` verifica si `seeded_templates_v2` ya está registrado.
- Si no está registrado:
  1. Localiza o crea la carpeta `Plantillas/` (`id: SYSTEM_TEMPLATES_FOLDER_ID`).
  2. Recorre las 11 plantillas v2.
  3. Si la plantilla no existe en `db.nodes`, la crea con su `body_md` estructurado.
  4. Marca `seeded_templates_v2 = true` en `db.meta`.

## Maquetación Editorial a 2 Columnas

### 1. CSS Columns
- `.article-reader-view.layout-two-columns`:
  ```css
  columns: 2;
  column-gap: 2.25rem;
  column-rule: 1px solid var(--border-subtle);
  ```
- Título principal:
  ```css
  .reader-heading.h1 {
    column-span: all;
    text-align: center;
    margin-bottom: 1.5rem;
  }
  ```
- Bloques indivisibles:
  ```css
  .reader-heading,
  .reader-callout,
  .reader-table-wrapper,
  .mermaid-container,
  .reader-paragraph,
  .reader-list,
  .reader-blockquote {
    break-inside: avoid;
  }
  ```

### 2. Paleta Tipográfica Clínica
- `font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`
- Variables:
  - `--reader-h1-color: #142337;` (Modo oscuro: `#F1F5F9`)
  - `--reader-h2-color: #008080;` (Modo oscuro: `#2DD4BF`)
  - `--reader-h3-color: #00ACA8;` (Modo oscuro: `#5EEAD4`)
  - `--reader-body-color: #1E1E1E;` (Modo oscuro: `#E2E8F0`)
