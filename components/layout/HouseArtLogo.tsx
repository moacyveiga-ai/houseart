// The glyph of the design: 16×20 rectangle with a 1.5px border and a 7×7
// square in the top-right corner, followed by the Fraunces wordmark.
export function HouseArtLogo({ size = 20, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const w = (size * 16) / 20
  return (
    <span className="ha-logo" aria-label="HouseArt">
      <svg width={w} height={size} viewBox="0 0 16 20" aria-hidden="true">
        <rect x="0.75" y="0.75" width="14.5" height="18.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="0" width="7" height="7" fill="currentColor" />
      </svg>
      {wordmark ? <span className="ha-logo__word">HouseArt</span> : null}
    </span>
  )
}
