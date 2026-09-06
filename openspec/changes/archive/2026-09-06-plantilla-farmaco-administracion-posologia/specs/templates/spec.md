## MODIFIED Requirements

### Requirement: Siembra de plantillas en el primer arranque

En el primer arranque o migración, el sistema SHALL sembrar en "Plantillas/" los 12 formatos maestros oficiales (los 11 de la Versión 2 más la nueva plantilla de farmacología clínica "Fármaco / Posología y administración clínica"): Patología / Enfermedad, Síndrome clínico / Diagnóstico sindromático, Síntoma / Motivo de consulta, Urgencia / Emergencia, Procedimiento / Técnica / Exploración clínica, Examen / Prueba / Interpretación diagnóstica, Concepto / Anatomía / Fisiología / Fisiopatología, Prevención / Tamizaje / Control clínico, Terapéutica / Estrategia de tratamiento, Fármaco / Ficha farmacológica, Fármaco / Posología y administración clínica y Patología oncológica / Cáncer. Cada plantilla SHALL contener sus secciones como encabezados Markdown, con tabla semilla donde el formato lo indica (p.ej. "Posología", "Tratamiento", "Fármacos y dosis"), fence mermaid semilla donde hay "Algoritmo" y listas guiadas de ítems clínicos. La siembra MUST ejecutarse de forma idempotente y no sobrescribir ediciones del usuario.

#### Scenario: Primer arranque
- **WHEN** el usuario abre la app por primera vez
- **THEN** existe la carpeta "Plantillas" con las 12 plantillas oficiales listas para usar

#### Scenario: Re-arranque tras personalizar
- **WHEN** el usuario editó una plantilla y vuelve a abrir la app
- **THEN** la plantilla conserva la edición del usuario (la siembra no se repite ni sobrescribe)

## ADDED Requirements

### Requirement: Estructura de la plantilla Fármaco / Posología y administración clínica

El sistema SHALL proveer la plantilla oficial "Fármaco / Posología y administración clínica" basada en el formato clínico manuscrito para uso en guardia y prescripción activa. Dicha plantilla SHALL estructurarse con:
1. Encabezado principal `# {título}`.
2. Sección `## Indicaciones` con lista numerada del 1 al 9.
3. Sección `## Posología` con tabla Markdown estructurada con las columnas: `Contexto`, `Dosis`, `Frecuencia`, `Vía`, `Máximo diario` y `Acotaciones`.
4. Sección `## Preparación y ajuste` con los ítems guiados: Dilución (en qué y en cuánto), Tiempo de administración, Ajuste en IRA, Ajuste en DHC y NO mezclar con.
5. Sección `## RAM relevantes` con lista numerada del 1 al 9.
6. Sección `## Marcas comerciales en Chile` con lista numerada del 1 al 5.
7. Sección `## Contraindicaciones` con lista numerada del 1 al 10.
8. Sección `## Fuentes` con lista numerada del 1 al 5.

#### Scenario: Creación de artículo a partir de la nueva plantilla de farmacología
- **WHEN** el usuario crea un artículo seleccionando la plantilla "Fármaco / Posología y administración clínica"
- **THEN** el artículo nuevo contiene todas las secciones, la tabla de posología con encabezados correctos y los campos guiados de preparación, seguridad y marcas comerciales en Chile
