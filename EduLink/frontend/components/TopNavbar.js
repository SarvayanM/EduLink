// frontend/components/TopNavbar.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from "react-native";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { auth, db } from "../services/firebaseAuth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Surfaces, EDU_COLORS, Buttons } from "../theme/colors";

/* ---- Constants ---- */
export const NAVBAR_HEIGHT = 60;

/* Friendly titles per route */
const FRIENDLY_TITLES = {
  Main: "EduLink",
  Home: "EduLink",
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
  Register: "Create Account",
};

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
 * - currentRouteName: string
 * - onBack?: () => void
 * - navigationRef?: React.RefObject<NavigationContainerRef>   <-- use this!
 * - insets?: { top: number }
 * - logoSource?: ImageSource
 */
export default function TopNavbar({
  currentRouteName,
  onBack,
  navigationRef, // ✅ get a ref from App.js
  insets,
  logoSource,
}) {
  const route = currentRouteName || "Home";
  const isAuthScreen = route === "Login" || route === "Register";
  const showBack = !isAuthScreen && typeof onBack === "function";
  const title = isAuthScreen ? "" : FRIENDLY_TITLES[route] || route;

  // ---- profile + notifications state ----
  const [profileImage, setProfileImage] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // ---- animations ----
  const mount = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mount, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mount]);

  useEffect(() => {
    if (unreadNotifications > 0) {
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
    } else {
      badgeScale.setValue(0);
    }
  }, [unreadNotifications, badgeScale]);

  /* ---------- Fetch Profile ---------- */
  const fetchUserProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(
        query(collection(db, "users"), where("uid", "==", user.uid))
      );
      const data = snap.docs[0]?.data();
      const uri = data?.profileImage || null;
      setProfileImage(typeof uri === "string" && uri.length > 0 ? uri : null);
    } catch {
      /* silent */
    }
  };

  /* ---------- Fetch Unread Notifications ---------- */
  const fetchUnreadNotifications = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(
        query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        )
      );
      setUnreadNotifications(Math.max(0, snap?.size || 0));
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const nav = navigationRef?.current; // ✅ safe accessor

  const goHomeIfTitle = () => {
    if (title === "EduLink" || route === "Home" || route === "Main") {
      nav?.navigate?.("Home");
    }
  };

  return (
    <Animated.View
      accessibilityRole="header"
      style={[
        styles.wrap,
        {
          opacity: mount,
          transform: [
            {
              translateY: mount.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <BlurView
        intensity={28}
        tint="light"
        style={styles.card}
        pointerEvents="auto"
      >
        {/* Left cluster */}
        <View style={styles.left}>
          {showBack && (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.iconBtn}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={EDU_COLORS.textPrimary}
              />
            </Pressable>
          )}

          {isAuthScreen && logoSource ? (
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <Pressable
              hitSlop={8}
              onPress={goHomeIfTitle}
              accessibilityRole="button"
              accessibilityLabel="Go to Home"
            >
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Right cluster */}
        {!isAuthScreen && (
          <View style={styles.right}>
            <Pressable
              onPress={() => nav?.navigate?.("Notifications")}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={EDU_COLORS.textPrimary}
              />
              {unreadNotifications > 0 && (
                <Animated.View
                  style={[styles.badge, { transform: [{ scale: badgeScale }] }]}
                >
                  <Text style={styles.badgeText}>
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </Text>
                </Animated.View>
              )}
            </Pressable>

            <Pressable
              onPress={() => nav?.navigate?.("Profile")}
              style={styles.avatarContainer}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>
                    {auth.currentUser?.email?.[0]?.toUpperCase() || "U"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </BlurView>

      <View style={styles.borderLine} />
    </Animated.View>
  );
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: NAVBAR_HEIGHT,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
    zIndex: 10,
  },
  card: {
    height: NAVBAR_HEIGHT - 8,
    marginHorizontal: 12,
    borderRadius: 14,
    paddingHorizontal: -8,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Platform.select({
      ios: {
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 0 },
    }),
  },
  borderLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Surfaces?.border ?? "rgba(148,163,184,0.24)",
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    paddingLeft: 8,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  logo: { width: 28, height: 28, borderRadius: 8 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: EDU_COLORS?.primary ?? "#0A8CA0",
    letterSpacing: 0.2,
    maxWidth: 240,
  },

  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: Buttons?.accentBg || "#EF4444",
    minWidth: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: Buttons?.accentText || "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },

  avatarContainer: { marginLeft: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: EDU_COLORS?.primary ?? "#0A8CA0",
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: "800",
    color: EDU_COLORS?.textPrimary ?? "#0B1220",
  },
});
