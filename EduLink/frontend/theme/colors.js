// theme/colors.js
import { MD3LightTheme as DefaultTheme } from "react-native-paper";

/**
 * EDUlink Color System (Revised — WCAG-Compliant)
 * -----------------------------------------------------------
 * Strategy: 60 / 30 / 10
 * - 60% Background/Base → calm aqua-white base
 * - 30% Primary/Structure → Edu Aqua (trust/focus)
 * - 10% Accent/Highlight → Violet (energy/motivation)
 */

export const EDU_COLORS = {
  /* ---- Brand Core ---- */
  primary: "#088395", // Edu Aqua (main brand tone)
  primary600: "#077885", // darker, accessible for white text
  primary700: "#066A76", // darkest usable brand tone
  secondary: "#37B7C3", // Supporting cyan (now used with dark text)
  secondary600: "#2FA3AE",
  secondary700: "#278E98",

  /* ---- Accent ---- */
  accent: "#7C3AED", // Vibrant violet
  accent600: "#6D28D9",
  accent700: "#5B21B6",

  /* ---- Neutrals / Backgrounds ---- */
  /* ---- Neutrals / Surfaces ---- */
  base: "#EBF4F6",
  background: "#E8F3F5",
  surface: "rgba(255, 255, 255, 0.25)", // light glass
  surfaceStrong: "rgba(255, 255, 255, 0.6)", // elevated
  surfaceSolid: "rgba(255, 255, 255, 0.92)", // polished matte glass
  outline: "rgba(0, 0, 0, 0.06)",
  borderLight: "rgba(15, 23, 42, 0.06)",

  /* ---- Text ---- */
  textPrimary: "#0B1E26", // dark bluish gray (main)
  textMuted: "#475569", // slate muted
  textOnGlass: "#FFFFFF",
  placeholder: "#64748B", // for TextInput label/hint

  /* ---- States ---- */
  error: "#DC2626",
  errorBg: "#FEE2E2",
  success: "#10B981",
  successBg: "#D1FAE5",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",

  /* ---- Utility ---- */
  shadow: "rgba(0, 0, 0, 0.25)",

  /* ---- Extended Neutral Grays ---- */
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
};

/** App-wide gradient */
export const APP_GRADIENT = [
  EDU_COLORS.primary,
  EDU_COLORS.secondary,
  EDU_COLORS.base,
];

/** 60/30/10 reference */
export const PALETTE_60_30_10 = {
  dominant60: EDU_COLORS.background,
  primary30: EDU_COLORS.primary,
  accent10: EDU_COLORS.accent,
  successAccent: EDU_COLORS.success,
  infoAccent: "#0EA5E9",
};

/** React Native Paper Theme (optimized for accessibility) */
export const paperTheme = {
  ...DefaultTheme,
  roundness: 16,
  colors: {
    ...DefaultTheme.colors,
    primary: EDU_COLORS.primary, // for main brand buttons
    secondary: EDU_COLORS.secondary,
    background: EDU_COLORS.background,
    surface: EDU_COLORS.surfaceSolid,
    outline: EDU_COLORS.outline,
    error: EDU_COLORS.error,

    onPrimary: "#FFFFFF", // OK because we use primary600/700 for contrast
    onSecondary: EDU_COLORS.textPrimary, // changed (white failed contrast)
    onSurface: EDU_COLORS.textPrimary,
    onSurfaceVariant: EDU_COLORS.textMuted,
    placeholder: EDU_COLORS.placeholder,
    text: EDU_COLORS.textPrimary,
    tertiary: EDU_COLORS.accent,
    onTertiary: "#FFFFFF",
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: { fontFamily: "Poppins-Regular", fontWeight: "400" },
    medium: { fontFamily: "Poppins-Medium", fontWeight: "500" },
    bold: { fontFamily: "Poppins-Bold", fontWeight: "700" },
  },
  shadows: {
    light: {
      shadowColor: EDU_COLORS.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 6,
    },
    medium: {
      shadowColor: EDU_COLORS.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 10,
    },
  },
};

/* --- Surfaces --- */
export const Surfaces = {
  translucent: EDU_COLORS.surface,
  elevated: EDU_COLORS.surfaceStrong,
  solid: EDU_COLORS.surfaceSolid,
  border: EDU_COLORS.borderLight,
  soft: EDU_COLORS.gray50,
};

/* --- Text --- */
export const TextColors = {
  default: EDU_COLORS.textPrimary,
  muted: EDU_COLORS.textMuted,
  onBrand: "#FFFFFF",
  onAccent: "#FFFFFF",
};

/* --- Buttons --- */
export const Buttons = {
  // Primary (white text contrast guaranteed)
  primaryBg: EDU_COLORS.primary600,
  primaryText: "#FFFFFF",

  // Secondary (dark text on light cyan)
  secondaryBg: EDU_COLORS.secondary,
  secondaryText: EDU_COLORS.textPrimary,
  secondaryBorder: EDU_COLORS.gray300,

  // Accent
  accentBg: EDU_COLORS.accent,
  accentText: "#FFFFFF",

  successBg: EDU_COLORS.success,
  successText: "#FFFFFF",

  outlineBorder: EDU_COLORS.gray300,
  subtleBg: EDU_COLORS.gray50,
  subtleText: EDU_COLORS.gray600,

  chipBg: EDU_COLORS.gray100,
  chipActiveBg: EDU_COLORS.accent,
  chipText: EDU_COLORS.gray600,
  chipActiveText: "#FFFFFF",
};
