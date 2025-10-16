// components/BottomNavbar.js
import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from "react-native";
import Toast from "react-native-toast-message";
import { CommonActions } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { signOut } from "firebase/auth";

import { auth } from "../services/firebaseAuth";
import { EDU_COLORS, Surfaces, Buttons } from "../theme/colors";

/* ---------- Constants ---------- */
export const BOTTOM_NAV_HEIGHT = 100;

/* ---------- Toast Utility (result messages) ---------- */
const showToast = (type, text1, text2) =>
  Toast.show({
    type,
    text1,
    text2,
    position: "top",
    topOffset: Platform.select({ ios: 56, android: 36, default: 44 }),
    visibilityTime: 2500,
  });

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

  // toast-style confirmation state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const confirmTimer = useRef(null);
  const anim = useRef(new Animated.Value(0)).current;

  const showConfirm = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmVisible(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // auto-hide in 6s
    confirmTimer.current = setTimeout(() => hideConfirm(), 6000);
  };

  const hideConfirm = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setConfirmVisible(false);
    });
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
  };

  useEffect(
    () => () => confirmTimer.current && clearTimeout(confirmTimer.current),
    []
  );

  const handleConfirmLogout = async () => {
    hideConfirm();
    try {
      await signOut(auth);
      showToast("success", "Logged out", "You’ve been signed out.");
    } catch {
      showToast("error", "Logout failed", "Please try again.");
    }
  };

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
    <>
      {/* Bottom bar */}
      <BlurView intensity={28} tint="light" style={styles.barContainer}>
        {items.map((it) => {
          const isActive = activeTab && it.tab === activeTab;

          const color = it.destructive
            ? EDU_COLORS.accent
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
                if (it.kind === "logout") return showConfirm(); // 🔔 toast-style prompt
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

      {/* Toast-style confirmation (overlays above bar) */}
      {confirmVisible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.confirmWrap,
            {
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <BlurView intensity={28} tint="light" style={styles.confirmCard}>
            <Text style={styles.confirmText}>Log out of your account?</Text>
            <View style={styles.confirmRow}>
              <Pressable
                accessibilityRole="button"
                onPress={hideConfirm}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  styles.confirmCancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleConfirmLogout}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  styles.confirmLogout,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.confirmLogoutText}>Log out</Text>
              </Pressable>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </>
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
    backgroundColor: Surfaces.solid, // subtle solid under blur
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
  labelInactive: { fontWeight: "500" },

  /* Toast-style confirmation */
  confirmWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: BOTTOM_NAV_HEIGHT + 12, // float above bar
    alignItems: "center",
    zIndex: 100,
  },
  confirmCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Surfaces.border,
    backgroundColor: Surfaces.solid,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: "92%",
    maxWidth: 520,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
    }),
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  confirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  confirmCancel: {
    backgroundColor: "#FFFFFF",
    borderColor: Surfaces.border,
  },
  confirmCancelText: {
    color: EDU_COLORS.textPrimary,
    fontWeight: "700",
  },
  confirmLogout: {
    backgroundColor: Buttons.primaryBg,
    borderColor: Buttons.primaryBg,
  },
  confirmLogoutText: {
    color: Buttons.primaryText,
    fontWeight: "800",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
