// frontend/screens/HomeScreen.js
import React, { useState, useEffect, memo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";
import { signOut } from "firebase/auth";
import { auth, db } from "../services/firebaseAuth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import Toast from "react-native-toast-message";

/* ---------------- UI constants ---------------- */
const RADIUS = 20;
const RADIUS_LG = 22;
const GAP = 16;
// Tighter distance from breadcrumb pill (lives in App)
const BREADCRUMB_CLEARANCE = -24; // was 44 — tuned to sit just below the breadcrumb

/* ---------------- Surface Card ---------------- */
const Card = memo(function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
});

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [userGrade, setUserGrade] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState([]);
  const [profileImage, setProfileImage] = useState(null);
  const [unansweredQuestions, setUnansweredQuestions] = useState([]);
  const [recentAnswers, setRecentAnswers] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [encouragements, setEncouragements] = useState([]);
  const [classroomsLoading, setClassroomsLoading] = useState(true);

  useEffect(() => {
    fetchUserGrade();
    fetchClassroomData();
    fetchUserProfile();
    fetchUnreadNotifications();
    fetchEncouragements();

    const interval = setInterval(fetchUnreadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userRole && (userGrade || userRole === "teacher")) {
      fetchGradeQuestions();
    }
  }, [userGrade, userRole]);

  async function fetchUserProfile() {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfileImage(userData.profileImage || null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  }

  async function fetchClassroomData() {
    try {
      setClassroomsLoading(true); // ← start
      const grades = ["6", "7", "8", "9", "10", "11"];
      const classroomData = [];
      // ... (existing code that builds classroomData)
      setClassrooms(classroomData);
    } catch (error) {
      console.error("Error fetching classroom data:", error);
    } finally {
      setClassroomsLoading(false); // ← finish
    }
  }

  function calculateCurrentGrade(initialGrade, registrationYear) {
    const currentYear = new Date().getFullYear();
    const yearsPassed = currentYear - registrationYear;
    const current = parseInt(initialGrade, 10) + yearsPassed;
    return Math.min(current, 12).toString();
  }

  async function fetchUserGrade() {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.role);
        setUserPoints(userData.points || 0);
        if (userData.registrationYear) {
          setUserGrade(
            calculateCurrentGrade(userData.grade, userData.registrationYear)
          );
        } else {
          setUserGrade(userData.grade);
        }
      }
    } catch (error) {
      console.error("Error fetching user grade:", error);
    } finally {
      setLoading(false);
    }
  }

  const getUserClassrooms = () => {
    if (userRole === "teacher") {
      return classrooms.map((c) => ({
        ...c,
        grade: c.title.replace("Grade ", ""),
      }));
    }

    if ((userRole === "student" && userPoints >= 200) || userRole === "tutor") {
      return userGrade
        ? classrooms.filter((c) => {
            const g = parseInt(c.title.replace("Grade ", ""), 10);
            return g <= parseInt(userGrade, 10);
          })
        : [];
    }

    return userGrade
      ? classrooms.filter((c) => c.title === `Grade ${userGrade}`)
      : [];
  };

  const userClassrooms = getUserClassrooms();

  const fetchGradeQuestions = async () => {
    try {
      const isTeacher = userRole === "teacher";
      const gradeQuery = isTeacher
        ? query(collection(db, "questions"), orderBy("createdAt", "desc"))
        : query(collection(db, "questions"), where("grade", "==", userGrade));

      const snapshot = await getDocs(gradeQuery);
      const allQuestions = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().createdAt?.toDate?.()?.toLocaleDateString() || "Recent",
      }));

      setUnansweredQuestions(
        allQuestions.filter((q) => q.status === "unanswered").slice(0, 2)
      );

      setRecentAnswers(
        allQuestions
          .filter((q) => q.status === "answered" && q.answers?.length > 0)
          .slice(0, 2)
      );
    } catch (error) {
      console.error("Error fetching grade questions:", error);
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const qSnap = await getDocs(
        query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        )
      );
      setUnreadNotifications(qSnap.size);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
    }
  };

  const fetchEncouragements = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const qSnap = await getDocs(
        query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("type", "==", "kudos"),
          where("read", "==", false)
        )
      );
      setEncouragements(qSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching encouragements:", error);
    }
  };

  const deleteEncouragement = async (encouragementId) => {
    try {
      await updateDoc(doc(db, "notifications", encouragementId), {
        read: true,
      });
      setEncouragements((prev) => prev.filter((e) => e.id !== encouragementId));
    } catch (error) {
      console.error("Error deleting encouragement:", error);
    }
  };

  /* ---------------- Loading ---------------- */
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "transparent" }}>
        <SafeAreaView
          style={[styles.container, styles.loadingContainer]}
          edges={["top", "left", "right", "bottom"]}
        >
          <View style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Loading Your Dashboard ...</Text>
        </SafeAreaView>
      </View>
    );
  }

  /* ---------------- Screen ---------------- */
  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top + BREADCRUMB_CLEARANCE, 20) }, // tighter, just below breadcrumb
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome back!</Text>
              <Text style={styles.subtitle}>
                Ready to learn and grow together
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                hitSlop={8}
                style={styles.notificationButton}
                onPress={() => navigation.navigate("Notifications")}
              >
                <View style={styles.notificationIcon}>
                  <Text style={styles.notificationIconText}>🔔</Text>
                  {unreadNotifications > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.badgeText}>
                        {unreadNotifications}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>

              <Pressable
                hitSlop={8}
                style={styles.avatar}
                onPress={() => navigation.navigate("Profile")}
              >
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.avatarImage}
                    onError={() => setProfileImage(null)}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>U</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={[styles.content, { backgroundColor: "transparent" }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 12 }}
        >
          {/* Status Card */}
          <Card style={styles.statusCard}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusRole}>
                {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
              </Text>
              <Text style={styles.statusGrade}>
                {userRole === "teacher" ? "All Grades" : `Grade ${userGrade}`}
              </Text>
            </View>

            <View style={styles.pointsContainer}>
              <Text style={styles.pointsLabel}>Learning Points</Text>
              <Text style={styles.pointsValue}>{userPoints}</Text>
            </View>

            <Pressable
              hitSlop={8}
              style={styles.logoutButton}
              onPress={async () => {
                try {
                  await signOut(auth);
                  Toast.show({
                    type: "success",
                    text1: "Logged out",
                    text2: "You’ve been signed out.",
                    position: "bottom",
                  });
                } catch (e) {
                  Toast.show({
                    type: "error",
                    text1: "Logout failed",
                    text2: e?.message ?? "Please try again.",
                    position: "bottom",
                  });
                }
              }}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </Card>

          {/* Encouragements */}
          {encouragements.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  💝 Words of Encouragement
                </Text>
              </View>
              {encouragements.map((encouragement) => (
                <Card key={encouragement.id} style={styles.encouragementCard}>
                  <View style={styles.encouragementIcon}>
                    <Text style={styles.encouragementIconText}>🌟</Text>
                  </View>
                  <View style={styles.encouragementContent}>
                    <Text style={styles.encouragementTitle}>
                      {encouragement.title}
                    </Text>
                    <Text style={styles.encouragementMessage}>
                      {encouragement.message}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    style={styles.deleteButton}
                    onPress={() => deleteEncouragement(encouragement.id)}
                  >
                    <Text style={styles.deleteButtonText}>×</Text>
                  </Pressable>
                </Card>
              ))}
            </View>
          )}

          {/* My Classrooms */}
          <View style={styles.section}>
            <View className="sr-only" />
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>My Classrooms</Text>
                <Text style={styles.sectionSubtitle}>
                  Join discussions and help peers
                </Text>
              </View>
            </View>

            {classroomsLoading ? (
              <Text style={styles.classroomsLoadingText}>Loading …</Text>
            ) : userClassrooms.length === 0 ? (
              <Text style={styles.classroomsEmptyText}>
                No classrooms to show
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.classroomScroll}
                contentContainerStyle={styles.classroomScrollContent}
              >
                {/* existing classroom cards */}
                {userClassrooms.map(/* ... */)}
              </ScrollView>
            )}
          </View>

          {/* Help Needed */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Help Needed</Text>
                <Text style={styles.sectionSubtitle}>
                  {userRole === "teacher"
                    ? "Questions from all grades"
                    : `Questions from Grade ${userGrade}`}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                style={styles.answerCta}
                onPress={() => {
                  /* your nav */
                }}
              >
                <Text style={styles.answerCtaText}>Provide Answer</Text>
              </Pressable>
            </View>

            {unansweredQuestions.length > 0 ? (
              unansweredQuestions.map((q) => (
                <Card key={q.id} style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <View style={styles.questionBadge}>
                      <Text style={styles.questionBadgeText}>
                        Grade {q.grade}
                      </Text>
                    </View>
                    <Text style={styles.questionDate}>{q.date}</Text>
                  </View>
                  <Text style={styles.questionText} numberOfLines={2}>
                    {q.question}
                  </Text>
                  <Pressable hitSlop={8} style={styles.answerCta}>
                    <Text style={styles.answerCtaText}>Provide Answer</Text>
                  </Pressable>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyText}>
                  All questions are answered!
                </Text>
                <Text style={styles.emptySubtext}>
                  Great work helping your peers
                </Text>
              </Card>
            )}
          </View>

          {/* Recent Solutions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Recent Solutions</Text>
                <Text style={styles.sectionSubtitle}>
                  {userRole === "teacher"
                    ? "Latest answers across grades"
                    : `Recent solutions for Grade ${userGrade}`}
                </Text>
              </View>
            </View>

            {recentAnswers.length > 0 ? (
              recentAnswers.map((q) => (
                <Card key={q.id} style={styles.answerCard}>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setExpandedQuestions((prev) => ({
                        ...prev,
                        [q.id]: !prev[q.id],
                      }))
                    }
                    style={styles.answerHeader}
                  >
                    <View style={styles.answerHeaderContent}>
                      <Text style={styles.answerQuestion} numberOfLines={2}>
                        {q.question}
                      </Text>
                      <Text style={styles.expandHint}>
                        {expandedQuestions[q.id]
                          ? "Tap to collapse"
                          : "Tap to expand"}
                      </Text>
                    </View>
                    <View style={styles.expandIcon}>
                      <Text style={styles.expandIconText}>
                        {expandedQuestions[q.id] ? "▲" : "▼"}
                      </Text>
                    </View>
                  </Pressable>

                  {expandedQuestions[q.id] && (
                    <View style={styles.answersList}>
                      <Text style={styles.answersTitle}>Solutions:</Text>
                      {(q.answers || []).map((answer, idx) => (
                        <View key={idx} style={styles.solutionCard}>
                          <Text style={styles.solutionText}>
                            {answer.answer}
                          </Text>
                          <View style={styles.solutionFooter}>
                            <Text style={styles.solutionAuthor}>
                              By {answer.answeredByName || "Anonymous"}
                            </Text>
                            <Text style={styles.solutionDate}>
                              {answer.createdAt
                                ?.toDate?.()
                                ?.toLocaleDateString() || "Recent"}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              ))
            ) : (
              <Card style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💡</Text>
                <Text style={styles.emptyText}>No solutions yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to help out!
                </Text>
              </Card>
            )}
          </View>
        </ScrollView>

        {/* FAB */}
        <Pressable
          hitSlop={8}
          style={styles.fab}
          onPress={() => navigation.navigate("AskQuestion")}
        >
          <View style={styles.fabContent}>
            <Text style={styles.fabIcon}>+</Text>
            <Text style={styles.fabText}>Ask</Text>
          </View>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },

  /* ---------- Cards (shared) ---------- */
  card: {
    backgroundColor: Surfaces.solid,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
    }),
  },

  /* ---------- Loading ---------- */
  loadingContainer: { justifyContent: "center", alignItems: "center" },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: EDU_COLORS.primary,
    borderTopColor: "transparent",
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 20, // Increased font size
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },

  /* ---------- Header ---------- */
  header: { paddingBottom: 16, paddingHorizontal: 20 },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  welcomeSection: { flex: 1 },
  welcomeText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "600",
    marginTop: 4,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  notificationButton: { padding: 8 },
  notificationIcon: { position: "relative", padding: 8 },
  notificationIconText: { fontSize: 20, color: "#fff" },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: EDU_COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  avatarImage: { width: "100%", height: "100%" },

  /* ---------- Content ---------- */
  content: { flex: 1, paddingHorizontal: 20 },

  /* ---------- Status Card ---------- */
  statusCard: {
    padding: 20,
    marginBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Surfaces.solid,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
    }),
  },
  statusInfo: { flex: 1 },
  statusRole: {
    fontSize: 16,
    fontWeight: "800",
    color: PALETTE_60_30_10.primary30,
    marginBottom: 2,
  },
  statusGrade: {
    fontSize: 14,
    color: EDU_COLORS.textPrimary,
    fontWeight: "600",
  },
  pointsContainer: { alignItems: "center", marginHorizontal: 16 },
  pointsLabel: { fontSize: 12, color: "#475569", marginBottom: 4 },
  pointsValue: { fontSize: 24, fontWeight: "800", color: "#0F766E" },

  logoutButton: {
    backgroundColor: EDU_COLORS.error,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  logoutText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  /* ---------- Sections ---------- */
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 6,
  },
  sectionSubtitle: { fontSize: 14, color: "#475569", fontWeight: "600" },
  viewAllButton: {
    backgroundColor: Buttons.accentBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewAllText: { color: Buttons.accentText, fontSize: 12, fontWeight: "700" },

  /* ---------- Encouragements ---------- */
  encouragementCard: {
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Surfaces.solid,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  encouragementIcon: { marginRight: 12 },
  encouragementIconText: { fontSize: 20 },
  encouragementContent: { flex: 1 },
  encouragementTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400E",
    marginBottom: 6,
  },
  encouragementMessage: { fontSize: 14, color: "#92400E", lineHeight: 20 },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: EDU_COLORS.error,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  deleteButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  /* ---------- Classrooms ---------- */
  classroomScroll: { marginHorizontal: -20 },
  classroomScrollContent: { paddingHorizontal: 20, gap: 16 },
  classroomCard: {
    width: 280,
    padding: 20,
    backgroundColor: Surfaces.solid,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  classroomHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  classroomIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F7FB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  classroomIconText: { fontSize: 20 },
  classroomTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  classroomStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: PALETTE_60_30_10.primary30,
    marginBottom: 2,
  },
  statLabel: { fontSize: 12, color: "#475569", fontWeight: "600" },
  classroomFooter: { alignItems: "flex-end" },
  joinText: {
    fontSize: 14,
    color: PALETTE_60_30_10.primary30,
    fontWeight: "800",
  },

  /* ---------- Help Needed ---------- */
  questionCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: Surfaces.solid,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  questionBadge: {
    backgroundColor: PALETTE_60_30_10.primary30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  questionBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  questionDate: { fontSize: 12, color: "#475569" },
  questionText: {
    fontSize: 15,
    color: EDU_COLORS.textPrimary,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 12,
  },
  answerCta: {
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  answerCtaText: {
    // link-like text instead of button
    color: PALETTE_60_30_10.primary30, // matches your label color system
    fontSize: 14,
    fontWeight: "800",
    textDecorationLine: "none", // set "underline" if you prefer a link look
  },

  /* ---------- Recent Solutions ---------- */
  answerCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: Surfaces.solid,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  answerHeader: { flexDirection: "row", alignItems: "flex-start" },
  answerHeaderContent: { flex: 1 },
  answerQuestion: {
    fontSize: 15,
    color: EDU_COLORS.textPrimary,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 4,
  },
  expandHint: {
    fontSize: 12,
    color: PALETTE_60_30_10.primary30,
    fontStyle: "italic",
  },
  expandIcon: { marginLeft: 12 },
  expandIconText: {
    fontSize: 12,
    color: PALETTE_60_30_10.primary30,
    fontWeight: "800",
  },
  answersList: { marginTop: 12 },
  answersTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },
  solutionCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
  },
  solutionText: {
    fontSize: 14,
    color: EDU_COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  solutionFooter: { flexDirection: "row", justifyContent: "space-between" },
  solutionAuthor: {
    fontSize: 12,
    color: PALETTE_60_30_10.primary30,
    fontWeight: "700",
  },
  solutionDate: { fontSize: 12, color: "#475569" },

  /* ---------- Empty ---------- */
  emptyState: {
    padding: 24,
    alignItems: "center",
    backgroundColor: Surfaces.solid,
    borderRadius: 16,
  },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyText: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 4,
    textAlign: "center",
  },
  emptySubtext: { fontSize: 14, color: "#475569", textAlign: "center" },

  /* ---------- FAB ---------- */
  fab: {
    position: "absolute",
    bottom: 84,
    right: 24,
    backgroundColor: Buttons.accentBg,
    borderRadius: 28,
    shadowColor: Buttons.accentBg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  fabIcon: {
    fontSize: 20,
    color: Buttons.accentText,
    fontWeight: "300",
    marginRight: 8,
  },
  fabText: { color: Buttons.accentText, fontSize: 16, fontWeight: "800" },
  classroomsLoadingText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  classroomsEmptyText: {
    color: "#FFFFFF",
    opacity: 0.9,
    fontWeight: "700",
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});
