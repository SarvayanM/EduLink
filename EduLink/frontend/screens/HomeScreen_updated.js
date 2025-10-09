import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  limit,
} from "firebase/firestore";
import { EDU_COLORS } from "../theme/colors";

/* ---- Palette shortcuts ---- */
const C = {
  primary: EDU_COLORS.primary,
  secondary: EDU_COLORS.secondary,
  base: EDU_COLORS.base,
  white: "#FFFFFF",
};

const { width, height } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
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

  // Enhanced Animations
  const fade = React.useRef(new Animated.Value(0)).current;
  const slideY = React.useRef(new Animated.Value(30)).current;
  const gradientAnim = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(0.95)).current;

  // Background gradient animation
  const gradientInterpolation = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      [C.primary, C.secondary, C.base],
      [C.secondary, C.base, C.primary],
    ],
  });

  useEffect(() => {
    // Start background animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, {
          toValue: 1,
          duration: 15000,
          easing: Animated.Easing.inOut(Animated.Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(gradientAnim, {
          toValue: 0,
          duration: 15000,
          easing: Animated.Easing.inOut(Animated.Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Content entrance animation
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 800,
        easing: Animated.Easing.out(Animated.Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 800,
        easing: Animated.Easing.out(Animated.Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    fetchUserGrade();
    fetchClassroomData();
    fetchUserProfile();
    fetchUnreadNotifications();

    // Refresh notifications every 10 seconds
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
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfileImage(userData.profileImage);
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  }

  async function fetchClassroomData() {
    try {
      const grades = ["6", "7", "8", "9", "10", "11"];
      const classroomData = [];

      for (const grade of grades) {
        // Get student count
        const studentsQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("grade", "==", grade)
        );
        const studentsSnapshot = await getDocs(studentsQuery);

        // Get unanswered questions count
        const questionsQuery = query(
          collection(db, "questions"),
          where("grade", "==", grade),
          where("status", "==", "unanswered")
        );
        const questionsSnapshot = await getDocs(questionsQuery);

        classroomData.push({
          id: parseInt(grade),
          title: `Grade ${grade}`,
          students: studentsSnapshot.size,
          unansweredQuestions: questionsSnapshot.size,
        });
      }

      setClassrooms(classroomData);
    } catch (error) {
      console.error("Error fetching classroom data:", error);
    }
  }

  function calculateCurrentGrade(initialGrade, registrationYear) {
    const currentYear = new Date().getFullYear();
    const yearsPassed = currentYear - registrationYear;
    const currentGrade = parseInt(initialGrade) + yearsPassed;
    return Math.min(currentGrade, 12).toString(); // Cap at grade 12
  }

  async function fetchUserGrade() {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role);
          setUserPoints(userData.points || 0);
          if (userData.registrationYear) {
            const currentGrade = calculateCurrentGrade(
              userData.grade,
              userData.registrationYear
            );
            setUserGrade(currentGrade);
          } else {
            setUserGrade(userData.grade);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user grade:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filter classrooms based on user role and peer tutor status
  const getUserClassrooms = () => {
    if (userRole === "teacher") {
      return classrooms.map((classroom) => ({
        ...classroom,
        grade: classroom.title.replace("Grade ", ""),
      }));
    }

    if (userRole === "student" && userPoints >= 200) {
      // Peer tutor: can access their grade and below
      return classrooms
        .filter((classroom) => {
          const classroomGrade = parseInt(
            classroom.title.replace("Grade ", "")
          );
          return classroomGrade <= parseInt(userGrade);
        })
        .map((classroom) => ({
          ...classroom,
          grade: classroom.title.replace("Grade ", ""),
        }));
    }

    // Regular student: only their grade
    return userGrade
      ? classrooms.filter(
          (classroom) => classroom.title === `Grade ${userGrade}`
        )
      : classrooms;
  };

  const userClassrooms = getUserClassrooms();

  const fetchGradeQuestions = async () => {
    try {
      let gradeQuery;
      if (userRole === "teacher") {
        // Teachers see questions from all grades
        gradeQuery = query(
          collection(db, "questions"),
          orderBy("createdAt", "desc")
        );
      } else {
        // Students see questions from their grade only
        gradeQuery = query(
          collection(db, "questions"),
          where("grade", "==", userGrade)
        );
      }

      const snapshot = await getDocs(gradeQuery);
      const allQuestions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date:
          doc.data().createdAt?.toDate?.()?.toLocaleDateString() || "Recent",
      }));

      // Filter unanswered questions
      const unanswered = allQuestions
        .filter((q) => q.status === "unanswered")
        .slice(0, 2);
      setUnansweredQuestions(unanswered);

      // Get answered questions with their answers (limit to 2)
      const answeredQuestions = allQuestions
        .filter(
          (q) => q.status === "answered" && q.answers && q.answers.length > 0
        )
        .slice(0, 2);

      setRecentAnswers(answeredQuestions);
    } catch (error) {
      console.error("Error fetching grade questions:", error);
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        where("read", "==", false)
      );

      const querySnapshot = await getDocs(q);
      setUnreadNotifications(querySnapshot.size);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[C.primary, C.secondary, C.base]}
            start={{ x: 0.1, y: 0.0 }}
            end={{ x: 0.95, y: 1.0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated gradient background */}
      <Animated.View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[C.primary, C.secondary, C.base]}
          start={{ x: 0.1, y: 0.0 }}
          end={{ x: 0.95, y: 1.0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Subtle background pattern */}
      <View style={styles.backgroundPattern}>
        {[...Array(15)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.patternDot,
              {
                top: Math.random() * height,
                left: Math.random() * width,
                opacity: Math.random() * 0.1 + 0.05,
                transform: [{ scale: Math.random() * 0.5 + 0.5 }],
              },
            ]}
          />
        ))}
      </View>

      {/* Top Navigation */}
      <Animated.View
        style={[
          styles.topNav,
          {
            opacity: fade,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <Text style={styles.title}>My Dashboard</Text>
        <View style={styles.topIcons}>
          <Pressable
            style={styles.iconButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Text style={styles.icon}>🔔</Text>
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </Pressable>

          <LinearGradient
            colors={["#EF4444", "#DC2626"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoutButton}
          >
            <Pressable
              onPress={async () => {
                try {
                  await signOut(auth);
                  Alert.alert("Success", "Logged out successfully");
                } catch (e) {
                  Alert.alert("Error", e?.message ?? "Logout failed");
                }
              }}
              style={styles.logoutPressable}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </LinearGradient>

          <Pressable
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
              <LinearGradient
                colors={[C.primary, C.secondary]}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>U</Text>
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* My Classroom Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fade,
              transform: [{ translateY: slideY }, { scale: cardScale }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>
            My Classroom{" "}
            {userRole === "student" &&
              userPoints >= 200 &&
              "(Peer Tutor Access)"}
          </Text>
          <View style={styles.classroomGrid}>
            {userClassrooms.map((classroom, index) => (
              <Animated.View
                key={classroom.id}
                style={{
                  transform: [{ scale: cardScale }],
                }}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0.1)"]}
                  style={styles.classroomCard}
                >
                  <Pressable
                    onPress={() =>
                      navigation.navigate("ClassroomDetail", {
                        classroom: {
                          ...classroom,
                          grade:
                            classroom.grade ||
                            classroom.title.replace("Grade ", ""),
                        },
                      })
                    }
                    style={styles.classroomPressable}
                  >
                    <View style={styles.classroomImage}>
                      <Text style={styles.classroomIcon}>🏫</Text>
                    </View>
                    <Text style={styles.classroomTitle}>{classroom.title}</Text>
                    <Text style={styles.classroomMeta}>
                      👥 Students: {classroom.students}
                    </Text>
                    <Text style={styles.classroomMeta}>
                      ❓ Unanswered: {classroom.unansweredQuestions}
                    </Text>
                  </Pressable>
                </LinearGradient>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Unanswered Questions Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fade,
              transform: [{ translateY: slideY }, { scale: cardScale }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Unanswered Questions{" "}
              {userRole === "teacher" ? "(All Grades)" : `(Grade ${userGrade})`}
            </Text>
          </View>

          {unansweredQuestions.length > 0 ? (
            unansweredQuestions.map((question) => (
              <LinearGradient
                key={question.id}
                colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
                style={styles.questionRowSimple}
              >
                <Text style={styles.questionText} numberOfLines={2}>
                  {question.question}
                </Text>
                <Text style={styles.questionMeta}>
                  Grade {question.grade} • {question.date}
                </Text>
              </LinearGradient>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No unanswered questions{" "}
              {userRole === "teacher" ? "available" : `for Grade ${userGrade}`}
            </Text>
          )}

          <LinearGradient
            colors={[C.primary, C.secondary]}
            style={styles.viewAllButton}
          >
            <Pressable
              onPress={() => navigation.navigate("Q&A")}
              style={styles.viewAllPressable}
            >
              <Text style={styles.viewAllText}>View All Questions</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        {/* Recent Answers Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fade,
              transform: [{ translateY: slideY }, { scale: cardScale }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Recent Answers{" "}
              {userRole === "teacher" ? "(All Grades)" : `(Grade ${userGrade})`}
            </Text>
          </View>

          {recentAnswers.length > 0 ? (
            recentAnswers.map((question) => (
              <LinearGradient
                key={question.id}
                colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0.1)"]}
                style={styles.questionCard}
              >
                <Pressable
                  onPress={() =>
                    setExpandedQuestions((prev) => ({
                      ...prev,
                      [question.id]: !prev[question.id],
                    }))
                  }
                >
                  <Text style={styles.questionText}>{question.question}</Text>
                  <Text style={styles.clickHint}>
                    Tap to {expandedQuestions[question.id] ? "hide" : "view"}{" "}
                    answers
                  </Text>
                </Pressable>
                {expandedQuestions[question.id] && (
                  <View style={styles.answersSection}>
                    <Text style={styles.answersTitle}>Answers:</Text>
                    {(question.answers || []).map((answer, index) => (
                      <LinearGradient
                        key={index}
                        colors={[
                          "rgba(255,255,255,0.1)",
                          "rgba(255,255,255,0.05)",
                        ]}
                        style={styles.answerCard}
                      >
                        <Text style={styles.answerText}>{answer.answer}</Text>
                        <Text style={styles.answerMeta}>
                          By {answer.answeredByName || "Anonymous"} •{" "}
                          {answer.createdAt?.toDate?.()?.toLocaleDateString() ||
                            "Recent"}
                        </Text>
                      </LinearGradient>
                    ))}
                  </View>
                )}
              </LinearGradient>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No recent answers{" "}
              {userRole === "teacher" ? "available" : `for Grade ${userGrade}`}
            </Text>
          )}
        </Animated.View>
      </ScrollView>

      {/* Floating Action Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            opacity: fade,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        <LinearGradient colors={[C.primary, C.secondary]} style={styles.fab}>
          <Pressable
            onPress={() => navigation.navigate("AskQuestion")}
            style={styles.fabPressable}
          >
            <Text style={styles.fabIcon}>+</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: C.white,
    fontSize: 18,
    fontWeight: "600",
  },
  // Background pattern
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  patternDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "transparent",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: C.white,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  topIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 10,
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  notificationBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  badgeText: {
    color: C.white,
    fontSize: 10,
    fontWeight: "800",
  },
  icon: {
    fontSize: 20,
  },
  logoutButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  logoutPressable: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logoutText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: C.white,
    fontWeight: "800",
    fontSize: 16,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.white,
    marginBottom: 16,
    letterSpacing: 0.3,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  viewAllButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  viewAllPressable: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  viewAllText: {
    color: C.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  classroomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  classroomCard: {
    width: "48%",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  classroomPressable: {
    padding: 16,
    alignItems: "center",
  },
  classroomImage: {
    alignItems: "center",
    marginBottom: 12,
  },
  classroomIcon: {
    fontSize: 36,
  },
  classroomTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.white,
    textAlign: "center",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  classroomMeta: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 4,
    fontWeight: "600",
  },
  questionRowSimple: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "600",
    color: C.white,
    marginBottom: 8,
    lineHeight: 20,
  },
  questionMeta: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  answerButton: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  answerButtonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    right: 24,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  fabPressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fabIcon: {
    fontSize: 28,
    color: C.white,
    fontWeight: "300",
  },
  emptyText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 24,
    fontWeight: "500",
  },
  questionCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  answersSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  answersTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.white,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  answerCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  answerText: {
    fontSize: 15,
    color: C.white,
    marginBottom: 8,
    lineHeight: 20,
    fontWeight: "500",
  },
  answerMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  clickHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontStyle: "italic",
    marginTop: 8,
    fontWeight: "500",
  },
});
