import { describe, it, expect } from 'vitest'
import { FolderExplorerView, type FolderExplorerViewProps } from './FolderExplorerView'

describe('FolderExplorerView Component Contract', () => {
  it('exporta FolderExplorerView como componente funcional de React', () => {
    expect(typeof FolderExplorerView).toBe('function')
  })

  it('acepta las props del explorador de carpeta con las 8 acciones del menú contextual', () => {
    let deletedId: string | null = null
    let editedId: string | null = null
    let printedId: string | null = null
    let backCalled = false

    const props: FolderExplorerViewProps = {
      folderNode: {
        id: 'folder-cardio',
        parent_id: null,
        kind: 'folder',
        title: 'Cardiología',
        order: 0,
        system: null,
        created_at: 1732147200000,
        updated_at: 1732147200000,
        deleted_at: null,
      },
      nodes: [],
      onSelectNode: () => {},
      onCreateArticle: () => {},
      onCreateSubfolder: () => {},
      onDeleteNode: (id) => {
        deletedId = id
      },
      onEditArticle: (id) => {
        editedId = id
      },
      onPrintArticle: (id) => {
        printedId = id
      },
      onGoBack: () => {
        backCalled = true
      },
    }

    props.onDeleteNode?.('art-1')
    props.onEditArticle?.('art-2')
    props.onPrintArticle?.('art-3')
    props.onGoBack?.()

    expect(deletedId).toBe('art-1')
    expect(editedId).toBe('art-2')
    expect(printedId).toBe('art-3')
    expect(backCalled).toBe(true)
  })

  it('acepta props opcionales de estación unificada (SM-2, plantillas, cabecera global)', () => {
    let templateCall: { title: string; parentId?: string | null } | null = null
    let studyScope: string[] | undefined

    const props: FolderExplorerViewProps = {
      folderNode: {
        id: 'folder-uci',
        parent_id: null,
        kind: 'folder',
        title: 'UCI Adulto',
        order: 0,
        system: null,
        created_at: 1732147200000,
        updated_at: 1732147200000,
        deleted_at: null,
      },
      nodes: [],
      onSelectNode: () => {},
      onCreateArticle: () => {},
      onCreateSubfolder: () => {},
      theme: 'dark',
      onToggleTheme: () => {},
      dueFlashcardsCount: 4,
      onOpenStudy: (nodeIds) => {
        studyScope = nodeIds
      },
      templates: [],
      onCreateFromTemplate: (title, parentId) => {
        templateCall = { title, parentId }
      },
    }

    props.onCreateFromTemplate?.('Protocolo Sepsis', 'folder-uci')
    props.onOpenStudy?.(['art-sepsis'])

    expect(templateCall).toEqual({ title: 'Protocolo Sepsis', parentId: 'folder-uci' })
    expect(studyScope).toEqual(['art-sepsis'])
  })
})
