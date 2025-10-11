// theme/colors.js
import { MD3LightTheme as DefaultTheme } from "react-native-paper";

/**
 * 🎓 EduLink Color System — Modern, Professional, WCAG-conscious
 * --------------------------------------------------------------
 * 60% Base (calm aqua-white, NOT pure white)
 * 30% Primary (Edu Aqua Teal — structure & trust)
 * 10% Accent (Violet — motivation & focus)
 *
 * Status bar protection: dark top of APP_GRADIENT ensures
 * light-content status icons have strong contrast.
 */

export const EDU_COLORS = {
  /* ---- Brand Core (Primary: Edu Aqua Teal) ---- */
  primary: "#0A8CA0",
  primary600: "#0A7480",
  primary700: "#065A63",

  /* ---- Supporting / Secondary (cool aqua cyan) ---- */
  secondary: "#33B6C6",
  secondary600: "#2AA4B3",
  secondary700: "#238F9C",

  /* ---- Accent (vibrant educational violet) ---- */
  accent: "#7C3AED",
  accent600: "#6D28D9",
  accent700: "#5B21B6",

  /* ---- Backgrounds & Surfaces ---- */
  base: "#F4F9FB", // 60% dominant (NOT white)
  background: "#E7F2F5", // gentle aqua tint
  surface: "rgba(255, 255, 255, 0.22)", // light glass
  surfaceStrong: "rgba(255, 255, 255, 0.55)", // elevated glass
  surfaceSolid: "rgba(255, 255, 255, 0.96)", // matte card
  outline: "rgba(6, 31, 38, 0.08)", // soft separators
  borderLight: "rgba(15, 23, 42, 0.08)",

  /* ---- Text ---- */
  textPrimary: "#0A1A1E", // deep slate-blue on light base
  textMuted: "#475A63",
  textOnGlass: "#FFFFFF",
  placeholder: "#64748B",

  /* ---- States ---- */
  error: "#DC2626",
  errorBg: "#FEE2E2",
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  info: "#0EA5E9",

  /* ---- Utility ---- */
  shadow: "rgba(0, 0, 0, 0.20)",

  /* ---- Extended Neutral Grays ---- */
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
};

/** App gradient — dark-to-light to preserve status bar contrast */
export const APP_GRADIENT = [
  "#A6E4EC",
  "#A6E4EC",
  "#A6E4EC",
  "#F4F9FB",
  "#F4F9FB",
  "#F4F9FB",
  "#F4F9FB",
  "#F4F9FB",
  "#F4F9FB",
  "#F4F9FB",
  "#F4F9FB",

  // bottom — soft aqua-white base (NOT pure white)
];

/** 60/30/10 reference */
export const PALETTE_60_30_10 = {
  dominant60: EDU_COLORS.base,
  primary30: EDU_COLORS.primary,
  accent10: EDU_COLORS.accent,
  successAccent: EDU_COLORS.success,
  infoAccent: EDU_COLORS.info,
};

/** React Native Paper Theme (MD3 aligned) */
export const paperTheme = {
  ...DefaultTheme,
  roundness: 16,
  colors: {
    ...DefaultTheme.colors,
    primary: EDU_COLORS.primary,
    secondary: EDU_COLORS.secondary,
    background: "transparent", // gradient shows through
    surface: EDU_COLORS.surfaceSolid, // default cards
    outline: EDU_COLORS.outline,
    error: EDU_COLORS.error,

    onPrimary: "#FFFFFF",
    onSecondary: EDU_COLORS.textPrimary,
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
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    medium: {
      shadowColor: EDU_COLORS.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 8,
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
  primaryBg: EDU_COLORS.primary600,
  primaryText: "#FFFFFF",

  secondaryBg: EDU_COLORS.secondary,
  secondaryText: EDU_COLORS.textPrimary,
  secondaryBorder: EDU_COLORS.gray300,

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
