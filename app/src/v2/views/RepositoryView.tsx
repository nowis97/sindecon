import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type NodeRow } from '../../db/db'
import { createNode } from '../../db/nodes'
import { saveArticle } from '../../db/articles'
import { BottomNav } from '../components/BottomNav'
import { CreateItemModal } from '../components/CreateItemModal'
import { VersionSwitcher } from '../components/VersionSwitcher'
import {
  getStoredEmail,
  getStoredToken,
  signInWithGoogle,
  clearStoredToken,
} from '../../pwa/googleDrive'
import { performGoogleDriveSync } from '../../pwa/syncEngine'

export interface RepositoryViewProps {
  userName: string
  onSelectFolder: (folderId: string) => void
  onSwitchToV1?: () => void
  onLogout?: () => void
  initialNodes?: NodeRow[]
  className?: string
}

function formatFolderDate(timestamp: number): string {
  if (!timestamp) return ''
  try {
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return ''
    const day = String(d.getDate()).padStart(2, '0')
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  } catch {
    return ''
  }
}

export function RepositoryView({
  userName,
  onSelectFolder,
  onSwitchToV1,
  onLogout,
  initialNodes,
  className = '',
}: RepositoryViewProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fallback state for Node/test environments
  const [fallbackNodes, setFallbackNodes] = useState<NodeRow[]>(initialNodes ?? [])

  // Google Drive state
  const [gdriveEmail, setGdriveEmail] = useState<string | null>(() => {
    try {
      return getStoredEmail()
    } catch {
      return null
    }
  })

  // Reactive IndexedDB query
  const liveNodes = useLiveQuery(
    () => db.nodes.filter((n) => n.deleted_at === null).toArray(),
    [],
    initialNodes,
  )

  // Synchronize IndexedDB nodes in test environments or on mount if not using live query
  useEffect(() => {
    let isMounted = true
    db.nodes
      .filter((n) => n.deleted_at === null)
      .toArray()
      .then((records) => {
        if (isMounted && records.length > 0) {
          setFallbackNodes(records)
        }
      })
      .catch(() => {
        // Ignore test errors
      })
    return () => {
      isMounted = false
    }
  }, [])

  const allNodes = useMemo(() => {
    if (liveNodes && liveNodes.length > 0) return liveNodes
    if (fallbackNodes && fallbackNodes.length > 0) return fallbackNodes
    return []
  }, [liveNodes, fallbackNodes])

  // Count active notes contained per folder
  const notesCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const n of allNodes) {
      if (n.kind === 'article' && n.parent_id && n.deleted_at === null) {
        map[n.parent_id] = (map[n.parent_id] || 0) + 1
      }
    }
    return map
  }, [allNodes])

  // Top-level folders (parent_id === null)
  const rootFolders = useMemo(() => {
    return allNodes
      .filter((n) => n.kind === 'folder' && n.parent_id === null && n.deleted_at === null)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }, [allNodes])

  // Filter folders according to search query
  const filteredFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rootFolders
    return rootFolders.filter((f) => f.title.toLowerCase().includes(q))
  }, [rootFolders, searchQuery])

  // Root articles (if any exist at the root level)
  const rootArticles = useMemo(() => {
    return allNodes
      .filter((n) => n.kind === 'article' && n.parent_id === null && n.deleted_at === null)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }, [allNodes])

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rootArticles
    return rootArticles.filter((a) => a.title.toLowerCase().includes(q))
  }, [rootArticles, searchQuery])

  // Handle Google Drive auth & sync
  const handleConnectGoogle = () => {
    signInWithGoogle(
      (_token, email) => {
        if (email) {
          setGdriveEmail(email)
        }
      },
      (err) => {
        console.warn('Google Drive auth warning:', err)
      },
    )
  }

  const handleSyncGoogle = async () => {
    const token = getStoredToken()
    if (!token) {
      handleConnectGoogle()
      return
    }
    try {
      setIsSyncing(true)
      await performGoogleDriveSync(token)
    } catch (err) {
      console.warn('Sync error:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDisconnectGoogle = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      clearStoredToken(true)
    } catch {
      // Ignore
    }
    setGdriveEmail(null)
  }

  // Handle Folder creation from FAB modal
  const handleCreateFolder = async (name: string) => {
    const folder = await createNode({
      kind: 'folder',
      title: name,
      parent_id: null,
    })
    setFallbackNodes((prev) => [...prev, folder])
    setIsCreateModalOpen(false)
  }

  // Handle Note creation from FAB modal
  const handleCreateNote = async (title: string, templateKey?: string) => {
    const note = await createNode({
      kind: 'article',
      title,
      parent_id: null,
    })

    let initialBody = ''
    if (templateKey === 'soap') {
      initialBody = '# Evolución Clínica (SOAP)\n\n## Subjetivo\n\n## Objetivo\n\n## Análisis\n\n## Plan\n'
    } else if (templateKey === 'epicrisis') {
      initialBody = '# Epicrisis Médica\n\n## Diagnóstico de Ingreso\n\n## Diagnóstico de Egreso\n\n## Resumen de Hospitalización\n\n## Indicaciones al Alta\n'
    } else if (templateKey === 'urgencias') {
      initialBody = '# Ingreso Urgencias\n\n## Triage y Signos Vitales\n\n## Motivo de Consulta\n\n## Anamnesis\n\n## Examen Físico\n\n## Conducta de Urgencia\n'
    }

    if (initialBody) {
      await saveArticle(note.id, initialBody)
    }

    setFallbackNodes((prev) => [...prev, note])
    setIsCreateModalOpen(false)
  }

  const displayName = userName && userName.trim() ? userName.trim() : 'Colega'

  return (
    <div
      className={`sindecon-v2 min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-200/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 flex flex-col pb-24 ${className}`}
    >
      {/* Cabecera superior según Mockup Página 2 */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>{`¡Hola ${displayName}!`}</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Bienvenido a tu repositorio clínico
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Botón de Drive */}
          {gdriveEmail ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 shadow-xs">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8.2 3.8 2.5 13.8l3.4 5.9 5.8-10.1L8.2 3.8Z" fill="#0066DA" />
                <path d="M15.8 3.8H8.2l3.5 6 7.6-.1-3.5-5.9Z" fill="#00AC47" />
                <path d="m11.7 9.8-5.8 10h12.3l5.8-10H11.7Z" fill="#EA4335" />
                <path d="M17.5 13.8 11.7 3.8h.1l5.8 10h-.1Z" fill="#FFBA00" />
              </svg>
              <button
                type="button"
                onClick={handleSyncGoogle}
                disabled={isSyncing}
                className="hover:underline font-semibold cursor-pointer max-w-[140px] truncate"
                title={`Sincronizar con Drive (${gdriveEmail})`}
                aria-label={`Drive conectado (${gdriveEmail})`}
              >
                {isSyncing ? 'Sincronizando…' : gdriveEmail}
              </button>
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 text-xs ml-1 cursor-pointer"
                title="Desconectar Google Drive"
                aria-label="Desconectar Drive"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/90 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Conectar con Google Drive"
              aria-label="Conectar con Google Drive"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8.2 3.8 2.5 13.8l3.4 5.9 5.8-10.1L8.2 3.8Z" fill="#0066DA" />
                <path d="M15.8 3.8H8.2l3.5 6 7.6-.1-3.5-5.9Z" fill="#00AC47" />
                <path d="m11.7 9.8-5.8 10h12.3l5.8-10H11.7Z" fill="#EA4335" />
                <path d="M17.5 13.8 11.7 3.8h.1l5.8 10h-.1Z" fill="#FFBA00" />
              </svg>
              <span>Conectar Drive</span>
            </button>
          )}

          {/* Botón Vista Clásica V1 */}
          {onSwitchToV1 && (
            <VersionSwitcher currentVersion="v2" onToggle={onSwitchToV1} />
          )}

          {/* Opción Salir / Cerrar sesión */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <span>🚪</span>
              <span>Salir</span>
            </button>
          )}
        </div>
      </header>

      {/* Contenido principal: Título, Buscador y Lista de Carpetas */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col">
        {/* Título de sección "Mi Repositorio" */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Mi Repositorio</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Expedientes, historias clínicas y notas organizadas por especialidad
            </p>
          </div>
        </div>

        {/* Buscador interactivo */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Buscar..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 shadow-xs transition-all"
            aria-label="Buscar"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* Listado de Carpetas */}
        {filteredFolders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFolders.map((folder) => {
              const count = notesCountMap[folder.id] ?? 0
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => onSelectFolder(folder.id)}
                  className="group relative flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-md transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label={`${folder.title}, ${count} notas`}
                >
                  {/* Icono de carpeta estilizado */}
                  <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                      />
                    </svg>
                  </div>

                  {/* Metadatos de la carpeta */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                      {folder.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {count === 1 ? '1 nota' : `${count} notas`}
                      </span>
                      {folder.updated_at ? (
                        <>
                          <span>•</span>
                          <span>{formatFolderDate(folder.updated_at)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Flecha indicadora de navegación */}
                  <div className="text-slate-300 group-hover:text-teal-500 transition-colors self-center">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3">
              <span className="text-2xl">📁</span>
            </div>
            {searchQuery ? (
              <>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No se encontraron carpetas
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Ninguna carpeta coincide con la búsqueda &ldquo;{searchQuery}&rdquo;.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Tu repositorio está vacío
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Crea tu primera carpeta clínica o nota con el botón circular (+) de la barra inferior.
                </p>
              </>
            )}
          </div>
        )}

        {/* Sección de notas sueltas en la raíz (si existen o si se busca) */}
        {filteredArticles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Notas en la raíz ({filteredArticles.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredArticles.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-left"
                >
                  <span className="text-lg">📄</span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {note.title}
                    </span>
                    {note.updated_at ? (
                      <span className="text-[11px] text-slate-400">
                        {formatFolderDate(note.updated_at)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Barra de navegación inferior con FAB central circular */}
      <BottomNav
        activeTab="home"
        onFabClick={() => setIsCreateModalOpen(true)}
        onOpenSearch={() => searchInputRef.current?.focus()}
      />

      {/* Modal de creación de nueva carpeta o nota */}
      <CreateItemModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateFolder={handleCreateFolder}
        onCreateNote={handleCreateNote}
      />
    </div>
  )
}
