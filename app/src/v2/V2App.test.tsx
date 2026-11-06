import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { V2App } from './V2App'
import { db, type NodeRow, type ArticleRow } from '../db/db'

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
      const prevVal = stateSlots[idx]
      stateSlots[idx] = typeof next === 'function' ? next(stateSlots[idx]) : next
      // If V2App's activeView (idx === 0) changed, child component changed: reset child hooks
      if (idx === 0 && prevVal !== stateSlots[idx]) {
        stateSlots.length = 4
        refSlots.length = 0
      }
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
  useContext: (ctx: any) => ctx?._currentValue,
  useSyncExternalStore: (_subscribe: any, getSnapshot: any, getServerSnapshot?: any) => {
    if (typeof getServerSnapshot === 'function') {
      try {
        return getServerSnapshot()
      } catch {
        // fallback
      }
    }
    if (typeof getSnapshot === 'function') {
      try {
        return getSnapshot()
      } catch {
        // fallback
      }
    }
    return undefined
  },
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
      throw new Error(`Unable to find text matching: ${text}`)
    }

    const target = matches[matches.length - 1]
    const clickable = all.find((el) => el.props?.onClick && flattenElements(el).includes(target)) || target

    return {
      node: clickable,
      click: async () => {
        if (clickable.props?.onClick) {
          await clickable.props.onClick({ preventDefault: () => {} })
        }
      },
      change: (e: any) => clickable.props?.onChange?.(e),
    } as SimulatedElement
  },

  queryByText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    const all = flattenElements(activeRenderOutput)
    return all.find((el) => regex.test(getNodeText(el))) || null
  },
}

const fireEvent = {
  click: async (element: SimulatedElement) => {
    await element.click()
  },
  change: (element: SimulatedElement, event: { target: { value: string } }) => {
    element.change(event)
  },
}

describe('V2App Orchestration and View Flow', () => {
  const sampleFolder: NodeRow = {
    id: 'folder-cardio',
    parent_id: null,
    kind: 'folder',
    title: 'Cardiología',
    order: 0,
    system: null,
    created_at: 1700000000000,
    updated_at: 1700000000000,
    deleted_at: null,
  }

  const sampleNote: NodeRow = {
    id: 'note-iam',
    parent_id: 'folder-cardio',
    kind: 'article',
    title: 'Infarto Agudo al Miocardio',
    order: 0,
    system: null,
    created_at: 1700000001000,
    updated_at: 1700000001000,
    deleted_at: null,
  }

  const sampleArticle: ArticleRow = {
    node_id: 'note-iam',
    body_md: '# Infarto Agudo al Miocardio\n\nPaciente varón de 60 años con supradesnivel ST.',
    tags: ['urgencias', 'cardio'],
  }

  beforeEach(async () => {
    localStorageMock.clear()
    printMock.mockReset()
    await db.nodes.clear()
    await db.articles.clear()
    await db.nodes.bulkAdd([sampleFolder, sampleNote])
    await db.articles.put(sampleArticle)
  })

  it('renders LandingView initially when no user is active', () => {
    const handleSwitch = vi.fn()
    const { html } = render(
      <V2App
        onSwitchToV1={handleSwitch}
        initialNodes={[sampleFolder, sampleNote]}
        initialArticles={[sampleArticle]}
      />,
    )

    // Debería renderizar la pantalla de bienvenida / landing
    expect(html).toContain('Entrar al Repositorio')
    expect(html).toContain('sindecon-v2')
    expect(screen.queryByText(/¡Hola/i)).toBeNull()
  })

  it('transitions from LandingView to RepositoryView on login / submit', async () => {
    const handleSwitch = vi.fn()
    render(
      <V2App
        onSwitchToV1={handleSwitch}
        initialNodes={[sampleFolder, sampleNote]}
        initialArticles={[sampleArticle]}
      />,
    )

    // Ingresar nombre de médico
    const input = screen.getByPlaceholderText(/Gregory House/i)
    fireEvent.change(input, { target: { value: 'Dra. Pérez' } })

    // Submit del formulario
    const submitBtn = screen.getByRole('button', { name: /Entrar al Repositorio/i })
    await fireEvent.click(submitBtn)

    // Ahora debemos estar en RepositoryView
    expect(activeHtml).toContain('¡Hola Dra. Pérez!')
    expect(activeHtml).toContain('Cardiología')
    expect(localStorage.getItem('sindecon_user_name')).toBe('Dra. Pérez')
  })

  it('transitions from RepositoryView to FolderDetailView when clicking a folder', async () => {
    render(
      <V2App
        onSwitchToV1={vi.fn()}
        initialView="repository"
        initialUserName="Dr. House"
        initialNodes={[sampleFolder, sampleNote]}
        initialArticles={[sampleArticle]}
      />,
    )

    expect(activeHtml).toContain('¡Hola Dr. House!')
    expect(activeHtml).toContain('Cardiología')

    // Click en la carpeta de Cardiología
    const folderCard = screen.getByText('Cardiología')
    await fireEvent.click(folderCard)

    // Ahora debemos estar en FolderDetailView
    expect(activeHtml).toContain('Volver a Mi Repositorio')
    expect(activeHtml).toContain('Infarto Agudo al Miocardio')
  })

  it('transitions from FolderDetailView to EditorWrapperView when opening a note', async () => {
    render(
      <V2App
        onSwitchToV1={vi.fn()}
        initialView="folder"
        initialFolderId="folder-cardio"
        initialUserName="Dr. House"
        initialNodes={[sampleFolder, sampleNote]}
        initialArticles={[sampleArticle]}
      />,
    )

    expect(activeHtml).toContain('Infarto Agudo al Miocardio')

    // Click en el título de la nota para abrir el editor
    const noteCard = screen.getByText('Infarto Agudo al Miocardio')
    await fireEvent.click(noteCard)

    // Ahora debemos estar en EditorWrapperView
    expect(activeHtml).toContain('Guardado')
    expect(activeHtml).toContain('Imprimir')
    expect(activeHtml).toContain('Editor Clínico')
  })

  it('supports complete backwards navigation across all views', async () => {
    render(
      <V2App
        onSwitchToV1={vi.fn()}
        initialView="editor"
        initialFolderId="folder-cardio"
        initialNoteId="note-iam"
        initialUserName="Dr. House"
        initialNodes={[sampleFolder, sampleNote]}
        initialArticles={[sampleArticle]}
      />,
    )

    // 1. En editor, hacer click en ← Volver
    const editorBackBtn = screen.getByRole('button', { name: /Volver/i })
    await fireEvent.click(editorBackBtn)

    // Regresa a FolderDetailView
    expect(activeHtml).toContain('Volver a Mi Repositorio')
    expect(activeHtml).toContain('Cardiología')

    // 2. En carpeta, hacer click en ← Volver a Mi Repositorio
    const folderBackBtn = screen.getByRole('button', { name: /Volver a Mi Repositorio/i })
    await fireEvent.click(folderBackBtn)

    // Regresa a RepositoryView
    expect(activeHtml).toContain('¡Hola Dr. House!')
    expect(activeHtml).toContain('Cardiología')

    // 3. En repositorio, hacer click en Salir / Cerrar sesión
    const logoutBtn = screen.getByRole('button', { name: /Cerrar sesión|Salir/i })
    await fireEvent.click(logoutBtn)

    // Regresa a LandingView
    expect(activeHtml).toContain('Entrar al Repositorio')
  })

  it('triggers onSwitchToV1 callback from header or switcher', async () => {
    const handleSwitch = vi.fn()
    render(
      <V2App
        onSwitchToV1={handleSwitch}
        initialNodes={[sampleFolder, sampleNote]}
        initialArticles={[sampleArticle]}
      />,
    )

    const switchBtn = screen.getByRole('button', { name: /Vista Clásica V1/i })
    await fireEvent.click(switchBtn)

    expect(handleSwitch).toHaveBeenCalled()
  })
})
