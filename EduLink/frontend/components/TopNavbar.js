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
  Modal,
} from "react-native";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { auth, db } from "../services/firebaseAuth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Surfaces, EDU_COLORS, Buttons } from "../theme/colors";
import { signOut } from "firebase/auth";

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
 * - navigationRef?: React.RefObject<NavigationContainerRef>
 * - insets?: { top: number }
 * - logoSource?: ImageSource
 */
export default function TopNavbar({
  currentRouteName,
  onBack,
  navigationRef,
  insets,
  logoSource,
}) {
  const route = currentRouteName || "Home";
  const isAuthScreen = route === "Login" || route === "Register";
  const isMainScreen = route === "Main" || route === "Home";
  const showBack =
    !isAuthScreen && !isMainScreen && typeof onBack === "function";
  const title = isAuthScreen ? "" : FRIENDLY_TITLES[route] || route;

  // ---- profile + notifications state ----
  const [profileImage, setProfileImage] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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

  const onLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await signOut(auth);
      showToast("success", "Signed out", "See you soon 👋");
      // Note: No manual navigation here. onAuthStateChanged in App.js
      // will set user=null and automatically render the Unauthed stack
      // which shows Login/Register. This avoids RESET warnings.
    } catch (err) {
      showToast("error", "Logout failed", err?.message || "Try again");
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

            {/* NEW: Logout button */}
            <Pressable
              onPress={onLogout}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Ionicons
                name="log-out-outline"
                size={22}
                color={EDU_COLORS.textPrimary}
              />
            </Pressable>
          </View>
        )}
      </BlurView>

      <View style={styles.borderLine} />

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLogoutModal(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons
                name="log-out-outline"
                size={32}
                color="red" // Apply red color directly
              />
              <Text style={styles.modalTitle}>Sign Out</Text>
            </View>
            <Text style={styles.modalMessage}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.logoutButton]}
                onPress={confirmLogout}
                accessibilityRole="button"
                accessibilityLabel="Confirm logout"
              >
                <Text style={styles.logoutButtonText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

  // Logout Modal Styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: EDU_COLORS?.textPrimary ?? "#0B1220",
    marginTop: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: EDU_COLORS?.textSecondary ?? "#64748B",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: Surfaces?.soft ?? "#F1F5F9",
    borderWidth: 1,
    borderColor: Surfaces?.border ?? "#E2E8F0",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: EDU_COLORS?.textPrimary ?? "#0B1220",
  },
  logoutButton: {
    backgroundColor: EDU_COLORS?.error || "#EF4444",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
