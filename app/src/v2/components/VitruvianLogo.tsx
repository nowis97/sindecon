import React from 'react'

export interface VitruvianLogoProps {
  size?: number
  className?: string
}

export const VitruvianLogo: React.FC<VitruvianLogoProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="SINDECON Vitruvian Logo"
      className={className}
    >
      {/* Círculo proporcional */}
      <circle cx="50" cy="50" r="46" strokeWidth="1.2" opacity="0.85" />
      {/* Cuadrado de proporciones humanas */}
      <rect x="12" y="12" width="76" height="76" strokeWidth="1.2" opacity="0.75" />
      
      {/* Cabeza */}
      <circle cx="50" cy="27" r="5" strokeWidth="1.5" />
      
      {/* Tronco y columna */}
      <line x1="50" y1="32" x2="50" y2="58" strokeWidth="1.8" />
      {/* Hombros y pelvis */}
      <line x1="42" y1="36" x2="58" y2="36" strokeWidth="1.5" />
      <line x1="44" y1="58" x2="56" y2="58" strokeWidth="1.5" />

      {/* Brazos horizontales (posición en cruz) */}
      <line x1="14" y1="36" x2="86" y2="36" strokeWidth="1.5" />
      
      {/* Brazos elevados (tocando el círculo superior) */}
      <line x1="50" y1="36" x2="20" y2="22" strokeWidth="1.5" />
      <line x1="50" y1="36" x2="80" y2="22" strokeWidth="1.5" />

      {/* Piernas rectas (posición suelo) */}
      <line x1="46" y1="58" x2="44" y2="88" strokeWidth="1.5" />
      <line x1="54" y1="58" x2="56" y2="88" strokeWidth="1.5" />

      {/* Piernas abiertas (tocando el círculo inferior) */}
      <line x1="46" y1="58" x2="25" y2="82" strokeWidth="1.5" />
      <line x1="54" y1="58" x2="75" y2="82" strokeWidth="1.5" />
    </svg>
  )
}
