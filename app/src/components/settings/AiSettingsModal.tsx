import React, { useState, useEffect } from 'react'
import {
  Settings,
  Sparkles,
  Zap,
  Brain,
  KeyRound,
  ExternalLink,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Trash2,
  RefreshCw,
  Lightbulb,
  Loader2,
} from 'lucide-react'
import { getAiConfig, saveAiConfig, type AiConfig, DEFAULT_AI_CONFIG } from '../../db/flashcards'
import {
  PROVIDER_MODELS,
  PROVIDER_GUIDES,
  testAiConnection,
  type AiModelOption,
} from '../../domain/ai/cloudAiClient'
import {
  checkWebGPUSupport,
  isLocalModelCached,
  unloadLocalModel,
  clearLocalModelCache,
  DEFAULT_LOCAL_MODEL,
  AVAILABLE_LOCAL_MODELS,
} from '../../domain/ai/webLlmClient'
import { getStoredToken, isGoogleSyncEnabled, uploadAiConfigToDrive } from '../../pwa/googleDrive'
import {
  BaseModal,
  PILL_BTN_PRIMARY,
  PILL_BTN_SECONDARY,
  CLINICAL_FIELD_CLASS,
} from '../common/DialogModal'

interface AiSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [saved, setSaved] = useState(false)
  const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null)
  const [localModelCached, setLocalModelCached] = useState<boolean>(false)
  const [localActionMsg, setLocalActionMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      getAiConfig().then((loaded) => {
        setConfig(loaded)
        const models = PROVIDER_MODELS[loaded.provider] || []
        const isPredefined = models.some((m) => m.id === loaded.modelName)
        setIsCustomModel(!isPredefined && Boolean(loaded.modelName))
        isLocalModelCached(loaded.localModelId || DEFAULT_LOCAL_MODEL).then((cached) =>
          setLocalModelCached(cached),
        )
      })
      checkWebGPUSupport().then((res) => setWebGpuSupported(res.supported))
      setTestResult(null)
      setSaved(false)
      setShowApiKey(false)
      setLocalActionMsg(null)
    }
  }, [isOpen])

  const currentGuide = PROVIDER_GUIDES[config.provider] || PROVIDER_GUIDES.gemini
  const availableModels: AiModelOption[] = PROVIDER_MODELS[config.provider] || []

  const handleProviderChange = (newProvider: AiConfig['provider']) => {
    const defaultModel =
      PROVIDER_MODELS[newProvider]?.find((m) => m.isDefault)?.id ||
      PROVIDER_MODELS[newProvider]?.[0]?.id ||
      'gemini-3.5-flash'

    setConfig({
      ...config,
      provider: newProvider,
      modelName: defaultModel,
    })
    setIsCustomModel(false)
    setTestResult(null)
  }

  const handleModelSelect = (modelId: string) => {
    if (modelId === '__custom__') {
      setIsCustomModel(true)
    } else {
      setIsCustomModel(false)
      setConfig({ ...config, modelName: modelId })
    }
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    if (!config.apiKey?.trim()) {
      setTestResult({ ok: false, message: 'Primero ingresa una API Key para realizar la prueba.' })
      return
    }

    setTesting(true)
    setTestResult(null)
    const result = await testAiConnection(config)
    setTesting(false)
    setTestResult(result)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const enrichedConfig: AiConfig = {
      ...config,
      updated_at: Date.now(),
    }
    await saveAiConfig(enrichedConfig)

    if (isGoogleSyncEnabled()) {
      const token = getStoredToken()
      if (token) {
        uploadAiConfigToDrive(token, enrichedConfig).catch((err) => {
          console.warn('Error subiendo AI config a Google Drive al guardar:', err)
        })
      }
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 800)
  }

  const selectedLocalMeta = AVAILABLE_LOCAL_MODELS.find(
    (m) => m.id === (config.localModelId || DEFAULT_LOCAL_MODEL),
  )

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración de IA Clínica"
      subtitle="Configura tu proveedor para extracción de flashcards y razonamiento médico."
      icon={<Settings className="h-5 w-5" />}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <button type="button" className={PILL_BTN_SECONDARY} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="ai-settings-form" className={PILL_BTN_PRIMARY}>
            {saved ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Guardado</span>
              </>
            ) : (
              <span>Guardar Ajustes</span>
            )}
          </button>
        </>
      }
    >
      <form id="ai-settings-form" onSubmit={handleSave} className="flex flex-col gap-5">
        {/* Provider Selector */}
        <div className="flex flex-col gap-2.5">
          <label
            htmlFor="ai-provider-select"
            className="text-xs font-semibold text-[var(--ch-text-secondary)]"
          >
            Proveedor de IA Cloud
          </label>
          <select
            id="ai-provider-select"
            className={`${CLINICAL_FIELD_CLASS} sm:hidden`}
            value={config.provider}
            onChange={(e) => handleProviderChange(e.target.value as AiConfig['provider'])}
          >
            <option value="gemini">Google Gemini (Recomendado - Gratuito)</option>
            <option value="groq">Groq Cloud (Ultra Rápido - Gratuito)</option>
            <option value="openai">OpenAI (GPT-4o Mini / o3-mini)</option>
          </select>

          <div className="hidden grid-cols-3 gap-2.5 sm:grid">
            <button
              type="button"
              onClick={() => handleProviderChange('gemini')}
              className={`flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition ${
                config.provider === 'gemini'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <Sparkles className="h-4 w-4 text-[var(--ch-accent)]" />
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Gratis
                </span>
              </div>
              <strong className="font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
                Google Gemini
              </strong>
              <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                Recomendado · 15 req/min
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('groq')}
              className={`flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition ${
                config.provider === 'groq'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <Zap className="h-4 w-4 text-[var(--ch-accent)]" />
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Gratis
                </span>
              </div>
              <strong className="font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
                Groq Cloud
              </strong>
              <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                Ultra rápido · Llama 3.3
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange('openai')}
              className={`flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition ${
                config.provider === 'openai'
                  ? 'border-[var(--ch-accent)] bg-[var(--ch-accent-soft)]'
                  : 'border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/50 hover:border-[var(--ch-accent)]/50'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <Brain className="h-4 w-4 text-[var(--ch-accent)]" />
                <span className="rounded-full border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--ch-text-muted)]">
                  De pago
                </span>
              </div>
              <strong className="font-serif text-sm font-semibold text-[var(--ch-text-primary)]">
                OpenAI
              </strong>
              <span className="font-mono text-[10px] text-[var(--ch-text-muted)]">
                GPT-4o Mini / o3-mini
              </span>
            </button>
          </div>
        </div>

        {/* Step-by-step API Key Guide */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ch-text-primary)]">
              <KeyRound className="h-4 w-4 text-[var(--ch-accent)]" />
              <span>¿Cómo obtener tu clave de {currentGuide.providerName}?</span>
            </div>
            <a
              href={currentGuide.portalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--ch-accent)]/35 bg-[var(--ch-accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--ch-accent)] transition hover:bg-[var(--ch-accent)] hover:text-white"
            >
              <span>Abrir {currentGuide.portalName}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-[var(--ch-text-secondary)]">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
            <span>{currentGuide.freeTierInfo}</span>
          </p>

          <ol className="flex flex-col gap-1.5 pl-1 text-xs text-[var(--ch-text-secondary)]">
            {currentGuide.steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ch-bg-elevated)] font-mono text-[10px] font-bold text-[var(--ch-accent)]">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* API Key Input + Connection Test */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[var(--ch-text-secondary)]">
            API Key de {currentGuide.providerName}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder={currentGuide.keyPrefix}
                value={config.apiKey || ''}
                onChange={(e) => {
                  setConfig({ ...config, apiKey: e.target.value })
                  setTestResult(null)
                }}
                className={`${CLINICAL_FIELD_CLASS} pr-10 font-mono`}
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                aria-label={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-[var(--ch-text-muted)] hover:text-[var(--ch-text-primary)]"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !config.apiKey?.trim()}
              className={PILL_BTN_SECONDARY}
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ch-accent)]" />
                  <span>Verificando…</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
                  <span>Probar Conexión</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-medium ${
                testResult.ok
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Cloud Model Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[var(--ch-text-secondary)]">
            Modelo de IA Cloud
          </label>
          <select
            value={isCustomModel ? '__custom__' : config.modelName || ''}
            onChange={(e) => handleModelSelect(e.target.value)}
            className={CLINICAL_FIELD_CLASS}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.badge}
              </option>
            ))}
            <option value="__custom__">Personalizado / Otro modelo…</option>
          </select>

          {!isCustomModel ? (
            <p className="text-[11px] text-[var(--ch-text-muted)]">
              {availableModels.find((m) => m.id === config.modelName)?.description ||
                'Modelo de lenguaje para análisis y generación de preguntas clínicas.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <input
                type="text"
                placeholder="ID del modelo (ej. gemini-2.0-flash-exp)…"
                value={config.modelName || ''}
                onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
                className={`${CLINICAL_FIELD_CLASS} font-mono`}
                autoFocus
              />
              <span className="text-[11px] text-[var(--ch-text-muted)]">
                Ingresa el identificador exacto de la API.
              </span>
            </div>
          )}
        </div>

        {/* Local AI WebLLM / WebGPU Section */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-secondary)]/45 p-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ch-accent-soft)] text-[var(--ch-accent)]">
              <Cpu className="h-4 w-4" />
            </span>
            <div>
              <strong className="block text-sm font-semibold text-[var(--ch-text-primary)]">
                Motor de IA Local (WebLLM / WebGPU)
              </strong>
              <span className="text-xs text-[var(--ch-text-muted)]">
                Inferencia médica 100% privada y offline en la GPU del navegador.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--ch-text-secondary)]">
              Modelo local seleccionado
            </label>
            <select
              value={config.localModelId || DEFAULT_LOCAL_MODEL}
              onChange={async (e) => {
                const newModelId = e.target.value
                setConfig({ ...config, localModelId: newModelId })
                const isCached = await isLocalModelCached(newModelId)
                setLocalModelCached(isCached)
              }}
              className={CLINICAL_FIELD_CLASS}
            >
              {AVAILABLE_LOCAL_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.size} ({m.badge})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--ch-text-muted)]">
              {selectedLocalMeta?.description}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ch-text-secondary)]">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ch-accent)]" />
            <span>
              <strong>Compatibilidad:</strong> En ordenadores con WebGPU la IA local corre a máxima
              velocidad. En móviles Android con cierres Vulkan recomendamos usar{' '}
              <strong>Gemini Cloud gratuito</strong>.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-2.5">
              <span className="block font-mono text-[10px] text-[var(--ch-text-muted)] uppercase">
                WebGPU
              </span>
              <strong
                className={`mt-0.5 block text-xs ${
                  webGpuSupported ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {webGpuSupported === null
                  ? 'Verificando…'
                  : webGpuSupported
                    ? 'Compatible'
                    : 'No disponible'}
              </strong>
            </div>

            <div className="rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-2.5">
              <span className="block font-mono text-[10px] text-[var(--ch-text-muted)] uppercase">
                Modelo
              </span>
              <strong className="mt-0.5 block truncate text-xs text-[var(--ch-text-primary)]">
                {selectedLocalMeta?.name || 'Qwen 2.5'}
              </strong>
            </div>

            <div className="rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-2.5">
              <span className="block font-mono text-[10px] text-[var(--ch-text-muted)] uppercase">
                VRAM
              </span>
              <strong className="mt-0.5 block font-mono text-xs text-[var(--ch-text-primary)]">
                {selectedLocalMeta?.vram || '< 1 GB'}
              </strong>
            </div>

            <div className="rounded-xl border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-elevated)] p-2.5">
              <span className="block font-mono text-[10px] text-[var(--ch-text-muted)] uppercase">
                Caché
              </span>
              <strong
                className={`mt-0.5 block text-xs ${
                  localModelCached ? 'text-[var(--ch-accent)]' : 'text-[var(--ch-text-muted)]'
                }`}
              >
                {localModelCached ? 'Descargado' : 'Sin descargar'}
              </strong>
            </div>
          </div>

          {localActionMsg && (
            <div className="rounded-xl border border-[var(--ch-accent)]/30 bg-[var(--ch-accent-soft)] px-3 py-2 text-xs font-medium text-[var(--ch-accent)]">
              {localActionMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PILL_BTN_SECONDARY}
              onClick={async () => {
                await unloadLocalModel()
                setLocalActionMsg('Memoria VRAM liberada correctamente.')
                setTimeout(() => setLocalActionMsg(null), 3000)
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 text-[var(--ch-accent)]" />
              <span>Liberar Memoria VRAM</span>
            </button>

            {localModelCached && (
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-4 text-xs font-semibold text-red-700 transition hover:bg-red-500/20 dark:text-red-300"
                onClick={async () => {
                  const activeModel = config.localModelId || DEFAULT_LOCAL_MODEL
                  await clearLocalModelCache(activeModel)
                  setLocalModelCached(false)
                  setLocalActionMsg('Caché del modelo eliminada correctamente.')
                  setTimeout(() => setLocalActionMsg(null), 3500)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar Caché Local</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </BaseModal>
  )
}
