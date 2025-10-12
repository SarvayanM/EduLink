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
  Animated,
  // Added StatusBar for a clean look
  StatusBar,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  // Using the provided color constants
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
// Renaming to be more specific to UI components
const CORNER_RADIUS = 16; // Slightly reduced for a cleaner, modern look

const PAGE_TOP_OFFSET = 16; // Reduced top offset as SafeAreaView handles it
const CONTENT_HORIZONTAL_PADDING = 20;
const CARD_HORIZONTAL_PADDING = 18; // Increased slightly for more breathing room
const CARD_VERTICAL_PADDING = 18;

// Reusable Blur Card Component for consistent design
const BlurCard = ({
  children,
  style,
  intensity = 45,
  tint = "systemMaterialLight",
}) => (
  // Increased intensity for better blur effect on a light background
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

/* ---------------- Card Component (unused but kept for pattern) ---------------- */
const Card = memo(({ style, children }) => (
  <View style={[styles.card, style]}>{children}</View>
));

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  /* ---------- State (Logic unchanged) ---------- */
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

  const [trackW, setTrackW] = useState(0);
  const barAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, {
          toValue: 1,
          duration: 1100,
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

  const barTranslate = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, Math.max(trackW - 80, 0)], // width-aware
  });

  /* ---------- Utility Functions (Logic unchanged) ---------- */
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
  /**** replace your current `if (loading) { ... }` return with this ****/
  if (loading) {
    return (
      <View style={styles.loadingFullscreenCenter}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={EDU_COLORS.primary} />
          <Text style={styles.loadingTitle}>Loading Dashboard ...</Text>
          <Text style={styles.loadingSubtitle}>
            Fetching your classes, questions, and recent activity
          </Text>

          {/* Indeterminate progress bar (width-aware) */}
          <View
            style={styles.progressTrack}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.progressBarIndeterminate, // <-- use the correct style
                { transform: [{ translateX: barTranslate }] },
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  /* ---------- Main Screen (Enhanced Layout and Styling) ---------- */
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      {/* Header Section */}
      <BlurCard style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.welcomeText}>
              Welcome back! {userRole === "teacher" ? "👨‍🏫" : "🧑‍🎓"}
            </Text>
            <Text style={styles.subtitle}>Ready to learn and grow</Text>
          </View>

          <View style={styles.headerActions}>
            {/* Notification Button */}
            <Pressable
              onPress={() => navigation?.navigate?.("Notifications")}
              style={styles.notificationButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <Text style={styles.notificationIcon}>🔔</Text>
              {unreadNotifications > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Profile Avatar */}
            <Pressable
              onPress={() => navigation?.navigate?.("Profile")}
              style={styles.avatarContainer}
              hitSlop={8}
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
                  <Text style={styles.avatarText}>
                    {auth.currentUser?.email?.[0]?.toUpperCase() || "U"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </BlurCard>

      {/* Main Content ScrollView */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: PAGE_TOP_OFFSET },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status Card (User Role/Points) - Moved outside the header but still prominent */}
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
              <Text style={styles.pointsValue}>
                {Number.isFinite(userPoints) ? userPoints : 0}
              </Text>
              <Text style={styles.pointsLabel}>Learning Points</Text>
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
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss encouragement"
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </Pressable>
              </BlurCard>
            ))}
          </View>
        )}
        <View style={styles.sectionDivider} />

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
                No classrooms found based on your role and points.
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
                <Pressable
                  key={c.id}
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
                  style={({ pressed }) => [
                    styles.classroomCardWrapper,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${c.title}`}
                >
                  <BlurCard style={styles.classroomCard}>
                    <View style={styles.classroomContent}>
                      <Text style={styles.classroomTitle}>{c.title}</Text>
                      <View style={styles.classroomStats}>
                        <Text style={styles.statLabel}>
                          {c.students} Students • {c.questions} Questions
                        </Text>
                      </View>
                      {/* Removed the separate 'View' button, made the whole card pressable */}
                      <Text style={styles.classroomViewCta}>
                        Explore &rarr;
                      </Text>
                    </View>
                  </BlurCard>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
        <View style={styles.sectionDivider} />

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
              hitSlop={8}
            >
              <Text style={styles.answerCtaText}>View All</Text>
            </Pressable>
          </View>

          {Array.isArray(unansweredQuestions) &&
          unansweredQuestions.length > 0 ? (
            unansweredQuestions.map((q) => (
              <Pressable
                key={q.id}
                onPress={() =>
                  navigation?.navigate?.("QuestionDetail", {
                    questionId: q.id,
                  })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                accessibilityRole="button"
                accessibilityLabel="View question details"
              >
                <BlurCard style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <View style={styles.questionBadge}>
                      <Text style={styles.questionBadgeText}>
                        {q.grade ? `Grade ${q.grade}` : "Grade"}
                      </Text>
                    </View>
                    <Text style={styles.questionDate}>{q.date}</Text>
                  </View>
                  <Text style={styles.questionText} numberOfLines={2}>
                    {q?.question || "—"}
                  </Text>
                </BlurCard>
              </Pressable>
            ))
          ) : (
            <BlurCard style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>All questions answered!</Text>
              <Text style={styles.emptySubtext}>Keep up the good work 🎓</Text>
            </BlurCard>
          )}
        </View>
        <View style={styles.sectionDivider} />

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
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle solution"
                >
                  <Text style={styles.answerQuestion}>
                    {q?.question || "—"}
                  </Text>
                  <Text style={styles.expandHint}>
                    {expandedQuestions[q.id]
                      ? "Collapse solution ▲"
                      : "Expand solution ▼"}
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
                        <Text style={styles.solutionText}>
                          No solution provided yet.
                        </Text>
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
    </View>
  );
}

/* ---------- Enhanced Styles ---------- */
const styles = StyleSheet.create({
  // Global/Screen Styles
  screen: {
    flex: 1,
    // Background color is handled globally, so no background color here
  },
  scrollContent: {
    paddingBottom: 120, // More padding to ensure FAB doesn't hide content
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Surfaces.border,
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    marginBottom: 32,
    opacity: 0.5,
  },

  /* Loading State */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC", // Match global background for loading state
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: EDU_COLORS.textPrimary, // Better contrast
    fontWeight: "600",
  },
  loadingIndicator: {
    marginVertical: 20,
  },

  /* Base Card Styles */
  blurCard: {
    borderRadius: CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  card: {
    // Kept the original Card styles as a fallback/pattern
    backgroundColor: Surfaces.solid,
    borderRadius: CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    padding: CARD_HORIZONTAL_PADDING,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08, // Reduced shadow for a lighter feel
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 3,
      },
    }),
  },

  /* Header Section */
  headerCard: {
    // Header is fixed to the top area outside the main scroll
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    paddingTop: 16, // Use paddingTop instead of hardcoded PAGE_TOP_OFFSET
    paddingBottom: 16,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    // Removed marginBottom to integrate better with the scroll area below
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  welcomeText: {
    fontSize: 24, // Slightly smaller for better fit
    color: EDU_COLORS.textPrimary,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: EDU_COLORS.textSecondary,
    fontWeight: "500", // Lighter weight for hierarchy
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16, // Increased gap
  },
  notificationButton: {
    position: "relative",
    padding: 6, // Reduced padding for better alignment
  },
  notificationIcon: {
    fontSize: 24, // Larger icon
    color: EDU_COLORS.textPrimary,
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: EDU_COLORS.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4, // Added padding for better look with "99+"
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 2, // Highlight avatar
    borderColor: EDU_COLORS.primary,
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: Surfaces.solid, // Light background for fallback
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: EDU_COLORS.textPrimary, // Better contrast
    fontWeight: "700",
    fontSize: 18,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },

  /* Status Card */
  statusCard: {
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    marginBottom: 32, // More space
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: 20, // Increased vertical padding
    backgroundColor: Surfaces.solid,
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
    fontSize: 14, // Larger role text
    color: EDU_COLORS.primary,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statusGrade: {
    fontSize: 18, // Larger grade text
    color: EDU_COLORS.textPrimary,
    fontWeight: "700",
  },
  pointsContainer: {
    alignItems: "flex-end", // Align text to the right
    marginLeft: 24,
  },
  pointsLabel: {
    fontSize: 12,
    color: EDU_COLORS.textSecondary,
    marginBottom: 2,
    fontWeight: "600",
  },
  pointsValue: {
    fontSize: 32, // Very prominent points value
    color: EDU_COLORS.primary,
    fontWeight: "900", // Extra bold
  },

  /* Section Styles */
  section: {
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 22, // Bigger title
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: EDU_COLORS.textSecondary,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: EDU_COLORS.primary,
    fontWeight: "700",
  },

  /* Encouragements */
  encouragementCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: 14,
    backgroundColor: PALETTE_60_30_10.accent10, // Distinct background
  },
  encouragementMessage: {
    flex: 1,
    color: EDU_COLORS.textPrimary,
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 20,
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
    paddingHorizontal: 0, // No horizontal padding here, handled by section
    paddingRight: CONTENT_HORIZONTAL_PADDING, // Padding for the last item
    gap: 14, // Slightly less gap
  },
  classroomCardWrapper: {
    width: SCREEN_WIDTH * 0.75, // Wider cards for better content display
    marginLeft: 0,
    // First card needs left margin, others don't, but ScrollView handles this with gap
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  classroomCard: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING + 4,
    backgroundColor: Surfaces.solid,
  },
  classroomContent: {
    gap: 10,
  },
  classroomTitle: {
    fontSize: 20, // Bigger title
    fontWeight: "900",
    color: EDU_COLORS.primary,
  },
  classroomStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: EDU_COLORS.textSecondary,
    fontWeight: "500",
  },
  classroomViewCta: {
    alignSelf: "flex-start",
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: EDU_COLORS.primary,
  },
  emptyClassroomsCard: {
    padding: 24,
    alignItems: "center",
    backgroundColor: Surfaces.solid,
    marginHorizontal: 0,
  },
  emptyClassroomsText: {
    color: EDU_COLORS.textSecondary,
    textAlign: "center",
    fontWeight: "600",
  },

  /* Answer CTA (View All) */
  answerCta: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Buttons.primaryBg, // Using secondary for "View All"
    borderWidth: 1,
    borderColor: Buttons.primaryBg,
  },
  answerCtaText: {
    color: Buttons.primaryText, // Primary color text for secondary button
    fontWeight: "800",
    fontSize: 13,
  },

  /* Questions & Answers */
  questionCard: {
    marginBottom: 10,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
    backgroundColor: Surfaces.solid,
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
    borderRadius: 4,
  },
  questionBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  questionDate: {
    fontSize: 12,
    color: EDU_COLORS.textSecondary,
    fontWeight: "500",
  },
  questionText: {
    fontSize: 16,
    color: EDU_COLORS.textPrimary,
    fontWeight: "700",
    lineHeight: 22,
  },

  // Recent Solutions
  answerCard: {
    marginBottom: 10,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
    backgroundColor: Surfaces.solid,
  },
  answerPressable: {
    paddingVertical: 4,
    paddingBottom: 8, // Added space for hint
  },
  answerQuestion: {
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  expandHint: {
    fontSize: 13,
    color: EDU_COLORS.primary,
    fontStyle: "normal", // Removed italic
    fontWeight: "600",
  },
  answersList: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surfaces.border,
    gap: 12,
  },
  solutionCard: {
    backgroundColor: Surfaces.faint, // Lighter background for nested card
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3, // Accent stripe
    borderLeftColor: PALETTE_60_30_10.accent60,
  },
  solutionText: {
    color: EDU_COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  solutionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  solutionAuthor: {
    fontSize: 12,
    color: EDU_COLORS.primary,
    fontWeight: "700",
  },
  solutionDate: {
    fontSize: 12,
    color: EDU_COLORS.textSecondary,
    fontWeight: "500",
  },

  /* Empty States */
  emptyState: {
    alignItems: "center",
    padding: 32,
    backgroundColor: Surfaces.solid,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyText: {
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
    fontSize: 18,
    marginBottom: 4,
  },
  emptySubtext: {
    color: EDU_COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },

  /* Floating Action Button (FAB) */
  fab: {
    position: "absolute",
    bottom: 30, // Lowered FAB to sit above common tab bars
    right: 24,
    backgroundColor: Buttons.primaryBg,
    borderRadius: 30, // Larger radius
    paddingHorizontal: 28,
    paddingVertical: 18,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.primary,
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      },
      android: {
        elevation: 10,
      },
    }),
  },
  fabText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
  },
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
  loadingFullscreenCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
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
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 8,
    backgroundColor: EDU_COLORS?.gray200 ?? "#E5E7EB",
    overflow: "hidden",
    marginTop: 6,
  },
  progressBarIndeterminate: {
    width: 80, // the moving “pill”
    height: 8,
    borderRadius: 8,
    backgroundColor: Buttons?.primaryBg ?? "#2563EB",
  },
});
