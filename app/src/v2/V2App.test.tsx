import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { V2App } from './V2App'

describe('V2App Component', () => {
  it('renders V2App header and welcome text', () => {
    const handleSwitch = () => {}
    const element = <V2App onSwitchToV1={handleSwitch} />
    const html = renderToString(element)

    expect(html).toContain('SINDECON')
    expect(html).toContain('Bienvenido a SINDECON V2')
    expect(html).toContain('sindecon-v2')
  })
})
