import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Tailwind v4 styles configuration', () => {
  it('should have v2.css with tailwindcss import and scoped theme rules', () => {
    const cssPath = path.resolve(__dirname, 'v2.css')
    expect(fs.existsSync(cssPath)).toBe(true)
    const content = fs.readFileSync(cssPath, 'utf-8')
    expect(content).toContain('@import "tailwindcss"')
    expect(content).toContain('.sindecon-v2')
  })
})
