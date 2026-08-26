# Diseño Técnico: Sesión Persistente y Renovación Silenciosa con Google Identity Services

## Context

SINDECON es una PWA cliente pura offline-first. Los Access Tokens de Google OAuth 2.0 caducan estrictamente a los 3600 segundos (1 hora). Actualmente, getStoredToken() borra las credenciales al expirar, causando desconexión al cerrar la app o al pasar 60 minutos. Ver proposal.md para la motivación.

## Goals / Non-Goals

**Goals:**
- Mantener la sesión de Google Drive conectada indefinidamente mientras el usuario mantenga su sesión de Google activa en el navegador.
- Renovar los Access Tokens automáticamente en segundo plano mediante equestAccessToken({ prompt: '' }) al iniciar la app o recuperar visibilidad.
- Programar un temporizador proactivo cada 45-50 minutos para refrescar el token antes de su caducidad.
- Solo revocar o borrar datos de sesión cuando el usuario pulse explícitamente " Desconectar cuenta\.

**Non-Goals:**
- No requiere backend intermediario ni almacenamiento de Client Secrets (sigue la arquitectura cliente recomendada por Google Identity Services).

## Decisions

### 1. Bandera Persistente de Sincronización (cuaderno-gdrive-enabled)

- Se introduce la clave GDRIVE_ENABLED_KEY = ''cuaderno-gdrive-enabled''.
- Al conectar por primera vez o vincular token, se guarda cuaderno-gdrive-enabled = ''true'' y se preserva cuaderno-gdrive-email.
- getStoredToken() ya no borra el email ni la bandera al detectar expiración; simplemente retorna 
ull para que el sistema proceda al refresco silencioso.

### 2. Función de Renovación Silenciosa (equestSilentAccessToken)

` s
export function requestSilentAccessToken(
 clientId: string,
 onSuccess: (token: string, expiresIn: number) => void,
 onError?: (err: string) => void,
) {
 const win = window as any;
 if (!win.google?.accounts?.oauth2) {
 onError?.(''Google Identity Services no disponible'');
 return;
 }

 const client = win.google.accounts.oauth2.initTokenClient({
 client_id: clientId,
 scope: ''https://www.googleapis.com/auth/drive.appdata'',
 prompt: '''', // Silencioso: no abre popup si el usuario ya concedió consentimiento
 callback: (res: any) => {
 if (res.access_token) {
 onSuccess(res.access_token, res.expires_in || 3600);
 } else if (res.error) {
 onError?.(res.error);
 }
 },
 });

 client.requestAccessToken({ prompt: '''' });
}
`

### 3. Ciclo de Vida en useGoogleSync

1. **Al montar el hook:** Si isGoogleSyncEnabled() es rue:
 - Si el token almacenado es válido: dispara sincronización inmediata.
 - Si el token está caducado: invoca equestSilentAccessToken() de inmediato y sincroniza al recibir el nuevo token.
2. **Al volver a la pestaña (isibilitychange a visible / evento online):**
 - Si el token expiró o le quedan menos de 5 minutos, refresca silenciosamente.
3. **Temporizador proactivo (cada 45 min):**
 - Refresca el token en segundo plano para mantener la conexión activa durante sesiones de trabajo prolongadas.

## Risks / Trade-offs

- **[Riesgo]** Si el usuario cierra su cuenta de Google en el navegador o revoca el consentimiento desde myaccount.google.com, prompt: '''' fallará.
 → *Mitigación:* Se captura el error en onError y se muestra un estado amigable en el indicador de nube (\Sesión expirada: pulsa para reconectar\) sin borrar la configuración.
