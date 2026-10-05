## Purpose

Proporcionar a los profesionales de la salud una experiencia de creación de flashcards interactiva, con vista previa en tiempo real (Flip 3D), renderizado Markdown completo y métricas de rendimiento basadas en el volumen de palabras del artículo clínico.

## ADDED Requirements

### Requirement: Vista previa interactiva en tiempo real durante creación y edición manual
El sistema DEBE permitir previsualizar de forma interactiva cualquier flashcard mientras se redacta o edita de forma manual, renderizando fielmente el formato Markdown tanto en el anverso como en el reverso y permitiendo el giro 3D de la tarjeta antes de guardarla.

#### Scenario: Alternar entre modo edición y modo vista previa
- **WHEN** el usuario hace clic en el botón de alternar vista previa (icono 👁️ / Pestaña Preview) en el formulario de creación o edición de tarjeta
- **THEN** el sistema renderiza la tarjeta médica con sus estilos de estudio interactivos mostrando la pregunta (Front) con formato enriquecido.

#### Scenario: Volteo interactivo 3D en la vista previa
- **WHEN** el usuario hace clic sobre la tarjeta en vista previa o en el botón "Voltear / Ver respuesta"
- **THEN** la tarjeta realiza una transición animada en 3D revelando la respuesta (Back) formateada con Markdown (listas, tablas, negritas y callouts).

### Requirement: Previsualización interactiva de tarjetas candidatas en el generador
El sistema DEBE permitir inspeccionar y previsualizar de forma interactiva las tarjetas generadas mediante extracción estructural o IA antes de incorporarlas al mazo de estudio.

#### Scenario: Inspección visual de tarjeta candidata antes de guardar
- **WHEN** el generador automático presenta la lista de flashcards candidatas detectadas
- **THEN** el usuario puede activar la vista de previsualización para examinar cómo se visualizará cada tarjeta seleccionada en el modo de estudio SM-2.

### Requirement: Indicador de rendimiento médico y conteo de palabras
El sistema DEBE calcular y mostrar en la interfaz de usuario la cantidad recomendada de flashcards en base al número de palabras del artículo clínico (aplicando la regla de ~1 flashcard clínica cada 60 palabras).

#### Scenario: Visualización del chip de estimación en el modal del tema
- **WHEN** el usuario abre el modal de flashcards de un artículo que contiene texto clínico
- **THEN** el sistema muestra un chip informativo indicando el total de palabras y el número de flashcards estimadas recomendadas para ese tema.
