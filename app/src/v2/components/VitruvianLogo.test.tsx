import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { VitruvianLogo } from './VitruvianLogo'

function render(element: React.ReactElement) {
  const html = renderToString(element)
  return {
    container: {
      querySelector: (selector: string) => {
        if (selector === 'svg') {
          const match = html.match(/<svg([^>]*)>/)
          if (!match) return null
          const attrs = match[1]
          return {
            getAttribute: (attr: string) => {
              const attrMatch = attrs.match(new RegExp(`${attr}="([^"]*)"`))
              return attrMatch ? attrMatch[1] : null
            },
          }
        }
        return null
      },
    },
  }
}

describe('VitruvianLogo Component', () => {
  it('renders svg with proper attributes', () => {
    const { container } = render(<VitruvianLogo size={48} className="text-teal-600" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.getAttribute('width')).toBe('48')
    expect(svg?.getAttribute('height')).toBe('48')
    expect(svg?.getAttribute('aria-label')).toBe('SINDECON Vitruvian Logo')
  })

  it('renders with default size if not provided', () => {
    const { container } = render(<VitruvianLogo />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('40')
    expect(svg?.getAttribute('height')).toBe('40')
  })
})
