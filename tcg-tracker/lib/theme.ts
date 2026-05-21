// Design tokens.
//
// Aesthetic direction: utility-first, optimized for use under harsh convention-hall
// lighting between fast customer turnover. High contrast, generous tap targets,
// no decorative chrome that steals attention. Dark surface by default to reduce
// glare and battery drain on OLED phones during a long show day.

export const palette = {
  bg: '#0d0e10',
  surface: '#17191d',
  surfaceElevated: '#22252b',
  border: '#2c3038',
  borderStrong: '#3a3f47',

  text: '#f2f3f5',
  textMuted: '#9aa0a6',
  textDim: '#6b7077',

  // Transaction colors — semantic, not decorative.
  trade: '#7c8cf8',   // indigo: even exchange
  sale: '#3ec38a',    // green: money in
  buy: '#f06a4a',     // orange: money out

  // Net P/L.
  positive: '#3ec38a',
  negative: '#f06a4a',
  neutral: '#9aa0a6',

  accent: '#ffd166',
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  title:   { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2 },
  body:    { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  small:   { fontSize: 13, fontWeight: '400' as const },
  mono:    { fontSize: 15, fontWeight: '500' as const, fontFamily: 'Menlo' },
} as const;

// Minimum tap target — large because you'll tap with one hand
// while holding a card stack with the other.
export const TAP_TARGET = 48;
