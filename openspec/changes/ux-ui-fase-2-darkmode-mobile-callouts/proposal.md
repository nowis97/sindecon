# Propuesta: UX/UI Fase 2 - Modo Oscuro, Barra de Navegación Inferior Móvil y Callouts Clínicos

## Why

El Cuaderno Médico Personal se utiliza intensivamente en dos escenarios críticos:
1. **Guardias nocturnas y largas horas de estudio:** Donde la interfaz de fondo blanco genera fatiga visual. Es indispensable un Modo Oscuro (*Dark Mode*) de alto contraste pero suave a la vista.
2. **Uso en planta con una sola mano (Móvil):** Donde alcanzar los botones superiores resulta incómodo. Una barra de navegación inferior (*Bottom Bar*) colocada en la zona del pulgar optimiza drásticamente el flujo de trabajo en rondas clínicas.
3. **Lectura médica estructurada:** Las guías y resúmenes clínicos requieren destacar con claridad inmediata criterios de alarma (*Red Flags*), perlas clínicas, dosis y criterios diagnósticos mediante cajas de alerta visuales (*Callouts*).

## What Changes

- **Sistema de Modo Oscuro / Claro (`useTheme.ts`):** Detección automática de preferencia del sistema operativo (`prefers-color-scheme`), persistencia en `localStorage` y toggle manual accesible en el header y barra móvil.
- **Barra de Navegación Inferior Móvil (`MobileBottomBar.tsx`):** Barra fija en la parte inferior en pantallas móviles con accesos directos a Temas, Búsqueda, Captura Rápida central destacada, Inbox (con badge de notas pendientes) y selector de tema.
- **Callouts Clínicos en el Lector (`ArticleReader.tsx`):** Soporte en Markdown para bloques de alerta médica con iconos y colores temáticos:
  - 🚨 *Criterios de Alarma / Red Flags* (`> [!WARNING]`, `> [!ALERTA]`, `> [!RED-FLAGS]`, `> [!CAUTION]`)
  - 💡 *Perlas Clínicas* (`> [!TIP]`, `> [!PERLA]`)
  - 💊 *Dosis Farmacológicas* (`> [!DOSIS]`, `> [!FARMACO]`)
  - 📋 *Criterios Diagnósticos / Notas* (`> [!IMPORTANT]`, `> [!DIAGNOSTICO]`, `> [!NOTE]`)
  - Citas estándar `> ...` estilizadas con barra lateral.
- **Estilos CSS Completos (`index.css`):** Paleta oscura profesional para todos los componentes (tablas, editor, lector, modales, visor Mermaid).

## Capabilities

### New Capabilities
- `theme-management`: Soporte para alternancia y persistencia de Modo Claro / Modo Oscuro.
- `mobile-navigation`: Barra ergonómica inferior en dispositivos móviles con badge de Inbox y acceso a 1 toque.

### Modified Capabilities
- `content-editing`: Renderizado de callouts y bloques de alerta clínicos estructurados en la vista lector de Markdown.

## Impact
- **Código nuevo:** `src/hooks/useTheme.ts`, `src/components/navigation/MobileBottomBar.tsx`.
- **Código modificado:** `src/components/reader/ArticleReader.tsx`, `src/App.tsx`, `src/index.css`.
- **Pruebas:** Cobertura de tests E2E y unitarios para modo oscuro y callouts.
