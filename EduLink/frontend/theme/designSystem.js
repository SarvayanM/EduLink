// theme/designSystem.js
// EduLink Design System — Accessible, soft & modern (Expo)
import { Platform } from "react-native";

export const COLORS = {
  // Keep primary as-is (using known default if not overridden)
  primary: "#088395",
  base: "#FFFFFF",

  textPrimary: "#0C1B1E",
  textSecondary: "rgba(12,27,30,0.75)",
  textMuted: "rgba(12,27,30,0.55)",
  // High-contrast accents (slightly adjusted for readability)
  accent: "#3A7D7C",
  accent600: "#2B5F5E",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
  // UI
  borderLight: "rgba(255,255,255,0.25)",
  borderDark: "rgba(0,0,0,0.1)",
};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const RADII = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
};

export const ELEVATION = {
  card: Platform.select({ ios: 6, android: 3 }),
  button: Platform.select({ ios: 4, android: 2 }),
};

export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: ELEVATION.card,
  },
  button: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: ELEVATION.button,
  },
};

export const TYPOGRAPHY = {
  title: { fontSize: 22, fontWeight: "700", color: COLORS.textPrimary },
  subtitle: { fontSize: 18, fontWeight: "600", color: COLORS.textSecondary },
  body: { fontSize: 16, color: COLORS.textPrimary },
};

export const SURFACES = {
  // For blur/gradient cards, we keep transparent bg and rely on expo-blur or LinearGradient wrappers
  cardBase: {
    borderRadius: RADII.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  inputContainer: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  bottomTab: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
};

export const INPUT = {
  container: {
    ...SURFACES.inputContainer,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.select({ ios: 14, android: 10 }),
  },
  text: { color: COLORS.textPrimary, fontSize: 16 },
  placeholder: { color: "rgba(12,27,30,0.45)" },
  focus: {
    borderColor: COLORS.accent,
    borderWidth: 1.5,
  },
};

export const BUTTON = {
  primary: {
    container: {
      backgroundColor: COLORS.primary,
      borderRadius: RADII.md,
      paddingVertical: 12,
      alignItems: "center",
      ...SHADOW.button,
    },
    label: { color: COLORS.base, fontSize: 16, fontWeight: "700" },
    pressed: { opacity: 0.9 },
  },
};

export const LAYOUT = {
  screen: {
    flex: 1,
    paddingTop: 60, // breadcrumb space
    paddingHorizontal: SPACING.md,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
};
