import { MD3LightTheme as DefaultTheme } from "react-native-paper";

/**
 * EDU Link — Accessible Color System (60 / 30 / 10)
 * -------------------------------------------------
 * 60% Dominant base: calm, paper-like canvas for long reading.
 * 30% Primary structure: trustworthy academic teal-blue.
 * 10% Accent: warm amber for CTAs and motivational highlights.
 */

export const EDU_COLORS = {
  /* ---- Brand Core (Academic Teal-Blue) ---- */
  primary: "#0A8CA0",
  primary600: "#0A7480",
  primary700: "#065A63", // headers/active states with white text

  /* ---- Supporting / Secondary ---- */
  secondary: "#14B8A6",
  secondary600: "#0D9488",
  secondary700: "#0F766E",

  /* ---- Accent (Motivational Amber) ---- */
  accent: "#F59E0B",
  accent600: "#D97706",
  accent700: "#B45309",

  /* ---- Backgrounds & Surfaces ---- */
  base: "#F8FAFC",
  background: "#F1F5FF",
  surface: "rgba(255, 255, 255, 0.18)",
  surfaceStrong: "rgba(255, 255, 255, 0.50)",
  surfaceSolid: "rgba(255, 255, 255, 0.98)",
  outline: "rgba(0, 0, 0, 0.08)",
  borderLight: "rgba(0, 0, 0, 0.12)",

  /* ---- Text ---- */
  textPrimary: "#111111",
  textSecondary: "#6B7280", // strong near-black for readability
  textMuted: "#2B2B2B", // lighter neutral for secondary labels
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
  shadow: "rgba(0, 0, 0, 0.25)",

  /* ---- Extended Neutral Blacks (Replacing Grays) ---- */
  gray50: "#FAFAFA", // lightest neutral
  gray100: "#EAEAEA", // soft cards / dividers
  gray200: "#CFCFCF", // light borders
  gray300: "#A3A3A3", // inactive icon/text
  gray400: "#6E6E6E", // muted text
  gray500: "#444444", // standard neutral
  gray600: "#2C2C2C", // dark surface
  gray700: "#1A1A1A", // deep matte
  gray800: "#0D0D0D", // almost black
  gray900: "#000000", // true black
};

/** App gradient — top teal-blue → soft white base */
export const APP_GRADIENT = ["#0A8CA0", "#F1F5FF", "#F9FAFB", "#F8FAFC"];

/** 60/30/10 reference map */
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
    background: "transparent", // let APP_GRADIENT or bg image show through
    surface: EDU_COLORS.surfaceSolid,
    outline: EDU_COLORS.outline,
    error: EDU_COLORS.error,

    onPrimary: "#FFFFFF",
    onSecondary: "#FFFFFF",
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
  border: EDU_COLORS.borderLight,
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

  secondaryBg: EDU_COLORS.secondary600,
  secondaryText: "#FFFFFF",
  secondaryBorder: EDU_COLORS.gray300,

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
