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
})
