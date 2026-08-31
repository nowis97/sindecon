## Context

Ver `proposal.md` para motivación y requisitos. Actualmente SINDECON cuenta con generación de flashcards estructurales offline (vía regex/AST) y generación Cloud con Gemini/Groq/OpenAI. Para añadir inferencia local profunda sin comprometer la privacidad ni depender de internet, integramos `@mlc-ai/web-llm` en el navegador.

## Goals / Non-Goals

**Goals:**
- Ejecutar el modelo `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` sobre WebGPU dentro de un Dedicated Web Worker.
- Segmentar el Markdown clínico mediante chunking semántico por encabezados (`H2`/`H3`) y tablas para no superar la ventana de contexto (< 1.200 tokens).
- Notificar la finalización en segundo plano con un Toast interactivo para revisar y guardar las tarjetas.
- Control total de almacenamiento en caché (`CacheStorage`) y memoria VRAM desde los Ajustes de IA.
- Fallback automático hacia el Extractor Rápido si el hardware no soporta WebGPU.

**Non-Goals:**
- Fine-tuning en el cliente o entrenamiento local (solo inferencia con pesos preentrenados y cuantizados en 4-bit).
- Modelos pesados superiores a 3B que puedan saturar la RAM de dispositivos móviles o portátiles de gama media.

## Decisions

### 1. Modelo Seleccionado: Qwen 2.5 1.5B (`Qwen2.5-1.5B-Instruct-q4f16_1-MLC`)
- **Razón**: Sobresaliente comprensión médica en español, seguimiento estricto de formato JSON/Markdown y peso moderado (~1.1 GB en descarga inicial).
- **Alternativas consideradas**: *Llama 3.2 1B* (muy rápido pero menor riqueza médica en español); *Llama 3.2 3B* (más pesado ~1.8 GB).

### 2. Ejecución Aislada en Dedicated Web Worker (`webWorkerMLCEngine`)
- **Razón**: WebGPU y la tokenización de texto consumen ciclos intensivos de CPU/GPU. Ejecutar en un Web Worker garantiza que el hilo principal (React UI, animaciones 3D, editor) se mantenga a 60 FPS sin ningún lag.
- **Alternativas consideradas**: Inferencia en el hilo principal (descartada porque congelaría el navegador durante el prefill de tokens).

### 3. Chunking Semántico Clínico por Secciones Markdown
- **Razón**: Los artículos de SINDECON están organizados por jerarquía (`# Tema`, `## Diagnóstico`, `## Tratamiento`). Enviar bloques de 300-600 palabras con prompts contextuales garantiza alta precisión clínica y elimina el riesgo de desbordar la ventana de 2.048 tokens.
- **Alternativas consideradas**: Ventana deslizante ciega (descartada porque puede cortar frases o tablas a la mitad).

### 4. Notificación Toast Flotante Interactiva
- **Razón**: Permite al usuario continuar navegando o editando mientras el worker trabaja en segundo plano, recibiendo un aviso discreto con botón "Revisar" al concluir.

## Risks / Trade-offs

- **[Dispositivos sin WebGPU o GPU antigua]** → Validación temprana con `navigator.gpu`. Si no está disponible, el sistema deshabilita la pestaña y muestra un mensaje recomendando el Extractor Rápido o Gemini.
- **[Descarga inicial de ~1.1 GB en conexiones lentas]** → Barra de progreso detallada con porcentaje y megabytes, con soporte de pausa/cancelación. Una vez descargado, queda persistido en `CacheStorage` para siempre.
- **[Uso de VRAM en dispositivos con poca memoria]** → Botón explícito en Ajustes de IA para descargar el modelo de la memoria y liberar el caché local cuando se desee.
