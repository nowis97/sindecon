import { useState, useEffect, useCallback } from 'react'

const FAVORITES_STORAGE_KEY = 'cuaderno-favorites'

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // Ignorar error de parsing
    }
    return []
  })

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds))
    } catch {
      // Ignorar error de almacenamiento
    }
  }, [favoriteIds])

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds],
  )

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }, [])

  return { favoriteIds, isFavorite, toggleFavorite }
}
