import Toast from "react-native-toast-message";
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Button } from "react-native-paper";
import { signOut } from "firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { EDU_COLORS, Surfaces } from "../theme/colors";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const PAGE_TOP_OFFSET = 24;

/* ---------- Toast helper ---------- */
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
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={EDU_COLORS.primary} />
        <Text style={styles.loadingText}>Loading Child Progress...</Text>
      </SafeAreaView>
    );
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
        {/* Child Progress Overview */}
        <View style={styles.section}>
          <SectionHeader title="👤 Progress Overview" sectionKey="progress" />
          {expanded.progress && (
            <BlurCard style={styles.contentCard}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{childStats.points}</Text>
                  <Text style={styles.statLabel}>Total Points</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    Level {childStats.level}
                  </Text>
                  <Text style={styles.statLabel}>
                    {childStats.level >= 2 ? "🎓 Peer Tutor" : "📚 Student"}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {childStats.badges.length}
                  </Text>
                  <Text style={styles.statLabel}>Badges Earned</Text>
                </View>
              </View>
            </BlurCard>
          )}
        </View>

        {/* Engagement Level */}
        <View style={styles.section}>
          <SectionHeader title="📊 Engagement Level" sectionKey="engagement" />
          {expanded.engagement && (
            <BlurCard
              style={[
                styles.contentCard,
                { borderLeftColor: engagement.color },
              ]}
            >
              <View style={styles.engagementContent}>
                <Text style={styles.engagementIcon}>{engagement.icon}</Text>
                <View style={styles.engagementInfo}>
                  <Text
                    style={[
                      styles.engagementLevel,
                      { color: engagement.color },
                    ]}
                  >
                    {engagement.level}
                  </Text>
                  <Text style={styles.engagementText}>
                    Compared to class average
                  </Text>
                </View>
              </View>
            </BlurCard>
          )}
        </View>

        {/* Weekly Activity Comparison */}
        <View style={styles.section}>
          <SectionHeader title="📈 Weekly Performance" sectionKey="weekly" />
          {expanded.weekly && (
            <BlurCard style={styles.contentCard}>
              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonLabel}>Questions Asked</Text>
                  <View style={styles.comparisonValues}>
                    <Text style={styles.comparisonChild}>
                      {childStats.weeklyActivity.questions}
                    </Text>
                    <Text style={styles.comparisonAvg}>
                      Avg: {childStats.classAverage.questions}
                    </Text>
                  </View>
                </View>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonLabel}>Answers Given</Text>
                  <View style={styles.comparisonValues}>
                    <Text style={styles.comparisonChild}>
                      {childStats.answersGiven}
                    </Text>
                    <Text style={styles.comparisonAvg}>
                      Avg: {childStats.classAverage.answers}
                    </Text>
                  </View>
                </View>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonLabel}>Points Earned</Text>
                  <View style={styles.comparisonValues}>
                    <Text style={styles.comparisonChild}>
                      {childStats.points}
                    </Text>
                    <Text style={styles.comparisonAvg}>
                      Avg: {childStats.classAverage.points}
                    </Text>
                  </View>
                </View>
              </View>
            </BlurCard>
          )}
        </View>

        {/* Subject Activity Insights */}
        <View style={styles.section}>
          <SectionHeader title="📚 Subject Insights" sectionKey="subject" />
          {expanded.subject && (
            <BlurCard style={styles.contentCard}>
              {Object.keys(childStats.subjectActivity).length > 0 ? (
                Object.entries(childStats.subjectActivity)
                  .sort(([, a], [, b]) => b - a)
                  .map(([subject, count]) => (
                    <View key={subject} style={styles.subjectRow}>
                      <Text style={styles.subjectName}>{subject}</Text>
                      <View style={styles.subjectBarContainer}>
                        <View
                          style={[
                            styles.subjectBar,
                            {
                              width: `${Math.min(
                                (count /
                                  Math.max(
                                    ...Object.values(childStats.subjectActivity)
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
                  ))
              ) : (
                <Text style={styles.emptyText}>No subject activity yet</Text>
              )}
            </BlurCard>
          )}
        </View>

        {/* Weak Zones */}
        <View style={styles.section}>
          <SectionHeader title="⚠️ Areas Needing Support" sectionKey="weak" />
          {expanded.weak &&
            (weakZones.length > 0 ? (
              <BlurCard style={[styles.contentCard, styles.weakZoneCard]}>
                <Text style={styles.weakZoneTitle}>Focus Areas</Text>
                <Text style={styles.weakZoneText}>
                  Your child asks many questions in {weakZones.join(", ")} but
                  gives fewer answers. Consider encouraging them to help peers
                  in these subjects!
                </Text>
              </BlurCard>
            ) : (
              <Text style={styles.emptyText}>
                No weak zones detected - great work!
              </Text>
            ))}
        </View>

        {/* Achievements */}
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

        {/* Recent Q&A Activity */}
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
                      style={styles.questionCard}
                      onPress={() => openQuestionModal(q)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.questionText} numberOfLines={2}>
                        {q.question}
                      </Text>
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

        {/* Encouragement Tools */}
        <View style={styles.section}>
          <SectionHeader title="💝 Encouragement" sectionKey="encouragement" />
          {expanded.encouragement && (
            <BlurCard style={styles.contentCard}>
              <View style={styles.encouragementContent}>
                <Text style={styles.encouragementText}>
                  "Your child helped {childStats.answersGiven} peers this week!
                  🌟"
                </Text>
                <Text style={styles.encouragementSubtext}>
                  Send them some love and motivation!
                </Text>
                <Button
                  mode="contained"
                  onPress={sendKudos}
                  style={styles.kudosButton}
                  labelStyle={styles.kudosButtonLabel}
                >
                  Send Kudos 🎉
                </Button>
              </View>
            </BlurCard>
          )}
        </View>
      </ScrollView>

      {/* Question Detail Modal */}
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

      <Toast position="top" topOffset={24} visibilityTime={2800} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 12,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  avatarText: {
    color: EDU_COLORS.primary,
    fontWeight: "700",
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: EDU_COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 80,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },

  /* Sections */
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  arrowIcon: {
    fontSize: 18,
    color: "#6B7280",
    fontWeight: "700",
  },

  /* Cards */
  blurCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  contentCard: {
    padding: 20,
    marginHorizontal: 0,
  },

  /* Stats Grid */
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: EDU_COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
  },

  /* Engagement */
  engagementContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  engagementIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  engagementInfo: {
    flex: 1,
  },
  engagementLevel: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  engagementText: {
    fontSize: 14,
    color: "#6B7280",
  },

  /* Comparison */
  comparisonGrid: {
    gap: 16,
  },
  comparisonItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  comparisonValues: {
    alignItems: "flex-end",
  },
  comparisonChild: {
    fontSize: 16,
    fontWeight: "700",
    color: EDU_COLORS.primary,
    marginBottom: 2,
  },
  comparisonAvg: {
    fontSize: 12,
    color: "#6B7280",
  },

  /* Subjects */
  subjectRow: {
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  subjectBarContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  subjectBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: EDU_COLORS.primary,
    marginRight: 12,
    minWidth: 40,
  },
  subjectCount: {
    fontSize: 12,
    color: "#6B7280",
    minWidth: 80,
  },

  /* Weak Zones */
  weakZoneCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  weakZoneTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 8,
  },
  weakZoneText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },

  /* Badges */
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: EDU_COLORS.primary,
  },

  /* Questions */
  questionsScrollView: {
    maxHeight: 300,
  },
  questionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 4,
    borderLeftColor: EDU_COLORS.primary,
  },
  questionText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
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
    fontWeight: "600",
  },
  questionDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  answerCount: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
  },

  /* Encouragement */
  encouragementContent: {
    alignItems: "center",
  },
  encouragementText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#059669",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 22,
  },
  encouragementSubtext: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  kudosButton: {
    borderRadius: 12,
    backgroundColor: EDU_COLORS.primary,
    paddingVertical: 4,
  },
  kudosButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  /* Empty States */
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  modalBody: {
    padding: 24,
  },
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
  modalQuestionDate: {
    fontSize: 14,
    color: "#6B7280",
  },
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
  modalAnswerMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  modalNoAnswers: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
});
