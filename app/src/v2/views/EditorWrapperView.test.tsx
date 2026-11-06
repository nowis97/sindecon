import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { EditorWrapperView } from './EditorWrapperView'
import { db, type NodeRow, type ArticleRow } from '../../db/db'
import * as nodesDb from '../../db/nodes'
import * as articlesDb from '../../db/articles'

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
  blur: () => void
  keyDown: (event: { key: string }) => void
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
      blur: () => match.props?.onBlur?.({ preventDefault: () => {} }),
      keyDown: (e: any) => match.props?.onKeyDown?.(e),
    } as SimulatedElement
  },

  getByLabelText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    const all = flattenElements(activeRenderOutput)
    const match = all.find((el) => {
      const label = el.props?.['aria-label']
      return label && regex.test(label)
    })
    if (!match) {
      throw new Error(`Unable to find element with aria-label matching: ${text}`)
    }
    return {
      node: match,
      click: () => match.props?.onClick?.({ preventDefault: () => {} }),
      change: (e: any) => match.props?.onChange?.(e),
      blur: () => match.props?.onBlur?.({ preventDefault: () => {} }),
      keyDown: (e: any) => match.props?.onKeyDown?.(e),
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
        }
      },
      change: (e: any) => match.props?.onChange?.(e),
      blur: () => match.props?.onBlur?.({ preventDefault: () => {} }),
      keyDown: (e: any) => match.props?.onKeyDown?.(e),
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
      blur: () => clickable.props?.onBlur?.({ preventDefault: () => {} }),
      keyDown: (e: any) => clickable.props?.onKeyDown?.(e),
    } as SimulatedElement
  },
}

const fireEvent = {
  click: async (element: SimulatedElement) => {
    await element.click()
  },
  change: (element: SimulatedElement, event: { target: { value: string } }) => {
    element.change(event)
  },
  blur: (element: SimulatedElement) => {
    element.blur()
  },
  keyDown: (element: SimulatedElement, event: { key: string }) => {
    element.keyDown(event)
  },
}

describe('EditorWrapperView Component', () => {
  const sampleNode: NodeRow = {
    id: 'note-dm2',
    parent_id: 'folder-med',
    kind: 'article',
    title: 'Diabetes Mellitus Tipo 2',
    order: 0,
    system: null,
    created_at: 1700000000000,
    updated_at: 1700000000000,
    deleted_at: null,
  }

  const sampleArticle: ArticleRow = {
    node_id: 'note-dm2',
    body_md: '# Manejo de DM2 Ambulatorio\n\n- Metformina 850mg c/12h\n- HbA1c meta < 7%',
    tags: ['endocrino', 'cronico'],
  }

  beforeEach(async () => {
    printMock.mockReset()
    await db.nodes.clear()
    await db.articles.clear()
    await db.nodes.put(sampleNode)
    await db.articles.put(sampleArticle)
  })

  it('renders clinical editor header with title, status, print, and back buttons', () => {
    const onBack = vi.fn()
    const { html } = render(
      <EditorWrapperView
        noteId="note-dm2"
        onBack={onBack}
        initialNode={sampleNode}
        initialArticle={sampleArticle}
        useTextareaFallback={true}
      />,
    )

    expect(html).toContain('Diabetes Mellitus Tipo 2')
    expect(html).toContain('Guardado')
    expect(html).toContain('Imprimir')
    expect(html).toContain('← Volver')
    expect(html).toContain('Manejo de DM2 Ambulatorio')
  })

  it('renames note via renameNode when editing title and blurring or pressing Enter', async () => {
    const renameSpy = vi.spyOn(nodesDb, 'renameNode')
    render(
      <EditorWrapperView
        noteId="note-dm2"
        onBack={vi.fn()}
        initialNode={sampleNode}
        initialArticle={sampleArticle}
        useTextareaFallback={true}
      />,
    )

    const titleInput = screen.getByLabelText(/Título de la nota/i)
    fireEvent.change(titleInput, { target: { value: 'Diabetes Mellitus 2 Descompensada' } })
    fireEvent.blur(titleInput)

    expect(renameSpy).toHaveBeenCalledWith('note-dm2', 'Diabetes Mellitus 2 Descompensada')
    renameSpy.mockRestore()
  })

  it('auto-saves markdown content when typing in clinical editor textarea', async () => {
    const saveSpy = vi.spyOn(articlesDb, 'saveArticle')
    render(
      <EditorWrapperView
        noteId="note-dm2"
        onBack={vi.fn()}
        initialNode={sampleNode}
        initialArticle={sampleArticle}
        useTextareaFallback={true}
      />,
    )

    const textarea = screen.getByLabelText(/Editor Clínico/i)
    fireEvent.change(textarea, {
      target: {
        value: '# Manejo de DM2 Ambulatorio\n\n- Metformina 850mg c/12h\n- Ajuste con Empagliflozina 10mg',
      },
    })

    // El estado pasa a Guardando...
    expect(activeHtml).toContain('Guardando...')

    // Esperar debounce
    await new Promise((r) => setTimeout(r, 400))

    expect(saveSpy).toHaveBeenCalledWith(
      'note-dm2',
      '# Manejo de DM2 Ambulatorio\n\n- Metformina 850mg c/12h\n- Ajuste con Empagliflozina 10mg',
    )
    expect(activeHtml).toContain('Guardado')
    saveSpy.mockRestore()
  })

  it('triggers window.print when clicking print button', async () => {
    render(
      <EditorWrapperView
        noteId="note-dm2"
        onBack={vi.fn()}
        initialNode={sampleNode}
        initialArticle={sampleArticle}
        useTextareaFallback={true}
      />,
    )

    const printBtn = screen.getByRole('button', { name: /Imprimir/i })
    await fireEvent.click(printBtn)

    expect(printMock).toHaveBeenCalled()
  })

  it('calls onBack when clicking back button and flushes pending save', async () => {
    const onBack = vi.fn()
    const saveSpy = vi.spyOn(articlesDb, 'saveArticle')

    render(
      <EditorWrapperView
        noteId="note-dm2"
        onBack={onBack}
        initialNode={sampleNode}
        initialArticle={sampleArticle}
        useTextareaFallback={true}
      />,
    )

    const textarea = screen.getByLabelText(/Editor Clínico/i)
    fireEvent.change(textarea, { target: { value: 'Nuevo texto sin esperar debounce' } })

    const backBtn = screen.getByRole('button', { name: /Volver/i })
    await fireEvent.click(backBtn)

    expect(saveSpy).toHaveBeenCalledWith('note-dm2', 'Nuevo texto sin esperar debounce')
    expect(onBack).toHaveBeenCalled()
    saveSpy.mockRestore()
  })

  it('renders VersionSwitcher when onSwitchToV1 is passed and allows switching', async () => {
    const handleSwitch = vi.fn()
    render(
      <EditorWrapperView
        noteId="note-dm2"
        onBack={vi.fn()}
        onSwitchToV1={handleSwitch}
        initialNode={sampleNode}
        initialArticle={sampleArticle}
        useTextareaFallback={true}
      />,
    )

    const switchBtn = screen.getByRole('button', { name: /Vista Clásica V1/i })
    await fireEvent.click(switchBtn)

    expect(handleSwitch).toHaveBeenCalled()
  })

  it('flushes pending title rename when clicking back button before debounce expires', async () => {
    const onBack = vi.fn()
    const renameSpy = vi.spyOn(nodesDb, 'renameNode')

    render(
      <EditorWrapperView
        noteId="note-dm2"
        onBack={onBack}
        initialNode={sampleNode}
        initialArticle={sampleArticle}
        useTextareaFallback={true}
      />,
    )

    const titleInput = screen.getByLabelText(/Título de la nota/i)
    fireEvent.change(titleInput, { target: { value: 'Título Modificado Inmediato' } })

    const backBtn = screen.getByRole('button', { name: /Volver/i })
    await fireEvent.click(backBtn)

    expect(renameSpy).toHaveBeenCalledWith('note-dm2', 'Título Modificado Inmediato')
    expect(onBack).toHaveBeenCalled()
    renameSpy.mockRestore()
  })

  it('shows loading placeholder when article is not loaded', () => {
    const { html } = render(
      <EditorWrapperView
        noteId="unloaded-note-id"
        onBack={vi.fn()}
        useTextareaFallback={false}
      />,
    )

    expect(html).toContain('Cargando nota clínica...')
  })
})
