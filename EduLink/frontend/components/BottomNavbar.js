import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import Toast from "react-native-toast-message";
import { CommonActions } from "@react-navigation/native";

import { BlurView } from "expo-blur";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";

// Set a slightly taller, more substantial height for better touch targets and design balance
export const BOTTOM_NAV_HEIGHT = 100;

// The BRAND constant is for the specific accent color used in the component's logic
const BRAND = { accent: "#E11D48" }; // This is used for destructive actions like Logout

// --- Toast Utility (No Change) ---
const showToast = (type, text1, text2) =>
  Toast.show({
    type,
    text1,
    text2,
    position: "top",
    topOffset: Platform.select({ ios: 56, android: 36, default: 44 }),
    visibilityTime: 2500,
  });

/* ---------- Unicode Icon Mapping Utility ---------- */
// Uses Emojis/Unicode as a replacement for dedicated icons to fulfill the visual enhancement request
function getIconForLabel(label) {
  switch (label) {
    case "Dashboard":
      return "📊"; // Chart/Stats
    case "Home":
      return "🏠"; // House
    case "Notifications":
      return "🔔"; // Bell
    case "Q&A":
      return "💬"; // Speech Bubble
    case "Resources":
      return "📚"; // Books
    case "Study":
      return "📝"; // Pencil/Notes
    case "Progress":
      return "📈"; // Growth Chart
    case "Profile":
      return "👤"; // Person Outline
    default:
      return "⭐️"; // Star fallback
  }
}

/* ---------- Items by role (No Change to data structure) ---------- */
function getNavItemsByRole(role) {
  if (role === "parent") {
    return [
      { label: "Dashboard", kind: "tab", tab: "Dashboard" },
      { label: "Notifications", kind: "tab", tab: "Notifications" },
      { label: "Profile", kind: "tab", tab: "Profile" },
    ];
  }
  if (role === "teacher") {
    return [
      { label: "Home", kind: "tab", tab: "Home" },
      { label: "Q&A", kind: "tab", tab: "Q&A" },
      { label: "Resources", kind: "tab", tab: "Resources" },
      { label: "Profile", kind: "tab", tab: "Profile" },
    ];
  }
  // student / tutor
  return [
    { label: "Home", kind: "tab", tab: "Home" },
    { label: "Q&A", kind: "tab", tab: "Q&A" },
    { label: "Resources", kind: "tab", tab: "Resources" },
    { label: "Study", kind: "tab", tab: "StudyPlanner" },
    { label: "Progress", kind: "tab", tab: "Progress" },
    { label: "Profile", kind: "tab", tab: "Profile" },
    // Removed incomplete { from original code
  ];
}

/* ---------- Component ---------- */
export default function BottomNavbar({
  role = "student",
  navigationRef,
  activeTab,
}) {
  const items = useMemo(() => getNavItemsByRole(role), [role]);

  // --- Navigation Functions (No Change) ---
  const goToTab = (tab) => {
    try {
      navigationRef?.current?.dispatch(
        CommonActions.navigate({ name: "Main", params: { screen: tab } })
      );
    } catch {
      showToast("error", "Navigation failed", "Please try again.");
    }
  };

  const goToScreen = (screen) => {
    try {
      navigationRef?.current?.dispatch(
        CommonActions.navigate({ name: screen })
      );
    } catch {
      showToast("error", "Navigation failed", "Please try again.");
    }
  };

  // onLogout function was removed from the item logic in your request,
  // so the placeholder is commented out for cleanliness.

  return (
    // Use BlurView for a modern, trustworthy frosted glass effect
    <BlurView intensity={28} tint="light" style={styles.barContainer}>
      {items.map((it) => {
        const isActive = activeTab && it.tab === activeTab;

        // Dynamic color selection based on state and destruction flag
        const color = it.destructive
          ? BRAND.accent
          : isActive
          ? EDU_COLORS.primary // Use primary for icon/text color for the active state
          : EDU_COLORS.gray400; // Use gray400 for a muted, clean look

        // Icon color is always the same as text color
        const iconColor = color;
        const icon = getIconForLabel(it.label);

        return (
          <Pressable
            key={it.label}
            onPress={() => {
              if (it.kind === "tab") return goToTab(it.tab);
              if (it.kind === "screen") return goToScreen(it.screen);
              // if (it.kind === "logout") return onLogout(); // Logic removed by user request
            }}
            // Enhanced press feedback for a more native feel
            style={({ pressed }) => [
              styles.item,
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={it.label}
          >
            {/* --- ICON --- */}
            <Text
              style={[styles.icon, { color: iconColor }]}
              accessible={false} // Icon is decorative, not focusable
            >
              {icon}
            </Text>

            {/* --- LABEL --- */}
            <Text
              style={[
                styles.label,
                { color },
                isActive ? styles.labelActive : styles.labelInactive, // Use consistent active style
              ]}
              numberOfLines={1} // Ensures full responsiveness for label length
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </BlurView>
  );
}

/* ---------- Styles (Finalized & Icon-Ready) ---------- */
const styles = StyleSheet.create({
  barContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth, // Use a very fine line
    borderTopColor: Surfaces.border,
    backgroundColor: Surfaces.solid, // Fallback to clean, solid white
    zIndex: 99,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4, // Adjusted padding for better vertical centering
    paddingBottom: Platform.select({ ios: 4, default: 4 }),
    minHeight: "100%",
  },
  icon: {
    fontSize: 22, // Size for a modern, visible icon
    lineHeight: 24, // Consistent line height
    marginBottom: Platform.select({ ios: 0, default: 2 }), // Small adjustment for better visual alignment
    color: EDU_COLORS.gray400,
    fontWeight: "600", // Default color, will be overridden by inline style
  },
  label: {
    fontSize: 12, // Smaller font for a professional, icon-first design
    letterSpacing: 0.2,
    textAlign: "center",
    // Base font weight for all platforms
    fontWeight: "500",
    marginTop: 1,
    // Minimal space between icon and text
  },
  // Unified active style for all platforms
  labelActive: {
    fontWeight: "700",
    color: EDU_COLORS.primary700,
    backgroundColor: Buttons.primaryBg,
    borderColor: Buttons.primaryBg,
    color: "#FFFFFF",
    paddingHorizontal: 1,
    paddingVertical: 1,
    borderRadius: 4,

    borderWidth: 1,
    borderColor: Surfaces.border,
  },
  labelInactive: {
    fontWeight: "500",
  },
});
