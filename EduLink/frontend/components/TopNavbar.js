// components/TopNavbar.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Platform,
  Pressable,
} from "react-native";
import { Menu, IconButton } from "react-native-paper";
import Toast from "react-native-toast-message";
import { CommonActions } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebaseAuth";
import { BlurView } from "expo-blur";
import { Surfaces, APP_GRADIENT } from "../theme/colors";

export const NAVBAR_HEIGHT = 64;

const BlurCard = ({
  children,
  style,
  intensity = 28,
  tint = "light",
  ...rest
}) => (
  <BlurView
    intensity={intensity}
    tint={tint}
    style={[styles.blurCard, style]}
    {...rest}
  >
    {children}
  </BlurView>
);

const BRAND = { accent: "#E11D48" };

const showToast = (type, text1, text2) =>
  Toast.show({
    type,
    text1,
    text2,
    position: "top",
    topOffset: Platform.select({ ios: 48, android: 28, default: 32 }),
    visibilityTime: 3000,
  });

function getMenuItemsByRole(role) {
  if (role === "parent") {
    return [
      { label: "Dashboard", kind: "tab", tab: "Dashboard" },
      { label: "Notifications", kind: "tab", tab: "Notifications" },
      { label: "Profile", kind: "tab", tab: "Profile" },
      { label: "Logout", kind: "logout", destructive: true },
    ];
  }
  if (role === "teacher") {
    return [
      { label: "Home", kind: "tab", tab: "Home" },
      { label: "Q&A", kind: "tab", tab: "Q&A" },
      { label: "Resources", kind: "tab", tab: "Resources" },
      { label: "Profile", kind: "tab", tab: "Profile" },
      { label: "Logout", kind: "logout", destructive: true },
    ];
  }
  return [
    { label: "Home", kind: "tab", tab: "Home" },
    { label: "Q&A", kind: "tab", tab: "Q&A" },
    { label: "Resources", kind: "tab", tab: "Resources" },
    { label: "Study Planner", kind: "tab", tab: "StudyPlanner" },
    { label: "Progress", kind: "tab", tab: "Progress" },
    { label: "Profile", kind: "tab", tab: "Profile" },
    { label: "Logout", kind: "logout", destructive: true },
  ];
}

export default function TopNavbar({
  role = "student",
  navigationRef,
  logoSource,
}) {
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const goToTab = (tab) => {
    closeMenu();
    try {
      navigationRef.current?.dispatch(
        CommonActions.navigate({ name: "Main", params: { screen: tab } })
      );
    } catch {
      showToast("error", "Navigation failed", "Please try again.");
    }
  };

  const goToScreen = (screen) => {
    closeMenu();
    try {
      navigationRef.current?.dispatch(CommonActions.navigate({ name: screen }));
    } catch {
      showToast("error", "Navigation failed", "Please try again.");
    }
  };

  const onLogout = async () => {
    closeMenu();
    try {
      await signOut(auth);
      showToast("success", "Logged out", "You’ve been signed out.");
    } catch {
      showToast("error", "Logout failed", "Please try again.");
    }
  };

  const items = getMenuItemsByRole(role);
  const homeTab = role === "parent" ? "Dashboard" : "Home";

  return (
    <View style={styles.wrap} accessibilityRole="header">
      {/* Left: Logo + App Title together */}
      <View style={styles.leftSection}>
        <Pressable
          onPress={() => goToTab(homeTab)}
          accessibilityRole="imagebutton"
          accessibilityLabel="Go to Home"
          hitSlop={8}
          style={styles.logoPressable}
        ></Pressable>

        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel="EduLink"
          numberOfLines={1}
        >
          EduLink
        </Text>
      </View>

      {/* Right: Menu (unchanged) */}
      <View style={styles.side}>
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={
            <View style={styles.menuAnchor} collapsable={false}>
              {/* onPressIn avoids “tap counts as backdrop” after layout */}
              <IconButton
                icon="menu"
                size={22}
                onPressIn={() => setTimeout(() => setMenuVisible(true), 0)}
                iconColor="#0B3B3F"
                style={styles.menuBtnIcon}
              />
            </View>
          }
          anchorPosition="bottom"
          contentStyle={styles.menuContentTransparent}
          style={styles.menuPortal}
        >
          <BlurCard style={styles.menuCard}>
            <View style={styles.menuInner}>
              {items.map((it, idx) => (
                <Menu.Item
                  key={`${it.label}-${idx}`}
                  onPress={() => {
                    if (it.kind === "tab") return goToTab(it.tab);
                    if (it.kind === "screen") return goToScreen(it.screen);
                    if (it.kind === "logout") return onLogout();
                  }}
                  title={it.label}
                  titleStyle={[
                    styles.menuItemText,
                    it.destructive && {
                      color: BRAND.accent,
                      fontWeight: "700",
                    },
                  ]}
                  style={styles.menuItemRow}
                />
              ))}
            </View>
          </BlurCard>
        </Menu>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: NAVBAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: APP_GRADIENT,
    zIndex: 1000,
  },

  /* Left: logo + name in one row */
  leftSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    minWidth: 0, // allow title to ellipsize if needed
  },
  logoPressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Bigger logo
  logo: {
    marginLeft: -28,
    marginTop: 48,
    width: 88,
    height: 88,
    borderRadius: 10,
  },
  // Larger & bolder app name next to logo
  title: {
    flexShrink: 1,
    color: "black",
    fontFamily: Platform.select({
      ios: "Poppins-SemiBold",
      android: "Poppins-SemiBold",
      default: "Poppins-SemiBold",
    }),
    fontWeight: "700",
    fontSize: 22,
    letterSpacing: 0.3,
    marginLeft: 6,
  },

  /* Right: menu area (unchanged) */
  side: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // Menu layering / content
  menuPortal: { zIndex: 2000 },
  menuContentTransparent: {
    backgroundColor: "transparent",
    borderRadius: 0,
    elevation: 0,
    shadowColor: "transparent",
    padding: 0,
  },

  // Frosted body
  blurCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Surfaces?.border || "rgba(255,255,255,0.45)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  menuCard: {
    maxWidth: 280,
  },
  menuInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuItemRow: {
    minHeight: 42,
    borderRadius: 10,
  },
  menuItemText: {
    color: "#0B3B3F",
    fontSize: 15,
  },

  menuAnchor: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  menuBtnIcon: {
    margin: 0,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
