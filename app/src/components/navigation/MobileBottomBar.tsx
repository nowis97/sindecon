import type { Theme } from '../../hooks/useTheme'

interface MobileBottomBarProps {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  onOpenSearch: () => void
  onOpenQuickCapture: () => void
  onOpenInbox: () => void
  inboxCount: number
  theme: Theme
  onToggleTheme: () => void
}

export function MobileBottomBar({
  onToggleSidebar,
  isSidebarOpen,
  onOpenSearch,
  onOpenQuickCapture,
  onOpenInbox,
  inboxCount,
  theme,
  onToggleTheme,
}: MobileBottomBarProps) {
  return (
    <nav className="mobile-bottom-bar" aria-label="Navegación principal móvil">
      <button
        type="button"
        className={`bottom-nav-item ${isSidebarOpen ? 'active' : ''}`}
        onClick={onToggleSidebar}
        title="Temas y carpetas"
      >
        <span className="bottom-nav-icon">📁</span>
        <span className="bottom-nav-label">Temas</span>
      </button>

      <button
        type="button"
        className="bottom-nav-item"
        onClick={onOpenSearch}
        title="Buscar artículos"
      >
        <span className="bottom-nav-icon">🔍</span>
        <span className="bottom-nav-label">Buscar</span>
      </button>

      <button
        type="button"
        className="bottom-nav-fab"
        onClick={onOpenQuickCapture}
        title="Captura rápida al Inbox"
        aria-label="Captura rápida"
      >
        <span className="fab-icon">⚡</span>
      </button>

      <button
        type="button"
        className="bottom-nav-item inbox-nav-item"
        onClick={onOpenInbox}
        title="Bandeja Inbox"
      >
        <span className="bottom-nav-icon">📥</span>
        <span className="bottom-nav-label">Inbox</span>
        {inboxCount > 0 && (
          <span className="bottom-nav-badge">{inboxCount}</span>
        )}
      </button>

      <button
        type="button"
        className="bottom-nav-item"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        aria-label="Cambiar tema"
      >
        <span className="bottom-nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
        <span className="bottom-nav-label">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
      </button>
    </nav>
  )
}
