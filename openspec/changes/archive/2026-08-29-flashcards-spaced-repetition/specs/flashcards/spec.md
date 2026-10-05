## ADDED Requirements

### Requirement: Almacenamiento local de Flashcards y estado SM-2

El sistema SHALL persistir flashcards en la base de datos local Dexie con vinculación al artículo (
ode_id) y atributos del algoritmo SM-2: interval (días), ease_factor (facilidad, base 2.5), eps (repeticiones consecutivas), lapses (fallos acumulados) y due_date (timestamp de vencimiento).

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
