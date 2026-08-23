import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'cuaderno-theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return { theme, toggleTheme, setTheme }
}
