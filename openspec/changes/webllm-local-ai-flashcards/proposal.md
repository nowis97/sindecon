## Why

Actualmente, la generación de flashcards con inteligencia artificial depende exclusivamente de proveedores Cloud (Google Gemini, Groq, OpenAI), lo que requiere una conexión a Internet activa y la configuración de una API Key externa. Para médicos, residentes y estudiantes de la salud que trabajan en hospitales, plantas con baja cobertura o que manejan notas con información clínica sensible, es fundamental contar con un motor de IA local, privado y offline-first.

Integrar **WebLLM** con el modelo **Qwen 2.5 (1.5B)** directamente en el navegador mediante **WebGPU** permite generar flashcards médicas de altísima calidad clínica en segundo plano, con costo cero, privacidad absoluta (0 bytes enviados a servidores) y sin depender de conexión a Internet ni claves de API.

## What Changes

- **Motor Local de Inferencia con WebLLM**: Integración de `@mlc-ai/web-llm` ejecutado dentro de un Dedicated Web Worker para no bloquear el hilo principal de la interfaz de usuario.
- **Modelo Clínico Optimizado**: Soporte y descarga bajo demanda del modelo `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (~1.1 GB en CacheStorage/OPFS).
- **Estrategia de Chunking Semántico Clínico**: División inteligente de artículos médicos por encabezados (`H2`/`H3`), tablas y callouts clínicos para garantizar que cada inferencia se mantenga dentro del límite seguro de tokens (< 1.200 tokens).
- **Manejo de Descarga y Memoria Local**: Modal de descarga inicial con barra de progreso transparente y opción en Ajustes de IA para liberar la memoria GPU/VRAM y caché local.
- **Detección y Degradación Elegante de WebGPU**: Validación de soporte de hardware con avisos contextuales y redirección al Extractor Rápido Offline o a Gemini si el dispositivo no soporta WebGPU.
- **Notificación Flotante No Intrusiva (Toast)**: Alerta interactiva cuando el Web Worker finaliza la generación en segundo plano para revisar las tarjetas directamente en el tema.

## Capabilities

### New Capabilities
- `local-ai-webllm`: Motor de inferencia local con WebGPU, gestión de descarga en segundo plano y generación clínica offline mediante WebLLM.

### Modified Capabilities
- `flashcards`: Integración del nuevo modo "🧠 IA Local (Qwen 2.5 WebGPU)" en el modal de generación, barra de estado de procesamiento y selector de proveedores.

## Impact

- **Nuevos Módulos**: `app/src/domain/ai/webLlmClient.ts`, `app/src/workers/webllm.worker.ts`.
- **Componentes Actualizados**: `GenerateFlashcardsModal.tsx`, `AiSettingsModal.tsx`, `ArticleFlashcardsModal.tsx`.
- **Dependencias**: Utilización del paquete ya instalado `@mlc-ai/web-llm`.
- **Compatibilidad**: Requiere navegadores compatibles con WebGPU (Chrome/Edge 113+, Firefox Nightly, Safari 18+); para navegadores sin WebGPU se mantiene fallback automático a Extractor Rápido.
