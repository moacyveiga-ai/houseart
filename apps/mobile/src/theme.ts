// Colours copied from app/ds/tokens.css (--ha-*), never loose values elsewhere.
export const colors = {
  paper50: '#FBFAF7',
  paper100: '#F6F3EE',
  paper200: '#ECE7DF',
  ink900: '#111111',
  ink700: '#2B2B2B',
  ink500: '#6B6760',
  ink300: '#B5B0A6',
  sand500: '#D9A441',
  sand600: '#B9872F',
  sand100: '#F5E7C8',
  verified500: '#2E7D5B',
  verified100: '#E3F0E9',
  pending500: '#C77A1E',
  pending100: '#F7EAD9',
  alert500: '#B23A2F',
  alert100: '#F5E1DE',
  info500: '#3A5F8A',
  /** --ha-wall: the "parede" behind an artwork (light theme). */
  wall: '#EEEAE3',
} as const

export const theme = {
  bg: colors.paper50,
  surface: colors.paper100,
  border: colors.paper200,
  fg: colors.ink900,
  fgBody: colors.ink700,
  fgMuted: colors.ink500,
  fgDisabled: colors.ink300,
  accent: colors.sand500,
  accentStrong: colors.sand600,
  accentSoft: colors.sand100,
  error: colors.alert500,
  success: colors.verified500,
  wall: colors.wall,
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 16,
  radiusFull: 999,
} as const

/**
 * --ha-font-display is Fraunces (italic for artwork titles). The three static
 * faces ship in assets/fonts (OFL, Google Fonts static build) and are
 * registered in app/_layout.tsx by `useFonts` under these family names; the
 * system serif stays as the fallback while they load or if they fail.
 */
export const FONT_FILES = {
  'Fraunces-Regular': require('../assets/fonts/Fraunces-Regular.ttf') as number,
  'Fraunces-Italic': require('../assets/fonts/Fraunces-Italic.ttf') as number,
  'Fraunces-SemiBold': require('../assets/fonts/Fraunces-SemiBold.ttf') as number,
} as const

export const fonts = {
  display: { regular: 'Fraunces-Regular', italic: 'Fraunces-Italic', semibold: 'Fraunces-SemiBold' },
  displayFallback: { ios: 'Georgia', android: 'serif', default: 'serif' } as const,
} as const
