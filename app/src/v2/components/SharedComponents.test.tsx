import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { BottomNav } from './BottomNav'
import { QuickLauncherGrid, QUICK_LAUNCHERS } from './QuickLauncherGrid'
import { CreateItemModal } from './CreateItemModal'

// Lightweight testing-library simulator for Node test environment (0 dependencies, ponytail compliant)
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
      change: (e: any) => {
        match.props?.onChange?.(e)
      },
    } as SimulatedElement
  },

  getByText: (text: RegExp | string) => {
    const regex = text instanceof RegExp ? text : new RegExp(text, 'i')
    if (regex.test(activeHtml)) {
      return { text: activeHtml }
    }
    const all = flattenElements(activeRenderOutput)
    const match = all.find((el) => regex.test(getNodeText(el)))
    if (!match) {
      throw new Error(`Unable to find text: ${text}`)
    }
    return { node: match }
  },

  getByPlaceholderText: (placeholder: RegExp | string) => {
    const regex = placeholder instanceof RegExp ? placeholder : new RegExp(placeholder, 'i')
    const all = flattenElements(activeRenderOutput)
    const match = all.find((el) => el.props?.placeholder && regex.test(el.props.placeholder))
    if (!match) {
      throw new Error(`Unable to find placeholder matching: ${placeholder}`)
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
      change: (e: any) => {
        match.props?.onChange?.(e)
      },
    } as SimulatedElement
  },
}

const fireEvent = {
  click: (element: SimulatedElement) => {
    if (element.click) {
      element.click()
    } else if (element.node?.props?.onClick) {
      element.node.props.onClick({ preventDefault: () => {} })
    }
  },
  change: (element: SimulatedElement, event: { target: { value: string } }) => {
    if (element.change) {
      element.change(event)
    } else if (element.node?.props?.onChange) {
      element.node.props.onChange(event)
    }
  },
}

describe('Shared V2 Components', () => {
  describe('BottomNav', () => {
    it('renders BottomNav with central FAB button and triggers callback', () => {
      const handleFab = vi.fn()
      const handleHome = vi.fn()
      render(<BottomNav onFabClick={handleFab} onNavigateHome={handleHome} />)
      const fab = screen.getByRole('button', { name: /nueva nota o carpeta|acción principal/i })
      expect(fab).toBeDefined()
      fireEvent.click(fab)
      expect(handleFab).toHaveBeenCalledTimes(1)
    })

    it('triggers home and search callbacks when their respective buttons are clicked', () => {
      const handleHome = vi.fn()
      const handleSearch = vi.fn()
      render(<BottomNav onFabClick={() => {}} onNavigateHome={handleHome} onOpenSearch={handleSearch} />)

      const homeBtn = screen.getByRole('button', { name: /^inicio$/i })
      fireEvent.click(homeBtn)
      expect(handleHome).toHaveBeenCalledTimes(1)

      const searchBtn = screen.getByRole('button', { name: /^buscar$/i })
      fireEvent.click(searchBtn)
      expect(handleSearch).toHaveBeenCalledTimes(1)
    })
  })

  describe('QuickLauncherGrid', () => {
    it('renders QuickLauncherGrid with 6 tools from the mockup', () => {
      render(<QuickLauncherGrid />)
      expect(screen.getByText(/drive/i)).toBeDefined()
      expect(screen.getByText(/chatgpt/i)).toBeDefined()
      expect(screen.getByText(/outlook/i)).toBeDefined()
      expect(screen.getByText(/canvas/i)).toBeDefined()
      expect(screen.getByText(/mi currículum|mi curricon/i)).toBeDefined()
      expect(screen.getByText(/gmail/i)).toBeDefined()
    })

    it('contains exact URLs and secure target attributes for all 6 tools', () => {
      expect(QUICK_LAUNCHERS).toHaveLength(6)
      const urls = QUICK_LAUNCHERS.map((l) => l.url)
      expect(urls).toContain('https://drive.google.com')
      expect(urls).toContain('https://chatgpt.com')
      expect(urls).toContain('https://outlook.office.com')
      expect(urls).toContain('https://canvas.instructure.com')
      expect(urls).toContain('https://www.linkedin.com')
      expect(urls).toContain('https://mail.google.com')

      const { html } = render(<QuickLauncherGrid />)
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
    })
  })

  describe('CreateItemModal', () => {
    it('renders CreateItemModal and submits folder creation', () => {
      const handleCreateFolder = vi.fn()
      const handleClose = vi.fn()
      render(
        <CreateItemModal
          isOpen={true}
          onClose={handleClose}
          onCreateFolder={handleCreateFolder}
          onCreateNote={() => {}}
        />
      )
      expect(screen.getByText(/crear nuevo elemento/i)).toBeDefined()
      const folderInput = screen.getByPlaceholderText(/nombre de la carpeta/i)
      fireEvent.change(folderInput, { target: { value: 'Cardiología' } })
      const createBtn = screen.getByRole('button', { name: /crear carpeta/i })
      fireEvent.click(createBtn)
      expect(handleCreateFolder).toHaveBeenCalledWith('Cardiología')
    })

    it('submits medical note creation with template selection', () => {
      const handleCreateNote = vi.fn()
      const handleClose = vi.fn()
      render(
        <CreateItemModal
          isOpen={true}
          defaultTab="note"
          onClose={handleClose}
          onCreateFolder={() => {}}
          onCreateNote={handleCreateNote}
        />
      )
      const noteInput = screen.getByPlaceholderText(/título de la nota médica/i)
      fireEvent.change(noteInput, { target: { value: 'Insuficiencia Cardíaca Aguda' } })

      const soapOption = screen.getByRole('radio', { name: /soap/i })
      fireEvent.click(soapOption)

      const createBtn = screen.getByRole('button', { name: /crear nota/i })
      fireEvent.click(createBtn)

      expect(handleCreateNote).toHaveBeenCalledWith('Insuficiencia Cardíaca Aguda', 'soap')
    })

    it('returns null when isOpen is false', () => {
      render(
        <CreateItemModal
          isOpen={false}
          onClose={() => {}}
          onCreateFolder={() => {}}
          onCreateNote={() => {}}
        />
      )
      expect(activeRenderOutput).toBeNull()
    })

    it('triggers onClose when close button is clicked', () => {
      const handleClose = vi.fn()
      render(
        <CreateItemModal
          isOpen={true}
          onClose={handleClose}
          onCreateFolder={() => {}}
          onCreateNote={() => {}}
        />
      )
      const closeBtn = screen.getByRole('button', { name: /cerrar modal/i })
      fireEvent.click(closeBtn)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })
})
