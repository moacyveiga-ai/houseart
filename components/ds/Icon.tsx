// Material Symbols Rounded ligature (the font is loaded in app/layout.tsx).
export function Icon({ name, size = 20, filled = false, className = '', label }: {
  name: string; size?: number; filled?: boolean; className?: string; label?: string
}) {
  return (
    <span
      className={`ha-icon ${className}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      style={{ fontSize: size, fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
    >
      {name}
    </span>
  )
}
