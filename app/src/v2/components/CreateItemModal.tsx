import React, { useState, useEffect, useRef } from 'react'

export interface CreateItemModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateFolder: (name: string) => void
  onCreateNote: (title: string, templateKey?: string) => void
  defaultTab?: 'folder' | 'note'
  initialFolderName?: string
  initialNoteTitle?: string
  className?: string
}

export interface ClinicalTemplateOption {
  id: string
  label: string
  description: string
  badge: string
}

export const CLINICAL_TEMPLATES: ClinicalTemplateOption[] = [
  {
    id: 'blank',
    label: 'En blanco',
    description: 'Documento limpio sin secciones predefinidas',
    badge: 'Libre',
  },
  {
    id: 'soap',
    label: 'SOAP (Evolución)',
    description: 'Subjetivo, Objetivo, Análisis, Plan terapéutico',
    badge: 'Consulta',
  },
  {
    id: 'epicrisis',
    label: 'Epicrisis',
    description: 'Resumen clínico de alta y continuidad asistencial',
    badge: 'Hospital',
  },
  {
    id: 'urgencias',
    label: 'Ingreso Urgencias',
    description: 'Triage, anamnesis rápida y conducta de urgencia',
    badge: 'Urgencia',
  },
]

export function CreateItemModal({
  isOpen,
  onClose,
  onCreateFolder,
  onCreateNote,
  defaultTab = 'folder',
  initialFolderName = '',
  initialNoteTitle = '',
  className = '',
}: CreateItemModalProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<'folder' | 'note'>(defaultTab)
  const [folderName, setFolderName] = useState(initialFolderName)
  const [noteTitle, setNoteTitle] = useState(initialNoteTitle)
  const [selectedTemplate, setSelectedTemplate] = useState('blank')

  // Refs for zero-latency testing & node compatibility
  const folderNameRef = useRef(folderName)
  const noteTitleRef = useRef(noteTitle)
  const templateRef = useRef(selectedTemplate)

  useEffect(() => {
    folderNameRef.current = folderName
  }, [folderName])

  useEffect(() => {
    noteTitleRef.current = noteTitle
  }, [noteTitle])

  useEffect(() => {
    templateRef.current = selectedTemplate
  }, [selectedTemplate])

  // Reset fields when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
      setFolderName(initialFolderName)
      folderNameRef.current = initialFolderName
      setNoteTitle(initialNoteTitle)
      noteTitleRef.current = initialNoteTitle
      setSelectedTemplate('blank')
      templateRef.current = 'blank'
    }
  }, [isOpen, defaultTab, initialFolderName, initialNoteTitle])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleFolderChange = (val: string) => {
    folderNameRef.current = val
    setFolderName(val)
  }

  const handleNoteChange = (val: string) => {
    noteTitleRef.current = val
    setNoteTitle(val)
  }

  const handleTemplateSelect = (id: string) => {
    templateRef.current = id
    setSelectedTemplate(id)
  }

  const handleFolderSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
    const name = (folderNameRef.current || folderName || '').trim()
    if (!name) return
    onCreateFolder(name)
    folderNameRef.current = ''
    setFolderName('')
    onClose()
  }

  const handleNoteSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
    const title = (noteTitleRef.current || noteTitle || '').trim()
    if (!title) return
    onCreateNote(title, templateRef.current || selectedTemplate)
    noteTitleRef.current = ''
    setNoteTitle('')
    onClose()
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-item-title"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="create-item-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Crear nuevo elemento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-4 pb-0">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl" role="tablist" aria-label="Tipo de elemento">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'folder'}
              onClick={() => setActiveTab('folder')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'folder'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>📁</span>
              <span>Carpeta</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'note'}
              onClick={() => setActiveTab('note')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'note'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>📄</span>
              <span>Nota Médica</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {activeTab === 'folder' ? (
            <form onSubmit={handleFolderSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="folder-name-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nombre de la carpeta
                </label>
                <input
                  id="folder-name-input"
                  type="text"
                  autoFocus
                  value={folderName}
                  onChange={(e) => handleFolderChange(e.target.value)}
                  placeholder="Nombre de la carpeta..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={handleFolderSubmit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-sm cursor-pointer"
                >
                  Crear Carpeta
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleNoteSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="note-title-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Título de la nota médica
                </label>
                <input
                  id="note-title-input"
                  type="text"
                  autoFocus
                  value={noteTitle}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder="Título de la nota médica..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Plantilla clínica
                </label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plantillas clínicas">
                  {CLINICAL_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      role="radio"
                      aria-checked={selectedTemplate === tmpl.id}
                      onClick={() => handleTemplateSelect(tmpl.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedTemplate === tmpl.id
                          ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-bold">{tmpl.label}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {tmpl.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {tmpl.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={handleNoteSubmit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-sm cursor-pointer"
                >
                  Crear Nota
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
