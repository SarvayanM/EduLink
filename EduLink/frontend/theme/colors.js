import { MD3LightTheme as DefaultTheme } from "react-native-paper";

/**
 * EDU Link — Accessible Academic Theme (60 / 30 / 10)
 * ---------------------------------------------------
 * 60% Dominant base: paper-like calm white surfaces.
 * 30% Primary: academic teal-blue for structure & focus.
 * 10% Accent: warm amber for CTAs & motivation.
 */

export const EDU_COLORS = {
  /* ---- Brand Core (Academic Teal-Blue) ---- */
  primary: "#0A8CA0",
  primary600: "#0A7480",
  primary700: "#065A63",

  /* ---- Secondary (Pure White surfaces — 60%) ---- */
  secondary: "#FFFFFF", // <— keep as-is
  secondary600: "#F9FAFB",
  secondary700: "#F3F4F6",

  /* ---- Accent (Motivational Amber — 10%) ---- */
  accent: "#F59E0B",
  accent600: "#D97706",
  accent700: "#B45309",

  /* ---- Backgrounds & Surfaces ---- */
  base: "#F8FAFC",
  background: "#F8FAFC",
  surface: "rgba(255,255,255,0.18)",
  surfaceStrong: "rgba(255,255,255,0.50)",
  surfaceSolid: "#FFFFFF",
  outline: "rgba(0,0,0,0.08)",
  borderLight: "rgba(0,0,0,0.12)",

  /* ---- Text ---- */
  textPrimary: "#0B1220",
  textSecondary: "#475569",
  textMuted: "#6B7280",
  textOnGlass: "#111111",
  placeholder: "#4A4A4A",

  /* ---- States ---- */
  error: "#DC2626",
  errorBg: "#FEE2E2",
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  info: "#0EA5E9",

  /* ---- Utility ---- */
  shadow: "rgba(0,0,0,0.25)",

  /* ---- Neutrals ---- */
  gray50: "#FAFAFA",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#0B1220",
};

/** App gradient — top teal → brand teal → white base (kept as-is) */
export const APP_GRADIENT = ["#FFFFFF", "#F9FAFB", "#F8FAFC"];

/** 60/30/10 reference map + tints used in UI */
export const PALETTE_60_30_10 = {
  dominant60: EDU_COLORS.secondary, // white / paper
  primary30: EDU_COLORS.primary, // teal structure
  accent10: "rgba(245, 158, 11, 0.14)", // subtle amber tile background
  accent60: "#F59E0B", // solid accent stripe/badge
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
    background: "transparent",
    surface: EDU_COLORS.surfaceSolid,
    outline: EDU_COLORS.outline,
    error: EDU_COLORS.error,

    onPrimary: "#FFFFFF",
    onSecondary: "#111111",
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
  solid: "#FFFFFF",
  faint: EDU_COLORS.gray100, // used for nested answer cards
  border: EDU_COLORS.gray200, // consistent with screen
  soft: EDU_COLORS.gray100,
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
  primaryBg: EDU_COLORS.primary,
  primaryText: "#FFFFFF",

  secondaryBg: EDU_COLORS.secondary,
  secondaryText: EDU_COLORS.textPrimary,
  secondaryBorder: EDU_COLORS.gray200,

  accentBg: EDU_COLORS.accent,
  accentText: "#FFFFFF",

  successBg: EDU_COLORS.success,
  successText: "#FFFFFF",

  outlineBorder: EDU_COLORS.gray300,
  subtleBg: EDU_COLORS.gray100,
  subtleText: EDU_COLORS.gray700,

  chipBg: EDU_COLORS.gray200,
  chipActiveBg: EDU_COLORS.accent,
  chipText: EDU_COLORS.gray600,
  chipActiveText: "#FFFFFF",
};
