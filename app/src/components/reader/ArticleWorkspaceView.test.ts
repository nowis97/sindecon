import { describe, it, expect } from 'vitest'
import {
  ArticleWorkspaceView,
  type ArticleWorkspaceViewProps,
} from './ArticleWorkspaceView'

describe('ArticleWorkspaceView Component Contract', () => {
  it('exporta ArticleWorkspaceView como componente funcional de React', () => {
    expect(typeof ArticleWorkspaceView).toBe('function')
  })

  it('acepta las props completas de lectura, edición y herramientas clínicas', () => {
    let editModeToggled: boolean | null = null
    let flashcardsOpened = false
    let smartImportOpened = false
    let pdfOpened = false

    const props: ArticleWorkspaceViewProps = {
      articleNode: {
        id: 'art-ic',
        parent_id: null,
        kind: 'article',
        title: 'Insuficiencia Cardíaca',
        order: 0,
        system: null,
        created_at: 1732147200000,
        updated_at: 1732147200000,
        deleted_at: null,
      },
      nodes: [],
      tags: ['cardiologia', 'uci'],
      currentBody: '# Insuficiencia Cardíaca\n\n## Definición\nSíndrome clínico.',
      isArticleReady: true,
      isPdfArticle: false,
      effectiveEditMode: false,
      editorRevision: 0,
      editorRef: { current: null },
      backlinks: [],
      isFavorite: true,
      onToggleFavorite: () => {},
      onRenameArticle: () => {},
      onSelectNode: () => {},
      onSelectArticle: () => {},
      onSetEditMode: (val) => {
        editModeToggled = val
      },
      onSaveMarkdown: () => {},
      onOpenExportPdf: () => {
        pdfOpened = true
      },
      onOpenExportGoogleDocs: () => {},
      onOpenFlashcards: () => {
        flashcardsOpened = true
      },
      onOpenSmartImport: () => {
        smartImportOpened = true
      },
      onCreateArticle: () => {},
      onOpenCommandPalette: () => {},
    }

    props.onSetEditMode(true)
    props.onOpenFlashcards()
    props.onOpenSmartImport()
    props.onOpenExportPdf()

    expect(editModeToggled).toBe(true)
    expect(flashcardsOpened).toBe(true)
    expect(smartImportOpened).toBe(true)
    expect(pdfOpened).toBe(true)
  })
})
