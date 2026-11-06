import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { RepositoryView } from './RepositoryView'
import { db } from '../../db/db'
import * as gdrive from '../../pwa/googleDrive'

// Mock localStorage for node test environment
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

type ElementNode = React.ReactElement<any>

interface SimulatedElement {
  node: ElementNode
  click: () => void
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
    } catch {
      activeRenderOutput = null
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
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join(' ')
  if (node?.props?.children) return getNodeText(node.props.children)
  return ''
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
      click: () => {
        if (match.props?.onClick) {
          match.props.onClick({ preventDefault: () => {} })
        } else if (match.props?.type === 'submit') {
          const form = all.find((el) => el.type === 'form')
          form?.props?.onSubmit?.({ preventDefault: () => {} })
        }
      },
      change: (e: any) => match.props?.onChange?.(e),
    } as SimulatedElement
  },

  getByText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    const all = flattenElements(activeRenderOutput)
    const match = all.find((el) => regex.test(getNodeText(el)))
    if (!match && !regex.test(activeHtml)) {
      throw new Error(`Unable to find text: ${text}`)
    }
    return {
      node: match,
      text: activeHtml,
      click: () => match?.props?.onClick?.({ preventDefault: () => {} }),
      change: (e: any) => match?.props?.onChange?.(e),
    } as SimulatedElement
  },
}

const fireEvent = {
  click: (element: SimulatedElement) => {
    element.click()
  },
  change: (element: SimulatedElement, event: { target: { value: string } }) => {
    element.change(event)
  },
}

describe('RepositoryView (Mockup Page 2)', () => {
  beforeEach(async () => {
    localStorageMock.clear()
    vi.restoreAllMocks()
    await Promise.all([
      db.nodes.clear(),
      db.articles.clear(),
      db.assets.clear(),
      db.meta.clear(),
    ])
  })

  it('displays user greeting, Drive button, and search input', () => {
    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
        onSwitchToV1={() => {}}
      />
    )

    expect(screen.getByText(/¡hola dr\. house!/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/buscar/i)).toBeDefined()
    expect(screen.getByText(/mi repositorio/i)).toBeDefined()
  })

  it('renders fallback greeting when userName is empty', () => {
    render(
      <RepositoryView
        userName=""
        onSelectFolder={() => {}}
      />
    )
    expect(screen.getByText(/¡hola colega!/i)).toBeDefined()
  })

  it('renders Drive button and triggers authentication when clicked', () => {
    const signInSpy = vi.spyOn(gdrive, 'signInWithGoogle').mockImplementation((onSuccess) => {
      onSuccess('mock-token', 'house@hospital.org')
    })

    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
      />
    )

    const driveBtn = screen.getByRole('button', { name: /drive|conectar.*drive/i })
    expect(driveBtn).toBeDefined()
    fireEvent.click(driveBtn)

    expect(signInSpy).toHaveBeenCalledTimes(1)
  })

  it('renders connected Drive email when user is connected', () => {
    localStorage.setItem('cuaderno-gdrive-email', 'cuddy@hospital.org')
    localStorage.setItem('cuaderno-gdrive-enabled', 'true')

    render(
      <RepositoryView
        userName="Dra. Cuddy"
        onSelectFolder={() => {}}
      />
    )

    expect(screen.getByText(/cuddy@hospital.org/i)).toBeDefined()
  })

  it('renders list of folders from initialNodes or DB with note count and formatted date', () => {
    const mockFolder = {
      id: 'f1',
      parent_id: null,
      kind: 'folder' as const,
      title: 'Medicina Interna',
      order: 0,
      system: null,
      created_at: 1730850000000,
      updated_at: 1730850000000,
      deleted_at: null,
    }
    const mockNote1 = {
      id: 'n1',
      parent_id: 'f1',
      kind: 'article' as const,
      title: 'Lupus eritematoso',
      order: 0,
      system: null,
      created_at: 1730850000000,
      updated_at: 1730850000000,
      deleted_at: null,
    }
    const mockNote2 = {
      id: 'n2',
      parent_id: 'f1',
      kind: 'article' as const,
      title: 'Sarcoidosis',
      order: 1,
      system: null,
      created_at: 1730850000000,
      updated_at: 1730850000000,
      deleted_at: null,
    }

    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
        initialNodes={[mockFolder, mockNote1, mockNote2]}
      />
    )

    expect(screen.getByText(/medicina interna/i)).toBeDefined()
    expect(screen.getByText(/2 notas/i)).toBeDefined()
  })

  it('invokes onSelectFolder callback when clicking a folder card', () => {
    const handleSelectFolder = vi.fn()
    const mockFolder = {
      id: 'f-cardio',
      parent_id: null,
      kind: 'folder' as const,
      title: 'Cardiología',
      order: 0,
      system: null,
      created_at: 1730850000000,
      updated_at: 1730850000000,
      deleted_at: null,
    }

    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={handleSelectFolder}
        initialNodes={[mockFolder]}
      />
    )

    const folderCard = screen.getByRole('button', { name: /cardiología/i })
    fireEvent.click(folderCard)

    expect(handleSelectFolder).toHaveBeenCalledWith('f-cardio')
  })

  it('filters folders dynamically when typing into search input', () => {
    const folderA = {
      id: 'f-neuro',
      parent_id: null,
      kind: 'folder' as const,
      title: 'Neurología',
      order: 0,
      system: null,
      created_at: 1730850000000,
      updated_at: 1730850000000,
      deleted_at: null,
    }
    const folderB = {
      id: 'f-trauma',
      parent_id: null,
      kind: 'folder' as const,
      title: 'Traumatología',
      order: 1,
      system: null,
      created_at: 1730850000000,
      updated_at: 1730850000000,
      deleted_at: null,
    }

    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
        initialNodes={[folderA, folderB]}
      />
    )

    const searchInput = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(searchInput, { target: { value: 'Neuro' } })

    expect(screen.getByText(/neurología/i)).toBeDefined()
    expect(() => screen.getByRole('button', { name: /traumatología/i })).toThrow()
  })

  it('invokes onSwitchToV1 when clicking the V1 switcher button', () => {
    const handleSwitch = vi.fn()
    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
        onSwitchToV1={handleSwitch}
      />
    )

    const v1Btn = screen.getByRole('button', { name: /vista clásica v1/i })
    fireEvent.click(v1Btn)

    expect(handleSwitch).toHaveBeenCalledTimes(1)
  })

  it('invokes onLogout when clicking logout button', () => {
    const handleLogout = vi.fn()
    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
        onLogout={handleLogout}
      />
    )

    const logoutBtn = screen.getByRole('button', { name: /salir|cerrar sesión/i })
    fireEvent.click(logoutBtn)

    expect(handleLogout).toHaveBeenCalledTimes(1)
  })

  it('renders BottomNav with FAB and opens CreateItemModal when clicked', () => {
    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
      />
    )

    const fabBtn = screen.getByRole('button', { name: /nueva nota o carpeta/i })
    expect(fabBtn).toBeDefined()

    fireEvent.click(fabBtn)

    // Modal should now be open
    expect(screen.getByText(/crear carpeta|nombre de la carpeta/i)).toBeDefined()
    expect(screen.getByText(/nota médica/i)).toBeDefined()
  })

  it('creates a new folder when submitted from CreateItemModal', async () => {
    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
      />
    )

    const fabBtn = screen.getByRole('button', { name: /nueva nota o carpeta/i })
    fireEvent.click(fabBtn)

    const folderNameInput = screen.getByPlaceholderText(/nombre de la carpeta/i)
    fireEvent.change(folderNameInput, { target: { value: 'Infectología' } })

    const createBtn = screen.getByRole('button', { name: /crear carpeta/i })
    fireEvent.click(createBtn)

    // Wait for async createNode to complete
    await new Promise((r) => setTimeout(r, 50))
    const liveFolder = await db.nodes.filter((n) => n.title === 'Infectología').first()
    expect(liveFolder).toBeDefined()
    expect(liveFolder?.kind).toBe('folder')
    expect(liveFolder?.parent_id).toBeNull()
  })

  it('creates a new note with template when submitted from CreateItemModal', async () => {
    render(
      <RepositoryView
        userName="Dr. House"
        onSelectFolder={() => {}}
      />
    )

    const fabBtn = screen.getByRole('button', { name: /nueva nota o carpeta/i })
    fireEvent.click(fabBtn)

    // Switch to note tab
    const noteTab = screen.getByRole('tab', { name: /nota médica/i })
    fireEvent.click(noteTab)

    const noteTitleInput = screen.getByPlaceholderText(/título de la nota médica/i)
    fireEvent.change(noteTitleInput, { target: { value: 'Paciente Wilson - Evolución' } })

    const createNoteBtn = screen.getByRole('button', { name: /crear nota/i })
    fireEvent.click(createNoteBtn)

    await new Promise((r) => setTimeout(r, 50))
    const liveNote = await db.nodes.filter((n) => n.title === 'Paciente Wilson - Evolución').first()
    expect(liveNote).toBeDefined()
    expect(liveNote?.kind).toBe('article')
    expect(liveNote?.parent_id).toBeNull()
  })
})
