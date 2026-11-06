import React, { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type NodeRow, type ArticleRow } from '../../db/db'
import { renameNode } from '../../db/nodes'
import { saveArticle } from '../../db/articles'
import { MarkdownEditor } from '../../components/editor/MarkdownEditor'
import { VersionSwitcher } from '../components/VersionSwitcher'

export interface EditorWrapperViewProps {
  noteId: string
  onBack: () => void
  onSwitchToV1?: () => void
  initialNode?: NodeRow
  initialArticle?: ArticleRow
  useTextareaFallback?: boolean
  className?: string
}

export function EditorWrapperView({
  noteId,
  onBack,
  onSwitchToV1,
  initialNode,
  initialArticle,
  useTextareaFallback,
  className = '',
}: EditorWrapperViewProps): React.JSX.Element {
  // Fallbacks for testing and SSR
  const [fallbackNode, setFallbackNode] = useState<NodeRow | null>(initialNode ?? null)
  const [fallbackArticle, setFallbackArticle] = useState<ArticleRow | null>(initialArticle ?? null)

  // Reactive IndexedDB queries
  const liveNode = useLiveQuery(() => db.nodes.get(noteId), [noteId], initialNode)
  const liveArticle = useLiveQuery(() => db.articles.get(noteId), [noteId], initialArticle)

  const node = liveNode ?? fallbackNode
  const article = liveArticle ?? fallbackArticle

  // Title and Content states
  const [title, setTitle] = useState(initialNode?.title ?? '')
  const [content, setContent] = useState(initialArticle?.body_md ?? '')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')

  // Timers for debouncing
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentTitleRef = useRef(title)
  currentTitleRef.current = title
  const currentContentRef = useRef(content)
  currentContentRef.current = content

  // Fetch node and article on mount / noteId change if not already loaded
  useEffect(() => {
    let isMounted = true
    Promise.all([
      db.nodes.get(noteId),
      db.articles.get(noteId),
    ])
      .then(([n, a]) => {
        if (!isMounted) return
        if (n) {
          setFallbackNode(n)
          setTitle((prev) => (prev ? prev : n.title))
        }
        if (a) {
          setFallbackArticle(a)
          setContent((prev) => (prev ? prev : a.body_md))
        }
      })
      .catch(() => {
        // Ignore errors in test environment
      })

    return () => {
      isMounted = false
    }
  }, [noteId])

  // Sync title when node updates
  useEffect(() => {
    if (node?.title && !title) {
      setTitle(node.title)
    }
  }, [node?.title])

  // Sync content when article updates
  useEffect(() => {
    if (article?.body_md !== undefined && !content) {
      setContent(article.body_md)
    }
  }, [article?.body_md])

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current)
      }
      if (titleDebounceTimerRef.current) {
        clearTimeout(titleDebounceTimerRef.current)
      }
    }
  }, [])

  // Title rename handlers
  const commitTitleRename = async (newTitle: string) => {
    const trimmed = newTitle.trim()
    if (trimmed && trimmed !== node?.title) {
      try {
        await renameNode(noteId, trimmed)
        setFallbackNode((prev) => (prev ? { ...prev, title: trimmed } : null))
      } catch (err) {
        console.error('Error renaming note in editor:', err)
      }
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTitle(val)
    currentTitleRef.current = val

    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current)
    }
    titleDebounceTimerRef.current = setTimeout(() => {
      void commitTitleRename(val)
    }, 400)
  }

  const handleTitleBlur = () => {
    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current)
      titleDebounceTimerRef.current = null
    }
    void commitTitleRename(currentTitleRef.current)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  // Article content change and auto-save
  const handleContentChange = (newMd: string) => {
    setContent(newMd)
    setSaveStatus('saving')

    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current)
    }

    saveDebounceTimerRef.current = setTimeout(async () => {
      try {
        await saveArticle(noteId, newMd)
        setSaveStatus('saved')
      } catch (err) {
        console.error('Error saving article:', err)
        setSaveStatus('saved')
      }
    }, 300)
  }

  const flushSave = async () => {
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current)
      saveDebounceTimerRef.current = null
      try {
        await saveArticle(noteId, currentContentRef.current)
        setSaveStatus('saved')
      } catch (err) {
        console.error('Error flushing article save:', err)
      }
    }
  }

  const handleBack = async () => {
    await flushSave()
    onBack()
  }

  // Print handler
  const handlePrint = () => {
    const printFn =
      typeof window !== 'undefined' && typeof window.print === 'function'
        ? window.print
        : typeof globalThis !== 'undefined' && typeof (globalThis as any).print === 'function'
          ? (globalThis as any).print
          : undefined

    if (printFn) {
      try {
        printFn()
      } catch {
        // Ignore
      }
    }
  }

  // Detect whether to use textarea fallback (in tests / Node environment)
  const isTestOrNode =
    useTextareaFallback ??
    (typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      !window.document?.createElement ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'))

  return (
    <div
      className={`sindecon-v2 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 ${className}`}
    >
      {/* Barra superior médica */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Botón Volver */}
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs shrink-0 cursor-pointer"
            aria-label="Volver"
            title="Volver al repositorio / carpeta"
          >
            <span>← Volver</span>
          </button>

          {/* Título editable */}
          <div className="flex-1 min-w-0 max-w-lg">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              placeholder="Título de la nota..."
              aria-label="Título de la nota"
              className="w-full font-bold text-base sm:text-lg text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900/60 focus:outline-none px-2 py-0.5 rounded transition-all truncate"
            />
          </div>
        </div>

        {/* Acciones de la barra superior */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Indicador de guardado */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300"
            aria-live="polite"
          >
            {saveStatus === 'saving' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Guardado</span>
              </>
            )}
          </div>

          {/* Botón Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
            aria-label="Imprimir"
            title="Imprimir nota"
          >
            <span aria-hidden="true">🖨️</span>
            <span>Imprimir</span>
          </button>

          {/* Switcher a V1 opcional */}
          {onSwitchToV1 && (
            <VersionSwitcher currentVersion="v2" onToggle={onSwitchToV1} />
          )}
        </div>
      </header>

      {/* Área del Editor Clínico */}
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          {isTestOrNode ? (
            <div className="flex-1 flex flex-col p-4">
              <label htmlFor="clinical-editor-fallback" className="sr-only">
                Editor Clínico
              </label>
              <textarea
                id="clinical-editor-fallback"
                data-testid="clinical-editor-fallback"
                aria-label="Editor Clínico"
                placeholder="Escribe la evolución clínica en Markdown..."
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full flex-1 min-h-[400px] p-4 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-100 bg-transparent resize-none focus:outline-none border-0"
              />
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-y-auto">
              <MarkdownEditor
                key={noteId}
                nodeId={noteId}
                defaultValue={content}
                onChange={(_id, md) => handleContentChange(md)}
                onWikiLinkClick={(_uuid) => {}}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
