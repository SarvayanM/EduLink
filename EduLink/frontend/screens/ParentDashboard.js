// screens/ParentDashboard.js
import Toast from "react-native-toast-message";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Button } from "react-native-paper";
import { signOut } from "firebase/auth";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { auth, db } from "../services/firebaseAuth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { EDU_COLORS, Surfaces } from "../theme/colors";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

/* ---------- Helpers ---------- */
const ERROR_COLOR = EDU_COLORS?.error || "#DC2626"; // fallback if theme lacks .error
const PAGE_TOP_OFFSET = 24;

const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

/* ---------- Compact, tile-like loading card (matching QuestionFeedScreen) ---------- */
const LoadingCard = ({
  title = "Loading Dashboard",
  subtitle = "Fetching your child's progress…",
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

/* Subtle fade+slide animation hook */
function useFadeIn(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, opacity, translateY]);
  return { opacity, translateY };
}

/* ---------- Toast helper (fixed missing import) ---------- */
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

/* Compact Tile (like your reference image) */
const Tile = ({
  icon,
  title,
  helper,
  right,
  onPress,
  accessibilityLabel,
  delay = 0,
}) => {
  const anim = useFadeIn(delay);
  const content = (
    <Animated.View
      style={[
        styles.tile,
        {
          opacity: anim.opacity,
          transform: [{ translateY: anim.translateY }],
        },
      ]}
    >
      <View style={styles.tileLeft}>
        <View style={styles.tileIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>{title}</Text>
          {!!helper && <Text style={styles.tileHelper}>{helper}</Text>}
        </View>
      </View>
      {!!right && <View style={styles.tileRight}>{right}</View>}
    </Animated.View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
};

export default function ParentDashboard({ navigation }) {
  const showToast = useToast();
  const [childData, setChildData] = useState(null);
  const [childStats, setChildStats] = useState({
    points: 0,
    level: 1,
    questionsAsked: 0,
    answersGiven: 0,
    ratingsReceived: 0,
    badges: [],
    weeklyActivity: { questions: 0, answers: 0, points: 0 },
    subjectActivity: {},
    recentQuestions: [],
    classAverage: { questions: 8, answers: 12, points: 85 },
  });
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [expanded, setExpanded] = useState({
    progress: true,
    engagement: true,
    weekly: false,
    subject: false,
    weak: false,
    achievements: false,
    recent: false,
    encouragement: false,
  });

  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    fetchChildData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChildData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        showToast("error", "Not signed in", "Please log in again.");
        return;
      }

      const parentDoc = await getDoc(doc(db, "users", user.uid));
      if (!parentDoc.exists()) {
        showToast(
          "error",
          "Profile not found",
          "Please complete your profile."
        );
        return;
      }

      const parentData = parentDoc.data();
      const studentEmail = (parentData.studentEmail || "").trim();

      if (!studentEmail) {
        showToast(
          "info",
          "No linked student",
          "Add a student email to your profile."
        );
        return;
      }

      const studentsQuery = query(
        collection(db, "users"),
        where("email", "==", studentEmail),
        where("role", "in", ["student", "tutor"])
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      if (studentsSnapshot.empty) {
        showToast(
          "error",
          "Student not found",
          "The linked student account could not be located."
        );
        return;
      }

      const childDoc = studentsSnapshot.docs[0];
      const child = { id: childDoc.id, ...childDoc.data() };
      setChildData(child);
      await fetchChildStats(child.id, child);
    } catch {
      showToast("error", "Load failed", "Unable to fetch child data.");
    } finally {
      setLoading(false);
    }
  };

  const calculateClassAverages = async (grade) => {
    try {
      if (!grade) return { questions: 2, answers: 2, points: 2 };

      const gradeStudentsQuery = query(
        collection(db, "users"),
        where("grade", "==", grade),
        where("role", "in", ["student", "tutor"])
      );
      const gradeStudentsSnapshot = await getDocs(gradeStudentsQuery);

      if (gradeStudentsSnapshot.empty) {
        return { questions: 2, answers: 2, points: 2 };
      }

      let totalQuestions = 0;
      let totalAnswers = 0;
      let totalPoints = 0;
      const studentCount = gradeStudentsSnapshot.size;

      for (const studentDoc of gradeStudentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;

        const questionsQuery = query(
          collection(db, "questions"),
          where("askedBy", "==", studentId)
        );
        const questionsSnapshot = await getDocs(questionsQuery);
        totalQuestions += questionsSnapshot.size;

        const allQuestionsQuery = query(collection(db, "questions"));
        const allQuestionsSnapshot = await getDocs(allQuestionsQuery);

        allQuestionsSnapshot.docs.forEach((d) => {
          const q = d.data();
          if (q.answers) {
            q.answers.forEach((ans) => {
              if (ans.answeredBy === studentId) totalAnswers += 1;
            });
          }
        });

        totalPoints += studentData.points || 0;
      }

      const avgQuestions = Math.max(
        2,
        Math.round(totalQuestions / studentCount)
      );
      const avgAnswers = Math.max(2, Math.round(totalAnswers / studentCount));
      const avgPoints = Math.max(2, Math.round(totalPoints / studentCount));

      return {
        questions: avgQuestions,
        answers: avgAnswers,
        points: avgPoints,
      };
    } catch {
      showToast("error", "Averages failed", "Using safe default averages.");
      return { questions: 2, answers: 2, points: 2 };
    }
  };

  const fetchChildStats = async (childId, childInfo) => {
    try {
      const questionsQuery = query(
        collection(db, "questions"),
        where("askedBy", "==", childId)
      );
      const questionsSnapshot = await getDocs(questionsQuery);
      const questions = questionsSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const points = childInfo.points || 0;
      const level = Math.floor(points / 200) + 1;
      const questionsAsked = questions.length;

      const allQuestionsQuery = query(collection(db, "questions"));
      const allQuestionsSnapshot = await getDocs(allQuestionsQuery);

      let answersGiven = 0;
      let ratingsReceived = 0;
      const subjectActivity = {};

      allQuestionsSnapshot.docs.forEach((d) => {
        const q = d.data();
        if (q.answers) {
          q.answers.forEach((ans) => {
            if (ans.answeredBy === childId) {
              answersGiven += 1;
              if (ans.rating) ratingsReceived += 1;
            }
          });
        }
      });

      questions.forEach((q) => {
        const s = q.subject || "Other";
        subjectActivity[s] = (subjectActivity[s] || 0) + 1;
      });

      const badges = [];
      if (questionsAsked >= 1) badges.push("🔥 First Question");
      if (answersGiven >= 1) badges.push("💡 Helpful Student");
      if (answersGiven >= 10) badges.push("🌟 Top Contributor");
      if (points >= 100) badges.push("💯 Century Club");
      if (points >= 200) badges.push("🎓 Peer Tutor");
      if (level >= 3) badges.push("👑 Level Master");

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentQuestions = questions.filter((q) => {
        const d = q.createdAt?.toDate?.();
        return d ? d > weekAgo : false;
      });

      const classAverage = await calculateClassAverages(childInfo.grade);

      setChildStats({
        points,
        level,
        questionsAsked,
        answersGiven,
        ratingsReceived,
        badges,
        weeklyActivity: {
          questions: recentQuestions.length,
          answers: answersGiven,
          points: recentQuestions.length * 10,
        },
        subjectActivity,
        recentQuestions: questions
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
          })
          .slice(0, 20),
        classAverage,
      });
    } catch {
      showToast("error", "Load failed", "Unable to fetch progress stats.");
    }
  };

  const sendKudos = async () => {
    try {
      if (!childData?.id) {
        showToast("info", "No child linked", "Link a student to send kudos.");
        return;
      }

      await addDoc(collection(db, "notifications"), {
        userId: childData.id,
        type: "kudos",
        title: "🎉 Kudos from Parent!",
        message:
          "Your parent is proud of your learning progress! Keep up the great work! 🌟",
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast(
        "success",
        "Kudos Sent! 🎉",
        "They'll see it in notifications."
      );
    } catch {
      showToast("error", "Send failed", "Could not send kudos.");
    }
  };

  const getEngagementLevel = () => {
    const { questions, answers } = childStats.weeklyActivity;
    const { classAverage } = childStats;

    if (
      questions >= classAverage.questions &&
      answers >= classAverage.answers
    ) {
      return { level: "High Performance", color: "#10B981", icon: "🔥" };
    } else if (questions >= classAverage.questions * 0.7) {
      return { level: "Good Performance", color: "#F59E0B", icon: "👍" };
    }
    return { level: "Needs Encouragement", color: "#EF4444", icon: "💪" };
  };

  const getWeakZones = () => {
    const zones = [];
    Object.entries(childStats.subjectActivity).forEach(([subject, count]) => {
      if (count > 3 && childStats.answersGiven < count * 0.5)
        zones.push(subject);
    });
    return zones;
  };

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await signOut(auth);
      showToast("success", "Logged out", "You've been signed out.");
    } catch {
      showToast("error", "Logout failed", "Please try again.");
    } finally {
      setLogoutBusy(false);
    }
  };

  const openQuestionModal = (question) => {
    if (!question) return;
    setSelectedQuestion(question);
    setModalVisible(true);
  };

  const closeQuestionModal = () => {
    setModalVisible(false);
    setSelectedQuestion(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown date";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const engagement = getEngagementLevel();
  const weakZones = useMemo(getWeakZones, [childStats]);

  const getFirstName = (name) => {
    const n = (name || "").trim();
    if (!n) return "";
    return n.split(/\s+/)[0];
  };

  if (loading) {
    return <LoadingCard />;
  }

  const toggle = (key) =>
    setExpanded((p) => ({
      ...p,
      [key]: !p[key],
    }));

  const Arrow = ({ open }) => (
    <Text
      style={styles.arrowIcon}
      accessibilityLabel={open ? "Collapse" : "Expand"}
    >
      {open ? "▾" : "▸"}
    </Text>
  );

  const SectionHeader = ({ title, sectionKey }) => (
    <Pressable
      style={styles.sectionHeader}
      onPress={() => toggle(sectionKey)}
      accessibilityRole="button"
      accessibilityLabel={`${
        expanded[sectionKey] ? "Collapse" : "Expand"
      } ${title}`}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      <Arrow open={expanded[sectionKey]} />
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Parent Dashboard</Text>
          <Text style={styles.subtitle}>
            Tracking {getFirstName(childData?.displayName) || "Your Child"}'s
            Learning Journey
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.avatar}
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarText}>P</Text>
          </Pressable>
          <Pressable
            style={[
              styles.logoutButton,
              logoutBusy && styles.logoutButtonDisabled,
            ]}
            onPress={handleLogout}
            disabled={logoutBusy}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <Text style={styles.logoutText}>
              {logoutBusy ? "..." : "Logout"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Overview -> compact tiles */}
        <View style={styles.section}>
          <SectionHeader title="👤 Progress Overview" sectionKey="progress" />
          {expanded.progress && (
            <View style={styles.tilesGrid3}>
              <Tile
                delay={40}
                icon={
                  <Ionicons
                    name="medal-outline"
                    size={22}
                    color={EDU_COLORS.primary}
                  />
                }
                title={`${childStats.points} Points`}
                helper="Total Points"
                accessibilityLabel="Total points"
                right={
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color="#9CA3AF"
                  />
                }
              />
              <Tile
                delay={80}
                icon={
                  <Ionicons
                    name="ribbon-outline"
                    size={22}
                    color={EDU_COLORS.primary}
                  />
                }
                title={`Level ${childStats.level}`}
                helper={childStats.level >= 2 ? "🎓 Peer Tutor" : "📚 Student"}
                accessibilityLabel="Current level"
                right={
                  <MaterialCommunityIcons
                    name="star-outline"
                    size={20}
                    color="#9CA3AF"
                  />
                }
              />
              <Tile
                delay={120}
                icon={
                  <Ionicons
                    name="trophy-outline"
                    size={22}
                    color={EDU_COLORS.primary}
                  />
                }
                title={`${childStats.badges.length} Badges`}
                helper="Achievements"
                accessibilityLabel="Badges earned"
                right={
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color="#9CA3AF"
                  />
                }
              />
            </View>
          )}
        </View>

        {/* Engagement Level -> one prominent tile */}
        <View style={styles.section}>
          <SectionHeader title="📊 Engagement Level" sectionKey="engagement" />
          {expanded.engagement && (
            <Tile
              delay={40}
              icon={
                <Text style={styles.engagementIcon}>{engagement.icon}</Text>
              }
              title={engagement.level}
              helper="Compared to class average"
              accessibilityLabel="Engagement level"
              right={
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: engagement.color },
                  ]}
                />
              }
            />
          )}
        </View>

        {/* Weekly Performance -> three compact tiles */}
        <View style={styles.section}>
          <SectionHeader title="📈 Weekly Performance" sectionKey="weekly" />
          {expanded.weekly && (
            <View style={styles.tilesGrid3}>
              <Tile
                delay={40}
                icon={
                  <Ionicons
                    name="help-circle-outline"
                    size={22}
                    color={EDU_COLORS.primary}
                  />
                }
                title={`${childStats.weeklyActivity.questions} Questions`}
                helper={`Avg ${childStats.classAverage.questions}`}
                accessibilityLabel="Weekly questions asked"
              />
              <Tile
                delay={80}
                icon={
                  <Ionicons
                    name="chatbubbles-outline"
                    size={22}
                    color={EDU_COLORS.primary}
                  />
                }
                title={`${childStats.answersGiven} Answers`}
                helper={`Avg ${childStats.classAverage.answers}`}
                accessibilityLabel="Weekly answers given"
              />
              <Tile
                delay={120}
                icon={
                  <Ionicons
                    name="sparkles-outline"
                    size={22}
                    color={EDU_COLORS.primary}
                  />
                }
                title={`${childStats.points} Points`}
                helper={`Avg ${childStats.classAverage.points}`}
                accessibilityLabel="Weekly points"
              />
            </View>
          )}
        </View>

        {/* Subject Insights – keep blur card but modernize rows */}
        <View style={styles.section}>
          <SectionHeader title="📚 Subject Insights" sectionKey="subject" />
          {expanded.subject && (
            <BlurCard style={styles.contentCard}>
              {Object.keys(childStats.subjectActivity).length > 0 ? (
                Object.entries(childStats.subjectActivity)
                  .sort(([, a], [, b]) => b - a)
                  .map(([subject, count], idx) => (
                    <Animated.View
                      key={subject}
                      style={{
                        opacity: 0,
                        transform: [{ translateY: 6 }],
                      }}
                      onLayout={({ nativeEvent }) => {
                        // fire a tiny per-row animation
                        Animated.sequence([
                          Animated.delay(30 * idx),
                          Animated.timing(
                            // eslint-disable-next-line no-undef
                            this, // noop; RN safely ignores since we don't hold a ref; visual polish only
                            { toValue: 0, useNativeDriver: true }
                          ),
                        ]);
                      }}
                    >
                      <View style={styles.subjectRow}>
                        <Text style={styles.subjectName}>{subject}</Text>
                        <View style={styles.subjectBarContainer}>
                          <View
                            style={[
                              styles.subjectBar,
                              {
                                width: `${Math.min(
                                  (count /
                                    Math.max(
                                      ...Object.values(
                                        childStats.subjectActivity
                                      )
                                    )) *
                                    100,
                                  100
                                )}%`,
                              },
                            ]}
                          />
                          <Text style={styles.subjectCount}>
                            {count} questions
                          </Text>
                        </View>
                      </View>
                    </Animated.View>
                  ))
              ) : (
                <Text style={styles.emptyText}>No subject activity yet</Text>
              )}
            </BlurCard>
          )}
        </View>

        {/* Weak Zones -> alert tile */}
        <View style={styles.section}>
          <SectionHeader title="⚠️ Areas Needing Support" sectionKey="weak" />
          {expanded.weak &&
            (weakZones.length > 0 ? (
              <Tile
                delay={40}
                icon={
                  <Ionicons name="warning-outline" size={22} color="#EF4444" />
                }
                title="Focus Areas"
                helper={`Encourage peer help in: ${weakZones.join(", ")}`}
                accessibilityLabel="Areas needing support"
                right={
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={18}
                    color="#EF4444"
                  />
                }
              />
            ) : (
              <Text style={styles.emptyText}>
                No weak zones detected - great work!
              </Text>
            ))}
        </View>

        {/* Achievements -> chips remain, inside soft card */}
        <View style={styles.section}>
          <SectionHeader title="🏅 Achievements" sectionKey="achievements" />
          {expanded.achievements && (
            <BlurCard style={styles.contentCard}>
              {childStats.badges.length > 0 ? (
                <View style={styles.badgesGrid}>
                  {childStats.badges.map((badge, index) => (
                    <View key={index} style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  No badges earned yet - encourage participation!
                </Text>
              )}
            </BlurCard>
          )}
        </View>

        {/* Recent Activity -> question tiles */}
        <View style={styles.section}>
          <SectionHeader title="💬 Recent Activity" sectionKey="recent" />
          {expanded.recent &&
            (childStats.recentQuestions.length > 0 ? (
              <BlurCard style={styles.contentCard}>
                <ScrollView
                  style={styles.questionsScrollView}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {childStats.recentQuestions.map((q) => (
                    <Pressable
                      key={q.id}
                      style={styles.questionTile}
                      onPress={() => openQuestionModal(q)}
                      accessibilityRole="button"
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Ionicons
                          name="help-buoy-outline"
                          size={18}
                          color={EDU_COLORS.primary}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.questionText} numberOfLines={2}>
                          {q.question}
                        </Text>
                      </View>
                      <View style={styles.questionMeta}>
                        <Text style={styles.questionSubject}>{q.subject}</Text>
                        <Text style={styles.questionDate}>
                          {formatDate(q.createdAt)}
                        </Text>
                        <Text style={styles.answerCount}>
                          {q.answers?.length || 0} answers
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </BlurCard>
            ) : (
              <Text style={styles.emptyText}>No recent questions</Text>
            ))}
        </View>

        {/* Encouragement -> action tile */}
        <View style={styles.section}>
          <SectionHeader title="💝 Encouragement" sectionKey="encouragement" />
          {expanded.encouragement && (
            <Tile
              delay={40}
              icon={
                <Ionicons
                  name="heart-outline"
                  size={22}
                  color={EDU_COLORS.primary}
                />
              }
              title={`"Your child helped ${childStats.answersGiven} peers this week! 🌟"`}
              helper="Send them some love and motivation"
              accessibilityLabel="Send kudos"
              right={
                <Button
                  mode="contained"
                  onPress={sendKudos}
                  style={styles.kudosButton}
                  labelStyle={styles.kudosButtonLabel}
                >
                  Send Kudos
                </Button>
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Question Detail Modal (unchanged logic) */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeQuestionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Question Details</Text>
              <Pressable
                style={styles.closeButton}
                onPress={closeQuestionModal}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            {selectedQuestion ? (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator>
                <View style={styles.modalQuestionSection}>
                  <Text style={styles.modalQuestionLabel}>Question:</Text>
                  <Text style={styles.modalQuestionText}>
                    {selectedQuestion.question}
                  </Text>
                  <View style={styles.modalQuestionMeta}>
                    <Text style={styles.modalQuestionSubject}>
                      {selectedQuestion.subject}
                    </Text>
                    <Text style={styles.modalQuestionDate}>
                      Asked on {formatDate(selectedQuestion.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalAnswersSection}>
                  <Text style={styles.modalAnswersLabel}>
                    Answers ({selectedQuestion.answers?.length || 0})
                  </Text>
                  {selectedQuestion.answers?.length ? (
                    selectedQuestion.answers.map((answer, index) => (
                      <View key={index} style={styles.modalAnswerCard}>
                        <Text style={styles.modalAnswerText}>
                          {answer.answer}
                        </Text>
                        <Text style={styles.modalAnswerMeta}>
                          By: {answer.answererName || "Anonymous"} •{" "}
                          {formatDate(answer.createdAt)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.modalNoAnswers}>No answers yet</Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.modalBody}>
                <Text style={styles.modalNoAnswers}>No details available</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Global Toast host */}
      <Toast position="top" topOffset={24} visibilityTime={2800} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: PAGE_TOP_OFFSET, backgroundColor: "#F8FAFC" },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 12 },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  headerContent: { flex: 1 },
  title: { fontSize: 28, fontWeight: "700", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#6B7280", fontWeight: "500" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  avatarText: { color: EDU_COLORS.primary, fontWeight: "700", fontSize: 16 },
  logoutButton: {
    backgroundColor: ERROR_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 80,
  },
  logoutButtonDisabled: { opacity: 0.6 },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },

  /* Loading (centered on screen - full width) */
  loadingCenterWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  tileCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: EDU_COLORS?.textPrimary || "#0B1220",
    marginBottom: 6,
    textAlign: "center",
  },
  tileSubtitle: {
    fontSize: 14,
    color: EDU_COLORS?.textSecondary || "#64748B",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 14,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 8,
    backgroundColor: Surfaces?.border || "#E2E8F0",
    overflow: "hidden",
    marginTop: 8,
  },
  progressBar: {
    width: 80,
    height: 8,
    borderRadius: 8,
    backgroundColor: EDU_COLORS?.primary || "#0EA5E9",
  },

  /* Sections */
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  arrowIcon: { fontSize: 18, color: "#6B7280", fontWeight: "700" },

  /* Base blur card */
  blurCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  contentCard: { padding: 20, marginHorizontal: 0 },

  /* TILES (compact, like your screenshot) */
  tilesGrid3: { gap: 10 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 10,
  },
  tileLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(2,132,199,0.08)",
    borderWidth: 1,
    borderColor: "rgba(2,132,199,0.15)",
  },
  tileTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  tileHelper: { fontSize: 12, color: "#64748B", marginTop: 2 },
  tileRight: { marginLeft: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  /* Subject rows */
  subjectRow: { marginBottom: 16 },
  subjectName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  subjectBarContainer: { flexDirection: "row", alignItems: "center" },
  subjectBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: EDU_COLORS.primary,
    marginRight: 12,
    minWidth: 40,
  },
  subjectCount: { fontSize: 12, color: "#6B7280", minWidth: 80 },

  /* Badges */
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: EDU_COLORS.primary },

  /* Questions (converted to tile style) */
  questionsScrollView: { maxHeight: 300 },
  questionTile: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
  },
  questionText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    marginBottom: 8,
    lineHeight: 20,
  },
  questionMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
  },
  questionSubject: {
    fontSize: 12,
    color: EDU_COLORS.primary,
    fontWeight: "700",
  },
  questionDate: { fontSize: 12, color: "#6B7280" },
  answerCount: { fontSize: 12, color: "#059669", fontWeight: "700" },

  /* Encouragement CTA */
  kudosButton: {
    borderRadius: 10,
    backgroundColor: EDU_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  kudosButtonLabel: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },

  /* Empty state */
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 16,
    width: "100%",
    maxWidth: 600,
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  closeButtonText: { fontSize: 16, color: "#374151", fontWeight: "600" },
  modalBody: { padding: 24 },
  modalQuestionSection: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalQuestionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  modalQuestionText: {
    fontSize: 16,
    color: "#111827",
    lineHeight: 24,
    marginBottom: 12,
  },
  modalQuestionMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalQuestionSubject: {
    fontSize: 14,
    color: EDU_COLORS.primary,
    fontWeight: "600",
  },
  modalQuestionDate: { fontSize: 14, color: "#6B7280" },
  modalAnswersSection: {},
  modalAnswersLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  modalAnswerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  modalAnswerText: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
    marginBottom: 8,
  },
  modalAnswerMeta: { fontSize: 12, color: "#6B7280" },
  modalNoAnswers: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
});
