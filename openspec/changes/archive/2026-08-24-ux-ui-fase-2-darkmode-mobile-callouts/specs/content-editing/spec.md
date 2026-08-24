# content-editing (Delta Spec: Callouts Clínicos y Alertas)

## MODIFIED REQUIREMENTS

### REQ-CE-003: Renderizado en Vista Lector
El sistema DEBE soportar bloques de alerta médica formateados visualmente (*Callouts*).

#### Scenario: Renderizado de Criterios de Alarma / Red Flags
- **GIVEN** un bloque de Markdown iniciado por `> [!WARNING]`, `> [!ALERTA]`, `> [!RED-FLAGS]` o `> [!CAUTION]`
- **WHEN** el usuario visualiza el artículo en Modo Lector
- **THEN** el sistema DEBE renderizar una tarjeta con borde e icono de peligro 🚨, encabezado destacado y cuerpo formateado.

#### Scenario: Renderizado de Perlas Clínicas y Dosis
- **GIVEN** un bloque de Markdown iniciado por `> [!TIP]` / `> [!PERLA]` o `> [!DOSIS]` / `> [!FARMACO]`
- **WHEN** el usuario visualiza el artículo en Modo Lector
- **THEN** el sistema DEBE renderizar el callout con su color distintivo (ámbar para perlas 💡, azul/cian para dosis 💊) e icono temático.
