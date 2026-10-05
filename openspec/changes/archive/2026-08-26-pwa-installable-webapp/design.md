# Diseño Técnico: Instalabilidad PWA y Flujo de Instalación Nativo

## Context

SINDECON ya cuenta con @vitejs/plugin-react y ite-plugin-pwa configurados con precache offline. Sin embargo, actualmente no expone un botón en la interfaz para activar el flujo nativo de instalación (eforeinstallprompt) ni orienta a usuarios en Safari/iOS sobre cómo agregarlo a la pantalla de inicio. Ver proposal.md para la motivación.

## Goals / Non-Goals

**Goals:**
- Proporcionar un botón claro e intuitivo ( 📲 Instalar App) en la barra lateral y en el Dashboard de inicio.
- Capturar y diferir el evento eforeinstallprompt para dispararlo cuando el usuario pulse el botón.
- Detectar automáticamente si la app ya se encuentra instalada o ejecutándose en modo standalone (display-mode: standalone), ocultando el botón.
- Mostrar una guía visual amigable en iOS para guiar el proceso de Añadir a pantalla de inicio.
- Enriquecer los metadatos de PWA en ite.config.ts e index.html.

**Non-Goals:**
- No requiere publicación en Google Play Store ni Apple App Store (sigue el estándar web PWA independiente).

## Decisions

### 1. Hook usePwaInstall

`	s
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Detectar si ya está en modo standalone
    const isStandalone = window.matchMedia('''(display-mode: standalone)''').matches || (navigator as any).standalone;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Capturar beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener(''beforeinstallprompt'', handler);
    window.addEventListener(''appinstalled'', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener(''beforeinstallprompt'', handler);
    };
  }, []);

  const triggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === ''accepted'') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIosDevice()) {
      setShowIosGuide(true);
    }
  };

  return { canInstall: Boolean(deferredPrompt) || (!isInstalled && isIosDevice()), isInstalled, triggerInstall, showIosGuide, closeIosGuide: () => setShowIosGuide(false) };
}
`

### 2. Integración en UI

- **Barra lateral (Sidebar):** Añadir botón de instalación accesible con icono 📲 junto a los controles de configuración/sincronización.
- **Dashboard (HomeDashboard):** Tarjeta destacada en Acciones Rápidas para instalar con un solo clic.
- **Modal para iOS:** Ventana emergente con ilustración y pasos en 2 toques: *Compartir (⎋) ➔ Añadir a pantalla de inicio (➕)*.

### 3. Metadatos PWA

- Actualizar index.html con tags 	heme-color, pple-touch-icon, pple-mobile-web-app-capable.
- Completar manifest en ite.config.ts con categorías médicas y nombres oficiales.

## Risks / Trade-offs

- **[Riesgo]** Algunos navegadores de escritorio (ej. Firefox o Safari en Mac antiguo) no soportan eforeinstallprompt.
  → *Mitigación:* El botón solo se muestra cuando el evento es capturado o se ofrece una indicación clara.
