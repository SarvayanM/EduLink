// components/BottomNavbar.js
import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import Toast from "react-native-toast-message";
import { CommonActions } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { signOut } from "firebase/auth";

import { auth } from "../services/firebaseAuth";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";

/* ---------- Constants ---------- */
export const BOTTOM_NAV_HEIGHT = 100;

/* ---------- Toast Utility ---------- */
const showToast = (type, text1, text2) =>
  Toast.show({
    type,
    text1,
    text2,
    position: "top",
    topOffset: Platform.select({ ios: 56, android: 36, default: 44 }),
    visibilityTime: 2500,
  });

/* ---------- Logout (with confirm) ---------- */
const onLogout = async () => {
  Alert.alert(
    "Logout",
    "Are you sure you want to sign out?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            showToast("success", "Logged out", "You’ve been signed out.");
          } catch {
            showToast("error", "Logout failed", "Please try again.");
          }
        },
      },
    ],
    { cancelable: true }
  );
};

/* ---------- Unicode Icon Mapping ---------- */
function getIconForLabel(label) {
  switch (label) {
    case "Dashboard":
      return "📊";
    case "Home":
      return "🏠";
    case "Notifications":
      return "🔔";
    case "Q&A":
      return "💬";
    case "Resources":
      return "📚";
    case "Study":
      return "📝";
    case "Progress":
      return "📈";
    case "Logout":
      return "🚪";
    default:
      return "⭐️";
  }
}

/* ---------- Items by role (Profile → Logout) ---------- */
function getNavItemsByRole(role) {
  if (role === "parent") {
    return [
      { label: "Dashboard", kind: "tab", tab: "Dashboard" },
      { label: "Notifications", kind: "tab", tab: "Notifications" },
      { label: "Logout", kind: "logout", destructive: true },
    ];
  }
  if (role === "teacher") {
    return [
      { label: "Home", kind: "tab", tab: "Home" },
      { label: "Q&A", kind: "tab", tab: "Q&A" },
      { label: "Resources", kind: "tab", tab: "Resources" },
      { label: "Logout", kind: "logout", destructive: true },
    ];
  }
  // student / tutor
  return [
    { label: "Home", kind: "tab", tab: "Home" },
    { label: "Q&A", kind: "tab", tab: "Q&A" },
    { label: "Resources", kind: "tab", tab: "Resources" },
    { label: "Study", kind: "tab", tab: "StudyPlanner" },
    { label: "Progress", kind: "tab", tab: "Progress" },
    { label: "Logout", kind: "logout", destructive: true },
  ];
}

/* ---------- Component ---------- */
export default function BottomNavbar({
  role = "student",
  navigationRef,
  activeTab,
}) {
  const items = useMemo(() => getNavItemsByRole(role), [role]);

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

  return (
    <BlurView intensity={28} tint="light" style={styles.barContainer}>
      {items.map((it) => {
        const isActive = activeTab && it.tab === activeTab;

        const color = it.destructive
          ? EDU_COLORS.accent // themed accent for logout
          : isActive
          ? "#FFFFFF"
          : EDU_COLORS.gray400;

        const icon = getIconForLabel(it.label);

        return (
          <Pressable
            key={it.label}
            onPress={() => {
              if (it.kind === "tab") return goToTab(it.tab);
              if (it.kind === "screen") return goToScreen(it.screen);
              if (it.kind === "logout") return onLogout();
            }}
            style={({ pressed }) => [
              styles.item,
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={it.label}
          >
            <Text style={[styles.icon, { color }]} accessible={false}>
              {icon}
            </Text>
            <Text
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelInactive,
                { color },
              ]}
              numberOfLines={1}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </BlurView>
  );
}

/* ---------- Styles ---------- */
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surfaces.border,
    backgroundColor: Surfaces.solid, // subtle solid under blur (palette-based)
    zIndex: 99,
  },
  item: {
    flex: 1,
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: Platform.select({ ios: 4, default: 4 }),
  },
  icon: {
    fontSize: 22,
    lineHeight: 24,
    marginBottom: Platform.select({ ios: 0, default: 2 }),
    fontWeight: "600",
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.2,
    textAlign: "center",
    fontWeight: "500",
    marginTop: 1,
    color: "#FFFFFF",
  },
  labelActive: {
    fontWeight: "700",
    backgroundColor: Buttons.primaryBg,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Surfaces.border,
    color: "black",
  },
  labelInactive: {
    fontWeight: "500",
  },
});
