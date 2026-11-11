import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { FolderDetailView } from './FolderDetailView'
import { NoteContextMenu } from '../components/NoteContextMenu'
import { db, type NodeRow, type ArticleRow } from '../../db/db'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString()
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k]
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock window.print
const printMock = vi.fn()
Object.defineProperty(globalThis, 'print', {
  value: printMock,
  writable: true,
})

type ElementNode = React.ReactElement<any>

interface SimulatedElement {
  node: ElementNode
  click: () => void | Promise<void>
  change: (event: { target: { value: string } }) => void
}

let activeRenderElement: React.ReactElement | null = null
let activeRenderOutput: any = null
let activeHtml = ''

let stateSlots: any[] = []
let stateIndex = 0
let refSlots: any[] = []
let refIndex = 0

const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

const testDispatcher = {
  useState: (initial: any) => {
    const idx = stateIndex++
    if (stateSlots.length <= idx) {
      stateSlots[idx] = typeof initial === 'function' ? initial() : initial
    }
    const setState = (next: any) => {
      stateSlots[idx] = typeof next === 'function' ? next(stateSlots[idx]) : next
      reRender()
    }
    return [stateSlots[idx], setState]
  },
  useReducer: (reducer: any, initial: any) => {
    const idx = stateIndex++
    if (stateSlots.length <= idx) {
      stateSlots[idx] = initial
    }
    const dispatch = (action: any) => {
      stateSlots[idx] = reducer(stateSlots[idx], action)
      reRender()
    }
    return [stateSlots[idx], dispatch]
  },
  useRef: (initial: any) => {
    const idx = refIndex++
    if (refSlots.length <= idx) {
      refSlots[idx] = { current: initial }
    }
    return refSlots[idx]
  },
  useEffect: () => {},
  useCallback: (fn: any) => fn,
  useMemo: (fn: any) => fn(),
  useId: () => 'id-' + Math.random().toString(36).substring(2, 9),
  useDebugValue: () => {},
}

function reRender() {
  if (!activeRenderElement) return
  if (internals) {
    internals.H = testDispatcher
  }
  stateIndex = 0
  refIndex = 0
  if (typeof activeRenderElement.type === 'function') {
    try {
      activeRenderOutput = (activeRenderElement.type as any)(activeRenderElement.props)
      activeHtml = renderToString(activeRenderOutput)
    } catch {
      activeRenderOutput = null
      activeHtml = ''
    }
  } else {
    activeRenderOutput = activeRenderElement
  }
}

function render(element: React.ReactElement) {
  activeRenderElement = element
  stateSlots = []
  refSlots = []
  try {
    activeHtml = renderToString(element)
  } catch {
    activeHtml = ''
  }
  reRender()
  return {
    html: activeHtml,
  }
}

function flattenElements(node: any): any[] {
  if (!node || typeof node !== 'object') return []
  if (typeof node.type === 'function') {
    try {
      const rendered = node.type(node.props)
      return [node, ...flattenElements(rendered)]
    } catch {
      return [node]
    }
  }
  const list = [node]
  const children = node.props?.children
  if (Array.isArray(children)) {
    for (const child of children) {
      list.push(...flattenElements(child))
    }
  } else if (children && typeof children === 'object') {
    list.push(...flattenElements(children))
  }
  return list
}

function getNodeText(node: any): string {
  if (!node) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join(' ')
  if (node.props?.children) return getNodeText(node.props.children)
  return ''
}

function findClickableElement(target: any, all: any[]) {
  if (target?.props?.onClick) return target
  const parent = all.find((el) => el.props?.onClick && flattenElements(el).includes(target))
  return parent || target
}

const screen = {
  getByPlaceholderText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    const all = flattenElements(activeRenderOutput)
    const match = all.find((el) => {
      const ph = el.props?.placeholder
      return ph && regex.test(ph)
    })
    if (!match) {
      throw new Error(`Unable to find placeholder matching: ${text}`)
    }
    return {
      node: match,
      click: () => match.props?.onClick?.({ preventDefault: () => {} }),
      change: (e: any) => match.props?.onChange?.(e),
    } as SimulatedElement
  },

  getByRole: (role: string, options?: { name?: RegExp | string }) => {
    const all = flattenElements(activeRenderOutput)
    const match = all.find((el) => {
      const isRole = el.type === role || el.props?.role === role
      if (!isRole) return false
      if (!options?.name) return true

      const accessibleName =
        el.props?.['aria-label'] ||
        el.props?.title ||
        getNodeText(el)

      if (options.name instanceof RegExp) {
        return options.name.test(accessibleName)
      }
      return accessibleName.includes(options.name)
    })

    if (!match) {
      throw new Error(`Unable to find role "${role}" with name ${options?.name}`)
    }

    return {
      node: match,
      click: async () => {
        if (match.props?.onClick) {
          await match.props.onClick({ preventDefault: () => {} })
        } else if (match.props?.type === 'submit') {
          const form = all.find((el) => el.type === 'form')
          await form?.props?.onSubmit?.({ preventDefault: () => {} })
        }
      },
      change: (e: any) => match.props?.onChange?.(e),
    } as SimulatedElement
  },

  getByText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    const all = flattenElements(activeRenderOutput)
    const matches = all.filter((el) => regex.test(getNodeText(el)))
    if (matches.length === 0) {
      throw new Error(`Unable to find text: ${text}`)
    }
    // Smallest text content is the most specific leaf node
    const match = matches.sort((a, b) => getNodeText(a).length - getNodeText(b).length)[0]
    const clickable = findClickableElement(match, all)

    return {
      node: match,
      text: getNodeText(match),
      click: async () => {
        if (clickable?.props?.onClick) {
          await clickable.props.onClick({ preventDefault: () => {}, currentTarget: {} })
        } else if (match?.props?.onClick) {
          await match.props.onClick({ preventDefault: () => {}, currentTarget: {} })
        }
      },
      change: (e: any) => match?.props?.onChange?.(e),
    } as SimulatedElement
  },

  getAllByText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    const all = flattenElements(activeRenderOutput)
    // Filter to buttons or clickable elements matching
    const matches = all.filter((el) => (el.type === 'button' || el.props?.onClick) && regex.test(getNodeText(el)))
    return matches.map((target) => ({
      node: target,
      text: getNodeText(target),
      click: async () => {
        await target.props?.onClick?.({ preventDefault: () => {}, currentTarget: {} })
      },
      change: (e: any) => target.props?.onChange?.(e),
    }))
  },

  queryByText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    const all = flattenElements(activeRenderOutput)
    const matches = all.filter((el) => regex.test(getNodeText(el)))
    if (matches.length === 0) return null
    const match = matches.sort((a, b) => getNodeText(a).length - getNodeText(b).length)[0]
    const clickable = findClickableElement(match, all)
    return {
      node: match,
      text: getNodeText(match),
      click: async () => {
        if (clickable?.props?.onClick) {
          await clickable.props.onClick({ preventDefault: () => {}, currentTarget: {} })
        }
      },
    }
  },
}

const fireEvent = {
  click: async (element: SimulatedElement | { click: () => void | Promise<void> }) => {
    await element.click()
    await new Promise((r) => setTimeout(r, 10))
  },
  change: (element: SimulatedElement, event: { target: { value: string } }) => {
    element.change(event)
  },
}

describe('FolderDetailView and NoteContextMenu (Mockup Page 3)', () => {
  const mockFolder: NodeRow = {
    id: 'folder-1',
    parent_id: null,
    kind: 'folder',
    title: 'Cardiología Clínica',
    order: 0,
    system: null,
    created_at: 1730764800000,
    updated_at: 1730764800000,
    deleted_at: null,
  }

  const mockFolder2: NodeRow = {
    id: 'folder-2',
    parent_id: null,
    kind: 'folder',
    title: 'Medicina Interna',
    order: 1,
    system: null,
    created_at: 1730764800000,
    updated_at: 1730764800000,
    deleted_at: null,
  }

  const mockNotes: NodeRow[] = [
    {
      id: 'note-1',
      parent_id: 'folder-1',
      kind: 'article',
      title: 'Estenosis Aórtica Severa',
      order: 0,
      system: null,
      created_at: 1730764800000, // 05 Nov 2026
      updated_at: 1730764800000,
      deleted_at: null,
    },
    {
      id: 'note-2',
      parent_id: 'folder-1',
      kind: 'article',
      title: 'Insuficiencia Cardíaca Aguda',
      order: 1,
      system: null,
      created_at: 1730851200000,
      updated_at: 1730851200000,
      deleted_at: null,
    },
  ]

  const mockArticles: ArticleRow[] = [
    {
      node_id: 'note-1',
      body_md: '# Estenosis Aórtica\nGradiente medio > 40 mmHg',
      tags: ['urgencias', 'valvulopatía'],
    },
    {
      node_id: 'note-2',
      body_md: '# Insuficiencia Cardíaca\nFracción de eyección reducida',
      tags: ['urgencias', 'hemodinamia'],
    },
  ]

  beforeEach(async () => {
    localStorageMock.clear()
    vi.restoreAllMocks()
    printMock.mockReset()
    await Promise.all([
      db.nodes.clear(),
      db.articles.clear(),
      db.assets.clear(),
      db.meta.clear(),
    ])
    await db.nodes.bulkAdd([mockFolder, mockFolder2, ...mockNotes])
    await db.articles.bulkAdd(mockArticles)
  })

  it('renders header with back button, folder title, and note counter', async () => {
    const onBack = vi.fn()
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={onBack}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, mockFolder2, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Back button
    const backBtn = screen.getByText(/volver a mi repositorio|volver/i)
    expect(backBtn).toBeDefined()
    await fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalled()

    // Title and counter
    expect(screen.getByText(/cardiología clínica/i)).toBeDefined()
    expect(screen.getByText(/2 notas/i)).toBeDefined()
  })

  it('renders table with columns Documento, Fecha Creación, Etiqueta, Acciones', () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    expect(screen.getByText(/documento/i)).toBeDefined()
    expect(screen.getByText(/fecha creación/i)).toBeDefined()
    expect(screen.getByText(/etiqueta/i)).toBeDefined()
    expect(screen.getByText(/acciones/i)).toBeDefined()

    // Notes displayed
    expect(screen.getByText(/estenosis aórtica severa/i)).toBeDefined()
    expect(screen.getByText(/insuficiencia cardíaca aguda/i)).toBeDefined()
    // Tags displayed
    expect(screen.getByText(/valvulopatía/i)).toBeDefined()
    expect(screen.getByText(/hemodinamia/i)).toBeDefined()
  })

  it('invokes onOpenEditor when clicking on note title', async () => {
    const onOpenEditor = vi.fn()
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={onOpenEditor}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    const noteLink = screen.getByText(/estenosis aórtica severa/i)
    await fireEvent.click(noteLink)
    expect(onOpenEditor).toHaveBeenCalledWith('note-1')
  })

  it('NoteContextMenu displays the exact 7 actions from mockup page 3', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    render(
      <NoteContextMenu
        noteId="note-1"
        noteTitle="Estenosis Aórtica Severa"
        currentTags={['urgencias']}
        onAction={onAction}
        onClose={onClose}
      />
    )

    expect(screen.getByText(/eliminar/i)).toBeDefined()
    expect(screen.getByText(/mover a/i)).toBeDefined()
    expect(screen.getByText(/exportar -> editor/i)).toBeDefined()
    expect(screen.getByText(/imprimir/i)).toBeDefined()
    expect(screen.getByText(/etiqueta/i)).toBeDefined()
    expect(screen.getByText(/seleccionar/i)).toBeDefined()
    expect(screen.getByText(/marcar/i)).toBeDefined()
  })

  it('triggers onAction with export_editor when clicking Exportar -> Editor', async () => {
    const onAction = vi.fn()
    render(
      <NoteContextMenu
        noteId="note-1"
        noteTitle="Estenosis Aórtica Severa"
        onAction={onAction}
        onClose={vi.fn()}
      />
    )

    const exportBtn = screen.getByText(/exportar -> editor/i)
    await fireEvent.click(exportBtn)
    expect(onAction).toHaveBeenCalledWith('export_editor')
  })

  it('clamps NoteContextMenu position to viewport and includes max-h-[85vh] overflow-y-auto', () => {
    const { html } = render(
      <NoteContextMenu
        noteId="note-1"
        noteTitle="Estenosis Aórtica Severa"
        position={{ x: 1200, y: 900 }}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(html).toContain('max-h-[85vh]')
    expect(html).toContain('overflow-y-auto')
  })

  it('opens context menu in FolderDetailView when clicking actions button (···)', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    const actionButtons = screen.getAllByText(/···/)
    expect(actionButtons.length).toBeGreaterThan(0)
    await fireEvent.click(actionButtons[0])

    // Verify context menu is visible with the 7 actions
    expect(screen.getByText(/eliminar/i)).toBeDefined()
    expect(screen.getByText(/mover a/i)).toBeDefined()
    expect(screen.getByText(/exportar -> editor/i)).toBeDefined()
    expect(screen.getByText(/imprimir/i)).toBeDefined()
    expect(screen.getByText(/etiqueta/i)).toBeDefined()
    expect(screen.getByText(/seleccionar/i)).toBeDefined()
    expect(screen.getByText(/marcar/i)).toBeDefined()
  })

  it('filters notes with search input by title or body', () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    const searchInput = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(searchInput, { target: { value: 'insuficiencia' } })

    expect(screen.getByText(/insuficiencia cardíaca aguda/i)).toBeDefined()
    expect(screen.queryByText(/estenosis aórtica severa/i)).toBeNull()
  })

  it('filters notes when clicking a tag in the right-side panel', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Right side panel shows tags
    const tagFilterButton = screen.getByText(/valvulopatía/i)
    await fireEvent.click(tagFilterButton)

    // Only note-1 has valvulopatía
    expect(screen.getByText(/estenosis aórtica severa/i)).toBeDefined()
    expect(screen.queryByText(/insuficiencia cardíaca aguda/i)).toBeNull()
  })

  it('allows moving a note to another folder via Mover A action', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, mockFolder2, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Open context menu
    const actionButtons = screen.getAllByText(/···/)
    await fireEvent.click(actionButtons[0])

    // Click Mover A
    const moveAction = screen.getByText(/mover a/i)
    await fireEvent.click(moveAction)

    // Modal to move appears with destination folder
    expect(screen.getByText(/mover nota a otra carpeta/i)).toBeDefined()
    const targetFolderOption = screen.getByText(/medicina interna/i)
    await fireEvent.click(targetFolderOption)

    const confirmMoveBtn = screen.getByRole('button', { name: /mover nota|confirmar mover/i })
    await fireEvent.click(confirmMoveBtn)

    // The note should be moved out of folder-1
    const movedInDb = await db.nodes.get('note-1')
    expect(movedInDb?.parent_id).toBe('folder-2')
  })

  it('allows deleting a note via Eliminar action with confirmation', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Open context menu
    const actionButtons = screen.getAllByText(/···/)
    await fireEvent.click(actionButtons[0])

    // Click Eliminar
    const deleteAction = screen.getByText(/eliminar/i)
    await fireEvent.click(deleteAction)

    // Confirm deletion in modal
    expect(screen.getByText(/¿deseas eliminar esta nota clínica\?|eliminar nota/i)).toBeDefined()
    const confirmDeleteBtn = screen.getByRole('button', { name: /eliminar definitivamente|confirmar eliminación|eliminar/i })
    await fireEvent.click(confirmDeleteBtn)

    const deletedInDb = await db.nodes.get('note-1')
    expect(deletedInDb?.deleted_at).not.toBeNull()
  })

  it('allows marking note status (▲ Urgente, ● En Proceso, ■ Completado)', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Open context menu
    const actionButtons = screen.getAllByText(/···/)
    await fireEvent.click(actionButtons[0])

    // Click Marcar
    const markAction = screen.getByText(/marcar/i)
    await fireEvent.click(markAction)

    // Select Urgent
    const urgentMarker = screen.getByText(/urgente/i)
    await fireEvent.click(urgentMarker)

    // Check that marker is displayed
    expect(screen.getByText(/▲/i)).toBeDefined()
  })

  it('does not erase existing marker when clicking Marcar header with undefined payload', async () => {
    await db.meta.put({ key: 'marker:note-1', value: 'urgent' })

    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Open context menu
    const actionButtons = screen.getAllByText(/···/)
    await fireEvent.click(actionButtons[0])

    // Click Marcar header (which passes payload = undefined)
    const markAction = screen.getByText(/marcar/i)
    await fireEvent.click(markAction)

    // Marker should still be present
    expect(screen.getByText(/▲/i)).toBeDefined()
  })

  it('triggers window.print when choosing Imprimir action', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Open context menu
    const actionButtons = screen.getAllByText(/···/)
    await fireEvent.click(actionButtons[0])

    // Click Imprimir
    const printAction = screen.getByText(/imprimir/i)
    await fireEvent.click(printAction)

    expect(printMock).toHaveBeenCalled()
  })

  it('allows editing note tags via Etiqueta action', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Open context menu
    const actionButtons = screen.getAllByText(/···/)
    await fireEvent.click(actionButtons[0])

    // Click Etiqueta
    const tagAction = screen.getByText(/- etiqueta/i)
    await fireEvent.click(tagAction)

    // Modal to edit tags appears
    expect(screen.getByText(/editar etiquetas/i)).toBeDefined()
    const tagInput = screen.getByPlaceholderText(/ej\. urgencias/i)
    fireEvent.change(tagInput, { target: { value: 'urgencias, cardiología, shock' } })

    const saveTagsBtn = screen.getByRole('button', { name: /guardar etiquetas/i })
    await fireEvent.click(saveTagsBtn)

    const articleInDb = await db.articles.get('note-1')
    expect(articleInDb?.tags).toContain('shock')
  })

  it('allows activating selection mode via Seleccionar action', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // Open context menu
    const actionButtons = screen.getAllByText(/···/)
    await fireEvent.click(actionButtons[0])

    // Click Seleccionar
    const selectAction = screen.getByText(/seleccionar/i)
    await fireEvent.click(selectAction)

    // Selection toolbar appears
    expect(screen.getByText(/seleccionada\(s\)/i)).toBeDefined()
  })

  it('opens CreateItemModal on FAB click and creates note in active folder', async () => {
    render(
      <FolderDetailView
        folderId="folder-1"
        onBack={vi.fn()}
        onOpenEditor={vi.fn()}
        initialNodes={[mockFolder, ...mockNotes]}
        initialArticles={mockArticles}
      />
    )

    // FAB button in BottomNav
    const fabBtn = screen.getByRole('button', { name: /nueva nota o carpeta/i })
    await fireEvent.click(fabBtn)

    // Switch to note tab
    const noteTab = screen.getByRole('tab', { name: /nota médica/i })
    await fireEvent.click(noteTab)

    const noteTitleInput = screen.getByPlaceholderText(/título de la nota médica/i)
    fireEvent.change(noteTitleInput, { target: { value: 'Miocardiopatía Hipertrófica' } })

    const submitBtn = screen.getByRole('button', { name: /crear nota/i })
    await fireEvent.click(submitBtn)

    await new Promise((r) => setTimeout(r, 50))
    const liveNote = await db.nodes.filter((n) => n.title === 'Miocardiopatía Hipertrófica').first()
    expect(liveNote).toBeDefined()
    expect(liveNote?.kind).toBe('article')
    expect(liveNote?.parent_id).toBe('folder-1')
  })
})
