import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Platform,
  Pressable,
} from "react-native";
import Toast from "react-native-toast-message";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebaseAuth";
import { Surfaces } from "../theme/colors";

/* ---- Constants ---- */
export const NAVBAR_HEIGHT = 60;
const BRAND = { accent: "#E11D48" };

/* Friendly titles per route */
const FRIENDLY_TITLES = {
  Main: "Home",
  Home: "Home",
  "Q&A": "Q&A",
  Resources: "Resources",
  StudyPlanner: "Study Planner",
  Progress: "Progress",
  Profile: "Profile",
  Notifications: "Notifications",
  ClassroomDetail: "Classroom",
  AskQuestion: "Ask Question",
  Dashboard: "Dashboard",
  ParentDashboard: "Parent Dashboard",

  Register: "Create Account", // user-friendly name
};

/* ---- Toast Helper ---- */
const showToast = (type, text1, text2) =>
  Toast.show({
    type,
    text1,
    text2,
    position: "top",
    topOffset: Platform.select({ ios: 56, android: 36, default: 44 }),
    visibilityTime: 2500,
  });

/**
 * Props:
 * - currentRouteName: string (e.g., "Home", "Login")
 * - onBack: function to call when back is pressed (usually navigation.goBack)
 * - logoSource?: ImageSource
 */
export default function TopNavbar({ currentRouteName, onBack, logoSource }) {
  const route = currentRouteName || "Home";
  const isLogin = route === "Login";
  const isRegister = route === "Register";
  const showLogout = !(isLogin || isRegister);
  const showBack = !isLogin && typeof onBack === "function";

  const title = isLogin ? "" : FRIENDLY_TITLES[route] || route;

  const onLogout = async () => {
    try {
      await signOut(auth);
      showToast("success", "Logged out", "You’ve been signed out.");
    } catch {
      showToast("error", "Logout failed", "Please try again.");
    }
  };

  return (
    <View style={styles.wrap} accessibilityRole="header">
      {/* Bottom hairline */}
      <View style={styles.borderLine} />

      {/* Left cluster: back (if any) + title (or app name on Login) */}
      <View style={styles.left}>
        {showBack && (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        )}

        {logoSource && isLogin && (
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        )}

        <Text style={styles.title}>{title}</Text>
      </View>

      {/* Right: Logout (hidden on Login/Register) */}
      {showLogout ? (
        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      ) : (
        <View style={{ width: 68 /* keep right side balanced */ }} />
      )}
    </View>
  );
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: NAVBAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
    backgroundColor: "transparent",
  },
  borderLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    flexShrink: 1,
  },
  backBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  backIcon: {
    fontSize: 28,
    lineHeight: 28,
    color: "#FFFFFF",
    fontWeight: "700",
    marginRight: 2,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  logoutBtn: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: BRAND.accent,
    minWidth: 68,
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  fallbackBg: {
    backgroundColor: Surfaces?.solid ?? "rgba(0,0,0,0.1)",
  },
});
