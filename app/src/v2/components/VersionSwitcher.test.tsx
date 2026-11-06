import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { VersionSwitcher } from './VersionSwitcher'

describe('VersionSwitcher Component', () => {
  it('renders switch button for v2 and fires onToggle callback', () => {
    const handleToggle = vi.fn()
    const element = <VersionSwitcher currentVersion="v2" onToggle={handleToggle} />
    const rendered = VersionSwitcher(element.props)
    expect(rendered.props['aria-label']).toBe('Vista Clásica V1')

    const html = renderToString(element)
    expect(html).toContain('Vista Clásica V1')
    expect(html).toContain('⏪')

    rendered.props.onClick()
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('renders v2 switch option when in v1 and fires onToggle callback', () => {
    const handleToggle = vi.fn()
    const element = <VersionSwitcher currentVersion="v1" onToggle={handleToggle} />
    const rendered = VersionSwitcher(element.props)
    expect(rendered.props['aria-label']).toBe('Probar Vista V2')

    const html = renderToString(element)
    expect(html).toContain('Probar Vista V2')
    expect(html).toContain('✨')

    rendered.props.onClick()
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })
})
