# flashcards Specification

## Purpose
TBD - created by archiving change webllm-local-ai-flashcards. Update Purpose after archive.

## Requirements

### Requirement: Opción de Generador con IA Local WebLLM
El sistema SHALL / DEBE incorporar el modo "🧠 IA Local (Qwen 2.5 WebGPU)" en el modal de generación de flashcards del tema, permitiendo generar preguntas y respuestas clínicas de alta calidad sin conexión y sin consumir tokens de APIs externas.

#### Scenario: Selección del modo IA Local en el generador
- **WHEN** el usuario abre el modal de generación de flashcards y selecciona la pestaña "🧠 IA Local (Qwen 2.5)"
- **THEN** el sistema muestra el estado de preparación del modelo local, el selector de cantidad de tarjetas y el botón para disparar la generación en segundo plano

#### Scenario: Visualización de progreso en generación con IA Local
- **WHEN** se inicia la generación con WebLLM
- **THEN** el generador muestra el avance sección por sección del artículo clínico sin bloquear la interfaz de usuario

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

### Requirement: Validación E2E de Extracción Estructural y Mazo de Flashcards

La suite de pruebas E2E SHALL validar que el usuario pueda abrir un artículo con contenido médico estructurado (secciones, tablas, negritas o callouts), abrir el modal de generación, visualizar las tarjetas extraídas automáticamente, seleccionar/editar preguntas y guardarlas exitosamente en el mazo del tema.

#### Scenario: Extracción estructural y guardado en mazo
- **WHEN** el usuario navega a un artículo con secciones y tablas y hace clic en " 🧠 Flashcards\ -> \✨ Generar Flashcards con IA / Extractor\
- **THEN** el sistema extrae las tarjetas estructurales, permite seleccionarlas y al hacer clic en \💾 Guardar en el Mazo\ aparecen en la lista de tarjetas del artículo.

### Requirement: Validación E2E de Gestión Manual de Flashcards

La suite de pruebas E2E SHALL verificar la creación manual de preguntas y respuestas, la edición inline de texto y la eliminación de tarjetas con actualización inmediata de contadores en el modal del tema.

#### Scenario: Crear, editar y eliminar una tarjeta manual
- **WHEN** el usuario pulsa \➕ Tarjeta Manual\, ingresa una pregunta y respuesta clínica y la guarda
- **THEN** la tarjeta se añade a la lista con badge \Nueva\, permite editar su texto mediante el botón ✏️ y eliminarla mediante 🗑️.

### Requirement: Validación E2E de Configuración de Proveedores de IA

La suite de pruebas E2E SHALL comprobar que el modal de Ajustes de IA permita alternar entre proveedores (Gemini, Groq, OpenAI, Ollama, WebLLM), ingresar credenciales y persistirlas en el almacenamiento local.

#### Scenario: Guardar configuración de API Key de IA
- **WHEN** el usuario abre \⚙️ Ajustes de IA Clínica\ desde el Dashboard, selecciona un proveedor e ingresa su clave
- **THEN** al guardar se muestra el feedback \✓ Guardado\ y los valores permanecen persistidos al reabrir el modal.

### Requirement: Validación E2E de Sesión de Estudio Activo SM-2 (Flip Card 3D)

La suite de pruebas E2E SHALL verificar el flujo completo de estudio interactivo: visualización de la cara frontal (pregunta), animación 3D de volteo (por clic o tecla Espacio), visualización de los 4 botones de calificación SM-2 (1: Otra vez, 2: Difícil, 3: Bueno, 4: Fácil), avance progresivo entre tarjetas y pantalla final de celebración con estadísticas de retención.

#### Scenario: Realizar sesión de estudio y recibir feedback
- **WHEN** el usuario inicia un repaso con tarjetas pendientes, voltea cada una y califica su dificultad
- **THEN** la barra de progreso avanza, el mazo recorre todas las tarjetas y al finalizar se despliega la pantalla de sesión completada con resumen de calificaciones.

### Requirement: Validación E2E de Métricas Reactivas en Dashboard

La suite de pruebas E2E SHALL verificar que el widget de \Repaso Activo SM-2\ y las estadísticas del Dashboard reflejen en tiempo real las tarjetas listas para estudiar y el total acumulado en el mazo.

#### Scenario: Actualización de contadores del Dashboard tras repasar
- **WHEN** el usuario concluye el estudio de todas sus tarjetas pendientes y regresa al Dashboard principal
- **THEN** la tarjeta de estadísticas actualiza su conteo a 0 repasos pendientes y el botón de acción rápida muestra el estado \Al día\.

### Requirement: Almacenamiento local de Flashcards y estado SM-2

El sistema SHALL persistir flashcards en la base de datos local Dexie con vinculación al artículo (
ode_id) y atributos del algoritmo SM-2: interval (días), ease_factor (facilidad, base 2.5), 
eps (repeticiones consecutivas), lapses (fallos acumulados) y due_date (timestamp de vencimiento).

#### Scenario: Creación y consulta de tarjeta pendiente
- **WHEN** se crea una nueva tarjeta con una pregunta y respuesta
- **THEN** se inicializa con interval: 0, ease_factor: 2.5, due_date <= ahora y aparece en la lista de pendientes de estudio

### Requirement: Extracción estructural automática desde Markdown común

El sistema SHALL ser capaz de extraer tarjetas de estudio a partir del Markdown natural de cualquier artículo médico reconociendo:
1. Encabezados de sección (## Sección) y su contenido descriptivo.
2. Elementos de lista con términos en negrita (- **Concepto:** Explicación).
3. Filas de tablas médicas con sus encabezados de columna.
4. Callouts clínicos de alerta o perlas (> [!WARNING], > [!PEARL]).

#### Scenario: Extraer tarjetas de un artículo sin marcas especiales
- **WHEN** el usuario pulsa " Generar Flashcards\ en un artículo con secciones y listas en negrita
- **THEN** el sistema extrae una lista de preguntas estructuradas y respuestas para que el usuario las revise antes de guardarlas

### Requirement: Generación con IA Cloud y WebLLM en Navegador

El sistema SHALL soportar la generación de flashcards clínicas mediante:
1. Proveedores Cloud con API Key del usuario: Google Gemini (gratuito), Groq (gratuito), OpenAI u Ollama local.
2. Motor WebLLM que se ejecuta directamente en la GPU del navegador mediante WebGPU sin requerir claves ni servidores.

#### Scenario: Generar con Google Gemini o Groq
- **WHEN** el usuario selecciona \Generar con IA\ teniendo configurada una API Key válida
- **THEN** el sistema envía el texto del artículo y recibe tarjetas con preguntas de razonamiento clínico y respuestas concisas

#### Scenario: Generar con WebLLM local en navegador
- **WHEN** el usuario selecciona \WebLLM Local\ en un navegador compatible con WebGPU
- **THEN** el sistema carga el modelo ligero en memoria y procesa el artículo 100% offline

### Requirement: Motor de Repetición Espaciada SM-2

El sistema SHALL calcular el siguiente intervalo de repaso en base a la calificación del usuario:
- 1 - Otra vez (Fallo): Intervalo = 1 día, reinicia reps a 0, reduce factor de facilidad.
- 2 - Difícil: Intervalo = interval * 1.2, reduce ligeramente factor de facilidad.
- 3 - Bueno: Intervalo = 1 día (primera repetición), 6 días (segunda) o interval * ease_factor.
- 4 - Fácil: Intervalo acelerado con bonificación de facilidad (interval * ease_factor * 1.3).

#### Scenario: Calificar una tarjeta como Buena
- **WHEN** el usuario responde correctamente y califica con \Bueno\
- **THEN** la tarjeta incrementa su intervalo y su due_date se actualiza al futuro correspondiente

### Requirement: Interfaz de Estudio Activo (Flip Card) y Gestión

El sistema SHALL proveer una interfaz de estudio interactiva con efecto de volteo de tarjeta (*flip card*), atajos de teclado (Espacio / Intro para voltear, 1-4 para calificar), soporte táctil completo en dispositivos móviles, y widgets de acceso en el Dashboard y la cabecera del artículo.

#### Scenario: Sesión de estudio completa
- **WHEN** el usuario inicia una sesión de repaso con 10 tarjetas pendientes y las califica todas
- **THEN** visualiza una pantalla de resumen con estadísticas de aciertos y vuelve al estado actualizado sin tarjetas pendientes
