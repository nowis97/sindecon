## Context

El proyecto cuenta con Playwright para pruebas E2E (pp/e2e/vital.spec.ts). Tras la integración del sistema de flashcards y repetición espaciada SM-2 en 0.2.21, necesitamos una suite específica pp/e2e/flashcards.spec.ts que valide de punta a punta toda la experiencia de usuario clínica.

## Goals / Non-Goals

**Goals:**
- Validar el flujo de extracción estructural de flashcards a partir del Markdown de un artículo médico.
- Validar la creación, edición inline y eliminación manual de tarjetas por tema.
- Validar el modal de configuración de IA (AiSettingsModal) y la persistencia de API Keys en IndexedDB.
- Validar el modo de estudio interactivo (StudyModal) con flip card 3D, atajos de teclado (Espacio/1-4) y cálculo SM-2.
- Validar la actualización reactiva del widget de Repaso Activo y contadores en el Dashboard.
- Usar page.route() de Playwright para simular respuestas de Cloud AI (Gemini/Groq) de forma determinista y sin depender de conexión a internet o cuotas de API.

**Non-Goals:**
- No descargar pesos pesados de modelos WebLLM (~800MB) durante la ejecución de los tests E2E de Playwright.

## Decisions

### 1. Mocking Determinista de APIs de IA con page.route
- **Decisión**: Para las pruebas del motor Cloud AI en el modal de generación, interceptar las peticiones a https://generativelanguage.googleapis.com/** y https://api.groq.com/** utilizando page.route().
- **Razón**: Permite validar la interfaz, el parseo de respuestas JSON y el guardado en el mazo sin requerir API keys reales ni conexión externa en entornos de CI.
- **Alternativas**: Dejar únicamente el extractor estructural (insuficiente para validar la UI de IA) o requerir claves reales de entorno (frágil y costoso).

### 2. Aislamiento de Estado y Limpieza en Pruebas E2E
- **Decisión**: Cada prueba crea sus artículos o carpetas de prueba con nombres unívocos o limpia IndexedDB al iniciar.
- **Razón**: Evita interferencias entre pruebas que se ejecuten en paralelo o en secuencia.

### 3. Validación de Interactividad 3D y Atajos de Teclado
- **Decisión**: Probar tanto la interacción por clic como la interacción por teclado (page.keyboard.press(" Space\) y page.keyboard.press(\3\)) en el StudyModal.
- **Razón**: Los médicos y estudiantes utilizan ampliamente los atajos de teclado tipo Anki para acelerar sus repasos diarios.

## Risks / Trade-offs

- **[Risk]** Dependencia de animaciones CSS 3D (otateY(180deg)) en pruebas headless.
 → *Mitigation*: Verificar clases CSS (.is-flipped) y visibilidad de los botones de calificación que se habilitan al voltear.
