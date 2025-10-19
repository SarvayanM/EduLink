import Toast from "react-native-toast-message";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  PanResponder,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

import { auth, db } from "../services/firebaseAuth";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";

import {
  EDU_COLORS,
  Surfaces,
  Buttons, // kept as-is; unused but not changing your logic footprint
} from "../theme/colors";

/* ===================== Colors & Surfaces (safe fallbacks) ===================== */
const C = {
  primary: EDU_COLORS?.primary ?? "#0A8CA0",
  accent: EDU_COLORS?.accent ?? "#F59E0B",
  success: EDU_COLORS?.success ?? "#16A34A",

  surface: EDU_COLORS?.surfaceSolid ?? "#FFFFFF",
  border: Surfaces?.border ?? "#E5E7EB",
  elevated: Surfaces?.elevated ?? "#FFFFFF",

  gray50: EDU_COLORS?.gray50 ?? "#F9FAFB",
  gray100: EDU_COLORS?.gray100 ?? "#F3F4F6",
  gray200: EDU_COLORS?.gray200 ?? "#E5E7EB",
  gray300: EDU_COLORS?.gray300 ?? "#D1D5DB",
  gray400: EDU_COLORS?.gray400 ?? "#9CA3AF",
  gray500: EDU_COLORS?.gray500 ?? "#6B7280",
  gray600: EDU_COLORS?.gray600 ?? "#4B5563",
  gray700: EDU_COLORS?.gray700 ?? "#374151",
  gray800: EDU_COLORS?.gray800 ?? "#1F2937",
  gray900: EDU_COLORS?.gray900 ?? "#111827",

  textPrimary: EDU_COLORS?.textPrimary ?? "#0B1220",
  textSecondary: EDU_COLORS?.textSecondary ?? "#475569",
};

const PAGE_TOP_OFFSET = 24;

/* ------------------ Toast helper (keeps topOffset under navbar) ------------------ */
function useToast() {
  const insets = useSafeAreaInsets();
  const topOffset = insets.top + NAVBAR_HEIGHT + 8;
  return useCallback(
    (type, text1, text2) => {
      Toast.show({
        type, // "success" | "error" | "info"
        text1,
        text2,
        position: "top",
        topOffset,
        visibilityTime: 2600,
      });
    },
    [topOffset]
  );
}

/* ------------------ Blur shell ------------------ */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

/* ===================== Main Screen ===================== */
export default function NotificationsScreen() {
  const showToast = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [questionDetails, setQuestionDetails] = useState(null);

  /* --------- Loading bar animation --------- */
  const barAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (!loading) return;
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(barAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loopRef.current.start();
    return () => {
      if (loopRef.current) loopRef.current.stop();
      barAnim.stopAnimation(() => barAnim.setValue(0));
    };
  }, [loading, barAnim]);

  const barTranslate = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 280], // visually smooth sweep; container clamps
  });

  /* --------- Draggable unread FAB --------- */
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({ x: pan.x.__getValue(), y: pan.y.__getValue() });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setTimeout(() => (isDragging.current = false), 100);
      },
    })
  ).current;

  const handleFabPress = () => {
    if (!isDragging.current) {
      const unread = notifications.filter((n) => !n.read).length;
      showToast(
        "info",
        `${unread} unread notification${unread === 1 ? "" : "s"}`
      );
    }
  };

  /* --------- Data --------- */
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        showToast("info", "Please sign in to view notifications");
        return;
      }

      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);

      const notificationsData = querySnapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          time: formatTime(raw.createdAt?.toDate?.()),
          icon: getNotificationIcon(raw.type),
        };
      });

      notificationsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setNotifications(notificationsData);
    } catch {
      showToast("error", "Failed to load notifications", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return "Recent";
    const now = new Date();
    const diff = Math.max(0, now - date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
    // (kept logic semantics; only guarded edge cases)
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "answer":
        return "💬";
      case "upvote":
        return "👍";
      case "resource":
        return "📚";
      case "achievement":
        return "🏅";
      default:
        return "🔔";
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await deleteDoc(doc(db, "notifications", notificationId));
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      showToast("success", "Notification deleted");
    } catch {
      showToast("error", "Failed to delete notification");
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification?.questionId) {
        showToast("info", "No linked question for this notification");
        return;
      }

      const questionDoc = await getDoc(
        doc(db, "questions", notification.questionId)
      );
      if (!questionDoc.exists()) {
        showToast("info", "Question no longer available");
        return;
      }

      setQuestionDetails({ id: questionDoc.id, ...questionDoc.data() });
      setSelectedNotification(notification);
      setShowDetailModal(true);

      if (!notification.read) {
        await updateDoc(doc(db, "notifications", notification.id), {
          read: true,
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
      }
    } catch {
      showToast("error", "Failed to load question details");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* ===================== UI ===================== */
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
      >
        {loading ? (
          <SafeAreaView style={styles.loadingCenterWrap}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingTitle}>Loading Notifications …</Text>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { transform: [{ translateX: barTranslate }] },
                  ]}
                />
              </View>
            </View>
          </SafeAreaView>
        ) : (
          <>
            {notifications.map((n) => (
              <NotificationTile
                key={n.id}
                n={n}
                onOpen={() => handleNotificationClick(n)}
                onDelete={() => deleteNotification(n.id)}
              />
            ))}

            {notifications.length === 0 && (
              <View style={styles.emptyTile}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySubtext}>
                  You’ll see updates about your questions and answers here
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Details Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Question &amp; Answer</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowDetailModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {questionDetails && (
                <>
                  <View style={styles.questionSection}>
                    <Text style={styles.sectionLabel}>Question:</Text>
                    <Text style={styles.questionText}>
                      {questionDetails.question}
                    </Text>
                    {!!questionDetails.subject && (
                      <Text style={styles.subjectText}>
                        📚 {questionDetails.subject}
                      </Text>
                    )}
                  </View>

                  {questionDetails.answers &&
                    questionDetails.answers.length > 0 && (
                      <View style={styles.answersSection}>
                        <Text style={styles.sectionLabel}>Answers:</Text>
                        {questionDetails.answers.map((answer, index) => (
                          <View key={index} style={styles.answerCard}>
                            <Text style={styles.answerText}>
                              {answer.answer}
                            </Text>
                            <Text style={styles.answerMeta}>
                              By {answer.answeredByName} •{" "}
                              {answer.createdAt
                                ?.toDate?.()
                                ?.toLocaleDateString() || "Recent"}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Draggable Unread FAB */}
    </View>
  );
}

/* ===================== Compact, card-like tile ===================== */
function NotificationTile({ n, onOpen, onDelete }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 7,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={styles.tile}>
        <Pressable
          onPress={onOpen}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          android_ripple={{ color: "red", borderless: false }}
          style={styles.tileInner}
        >
          <View style={styles.tileTextCol}>
            <Text
              style={[styles.notificationTitle, !n.read && styles.unreadTitle]}
              numberOfLines={2}
            >
              {n.title}
            </Text>
            {!!n.message && (
              <Text style={styles.notificationMessage} numberOfLines={3}>
                {n.message}
              </Text>
            )}
            <Text style={styles.notificationTime}>{n.time}</Text>
          </View>

          <View style={styles.tileActions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              hitSlop={8}
              style={styles.deletePill}
              android_ripple={{ color: "#ffffff22", borderless: false }}
              accessibilityRole="button"
              accessibilityLabel="Delete notification"
            >
              <Text style={styles.deleteText}>×</Text>
            </Pressable>
            {!n.read && <View style={styles.unreadDot} />}
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,
  },
  content: { flex: 1 },

  /* ---- Blur shell for group spacers if needed (kept) ---- */
  blurCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    backgroundColor: "transparent",
  },

  /* ---------- Compact card-like tile (replaces plain white blocks) ---------- */
  tile: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  tileInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  leadIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  leadIcon: { fontSize: 18 },

  tileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.gray900,
    marginBottom: 4,
  },
  unreadTitle: { fontWeight: "900" },
  notificationMessage: {
    fontSize: 14,
    color: C.gray600,
    marginBottom: 6,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: C.gray500,
  },
  tileActions: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
  },
  deletePill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "red",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 16,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Buttons.accentBg,
    alignSelf: "flex-end",
  },

  /* ---------- Empty state tile ---------- */
  emptyTile: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIcon: { fontSize: 44, marginBottom: 10, textAlign: "center" },
  emptyText: {
    fontSize: 18,
    fontWeight: "800",
    color: C.gray700,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: C.gray500,
    textAlign: "center",
    lineHeight: 20,
  },

  /* ---------- Modal ---------- */
  modalOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.gray100,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.gray900 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: { fontSize: 20, color: C.gray500, fontWeight: "700" },
  modalBody: { padding: 20 },

  /* ---------- Q&A content ---------- */
  questionSection: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: C.gray700,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    color: C.gray900,
    marginBottom: 8,
    lineHeight: 22,
  },
  subjectText: { fontSize: 14, color: C.gray600, fontWeight: "600" },
  answersSection: { marginTop: 16 },
  answerCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: C.gray50,
    borderLeftWidth: 3,
    borderLeftColor: C.success,
  },
  answerText: {
    fontSize: 15,
    color: C.gray900,
    marginBottom: 6,
    lineHeight: 20,
  },
  answerMeta: { fontSize: 12, color: C.gray600 },

  /* ---------- Draggable Unread FAB ---------- */
  countFab: {
    position: "absolute",
    top: 30,
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 999,
  },
  countFabText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  fabPressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ---------- Loading card ---------- */
  loadingCenterWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "800",
    color: C.textPrimary,
    textAlign: "center",
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 8,
    backgroundColor: C.gray200,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    width: 80,
    height: 8,
    borderRadius: 8,
    backgroundColor: C.primary,
  },
});
