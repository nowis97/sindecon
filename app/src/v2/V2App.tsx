import React, { useState } from 'react'
import './styles/v2.css'
import { LandingView } from './views/LandingView'
import { RepositoryView } from './views/RepositoryView'
import { FolderDetailView } from './views/FolderDetailView'
import { EditorWrapperView } from './views/EditorWrapperView'
import type { NodeRow, ArticleRow } from '../db/db'

export type V2ViewType = 'landing' | 'repository' | 'folder' | 'editor'

export interface V2AppProps {
  onSwitchToV1: () => void
  initialView?: V2ViewType
  initialFolderId?: string | null
  initialNoteId?: string | null
  initialUserName?: string
  initialNodes?: NodeRow[]
  initialArticles?: ArticleRow[]
}

export function V2App({
  onSwitchToV1,
  initialView = 'landing',
  initialFolderId = null,
  initialNoteId = null,
  initialUserName,
  initialNodes,
  initialArticles,
}: V2AppProps): React.JSX.Element {
  const [activeView, setActiveView] = useState<V2ViewType>(initialView)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialNoteId)
  const [userName, setUserName] = useState<string>(() => {
    if (initialUserName) return initialUserName
    try {
      return localStorage.getItem('sindecon_user_name') || ''
    } catch {
      return ''
    }
  })

  // Transición 1: Landing -> Repositorio
  const handleEnterRepository = (name: string) => {
    const finalName = name.trim() || 'Colega'
    setUserName(finalName)
    try {
      localStorage.setItem('sindecon_user_name', finalName)
    } catch {
      // Ignore
    }
    setActiveView('repository')
  }

  // Transición 2: Repositorio -> Landing (Cerrar sesión)
  const handleLogout = () => {
    try {
      localStorage.removeItem('sindecon_user_name')
    } catch {
      // Ignore
    }
    setUserName('')
    setSelectedFolderId(null)
    setSelectedNoteId(null)
    setActiveView('landing')
  }

  // Transición 3: Repositorio -> Detalle de Carpeta
  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(folderId)
    setActiveView('folder')
  }

  // Transición 4: Detalle de Carpeta -> Repositorio
  const handleBackToRepository = () => {
    setSelectedFolderId(null)
    setActiveView('repository')
  }

  // Transición 5: Detalle de Carpeta (o Repositorio) -> Editor Clínico
  const handleOpenEditor = (noteId: string) => {
    setSelectedNoteId(noteId)
    setActiveView('editor')
  }

  // Transición 6: Editor Clínico -> Detalle de Carpeta (o Repositorio)
  const handleBackFromEditor = () => {
    setSelectedNoteId(null)
    if (selectedFolderId) {
      setActiveView('folder')
    } else {
      setActiveView('repository')
    }
  }

  return (
    <div className="sindecon-v2 min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {activeView === 'landing' && (
        <LandingView
          onEnterRepository={handleEnterRepository}
          onSwitchToV1={onSwitchToV1}
        />
      )}

      {activeView === 'repository' && (
        <RepositoryView
          userName={userName || 'Colega'}
          onSelectFolder={handleSelectFolder}
          onLogout={handleLogout}
          onSwitchToV1={onSwitchToV1}
          initialNodes={initialNodes}
        />
      )}

      {activeView === 'folder' && selectedFolderId && (
        <FolderDetailView
          folderId={selectedFolderId}
          onBack={handleBackToRepository}
          onOpenEditor={handleOpenEditor}
          onSwitchToV1={onSwitchToV1}
          initialNodes={initialNodes}
          initialArticles={initialArticles}
        />
      )}

      {activeView === 'editor' && selectedNoteId && (
        <EditorWrapperView
          noteId={selectedNoteId}
          onBack={handleBackFromEditor}
          onSwitchToV1={onSwitchToV1}
          initialNode={initialNodes?.find((n) => n.id === selectedNoteId)}
          initialArticle={initialArticles?.find((a) => a.node_id === selectedNoteId)}
        />
      )}
    </div>
  )
}
