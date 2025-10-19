// frontend/screens/HomeScreen.js
import React, { useState, useEffect, memo, useRef } from "react";
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
  StatusBar,
  Easing,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

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

/* ---------------- Constants & safe fallbacks ---------------- */
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CORNER_RADIUS = 16;
const PAGE_TOP_OFFSET = 16;
const CONTENT_HORIZONTAL_PADDING = 20;
const CARD_HORIZONTAL_PADDING = 18;
const CARD_VERTICAL_PADDING = 18;

// Robust color tokens (avoid undefined theme keys)
const PRIMARY = EDU_COLORS?.primary ?? "#0A8CA0";
const PRIMARY_TEXT = EDU_COLORS?.textPrimary ?? "#0B1220";
const SECONDARY_TEXT = EDU_COLORS?.textSecondary ?? "#475569";
const ERROR = EDU_COLORS?.error ?? "#EF4444";
const SURFACE = Surfaces?.solid ?? "#FFFFFF";
const BORDER = Surfaces?.border ?? "#E5E7EB";
const BUTTON_BG = Buttons?.primaryBg ?? PRIMARY;
const BUTTON_TEXT = Buttons?.primaryText ?? "#FFFFFF";
const ACCENT10 = PALETTE_60_30_10?.accent10 ?? "rgba(245, 158, 11, 0.14)"; // amber-ish

/* ---------------- Reusable UI ---------------- */
const BlurCard = ({ children, style, intensity = 32, tint }) => (
  <BlurView
    intensity={intensity}
    tint={tint ?? (Platform.OS === "ios" ? "systemMaterialLight" : "light")}
    style={[styles.blurCard, style]}
  >
    {children}
  </BlurView>
);

const Card = memo(({ style, children }) => (
  <View style={[styles.card, style]}>{children}</View>
));

const LoadingCard = ({
  title = "Loading Q&A",
  subtitle = "Fetching the latest unanswered questions…",
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = React.useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.cubic),
      })
    );
    loop.start();
    return () => {
      anim.stopAnimation(() => anim.setValue(0));
    };
  }, [anim]);

  const translateX =
    trackW > 0
      ? anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-80, Math.max(trackW - 80, 0)],
        })
      : 0;

  return (
    <View style={styles.loadingCenterWrap}>
      <View style={styles.tileCard}>
        <Text style={styles.tileTitle}>⏳ {title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>

        <View
          style={styles.progressTrack}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.progressBar,
              trackW ? { transform: [{ translateX }] } : null,
            ]}
          />
        </View>
      </View>
    </View>
  );
};

// Little tiles like your screenshot ("Performance Insights" look)
const InsightTile = ({ icon, color, title, subtitle, delay = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      delay: delay,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [anim, delay]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
        opacity: anim,
        flex: 1,
      }}
    >
      <View style={styles.insightTile}>
        <View
          style={[styles.insightIconWrap, { backgroundColor: color + "22" }]}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.insightTitle}>{title}</Text>
          <Text style={styles.insightSubtitle}>{subtitle}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// List rows like “Tips for Better Sales”
const TipItem = ({ icon, title, subtitle }) => (
  <View style={styles.tipRow}>
    <View style={styles.tipIconCircle}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={styles.tipTitle}>{title}</Text>
      <Text style={styles.tipSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={SECONDARY_TEXT} />
  </View>
);

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  /* ---------- State (logic preserved) ---------- */
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
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    outputRange: [-80, Math.max(trackW - 80, 0)],
  });

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
  }, []);

  useEffect(() => {
    if (userRole && (userGrade || userRole === "teacher"))
      fetchGradeQuestions();
  }, [userGrade, userRole]);

  /* ---------- Data Fetching (unchanged logic) ---------- */
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
      /* silent */
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
      /* silent */
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

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <LoadingCard
        title="Loading questions"
        subtitle="Personalizing by your role and grade…"
      />
    );
  }

  /* ---------- Main ---------- */
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <BlurCard style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.welcomeText}>
              Welcome to EduLink ! {userRole === "teacher" ? "👨‍🏫" : "🧑‍🎓"}
            </Text>
            <Text style={styles.subtitle}>Are you ready to learn and grow</Text>
          </View>
        </View>
      </BlurCard>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: PAGE_TOP_OFFSET },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* === Performance Insights / Tips (screenshot-style tiles) === */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Insights</Text>
          <View style={styles.insightRow}>
            <InsightTile
              color="#16A34A"
              icon={<Ionicons name="time-outline" size={20} color="#16A34A" />}
              title="Response Time"
              subtitle="Fast responder — typically replies within 30 minutes"
              delay={0}
            />
            <View style={{ width: 12 }} />
            <InsightTile
              color="#2563EB"
              icon={
                <Ionicons
                  name="stats-chart-outline"
                  size={20}
                  color="#2563EB"
                />
              }
              title="Activity Level"
              subtitle="Moderate — based on your recent interactions"
              delay={150}
            />
          </View>

          <View style={{ height: 14 }} />

          <Text style={styles.sectionTitle}>Tips for Better Results</Text>
          <View style={styles.tipCard}>
            <TipItem
              icon={
                <Ionicons
                  name="chatbubbles-outline"
                  size={18}
                  color={PRIMARY}
                />
              }
              title="Respond quickly"
              subtitle="Reply to inquiries to increase engagement"
            />
            <View style={styles.tipDivider} />
            <TipItem
              icon={
                <MaterialCommunityIcons
                  name="image-multiple-outline"
                  size={18}
                  color={PRIMARY}
                />
              }
              title="Use clear visuals"
              subtitle="Add high-quality images to attract attention"
            />
            <View style={styles.tipDivider} />
            <TipItem
              icon={
                <Ionicons name="pricetag-outline" size={18} color={PRIMARY} />
              }
              title="Be specific"
              subtitle="Provide details and context for faster help"
            />
          </View>
        </View>

        {/* Encouragements */}
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

        {/* My Classrooms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Classrooms</Text>
          </View>

          {classroomsLoading ? (
            <ActivityIndicator
              size="small"
              color={PRIMARY}
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
                    { opacity: pressed ? 0.85 : 1 },
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
                      <Text style={styles.classroomViewCta}>Explore →</Text>
                    </View>
                  </BlurCard>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionDivider} />

        {/* Help Needed */}
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
                  navigation?.navigate?.("QuestionDetail", { questionId: q.id })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
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

        {/* Recent Solutions */}
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

/* ---------------- Styles ---------------- */
const CARD_BG = Surfaces?.solid ?? "#FFFFFF";
const CARD_BORDER = Surfaces?.border ?? "rgba(148,163,184,0.24)";
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  sectionDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    marginBottom: 32,
    opacity: 0.6,
    marginTop: 8,
  },

  /* Base cards */
  blurCard: {
    borderRadius: CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: CARD_HORIZONTAL_PADDING,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 3 },
    }),
  },

  /* Header */
  headerCard: {
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeText: {
    fontSize: 24,
    color: PRIMARY_TEXT,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: SECONDARY_TEXT, fontWeight: "500" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  notificationButton: { position: "relative", padding: 6 },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: Buttons.accentBg,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: PRIMARY_TEXT, fontWeight: "700", fontSize: 18 },
  avatarImage: { width: "100%", height: "100%" },

  /* Insight tiles + tips (screenshot style) */
  section: { paddingHorizontal: CONTENT_HORIZONTAL_PADDING },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTextContainer: { flex: 1, marginRight: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: PRIMARY_TEXT,
    marginBottom: 10,
  },
  sectionSubtitle: { fontSize: 14, color: SECONDARY_TEXT },

  insightRow: { flexDirection: "row" },
  insightTile: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
    }),
  },
  insightIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: { fontSize: 13, fontWeight: "800", color: PRIMARY_TEXT },
  insightSubtitle: { fontSize: 12, color: SECONDARY_TEXT, marginTop: 2 },

  tipCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
    }),
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY_TEXT },
  tipSubtitle: { fontSize: 12, color: SECONDARY_TEXT, marginTop: 2 },
  tipDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 54,
  },

  /* Status */
  statusCard: {
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    marginBottom: 28,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: 20,
    backgroundColor: SURFACE,
  },
  statusContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusInfo: { flex: 1 },
  statusRole: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statusGrade: { fontSize: 18, color: PRIMARY_TEXT, fontWeight: "700" },
  pointsContainer: { alignItems: "flex-end", marginLeft: 24 },
  pointsLabel: {
    fontSize: 12,
    color: SECONDARY_TEXT,
    marginBottom: 2,
    fontWeight: "600",
  },
  pointsValue: { fontSize: 32, color: PRIMARY, fontWeight: "900" },

  /* Encouragements */
  encouragementCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: 14,
    backgroundColor: ACCENT10,
  },
  encouragementMessage: {
    flex: 1,
    color: PRIMARY_TEXT,
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: ERROR,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginLeft: 12,
  },
  deleteButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  /* Classrooms */
  classroomScrollContent: {
    paddingHorizontal: 0,
    paddingRight: CONTENT_HORIZONTAL_PADDING,
    gap: 14,
  },
  classroomCardWrapper: {
    width: SCREEN_WIDTH * 0.75,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  classroomCard: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING + 4,
    backgroundColor: SURFACE,
  },
  classroomContent: { gap: 10 },
  classroomTitle: { fontSize: 20, fontWeight: "900", color: PRIMARY },
  classroomStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statLabel: { fontSize: 13, color: SECONDARY_TEXT, fontWeight: "500" },
  classroomViewCta: {
    alignSelf: "flex-start",
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: Buttons.accentBg,
  },
  emptyClassroomsCard: {
    padding: 24,
    alignItems: "center",
    backgroundColor: SURFACE,
    marginHorizontal: 0,
  },
  emptyClassroomsText: {
    color: SECONDARY_TEXT,
    textAlign: "center",
    fontWeight: "600",
  },

  /* “View all” button */
  answerCta: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: BUTTON_BG,
    borderWidth: 1,
    borderColor: BUTTON_BG,
  },
  answerCtaText: { color: BUTTON_TEXT, fontWeight: "800", fontSize: 13 },

  /* Q&A cards */
  questionCard: {
    marginBottom: 10,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
    backgroundColor: SURFACE,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  questionBadge: {
    backgroundColor: PRIMARY + "22",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PRIMARY + "44",
  },
  questionBadgeText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  questionDate: { fontSize: 12, color: SECONDARY_TEXT, fontWeight: "500" },
  questionText: {
    fontSize: 16,
    color: PRIMARY_TEXT,
    fontWeight: "700",
    lineHeight: 22,
  },

  /* Answers */
  answerCard: {
    marginBottom: 10,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: CARD_VERTICAL_PADDING,
    backgroundColor: SURFACE,
  },
  answerPressable: { paddingVertical: 4, paddingBottom: 8 },
  answerQuestion: {
    fontWeight: "700",
    color: PRIMARY_TEXT,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  expandHint: { fontSize: 13, color: PRIMARY, fontWeight: "600" },
  answersList: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    gap: 12,
  },
  solutionCard: {
    backgroundColor: Surfaces?.faint ?? "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: PALETTE_60_30_10?.accent60 ?? "#F59E0B",
  },
  solutionText: {
    color: PRIMARY_TEXT,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  solutionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  solutionAuthor: { fontSize: 12, color: PRIMARY, fontWeight: "700" },
  solutionDate: { fontSize: 12, color: SECONDARY_TEXT, fontWeight: "500" },

  /* Empty states */
  emptyState: { alignItems: "center", padding: 32, backgroundColor: SURFACE },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: {
    fontWeight: "700",
    color: PRIMARY_TEXT,
    fontSize: 18,
    marginBottom: 4,
  },
  emptySubtext: { color: SECONDARY_TEXT, fontSize: 14, textAlign: "center" },

  /* Loading */
  loadingCenterWrap: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tile: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    paddingVertical: 14,
  },
  px16: { paddingHorizontal: 16 },

  tileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  tileSubtitle: {
    fontSize: 13.5,
    color: EDU_COLORS.textSecondary,
    marginTop: 2,
  },

  loadingFullscreenCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  tileCard: {
    width: "100%",
    maxWidth: 480,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },

  loadingCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: PRIMARY_TEXT,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    color: SECONDARY_TEXT,
    textAlign: "center",
    marginBottom: 8,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginTop: 6,
  },
  progressBarIndeterminate: {
    width: 80,
    height: 8,
    borderRadius: 8,
    backgroundColor: BUTTON_BG,
  },

  loadingIndicator: { marginVertical: 20 },
});
