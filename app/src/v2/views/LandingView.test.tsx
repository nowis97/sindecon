import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { LandingView } from './LandingView'
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
  getByLabelText: (labelText: RegExp | string) => {
    const regex = labelText instanceof RegExp ? labelText : new RegExp(labelText, 'i')
    const all = flattenElements(activeRenderOutput)
    
    // Find label
    const labelNode = all.find((el) => {
      if (el.type !== 'label') return false
      const txt = getNodeText(el)
      return regex.test(txt)
    })

    if (!labelNode) {
      throw new Error(`Unable to find label matching: ${labelText}`)
    }

    const htmlFor = labelNode.props?.htmlFor
    let targetInput: any = null

    if (htmlFor) {
      targetInput = all.find((el) => el.props?.id === htmlFor)
    } else {
      // Check for nested input
      const nested = flattenElements(labelNode.props?.children)
      targetInput = nested.find((el) => el.type === 'input')
    }

    if (!targetInput) {
      throw new Error(`Found label for "${labelText}" but could not find corresponding input (id=${htmlFor})`)
    }

    return {
      node: targetInput,
      click: () => targetInput.props?.onClick?.({ preventDefault: () => {} }),
      change: (e: any) => targetInput.props?.onChange?.(e),
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
          // Find enclosing form and trigger submit
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
    return { node: match, text: activeHtml }
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

describe('LandingView (Mockup Page 1)', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.restoreAllMocks()
  })

  it('renders branding with SINDECON title, subtitle, and VitruvianLogo', () => {
    const { html } = render(<LandingView onEnterRepository={() => {}} />)
    expect(html).toContain('SINDECON')
    expect(html).toContain('Sistema de Información y Notas para Decisiones Clínicas')
    expect(html).toContain('sindecon-v2')
    expect(html).toContain('aria-label="SINDECON Vitruvian Logo"')
  })

  it('renders Usuario and Contraseña inputs and submits to repository with user name', () => {
    const handleEnter = vi.fn()
    render(<LandingView onEnterRepository={handleEnter} />)

    const userInput = screen.getByLabelText(/usuario/i)
    const passInput = screen.getByLabelText(/contraseña/i)
    expect(userInput).toBeDefined()
    expect(passInput).toBeDefined()

    fireEvent.change(userInput, { target: { value: 'Dr. Gregory House' } })
    fireEvent.change(passInput, { target: { value: '1234' } })

    const enterBtn = screen.getByRole('button', { name: /entrar al repositorio/i })
    fireEvent.click(enterBtn)

    expect(handleEnter).toHaveBeenCalledWith('Dr. Gregory House')
    expect(localStorage.getItem('sindecon_user_name')).toBe('Dr. Gregory House')
  })

  it('defaults to Colega when submitting empty username', () => {
    const handleEnter = vi.fn()
    render(<LandingView onEnterRepository={handleEnter} />)

    const enterBtn = screen.getByRole('button', { name: /entrar al repositorio/i })
    fireEvent.click(enterBtn)

    expect(handleEnter).toHaveBeenCalledWith('Colega')
    expect(localStorage.getItem('sindecon_user_name')).toBe('Colega')
  })

  it('prefills username from localStorage if already saved', () => {
    localStorage.setItem('sindecon_user_name', 'Dra. Cuddy')
    const handleEnter = vi.fn()
    render(<LandingView onEnterRepository={handleEnter} />)

    const userInput = screen.getByLabelText(/usuario/i)
    expect(userInput.node.props.value).toBe('Dra. Cuddy')

    const enterBtn = screen.getByRole('button', { name: /entrar al repositorio/i })
    fireEvent.click(enterBtn)

    expect(handleEnter).toHaveBeenCalledWith('Dra. Cuddy')
  })

  it('prefills username from Google Drive email if no username exists', () => {
    localStorage.setItem('cuaderno-gdrive-email', 'allison.cameron@hospital.org')
    const handleEnter = vi.fn()
    render(<LandingView onEnterRepository={handleEnter} />)

    const userInput = screen.getByLabelText(/usuario/i)
    expect(userInput.node.props.value).toBe('allison.cameron')
  })

  it('displays Google Drive connected status and allows disconnection', () => {
    localStorage.setItem('cuaderno-gdrive-email', 'chase@hospital.org')
    localStorage.setItem('cuaderno-gdrive-enabled', 'true')
    render(<LandingView onEnterRepository={() => {}} />)

    expect(screen.getByText(/chase@hospital.org/i)).toBeDefined()
    const disconnectBtn = screen.getByRole('button', { name: /desconectar|cerrar sesión/i })
    fireEvent.click(disconnectBtn)

    expect(localStorage.getItem('cuaderno-gdrive-email')).toBeNull()
  })

  it('triggers Google Drive authentication when clicking connect button', () => {
    const signInSpy = vi.spyOn(gdrive, 'signInWithGoogle').mockImplementation((onSuccess) => {
      onSuccess('mock-token', 'foreman@hospital.org')
    })

    render(<LandingView onEnterRepository={() => {}} />)
    const connectBtn = screen.getByRole('button', { name: /conectar con google drive|iniciar sesión con google/i })
    fireEvent.click(connectBtn)

    expect(signInSpy).toHaveBeenCalledTimes(1)
  })

  it('renders QuickLauncherGrid with 6 tools below the form', () => {
    render(<LandingView onEnterRepository={() => {}} />)
    expect(screen.getByText(/drive/i)).toBeDefined()
    expect(screen.getByText(/chatgpt/i)).toBeDefined()
    expect(screen.getByText(/outlook/i)).toBeDefined()
    expect(screen.getByText(/canvas/i)).toBeDefined()
    expect(screen.getByText(/mi currículum|mi curricon/i)).toBeDefined()
    expect(screen.getByText(/gmail/i)).toBeDefined()
  })

  it('triggers onSwitchToV1 callback when switch button is clicked', () => {
    const handleSwitch = vi.fn()
    render(<LandingView onEnterRepository={() => {}} onSwitchToV1={handleSwitch} />)

    const switchBtn = screen.getByRole('button', { name: /vista clásica v1/i })
    fireEvent.click(switchBtn)

    expect(handleSwitch).toHaveBeenCalledTimes(1)
  })
})
