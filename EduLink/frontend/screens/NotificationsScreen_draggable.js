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
} from "react-native";
import { auth, db } from "../services/firebaseAuth";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [questionDetails, setQuestionDetails] = useState(null);
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);
      const notificationsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        time: formatTime(doc.data().createdAt?.toDate()),
        icon: getNotificationIcon(doc.data().type),
      }));

      notificationsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      setNotifications(notificationsData);
    } catch (error) {
      console.error("Error fetching notifications:", error);
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
      fetchNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
      Toast.show("Error", "Failed to delete notification");
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (notification.questionId) {
        const questionDoc = await getDoc(
          doc(db, "questions", notification.questionId)
        );
        if (questionDoc.exists()) {
          setQuestionDetails({ id: questionDoc.id, ...questionDoc.data() });
          setSelectedNotification(notification);
          setShowDetailModal(true);
        }
      }
    } catch (error) {
      console.error("Error fetching question details:", error);
      Toast.show("Error", "Failed to load question details");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingState}>
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
          <>
            {notifications.map((notification) => (
              <Pressable
                key={notification.id}
                style={[
                  styles.notificationItem,
                  !notification.read && styles.unreadItem,
                ]}
                onPress={() => handleNotificationClick(notification)}
              >
                <View style={styles.notificationIcon}>
                  <Text style={styles.iconText}>{notification.icon}</Text>
                </View>

                <View style={styles.notificationContent}>
                  <Text
                    style={[
                      styles.notificationTitle,
                      !notification.read && styles.unreadTitle,
                    ]}
                  >
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {notification.time}
                  </Text>
                </View>

                <Pressable
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                >
                  <Text style={styles.deleteText}>×</Text>
                </Pressable>

                {!notification.read && <View style={styles.unreadDot} />}
              </Pressable>
            ))}

            {notifications.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>No notifications yet</Text>
                <Text style={styles.emptySubtext}>
                  You'll see updates about your questions and answers here
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Question & Answer</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
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

      {/* Draggable Notification Count FAB */}
      {unreadCount > 0 && (
        <Animated.View
          style={[
            styles.countFab,
            {
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Text style={styles.countFabText}>{unreadCount}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginRight: 12,
  },
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
  countFabText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
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
  iconText: {
    fontSize: 18,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,

    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  deleteText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: "600",
  },
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,

    marginTop: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
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
  modalOverlay: {
    flex: 1,

    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,

    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 20,
    color: "#6B7280",
    fontWeight: "600",
  },
  modalBody: {
    padding: 20,
  },
  questionSection: {
    marginBottom: 20,
  },
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
  subjectText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  answersSection: {
    marginTop: 16,
  },
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
  answerMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
});
