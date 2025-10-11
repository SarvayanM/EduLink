// frontend/screens/HomeScreen.js
import React, { useState, useEffect, memo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
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
import { BlurView } from "expo-blur";

/* ---------------- Constants ---------------- */
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RADIUS = 20;
const RADIUS_LG = 22;
const PAGE_TOP_OFFSET = 24;
const CONTENT_HORIZONTAL_PADDING = 20;
const CARD_HORIZONTAL_PADDING = 16;
const CARD_VERTICAL_PADDING = 14;

const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

/* ---------------- Card Component ---------------- */
const Card = memo(({ style, children }) => (
  <View style={[styles.card, style]}>{children}</View>
));

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [userGrade, setUserGrade] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const [classrooms, setClassrooms] = useState([]);
  const [classroomsLoading, setClassroomsLoading] = useState(true);

  const [profileImage, setProfileImage] = useState(null);
  const [unansweredQuestions, setUnansweredQuestions] = useState([]);
  const [recentAnswers, setRecentAnswers] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [encouragements, setEncouragements] = useState([]);
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const showToast = (type, text1, text2) =>
    Toast.show({
      type,
      text1,
      text2,
      position: "top",
      topOffset: Math.max(insets.top + 10, 24),
      visibilityTime: 2500,
    });

  /* ---------- Lifecycle ---------- */
  useEffect(() => {
    fetchUserGrade();
    fetchClassroomData();
    fetchUserProfile();
    fetchUnreadNotifications();
    fetchEncouragements();

    const interval = setInterval(fetchUnreadNotifications, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userRole && (userGrade || userRole === "teacher")) {
      fetchGradeQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGrade, userRole]);

  /* ---------- Data Fetching Functions (unchanged) ---------- */
  const fetchUserProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const uri = docSnap.data().profileImage || null;
        setProfileImage(typeof uri === "string" && uri.length > 0 ? uri : null);
      }
    } catch {
      showToast("error", "Profile", "Failed to load profile image.");
    }
  };

  const fetchClassroomData = async () => {
    try {
      setClassroomsLoading(true);
      const grades = ["6", "7", "8", "9", "10", "11"];
      const data = grades.map((g) => ({
        id: g,
        title: `Grade ${g}`,
        students: Math.floor(Math.random() * 20) + 5,
        questions: Math.floor(Math.random() * 40),
      }));
      setClassrooms(Array.isArray(data) ? data : []);
    } catch {
      showToast("error", "Classrooms", "Failed to load classrooms.");
      setClassrooms([]);
    } finally {
      setClassroomsLoading(false);
    }
  };

  const calculateCurrentGrade = (initial, year) => {
    const initialNum = parseInt(initial, 10);
    const yearNum = parseInt(year, 10);
    if (Number.isNaN(initialNum) || Number.isNaN(yearNum))
      return initial?.toString?.() || "6";
    const diff = new Date().getFullYear() - yearNum;
    return Math.min(initialNum + diff, 12).toString();
  };

  const fetchUserGrade = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRole(data.role);
        setUserPoints(Number.isFinite(data.points) ? data.points : 0);
        const resolved = data.registrationYear
          ? calculateCurrentGrade(data.grade, data.registrationYear)
          : data.grade;
        const safeGrade = String(resolved || "").trim();
        const allowed = ["6", "7", "8", "9", "10", "11"];
        setUserGrade(allowed.includes(safeGrade) ? safeGrade : "6");
      } else {
        showToast("info", "Welcome", "Please complete your profile.");
      }
    } catch {
      showToast("error", "Profile", "Failed to load user details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchGradeQuestions = async () => {
    try {
      const isTeacher = userRole === "teacher";
      const qRef = isTeacher
        ? query(collection(db, "questions"), orderBy("createdAt", "desc"))
        : query(collection(db, "questions"), where("grade", "==", userGrade));

      const snap = await getDocs(qRef);
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().createdAt?.toDate?.()?.toLocaleDateString() || "Recent",
      }));

      setUnansweredQuestions(
        all.filter((q) => q.status === "unanswered").slice(0, 3)
      );
      setRecentAnswers(
        all
          .filter((q) => q.status === "answered" && q.answers?.length)
          .slice(0, 3)
      );
    } catch {
      showToast("error", "Questions", "Failed to load questions.");
    }
  };

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
      const count = Math.max(0, snap.size || 0);
      setUnreadNotifications(count);
    } catch {
      // soft fail; no toast spam
    }
  };

  const fetchEncouragements = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(
        query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("type", "==", "kudos"),
          where("read", "==", false)
        )
      );
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEncouragements(Array.isArray(items) ? items : []);
    } catch {
      // soft section
    }
  };

  const deleteEncouragement = async (id) => {
    try {
      if (!id) return;
      await updateDoc(doc(db, "notifications", id), { read: true });
      setEncouragements((p) => p.filter((e) => e.id !== id));
      showToast("success", "Dismissed", "Encouragement hidden.");
    } catch {
      showToast("error", "Action failed", "Please try again.");
    }
  };

  /* ---------- Classroom Filtering ---------- */
  const getUserClassrooms = () => {
    const all = Array.isArray(classrooms) ? classrooms : [];
    if (userRole === "teacher") return all;

    const gradeNum = parseInt(userGrade, 10);
    if (!Number.isFinite(gradeNum)) return [];

    if ((userRole === "student" && userPoints >= 200) || userRole === "tutor") {
      return all.filter(
        (c) => parseInt(c.title.replace("Grade ", ""), 10) <= gradeNum
      );
    }
    return all.filter((c) => c.title === `Grade ${gradeNum}`);
  };
  const userClassrooms = getUserClassrooms();

  /* ---------- Loading Screen ---------- */
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={EDU_COLORS.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </SafeAreaView>
    );
  }

  /* ---------- Main Screen ---------- */
  return (
    <View style={styles.screen}>
      {/* Header Section */}
      <BlurCard style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.subtitle}>Ready to learn and grow</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation?.navigate?.("Notifications")}
              style={styles.notificationButton}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <Text style={styles.notificationIcon}>🔔</Text>
              {unreadNotifications > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>{unreadNotifications}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => navigation?.navigate?.("Profile")}
              style={styles.avatar}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>U</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </BlurCard>

      {/* Main Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status Card */}
        <BlurCard style={styles.statusCard}>
          <View style={styles.statusContent}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusRole}>
                {userRole?.toUpperCase?.() ?? "USER"}
              </Text>
              <Text style={styles.statusGrade}>
                {userRole === "teacher" ? "All Grades" : `Grade ${userGrade}`}
              </Text>
            </View>

            <View style={styles.pointsContainer}>
              <Text style={styles.pointsLabel}>Learning Points</Text>
              <Text style={styles.pointsValue}>
                {Number.isFinite(userPoints) ? userPoints : 0}
              </Text>
            </View>
          </View>
        </BlurCard>

        {/* Encouragements Section */}
        {encouragements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💝 Words of Encouragement</Text>
            {encouragements.map((e) => (
              <BlurCard key={e.id} style={styles.encouragementCard}>
                <Text style={styles.encouragementMessage}>
                  {e?.message || "Keep going — you're doing great!"}
                </Text>
                <Pressable
                  onPress={() => deleteEncouragement(e.id)}
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss encouragement"
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </Pressable>
              </BlurCard>
            ))}
          </View>
        )}

        {/* My Classrooms Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Classrooms</Text>
          </View>

          {classroomsLoading ? (
            <ActivityIndicator
              size="small"
              color={EDU_COLORS.primary}
              style={styles.loadingIndicator}
            />
          ) : userClassrooms.length === 0 ? (
            <BlurCard style={styles.emptyClassroomsCard}>
              <Text style={styles.emptyClassroomsText}>
                No classrooms found
              </Text>
            </BlurCard>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.classroomScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {userClassrooms.map((c) => (
                <BlurCard key={c.id} style={styles.classroomCard}>
                  <View style={styles.classroomContent}>
                    <Text style={styles.classroomTitle}>{c.title}</Text>
                    <View style={styles.classroomStats}>
                      <Text style={styles.statLabel}>
                        {c.students} Students • {c.questions} Questions
                      </Text>
                    </View>
                    <Pressable
                      style={styles.viewButton}
                      onPress={() => {
                        const gradeLabel = c?.title?.replace?.("Grade ", "");
                        if (!c?.id || !gradeLabel) {
                          showToast(
                            "error",
                            "Unavailable",
                            "Classroom details are missing."
                          );
                          return;
                        }
                        navigation?.navigate?.("ClassroomDetail", {
                          classroomId: c.id,
                          grade: gradeLabel,
                          title: c.title,
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${c.title}`}
                    >
                      <Text style={styles.viewButtonText}>View</Text>
                    </Pressable>
                  </View>
                </BlurCard>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Help Needed Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTextContainer}>
              <Text style={styles.sectionTitle}>Help Needed</Text>
              <Text style={styles.sectionSubtitle}>
                {userRole === "teacher"
                  ? "Questions from all grades"
                  : `Grade ${userGrade} questions`}
              </Text>
            </View>
            <Pressable
              style={styles.answerCta}
              onPress={() => navigation?.navigate?.("Q&A")}
              accessibilityRole="button"
              accessibilityLabel="Provide answers"
            >
              <Text style={styles.answerCtaText}>Provide Answer</Text>
            </Pressable>
          </View>

          {Array.isArray(unansweredQuestions) &&
          unansweredQuestions.length > 0 ? (
            unansweredQuestions.map((q) => (
              <BlurCard key={q.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <View style={styles.questionBadge}>
                    <Text style={styles.questionBadgeText}>
                      {q.grade ? `Grade ${q.grade}` : "Grade"}
                    </Text>
                  </View>
                  <Text style={styles.questionDate}>{q.date}</Text>
                </View>
                <Text style={styles.questionText}>{q?.question || "—"}</Text>
              </BlurCard>
            ))
          ) : (
            <BlurCard style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>All questions answered!</Text>
              <Text style={styles.emptySubtext}>Keep it up 🎓</Text>
            </BlurCard>
          )}
        </View>

        {/* Recent Solutions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Solutions</Text>
          </View>

          {Array.isArray(recentAnswers) && recentAnswers.length > 0 ? (
            recentAnswers.map((q) => (
              <BlurCard key={q.id} style={styles.answerCard}>
                <Pressable
                  onPress={() =>
                    setExpandedQuestions((p) => ({ ...p, [q.id]: !p[q.id] }))
                  }
                  style={styles.answerPressable}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle solution"
                >
                  <Text style={styles.answerQuestion}>
                    {q?.question || "—"}
                  </Text>
                  <Text style={styles.expandHint}>
                    {expandedQuestions[q.id]
                      ? "Tap to collapse"
                      : "Tap to expand"}
                  </Text>
                </Pressable>

                {expandedQuestions[q.id] && (
                  <View style={styles.answersList}>
                    {Array.isArray(q.answers) && q.answers.length > 0 ? (
                      q.answers.map((a, i) => (
                        <View key={`${q.id}-${i}`} style={styles.solutionCard}>
                          <Text style={styles.solutionText}>
                            {a?.answer || "—"}
                          </Text>
                          <View style={styles.solutionFooter}>
                            <Text style={styles.solutionAuthor}>
                              By {a?.answeredByName || "Anonymous"}
                            </Text>
                            <Text style={styles.solutionDate}>
                              {a?.createdAt
                                ?.toDate?.()
                                ?.toLocaleDateString?.() || "Recent"}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={styles.solutionCard}>
                        <Text style={styles.solutionText}>No details</Text>
                      </View>
                    )}
                  </View>
                )}
              </BlurCard>
            ))
          ) : (
            <BlurCard style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💡</Text>
              <Text style={styles.emptyText}>No recent solutions</Text>
              <Text style={styles.emptySubtext}>
                Check back later for updates
              </Text>
            </BlurCard>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          if (!navigation?.navigate) {
            showToast("error", "Navigation unavailable");
            return;
          }
          navigation.navigate("AskQuestion");
        }}
        accessibilityRole="button"
        accessibilityLabel="Ask a question"
      >
        <Text style={styles.fabText}>+ Ask</Text>
      </Pressable>
    </View>
  );
}

/* ---------- Enhanced Styles ---------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,

    paddingTop: PAGE_TOP_OFFSET,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  /* Loading State */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  loadingIndicator: {
    marginVertical: 20,
  },

  /* Base Card Styles */
  blurCard: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  card: {
    backgroundColor: Surfaces.solid,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 4,
      },
    }),
  },

  /* Header Section */
  headerCard: {
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    marginBottom: 16,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 26,
    color: EDU_COLORS.textPrimary,
    fontWeight: "800",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: EDU_COLORS.textSecondary,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationButton: {
    position: "relative",
    padding: 8,
  },
  notificationIcon: {
    fontSize: 22,
    color: EDU_COLORS.textPrimary,
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: EDU_COLORS.error,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },

  /* Status Card */
  statusCard: {
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    marginBottom: 24,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
  },
  statusContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusInfo: {
    flex: 1,
  },
  statusRole: {
    fontSize: 12,
    color: EDU_COLORS.primary,
    fontWeight: "800",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  statusGrade: {
    fontSize: 14,
    color: EDU_COLORS.textSecondary,
    fontWeight: "700",
  },
  pointsContainer: {
    alignItems: "center",
    marginHorizontal: 16,
  },
  pointsLabel: {
    fontSize: 12,
    color: EDU_COLORS.textSecondary,
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 22,
    color: EDU_COLORS.primary,
    fontWeight: "800",
  },
  logoutButton: {
    backgroundColor: EDU_COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  /* Section Styles */
  section: {
    marginBottom: 32,
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sectionTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: EDU_COLORS.textSecondary,
  },

  /* Encouragements */
  encouragementCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: 12,
  },
  encouragementMessage: {
    flex: 1,
    color: PALETTE_60_30_10.accent60,
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 18,
  },
  deleteButton: {
    backgroundColor: EDU_COLORS.error,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginLeft: 12,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  /* Classrooms */
  classroomScrollContent: {
    paddingRight: CONTENT_HORIZONTAL_PADDING,
    gap: 16,
  },
  classroomCard: {
    width: SCREEN_WIDTH * 0.7,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
  },
  classroomContent: {
    gap: 12,
  },
  classroomTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  classroomStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: EDU_COLORS.textSecondary,
  },
  viewButton: {
    alignSelf: "flex-start",
    backgroundColor: Buttons.primaryBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewButtonText: {
    color: Buttons.accentText,
    fontWeight: "800",
    fontSize: 13,
  },
  emptyClassroomsCard: {
    padding: 24,
    alignItems: "center",
  },
  emptyClassroomsText: {
    color: EDU_COLORS.textSecondary,
    textAlign: "center",
    fontWeight: "600",
  },

  /* Answer CTA */
  answerCta: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Buttons.primaryBg,
  },
  answerCtaText: {
    color: Buttons.accentText,
    fontWeight: "800",
    fontSize: 13,
  },

  /* Questions & Answers */
  questionCard: {
    marginBottom: 12,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  questionBadge: {
    backgroundColor: PALETTE_60_30_10.accent10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  questionBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  questionDate: {
    fontSize: 11,
    color: EDU_COLORS.textSecondary,
  },
  questionText: {
    fontSize: 15,
    color: EDU_COLORS.textPrimary,
    fontWeight: "600",
    lineHeight: 20,
  },
  answerCard: {
    marginBottom: 12,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
  },
  answerPressable: {
    paddingVertical: 4,
  },
  answerQuestion: {
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  expandHint: {
    fontSize: 12,
    color: EDU_COLORS.primary,
    fontStyle: "italic",
  },
  answersList: {
    marginTop: 12,
    gap: 8,
  },
  solutionCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 12,
    borderRadius: 8,
  },
  solutionText: {
    color: EDU_COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  solutionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  solutionAuthor: {
    fontSize: 12,
    color: EDU_COLORS.primary,
    fontWeight: "700",
  },
  solutionDate: {
    fontSize: 12,
    color: EDU_COLORS.textSecondary,
  },

  /* Empty States */
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyText: {
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: EDU_COLORS.textSecondary,
    fontSize: 14,
  },

  /* Floating Action Button */
  fab: {
    position: "absolute",
    bottom: 84,
    right: 24,
    backgroundColor: Buttons.primaryBg,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  fabText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
