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
    let movedTarget: string | null | undefined = undefined
    let duplicatedId: string | null = null
    let deletedId: string | null = null

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
      onMoveArticle: (_nodeId, targetFolderId) => {
        movedTarget = targetFolderId
      },
      onDuplicateArticle: (nodeId) => {
        duplicatedId = nodeId
      },
      onDeleteArticle: (nodeId) => {
        deletedId = nodeId
      },
    }

    props.onSetEditMode(true)
    props.onOpenFlashcards()
    props.onOpenSmartImport()
    props.onOpenExportPdf()
    props.onMoveArticle?.('art-ic', 'folder-cardio')
    props.onDuplicateArticle?.('art-ic')
    props.onDeleteArticle?.('art-ic')

    expect(editModeToggled).toBe(true)
    expect(flashcardsOpened).toBe(true)
    expect(smartImportOpened).toBe(true)
    expect(pdfOpened).toBe(true)
    expect(movedTarget).toBe('folder-cardio')
    expect(duplicatedId).toBe('art-ic')
    expect(deletedId).toBe('art-ic')
  })
})
