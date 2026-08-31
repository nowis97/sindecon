import React, { useState, useEffect } from 'react'
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
} from '../../domain/ai/webLlmClient'
import { getStoredToken, isGoogleSyncEnabled, uploadAiConfigToDrive } from '../../pwa/googleDrive'

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
      })
      checkWebGPUSupport().then((res) => setWebGpuSupported(res.supported))
      isLocalModelCached().then((cached) => setLocalModelCached(cached))
      setTestResult(null)
      setSaved(false)
      setShowApiKey(false)
      setLocalActionMsg(null)
    }
  }, [isOpen])

  if (!isOpen) return null

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

    // Si Google Drive está conectado, subimos inmediatamente a appDataFolder
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content ai-settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="header-title-group">
            <div className="topic-modal-title-line">
              <span className="topic-modal-icon">⚙️</span>
              <h3>Configuración de Inteligencia Artificial</h3>
            </div>
            <span className="header-subtitle">
              Configura tu proveedor gratuito para extracción de flashcards y razonamiento clínico.
            </span>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="ai-settings-form">
          {/* Selector de Proveedor */}
          <div className="form-group">
            <label className="field-main-label" htmlFor="ai-provider-select">
              Proveedor de IA:
            </label>
            <select
              id="ai-provider-select"
              className="provider-select-dropdown"
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value as AiConfig['provider'])}
            >
              <option value="gemini">✨ Google Gemini (Recomendado - Gratuito)</option>
              <option value="groq">⚡ Groq Cloud (Ultra Rápido - Gratuito)</option>
              <option value="openai">🧠 OpenAI (GPT-4o Mini / o3-mini)</option>
            </select>

            <div className="provider-selector-grid">
              <button
                type="button"
                className={`provider-card-btn ${config.provider === 'gemini' ? 'active' : ''}`}
                onClick={() => handleProviderChange('gemini')}
              >
                <div className="provider-badge-pill free">Gratis</div>
                <div className="provider-logo-row">
                  <span className="provider-emoji">✨</span>
                  <strong>Google Gemini</strong>
                </div>
                <span className="provider-tagline">Recomendado • 15 req/min</span>
              </button>

              <button
                type="button"
                className={`provider-card-btn ${config.provider === 'groq' ? 'active' : ''}`}
                onClick={() => handleProviderChange('groq')}
              >
                <div className="provider-badge-pill free">Gratis</div>
                <div className="provider-logo-row">
                  <span className="provider-emoji">⚡</span>
                  <strong>Groq Cloud</strong>
                </div>
                <span className="provider-tagline">Ultra Rápido • Llama 3.3</span>
              </button>

              <button
                type="button"
                className={`provider-card-btn ${config.provider === 'openai' ? 'active' : ''}`}
                onClick={() => handleProviderChange('openai')}
              >
                <div className="provider-badge-pill paid">De Pago</div>
                <div className="provider-logo-row">
                  <span className="provider-emoji">🧠</span>
                  <strong>OpenAI</strong>
                </div>
                <span className="provider-tagline">GPT-4o Mini / o3-mini</span>
              </button>
            </div>
          </div>

          {/* Guía Interactiva Paso a Paso para Obtener la API Key */}
          <div className="api-guide-box">
            <div className="api-guide-header">
              <div className="guide-title-line">
                <span className="guide-icon">🔑</span>
                <strong>¿Cómo obtener tu clave de {currentGuide.providerName}?</strong>
              </div>
              <a
                href={currentGuide.portalUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-open-portal"
              >
                <span>Abrir {currentGuide.portalName}</span>
                <span className="external-arrow">↗</span>
              </a>
            </div>

            <p className="guide-free-badge">💡 {currentGuide.freeTierInfo}</p>

            <ol className="guide-steps-list">
              {currentGuide.steps.map((step, idx) => (
                <li key={idx}>
                  <span className="step-num">{idx + 1}</span>
                  <span className="step-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Campo de API Key con Toggle y Botón de Prueba */}
          <div className="form-group">
            <label className="field-main-label">
              API Key de {currentGuide.providerName}:
            </label>
            <div className="api-key-input-row">
              <div className="api-key-field-wrapper">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={currentGuide.keyPrefix}
                  value={config.apiKey || ''}
                  onChange={(e) => {
                    setConfig({ ...config, apiKey: e.target.value })
                    setTestResult(null)
                  }}
                  className="api-key-input"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>

              <button
                type="button"
                className="btn-test-connection"
                onClick={handleTestConnection}
                disabled={testing || !config.apiKey?.trim()}
                title="Probar conexión con esta clave"
              >
                {testing ? (
                  <>
                    <span className="spinner-xs" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Probar Conexión</span>
                  </>
                )}
              </button>
            </div>

            {/* Banner de Resultado de la Prueba */}
            {testResult && (
              <div className={`test-result-banner ${testResult.ok ? 'success' : 'error'}`}>
                <span className="result-icon">{testResult.ok ? '✓' : '⚠️'}</span>
                <span className="result-text">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Selector de Modelos de IA */}
          <div className="form-group">
            <label className="field-main-label">Modelo de IA:</label>
            <div className="model-selector-container">
              <select
                value={isCustomModel ? '__custom__' : config.modelName || ''}
                onChange={(e) => handleModelSelect(e.target.value)}
                className="model-select-dropdown"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.badge}
                  </option>
                ))}
                <option value="__custom__">⚙️ Personalizado / Otro modelo...</option>
              </select>

              {/* Si es un modelo predefinido, mostrar su descripción */}
              {!isCustomModel && (
                <div className="selected-model-info">
                  {availableModels.find((m) => m.id === config.modelName)?.description ||
                    'Modelo de lenguaje para análisis y generación de preguntas clínicas.'}
                </div>
              )}

              {/* Si eligió personalizado, mostrar input de texto */}
              {isCustomModel && (
                <div className="custom-model-input-row">
                  <input
                    type="text"
                    placeholder="Escribe el ID del modelo (ej. gemini-2.0-flash-exp)..."
                    value={config.modelName || ''}
                    onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
                    className="custom-model-input"
                    autoFocus
                  />
                  <small className="helper-text">
                    Ingresa el identificador exacto de la API.
                  </small>
                </div>
              )}
            </div>
          </div>

          {/* Panel de Motor Local WebLLM (Qwen 2.5) */}
          <div className="local-ai-management-section">
            <div className="local-ai-header">
              <span className="local-ai-icon">🧠</span>
              <div className="local-ai-title-block">
                <span className="local-ai-title">Motor de IA Local (WebLLM / WebGPU)</span>
                <span className="local-ai-subtitle">Inferencia médica 100% privada y offline sobre la GPU del navegador</span>
              </div>
            </div>

            <div className="local-ai-details-grid">
              <div className="local-detail-item">
                <span className="detail-label">Hardware WebGPU:</span>
                <span className={`detail-badge ${webGpuSupported ? 'badge-success' : 'badge-warning'}`}>
                  {webGpuSupported === null ? 'Verificando...' : webGpuSupported ? '✓ Compatible' : '⚠️ No disponible'}
                </span>
              </div>
              <div className="local-detail-item">
                <span className="detail-label">Modelo Local:</span>
                <span className="detail-value">Qwen 2.5 (1.5B) Quantized (~1.1 GB)</span>
              </div>
              <div className="local-detail-item">
                <span className="detail-label">Almacenamiento Local:</span>
                <span className={`detail-badge ${localModelCached ? 'badge-info' : 'badge-muted'}`}>
                  {localModelCached ? '📦 Descargado en Caché' : '☁️ No descargado aún'}
                </span>
              </div>
            </div>

            {localActionMsg && (
              <div className="local-ai-action-feedback">
                <span>{localActionMsg}</span>
              </div>
            )}

            <div className="local-ai-button-row">
              <button
                type="button"
                className="btn-local-action"
                onClick={async () => {
                  await unloadLocalModel()
                  setLocalActionMsg('Memoria VRAM liberada correctamente.')
                  setTimeout(() => setLocalActionMsg(null), 3000)
                }}
              >
                🧹 Liberar Memoria VRAM
              </button>
              {localModelCached && (
                <button
                  type="button"
                  className="btn-local-action btn-danger-action"
                  onClick={async () => {
                    await clearLocalModelCache(DEFAULT_LOCAL_MODEL)
                    setLocalModelCached(false)
                    setLocalActionMsg('Caché local del modelo eliminada (~1.1 GB liberados).')
                    setTimeout(() => setLocalActionMsg(null), 3500)
                  }}
                >
                  🗑️ Eliminar Modelo del Caché
                </button>
              )}
            </div>
          </div>

          {/* Acciones del Modal */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {saved ? '✓ Guardado' : 'Guardar Ajustes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
