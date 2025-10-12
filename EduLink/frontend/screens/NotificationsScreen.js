import Screen from "../components/Screen";
import Toast from "react-native-toast-message";
import React, { useState, useEffect, useRef } from "react";
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
import { BlurView } from "expo-blur";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";
import {
  EDU_COLORS,
  Surfaces,
  Buttons, // (unused in this file — left untouched)
} from "../theme/colors";

const PAGE_TOP_OFFSET = 24;

/* ---------- Toast helper (visible + consistent) ---------- */
function useToast() {
  const insets = useSafeAreaInsets();
  const topOffset = insets.top + NAVBAR_HEIGHT + 8;

  return React.useCallback(
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

const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

export default function NotificationsScreen({ navigation }) {
  const showToast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [questionDetails, setQuestionDetails] = useState(null);

  const barAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
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
    loop.start();
    return () => loop.stop();
  }, [loading, barAnim]);

  // Interpolate to slide the bar from left to right
  const barTranslate = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 280], // will be clamped by container width; feels smooth on phones & tablets
  });

  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setTimeout(() => {
          isDragging.current = false;
        }, 100);
      },
    })
  ).current;

  const handleFabPress = () => {
    if (!isDragging.current) {
      // Show unread count with toast (no alerts / no console logs)
      const unread = notifications.filter((n) => !n.read).length;
      showToast(
        "info",
        `${unread} unread notification${unread === 1 ? "" : "s"}`
      );
    }
  };

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
      const notificationsData = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        time: formatTime(d.data().createdAt?.toDate?.()),
        icon: getNotificationIcon(d.data().type),
      }));

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
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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

      // Optionally mark as read (logic unchanged elsewhere; safe update)
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

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }} // prevent bottom clipping under navbar
      >
        {loading ? (
          <View style={styles.loadingCenterWrap}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={EDU_COLORS.primary} />
              <Text style={styles.loadingTitle}>Loading Notifications ...</Text>

              {/* Indeterminate progress bar */}
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { transform: [{ translateX: barTranslate }] },
                  ]}
                />
              </View>
            </View>
          </View>
        ) : (
          <>
            {notifications.map((notification) => (
              <BlurCard key={notification.id} style={[styles.chatBubble]}>
                <Pressable
                  style={[
                    styles.notificationItem,
                    !notification.read && styles.unreadItem,
                  ]}
                  onPress={() => handleNotificationClick(notification)}
                >
                  <View style={styles.notificationIcon}>
                    <Text style={styles.iconText}>{notification.icon}</Text>
                  </View>

                  <BlurCard style={[styles.chatBubble]}>
                    <Text
                      style={[
                        styles.notificationTitle,
                        !notification.read && styles.unreadTitle,
                      ]}
                      numberOfLines={2}
                    >
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationMessage} numberOfLines={3}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {notification.time}
                    </Text>
                  </BlurCard>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete notification"
                  >
                    <Text style={styles.deleteText}>×</Text>
                  </Pressable>

                  {!notification.read && <View style={styles.unreadDot} />}
                </Pressable>
              </BlurCard>
            ))}

            {notifications.length === 0 && (
              <BlurCard style={[styles.chatBubble, { alignItems: "center" }]}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySubtext}>
                  You'll see updates about your questions and answers here
                </Text>
              </BlurCard>
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
              <Text style={styles.modalTitle}>Question & Answer</Text>
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
                    {questionDetails.subject && (
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

      {/* Draggable Unread Count FAB */}
      {unreadCount > 0 && (
        <Animated.View
          style={[
            styles.countFab,
            { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
          ]}
          {...panResponder.panHandlers}
        >
          <Pressable style={styles.fabPressable} onPress={handleFabPress}>
            <Text style={styles.countFabText}>{unreadCount}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },

  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,
  },

  content: { flex: 1 },

  /* ---- Blur card shell (matches profile screen vibe) ---- */
  blurCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  chatBubble: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  /* ---- List items ---- */
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  unreadItem: {},
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: { fontSize: 18 },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  unreadTitle: { fontWeight: "600" },
  notificationMessage: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  deleteText: { color: "white", fontSize: 14, fontWeight: "600" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },

  /* ---- Empty & Loading ---- */
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, textAlign: "center" },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  /* ---- Modal ---- */
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)", // requested overlay
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
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: { fontSize: 20, color: "#6B7280", fontWeight: "600" },
  modalBody: { padding: 20 },

  /* ---- Answers ---- */
  questionSection: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
    lineHeight: 22,
  },
  subjectText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  answersSection: { marginTop: 16 },
  answerCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
  },
  answerText: {
    fontSize: 15,
    color: "#111827",
    marginBottom: 6,
    lineHeight: 20,
  },
  answerMeta: { fontSize: 12, color: "#6B7280" },

  /* ---- Draggable FAB ---- */
  countFab: {
    position: "absolute",
    top: 30,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 999,
  },
  countFabText: { color: "white", fontSize: 16, fontWeight: "700" },
  fabPressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  /* Centered wrap that respects safe areas and stays inline */
  loadingCenterWrap: {
    width: "100%",
    minHeight: 220,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Card that matches EduLink surface language (no blur) */
  loadingCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: EDU_COLORS.surfaceSolid, // from colors.js (neutral surface)
    borderWidth: 1,
    borderColor: Surfaces?.border ?? "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary ?? "#0B1220",
    textAlign: "center",
  },

  loadingSubtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    color: EDU_COLORS.textSecondary ?? "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginBottom: 8,
  },
});
