/**
 * Centralized color palette for opencode-mobile.
 *
 * Goals:
 * - Single source of truth for every hex literal scattered across app/ and src/.
 * - Eliminate purple/indigo family entirely — replaced by blue accent that matches
 *   existing brand tones (splash #0F172A, telemetry #3b82f6, links #2563eb).
 * - Provide light/dark-aware tokens so `isDark ? X : Y` branches become
 *   `isDark ? colors.accentDark : colors.accent` instead of raw hexes.
 *
 * Structure: flat `colors` object grouped by role. Each group keeps the raw
 * hex so StyleSheet.create can reference it directly without extra runtime.
 * `theme.light` / `theme.dark` expose semantic aliases for callers that prefer
 * a theme object.
 *
 * When adding a new color, extend this file — never inline a hex elsewhere.
 */

// ── Accent — replaces the former purple / indigo family ─────────────────────
// Former values removed: #8b5cf6 #6d28d9 #a78bfa #c4b5fd #f5f3ff #e9d5ff
// #f3e8ff #c7d2fe #6366f1 #3730a3 #1e1b4b #f0f0ff #e8e5f0 #2a2040 #1f1a2e
// #2a1a3e #1a1030 #2a1a4a
// All now map to blue / slate equivalents. Hue 258 (purple) → 217-221 (blue).
const accent = {
  /** Primary accent — icons, checkmarks, active text on light bg. Replaces #8b5cf6 / #6366f1. */
  DEFAULT: "#2563eb",
  /** Stronger variant for text on muted bg, light theme. Replaces #6d28d9. */
  strong: "#1d4ed8",
  /** Lighter for dark theme icons / checkmarks. Replaces #8b5cf6 on dark. */
  light: "#3b82f6",
  /** Pale for dark theme secondary text on muted. Replaces #c4b5fd / #a78bfa. */
  pale: "#60a5fa",
  /** Extra pale for dark muted text. Replaces #c4b5fd. */
  extraPale: "#93c5fd",
  /** Muted bg — selected rows, banners, chips on light. Replaces #f5f3ff / #e8e5f0 / #f0f0ff / #f3e8ff. */
  muted: "#eff6ff",
  /** Muted bg — dark. Replaces #1f1a2e / #2a2040 / #1e1b4b / #2a1a3e. */
  mutedDark: "#1e293b",
  /** Border on light muted bg. Replaces #e9d5ff / #c7d2fe. */
  border: "#dbeafe",
  /** Border on dark muted bg. Replaces #2a1a4a / #3730a3. */
  borderDark: "#334155",
  /** Banner dark bg. Replaces #1a1030. */
  bannerDark: "#0f172a",
  /** Chip bg light/dark alias — kept explicit for call sites. */
  chipBg: "#eff6ff",
  chipBgDark: "#1e293b",
} as const

// ── Neutral — grays / backgrounds used throughout the app ────────────────────
const neutral = {
  white: "#ffffff",
  gray50: "#f5f5f5",
  gray100: "#e5e5e5",
  gray200: "#cccccc",
  gray300: "#999999",
  gray400: "#888888",
  gray500: "#666666",
  gray600: "#444444",
  gray700: "#2a2a2a",
  gray800: "#1a1a1a",
  gray900: "#0a0a0a",
  black: "#000000",
} as const

// ── Spacing / Layout — единый контейнер для Header и контента ───────────────
// До этого в проекте не было ни <Header>, ни <Container>: каждый экран задавал
// padding: 16 / paddingHorizontal: 16 вручную, а Tabs header (expo-router)
// рендерил headerRight без отступа справа. Теперь все горизонтальные отступы
// синхронизированы через один токен.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const

export const breakpoints = {
  /** Планшетная ширина — с неё включаются 2 колонки и центрирование контента. */
  tablet: 768,
  /** Десктопная ширина — с неё включаются 3 колонки. */
  desktop: 1024,
} as const

export const layout = {
  /** Горизонтальный паддинг page-контейнера и header-контейнера. Следовать ему — значит badge в Header выравнивается с контентом. */
  containerPadding: 16,
  headerRightPadding: 16,
  headerLeftPadding: 16,
  /** Максимальная ширина центрированного контента на планшете (экраны, ScrollView). */
  contentMaxWidth: 640,
  /** Максимальная ширина формы логина на планшете. */
  formMaxWidth: 500,
  /** Максимальная ширина модалок на планшете. */
  modalMaxWidth: 560,
} as const

// ── Semantic ─────────────────────────────────────────────────────────────────
const semantic = {
  success: "#22c55e",
  successStrong: "#16a34a",
  error: "#ef4444",
  errorStrong: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",
} as const

// ── Flat export — preferred for StyleSheet / inline color props ──────────────
export const colors = {
  // accent
  accent: accent.DEFAULT,
  accentStrong: accent.strong,
  accentLight: accent.light,
  accentPale: accent.pale,
  accentExtraPale: accent.extraPale,
  accentMuted: accent.muted,
  accentMutedDark: accent.mutedDark,
  accentBorder: accent.border,
  accentBorderDark: accent.borderDark,
  accentBannerDark: accent.bannerDark,
  accentChipBg: accent.chipBg,
  accentChipBgDark: accent.chipBgDark,

  // neutral aliases (short names for frequent use)
  white: neutral.white,
  black: neutral.black,
  backgroundLight: neutral.white,
  backgroundDark: neutral.gray900,
  surfaceLight: neutral.gray50,
  surfaceDark: neutral.gray800,
  surfaceDark2: neutral.gray700,
  borderLight: neutral.gray100,
  borderDark: neutral.gray800,
  textPrimaryLight: neutral.gray900,
  textPrimaryDark: neutral.white,
  textSecondaryLight: neutral.gray500,
  textSecondaryDark: neutral.gray400,
  textTertiaryLight: neutral.gray300,
  textTertiaryDark: neutral.gray500,

  // semantic
  success: semantic.success,
  successStrong: semantic.successStrong,
  error: semantic.error,
  errorStrong: semantic.errorStrong,
  warning: semantic.warning,
  info: semantic.info,

  // groups for iteration
  accentGroup: accent,
  neutral: neutral,
  semantic: semantic,
} as const

// ── Theme object — light / dark semantic mapping ────────────────────────────
export const theme = {
  light: {
    background: neutral.white,
    surface: neutral.gray50,
    surfaceHover: neutral.gray100,
    border: neutral.gray100,
    text: neutral.gray900,
    textSecondary: neutral.gray500,
    textTertiary: neutral.gray300,
    accent: accent.DEFAULT,
    accentStrong: accent.strong,
    accentMuted: accent.muted,
    accentBorder: accent.border,
    accentChipBg: accent.chipBg,
  },
  dark: {
    background: neutral.gray900,
    surface: neutral.gray800,
    surfaceHover: neutral.gray700,
    border: neutral.gray800,
    text: neutral.white,
    textSecondary: neutral.gray400,
    textTertiary: neutral.gray500,
    accent: accent.light,
    accentPale: accent.pale,
    accentExtraPale: accent.extraPale,
    accentMuted: accent.mutedDark,
    accentBorder: accent.borderDark,
    accentChipBg: accent.chipBgDark,
  },
} as const

export type Colors = typeof colors
export type Theme = typeof theme
export type AccentColors = typeof accent
export type Spacing = typeof spacing
export type Breakpoints = typeof breakpoints
export type Layout = typeof layout
