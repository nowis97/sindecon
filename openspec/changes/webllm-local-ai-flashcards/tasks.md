## 1. Infraestructura de WebLLM y Worker en Segundo Plano

- [x] 1.1 Crear el Web Worker dedicado (`app/src/workers/webllm.worker.ts`) usando `WebWorkerMLCEngineHandler` para aislar la carga del modelo y la inferencia de WebGPU del hilo de la interfaz.
- [x] 1.2 Implementar el cliente `webLlmClient.ts` en `app/src/domain/ai/` con detección de soporte WebGPU (`navigator.gpu`), gestión de estados de descarga (progreso porcentual y bytes) y puente de mensajería con el worker.
- [x] 1.3 Crear pruebas unitarias para `webLlmClient.ts` verificando validación de WebGPU, manejo de eventos de progreso y formateo de respuestas JSON.

## 2. Chunking Semántico Clínico y Prompts Médicos

- [x] 2.1 Implementar el segmentador semántico `clinicalChunker.ts` para dividir artículos Markdown por encabezados (`H2`/`H3`), tablas y callouts respetando el límite seguro de 1.200 tokens por bloque.
- [x] 2.2 Diseñar y probar prompts clínicos especializados para Qwen 2.5 orientados a diagnóstico, dosis farmacológicas, tríadas y criterios de alarma.
- [x] 2.3 Añadir tests unitarios para `clinicalChunker.ts` validando el particionado correcto de artículos extensos y preservación de tablas completas.

## 3. Integración en UI: Modal de Generador y Modal de Ajustes

- [x] 3.1 Integrar la pestaña "🧠 IA Local (Qwen 2.5 WebGPU)" en `GenerateFlashcardsModal.tsx` con soporte de visualización de descarga y selector de cantidad de tarjetas.
- [x] 3.2 Implementar el Toast flotante interactivo de notificación en segundo plano para alertar al usuario cuando las flashcards locales estén listas para revisión.
- [x] 3.3 Añadir controles de gestión de memoria y almacenamiento en `AiSettingsModal.tsx` (botón para liberar VRAM y vaciar el caché de modelos locales).

## 4. Verificación E2E y Pruebas de Integración

- [x] 4.1 Añadir suite de pruebas E2E en Playwright para el flujo completo de IA Local (mock de WebWorker/WebGPU, detección de hardware y generación por chunks).
- [x] 4.2 Ejecutar `npm test`, `npx playwright test` y `npm run build` confirmando 100% de tests aprobados y compilación limpia.
