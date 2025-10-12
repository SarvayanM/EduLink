// frontend/screens/ClassroomScreen.js
import Screen from "../components/Screen";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Modal,
  FlatList,
  Platform,
  Animated,
  StyleSheet,
  RefreshControl,
  Keyboard,
  Dimensions,
  Alert,
} from "react-native";
import {
  TextInput,
  Provider as PaperProvider,
  ActivityIndicator,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import {
  EDU_COLORS,
  paperTheme as baseTheme,
  Surfaces,
  Buttons,
} from "../theme/colors";

import { auth, db } from "../services/firebaseAuth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  getDocs,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

/* ---------- Constants ---------- */
const INPUT_BAR_HEIGHT = 68;
const SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "History",
  "Geography",
  "Other",
];

/* ---------- Paper theme (transparent shells so global gradient shows) ---------- */
const paperTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    background: "transparent",
    surface: "transparent",
  },
};

/* ---------- Input theme for Paper TextInputs ---------- */
const INPUT_THEME = {
  roundness: 14,
  colors: {
    primary: EDU_COLORS.primary,
    onSurfaceVariant: EDU_COLORS.textMuted,
    outline: Surfaces.border,
    outlineVariant: Surfaces.border,
    placeholder: EDU_COLORS.placeholder,
    text: EDU_COLORS.textPrimary,
    background: "transparent",
    surface: "transparent",
  },
};

/* ---------- Small UI helpers (blur card + gradient button) ---------- */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const PAGE_TOP_OFFSET = 24;

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

const GradientButton = ({
  title,
  onPress,
  left,
  right,
  style,
  textStyle,
  disabled,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
  >
    <LinearGradient
      colors={[Buttons.primaryBg, Buttons.primaryBg]} // subtle sheen, same palette
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientBtn, disabled && { opacity: 0.6 }, style]}
    >
      <Text style={[styles.gradientBtnText, textStyle]}>{title}</Text>
    </LinearGradient>
  </Pressable>
);

/* ================================================================ */
export default function ClassroomScreen({ route }) {
  const showToast = useToast();
  const insets = useSafeAreaInsets();
  const { classroom } = route.params || {};

  /* ---------- User & data ---------- */
  const [userRole, setUserRole] = useState(null);
  const [userGrade, setUserGrade] = useState(null);
  const [userName, setUserName] = useState("");

  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  /* ---------- Filters ---------- */
  const [selectedSubject, setSelectedSubject] = useState(null);

  /* ---------- Composer / forms ---------- */
  const [questionTitle, setQuestionTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [selectedQuestionItem, setSelectedQuestionItem] = useState(null);
  const [answer, setAnswer] = useState("");

  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [showMyQuestions, setShowMyQuestions] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);

  /* ---------- Refs ---------- */
  const flatListRef = useRef(null);
  const fadeAnims = useRef({});
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;

  /* ---------- Effects ---------- */
  useEffect(() => {
    (async () => {
      await fetchUser();
      await fetchAllQuestions();
      setInitialLoading(false);
    })();
  }, []);

  useEffect(() => {
    setQuestions(
      filterByRoleAndGrade(allQuestions, userRole, userGrade, classroom?.grade)
    );
  }, [allQuestions, userRole, userGrade, classroom?.grade]);

  // Auto-scroll to bottom when questions change
  useEffect(() => {
    if (questions.length > 0 && flatListRef.current) {
      setTimeout(() => {
        try {
          // For inverted lists, scroll to offset 0 to show latest
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
          console.log("Scroll error (non-critical):", error);
        }
      }, 100);
    }
  }, [questions]);

  useEffect(() => {
    const showListener = Keyboard.addListener("keyboardWillShow", (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    const hideListener = Keyboard.addListener("keyboardWillHide", (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (showQuestionForm) {
      modalAnim.setValue(Dimensions.get("window").height);
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: Dimensions.get("window").height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showQuestionForm]);

  useEffect(() => {
    if (showAnswerForm) {
      modalAnim.setValue(Dimensions.get("window").height);
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: Dimensions.get("window").height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showAnswerForm]);

  useEffect(() => {
    if (showMyQuestions) {
      modalAnim.setValue(Dimensions.get("window").height);
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: Dimensions.get("window").height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showMyQuestions]);

  /* ---------- Firestore ---------- */
  const fetchUser = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserRole(data.role);
        setUserGrade(data.grade);
        setUserName(data.displayName || "Student");
      }
    } catch {
      showToast("error", "Failed to load user", "Please try again.");
    }
  };

  const fetchAllQuestions = async () => {
    try {
      const qRef = query(
        collection(db, "questions"),
        orderBy("createdAt", "desc")
      );
      const qs = await getDocs(qRef);
      setAllQuestions(qs.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      showToast("error", "Couldn’t load questions", "Check your connection.");
    }
  };

  const refreshQuestions = async () => {
    try {
      setRefreshing(true);
      await fetchAllQuestions();
    } finally {
      setRefreshing(false);
    }
  };

  /* ---------- Helpers ---------- */
  const filterByRoleAndGrade = (list, role, grade, clsGrade) => {
    const filterGrade = clsGrade || grade;
    let out = list;
    if ((role === "student" || role === "tutor") && filterGrade) {
      out = out.filter((q) => q.grade === filterGrade);
    } else if (role === "teacher" && clsGrade) {
      out = out.filter((q) => q.grade === clsGrade);
    }
    return out;
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        showToast("success", "Image attached");
      }
    } catch {
      showToast("error", "Failed to pick image");
    }
  };

  const postQuestion = async () => {
    if (!question.trim() && !selectedImage) {
      showToast("error", "Please type a question or attach an image.");
      return;
    }

    if (!selectedSubject) {
      showToast("error", "Select subject to send");
      return;
    }

    try {
      const questionGrade = classroom?.grade || userGrade;

      const payload = {
        title: (questionTitle || "").trim(),
        question: question.trim(),
        image: selectedImage,
        subject: selectedSubject,
        askedBy: auth.currentUser.uid,
        askedByEmail: auth.currentUser.email,
        askedByName: userName,
        grade: questionGrade || "N/A",
        createdAt: serverTimestamp(),
        answers: [],
        upvotes: 0,
        status: "unanswered",
      };

      await addDoc(collection(db, "questions"), payload);

      setQuestionTitle("");
      setQuestion("");
      setSelectedImage(null);
      setShowQuestionForm(false);
      showToast("success", "Your question was posted!");

      await fetchAllQuestions();

      // Auto-scroll to bottom to show the new question
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
          console.log("Scroll error (non-critical):", error);
        }
      }, 300);
    } catch {
      showToast("error", "Failed to post question.");
    }
  };

  const submitAnswer = async () => {
    console.log("=== SUBMIT ANSWER STARTED ===");
    console.log("Answer text:", answer);
    console.log("Selected question:", selectedQuestionItem);
    console.log("Current user:", auth.currentUser?.uid);
    console.log("User name:", userName);

    if (!answer.trim()) {
      console.log("❌ Empty answer detected");
      showToast("error", "Please enter your answer.");
      return;
    }

    if (!selectedQuestionItem) {
      console.error("❌ No question selected!");
      showToast("error", "No question selected.");
      return;
    }

    if (!auth.currentUser) {
      console.error("❌ No authenticated user!");
      showToast("error", "Please log in to submit answers.");
      return;
    }

    if (!userName) {
      console.error("❌ No username available!");
      showToast("error", "User name not loaded. Please refresh and try again.");
      return;
    }

    try {
      const qRef = doc(db, "questions", selectedQuestionItem.id);
      const newAnswer = {
        answer: answer.trim(),
        answeredBy: auth.currentUser.uid,
        answeredByName: userName,
        createdAt: new Date(),
        upvotes: 0,
      };
      const updatedAnswers = [
        ...(selectedQuestionItem.answers || []),
        newAnswer,
      ];

      await updateDoc(qRef, { answers: updatedAnswers, status: "answered" });
      console.log("✅ Question document updated successfully!");

      // +5 points and auto-promotion
      const meRef = doc(db, "users", auth.currentUser.uid);
      const me = await getDoc(meRef);
      if (me.exists()) {
        const currentPoints = me.data().points || 0;
        const nextPoints = currentPoints + 5;
        await updateDoc(meRef, { points: nextPoints });
        if (nextPoints >= 200 && me.data().role === "student") {
          await updateDoc(meRef, { role: "tutor" });
          showToast(
            "success",
            "Congrats! You’ve been promoted to Peer Tutor 🎓"
          );
        }
      }

      // soft notification
      try {
        await addDoc(collection(db, "notifications"), {
          userId: selectedQuestionItem.askedBy,
          type: "answer",
          title: "New answer to your question",
          message: `${userName} answered: “${selectedQuestionItem.question?.slice(
            0,
            50
          )}${(selectedQuestionItem.question || "").length > 50 ? "..." : ""}”`,
          questionId: selectedQuestionItem.id,
          read: false,
          createdAt: new Date(),
        });
      } catch {}

      setAnswer("");
      setShowAnswerForm(false);
      setSelectedQuestionItem(null);
      console.log("✅ UI state cleared successfully!");
      showToast("success", "Answer submitted! (+5 points)");

      console.log("Refreshing questions list...");
      await fetchAllQuestions();
      console.log("✅ Questions refreshed successfully!");

      // Auto-scroll to bottom to show the updated question/answer
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
          console.log("Scroll error (non-critical):", error);
        }
      }, 300);
    } catch (error) {
      console.error("Error submitting answer:", error);
      showToast(
        "error",
        "Failed to submit answer",
        error.message || "Unknown error"
      );
    }
  };

  const handleRateAnswer = async (
    questionId,
    answerIndex,
    rating,
    answeredBy
  ) => {
    try {
      // Update question with rating
      const questionRef = doc(db, "questions", questionId);
      const questionDoc = await getDoc(questionRef);
      if (questionDoc.exists()) {
        const questionData = questionDoc.data();
        const updatedAnswers = [...questionData.answers];
        updatedAnswers[answerIndex] = {
          ...updatedAnswers[answerIndex],
          rating: rating,
          ratedBy: auth.currentUser.uid,
        };

        await updateDoc(questionRef, {
          answers: updatedAnswers,
        });

        // Update user points
        const userRef = doc(db, "users", answeredBy);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentPoints = userData.points || 0;
          const newPoints = currentPoints + rating;

          await updateDoc(userRef, {
            points: newPoints,
          });

          // Check if user should be promoted to tutor
          if (newPoints >= 200 && userData.role === "student") {
            await updateDoc(userRef, {
              role: "tutor",
            });
          }
        }

        showToast(
          "success",
          `Rated ${rating} points!`,
          `Points added to ${updatedAnswers[answerIndex].answeredByName}`
        );
        await fetchAllQuestions();
      }
    } catch (error) {
      showToast("error", "Failed to rate answer", error.message);
    }
  };

  const handleDeleteQuestion = async (questionId, questionText) => {
    Alert.alert(
      "Delete Question",
      `Are you sure you want to delete this question?\n\n"${questionText.slice(
        0,
        100
      )}${questionText.length > 100 ? "..." : ""}"`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("Deleting question:", questionId);

              // Delete the question document from Firestore
              await deleteDoc(doc(db, "questions", questionId));

              showToast("success", "Question deleted successfully");

              // Refresh the questions list
              await fetchAllQuestions();

              console.log("✅ Question deleted and list refreshed");
            } catch (error) {
              console.error("Error deleting question:", error);
              showToast("error", "Failed to delete question", error.message);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  /* ---------- Renderers ---------- */
  const SubjectRail = () =>
    (userRole === "student" || userRole === "tutor") && (
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {SUBJECTS.map((subject) => {
            const active = selectedSubject === subject;
            return (
              <Pressable
                key={subject}
                onPress={() => setSelectedSubject(subject)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && styles.chipPressed,
                ]}
                android_ripple={{
                  color: EDU_COLORS.gray200,
                  borderless: false,
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Select ${subject} for posting`}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {subject}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );

  const Empty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>💬 No questions yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Be the first to ask a question!
      </Text>

      {(userRole === "student" || userRole === "tutor") && (
        <GradientButton
          title="Ask a Question"
          onPress={() => setShowQuestionForm(true)}
          style={styles.ctaAsk}
        />
      )}
    </View>
  );

  const renderBubble = (q) => {
    const isMine = q.askedBy === auth.currentUser?.uid;
    return (
      <View
        style={[
          styles.chatContainer,
          isMine ? styles.myQuestionContainer : styles.othersQuestionContainer,
        ]}
      >
        {!isMine && (
          <Text style={styles.chatNameLabel}>
            {q.askedByName || "Anonymous"}
          </Text>
        )}

        <BlurCard style={[styles.chatBubble]}>
          <Pressable
            onPress={() =>
              setExpandedQuestion(expandedQuestion === q.id ? null : q.id)
            }
            onLongPress={
              isMine
                ? () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleDeleteQuestion(q.id, q.question);
                  }
                : undefined
            }
            accessibilityRole="button"
          >
            {q.image ? (
              <Pressable
                onPress={() => {
                  setModalImage(q.image);
                  setShowImageModal(true);
                }}
                accessibilityRole="imagebutton"
              >
                <Image source={{ uri: q.image }} style={styles.questionImage} />
              </Pressable>
            ) : null}

            {!!q.title && (
              <Text
                style={[styles.chatTitleText, styles.textStrong]}
                numberOfLines={2}
              >
                {q.title}
              </Text>
            )}

            <Text style={styles.chatQuestionText}>{q.question}</Text>

            {q.subject && (
              <View
                style={[
                  styles.subjectPill,
                  isMine ? styles.mySubjectPill : styles.othersSubjectPill,
                ]}
              >
                <Text
                  style={[
                    styles.subjectPillText,
                    isMine
                      ? styles.mySubjectPillText
                      : styles.othersSubjectPillText,
                  ]}
                >
                  {q.subject}
                </Text>
              </View>
            )}

            <View style={styles.chatMetaRow}>
              <Text style={styles.chatMeta}>
                {q.status} • 💬 {q.answers?.length || 0}
                {isMine && (
                  <Text style={styles.longPressHint}> • Hold to delete</Text>
                )}
              </Text>
              {!isMine && (
                <GradientButton
                  title="Answer"
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    setSelectedQuestionItem(q);
                    setShowAnswerForm(true);
                  }}
                  style={styles.answerBtn}
                  textStyle={styles.answerBtnLabel}
                />
              )}
            </View>
          </Pressable>

          {expandedQuestion === q.id && q.answers?.length > 0 && (
            <View style={styles.chatAnswersSection}>
              {q.answers.map((ans, i) => (
                <View key={i} style={styles.chatAnswerCard}>
                  <Text style={styles.chatAnswerText}>{ans.answer}</Text>
                  <Text style={styles.chatAnswerMeta}>
                    By {ans.answeredByName}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </BlurCard>
      </View>
    );
  };

  const renderList = () => (
    <FlatList
      ref={flatListRef}
      data={questions}
      keyExtractor={(item) => item.id}
      inverted={true}
      contentContainerStyle={
        questions.length === 0
          ? { flex: 1, paddingHorizontal: 16 }
          : {
              paddingTop: 12,
              paddingBottom: INPUT_BAR_HEIGHT + Math.max(insets.bottom, 24),
              paddingHorizontal: 16,
            }
      }
      ListEmptyComponent={<Empty />}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10,
      }}
      refreshControl={
        <RefreshControl
          tintColor={EDU_COLORS.primary}
          colors={[EDU_COLORS.primary]}
          refreshing={refreshing}
          onRefresh={refreshQuestions}
        />
      }
      renderItem={({ item }) => renderBubble(item)}
    />
  );

  const renderParentView = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={{
        paddingBottom: INPUT_BAR_HEIGHT + Math.max(insets.bottom, 24),
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Child’s Progress</Text>
      <BlurCard style={styles.childCard}>
        <Text style={styles.childName}>👤 Child: John Doe</Text>
        <Text style={styles.childGrade}>📚 Grade: {userGrade || "N/A"}</Text>
        <Text style={styles.childPoints}>🏆 Points: 150</Text>
        <Text style={styles.childRank}>🥇 Class Rank: #12</Text>
      </BlurCard>

      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
        Recent Activity
      </Text>
      <BlurCard style={styles.activityCard}>
        <Text style={styles.activityText}>✅ Answered 3 questions today</Text>
        <Text style={styles.activityText}>📖 Downloaded Math notes</Text>
        <Text style={styles.activityText}>🏆 Earned “Helper” badge</Text>
      </BlurCard>

      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
        Weekly Digest
      </Text>
      <BlurCard style={styles.digestCard}>
        <Text style={styles.digestText}>📊 Questions Asked: 5</Text>
        <Text style={styles.digestText}>💡 Questions Answered: 12</Text>
        <Text style={styles.digestText}>⭐ Points Earned: 45</Text>
        <Text style={styles.digestText}>📈 Improvement: +15%</Text>
      </BlurCard>
    </ScrollView>
  );

  const renderContent = () => {
    if (initialLoading) {
      return (
        <View style={styles.loaderWrap}>
          <ActivityIndicator animating color={EDU_COLORS.primary} />
          <Text
            style={{
              fontSize: 20,
              color: "white",
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            Loading Your Classroom …
          </Text>
        </View>
      );
    }
    switch (userRole) {
      case "teacher":
        return renderList();
      case "parent":
        return renderParentView();
      case "student":
      case "tutor":
      default:
        return renderList();
    }
  };

  /* ---------- Draggable FAB ---------- */
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);
  const panResponder = useRef(
    Animated.createAnimatedComponent(View) &&
      require("react-native").PanResponder.create({
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
          setTimeout(() => (isDragging.current = false), 60);
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            bounciness: 6,
            useNativeDriver: false,
          }).start();
        },
      })
  ).current;

  const handleFabPress = () => {
    if (!isDragging.current) setShowMyQuestions(true);
  };

  /* ---------- UI ---------- */
  return (
    <PaperProvider theme={paperTheme}>
      <Screen>
        {/* Content */}
        {renderContent()}

        <View>
          {/* Subject rail - moved above chatbox */}
          {userRole && <SubjectRail />}

          {/* Subject Selection Bar */}
          {(userRole === "student" || userRole === "tutor") &&
            selectedSubject && (
              <View style={styles.subjectSelectionBar}>
                <View style={styles.subjectTag}>
                  <Text style={styles.subjectTagText}>{selectedSubject}</Text>
                  <Pressable
                    style={styles.subjectTagClose}
                    onPress={() => setSelectedSubject(null)}
                  >
                    <Text style={styles.subjectTagCloseText}>×</Text>
                  </Pressable>
                </View>
              </View>
            )}

          {/* Main Input Bar */}
          <View
            style={[
              styles.inputBar,
              { paddingBottom: Math.max(insets.bottom, 8) },
            ]}
          >
            <View style={styles.chatInputContainer}>
              {/* Attachment Button */}
              <Pressable
                style={styles.imageButton}
                onPress={pickImage}
                accessibilityRole="button"
              >
                <Text style={styles.imageButtonText}>+</Text>
              </Pressable>

              {/* Text Input */}
              <View style={styles.textInputContainer}>
                <TextInput
                  mode="flat"
                  theme={{
                    ...INPUT_THEME,
                    colors: {
                      ...INPUT_THEME.colors,
                      background: "transparent",
                      primary: EDU_COLORS.primary,
                      text: "#000000",
                      placeholder: EDU_COLORS.gray500,
                    },
                  }}
                  style={styles.inputField}
                  contentStyle={styles.inputContent}
                  placeholder="Select subject and Ask..."
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  numberOfLines={1} // Start with single line
                  maxLength={500}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholderTextColor={EDU_COLORS.gray500}
                  autoCorrect={true}
                  autoCapitalize="sentences"
                />
              </View>

              {/* Send Button */}
              <Pressable
                style={[
                  styles.sendButton,
                  question.trim() && selectedSubject
                    ? styles.sendButtonActive
                    : styles.sendButtonInactive,
                ]}
                onPress={postQuestion}
                accessibilityRole="button"
              >
                <Text style={styles.sendButtonText}>↑</Text>
              </Pressable>
            </View>

            {/* Character Count */}
            {question.length > 0 && (
              <Text
                style={[
                  styles.characterCount,
                  {
                    color:
                      question.length > 450
                        ? EDU_COLORS.error
                        : EDU_COLORS.gray500,
                  },
                ]}
              >
                {question.length}/500
              </Text>
            )}
          </View>

          {/* Image Preview */}
          {selectedImage && (
            <View style={styles.imagePreview}>
              <Image
                source={{ uri: selectedImage }}
                style={styles.previewImage}
              />
              <Pressable
                style={styles.removeImageBtn}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={styles.removeImageText}>×</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Draggable FAB */}
        <Animated.View
          style={[
            styles.fab,
            {
              bottom:
                userRole === "student" || userRole === "tutor"
                  ? INPUT_BAR_HEIGHT + Math.max(insets.bottom, 20)
                  : Math.max(insets.bottom, 56),
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Pressable
            style={styles.fabPressable}
            onPress={handleFabPress}
            accessibilityRole="button"
          >
            <Text style={styles.fabText}>📋</Text>
          </Pressable>
        </Animated.View>

        {/* ---------------- Modals ---------------- */}
        {/* Ask Modal */}
        <Modal
          visible={showQuestionForm}
          animationType="none"
          transparent
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowQuestionForm(false)}
        >
          <View style={styles.centeredOverlay}>
            <Animated.View
              style={[
                styles.centeredCard,
                { transform: [{ translateY: modalAnim }] },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ask a Question</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowQuestionForm(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: 12 }}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  mode="outlined"
                  theme={INPUT_THEME}
                  style={styles.questionInput}
                  placeholder="Question title…"
                  value={questionTitle}
                  onChangeText={setQuestionTitle}
                  placeholderTextColor={EDU_COLORS.placeholder}
                />

                <TextInput
                  mode="outlined"
                  theme={INPUT_THEME}
                  style={styles.questionInput}
                  placeholder="Describe your question in detail…"
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={EDU_COLORS.placeholder}
                />

                <View style={styles.subjectSection}>
                  <Text style={styles.fieldLabel}>Subject</Text>
                  <View style={styles.subjectButtons}>
                    {SUBJECTS.map((subject) => {
                      const active = selectedSubject === subject;
                      return (
                        <Pressable
                          key={subject}
                          style={[
                            styles.subjectButton,
                            active && styles.activeSubject,
                          ]}
                          onPress={() =>
                            setSelectedSubject(active ? null : subject)
                          }
                        >
                          <Text
                            style={[
                              styles.subjectText,
                              active && styles.activeSubjectText,
                            ]}
                          >
                            {subject}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <GradientButton
                    title="Ask Question"
                    onPress={postQuestion}
                    style={styles.askButton}
                  />
                  <Pressable
                    onPress={() =>
                      showToast("info", "Snap & Solve coming soon!")
                    }
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.9 : 1 },
                      styles.secondaryBtn,
                    ]}
                  >
                    <Text
                      style={{
                        color: EDU_COLORS.textPrimary,
                        fontWeight: "700",
                      }}
                    >
                      📷 Snap & Solve
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        {/* Answer Modal */}
        <Modal
          visible={showAnswerForm}
          animationType="fade"
          transparent
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowAnswerForm(false)}
        >
          <View style={styles.centeredOverlay}>
            <View style={styles.centeredCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Answer Question</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowAnswerForm(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: 12 }}
                keyboardShouldPersistTaps="handled"
              >
                {selectedQuestionItem && (
                  <View style={styles.questionPreview}>
                    <Text style={styles.previewLabel}>Question</Text>
                    <Text style={styles.previewText}>
                      {selectedQuestionItem.question}
                    </Text>
                  </View>
                )}

                <TextInput
                  mode="outlined"
                  theme={INPUT_THEME}
                  style={styles.answerInput}
                  placeholder="Write your answer here…"
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                  numberOfLines={6}
                  placeholderTextColor={EDU_COLORS.placeholder}
                />

                <View style={styles.buttonRow}>
                  <GradientButton
                    title="Submit"
                    onPress={submitAnswer}
                    style={styles.submitButton}
                  />
                  <Pressable
                    onPress={() => setShowAnswerForm(false)}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.9 : 1 },
                      styles.secondaryBtn,
                    ]}
                  >
                    <Text
                      style={{
                        color: EDU_COLORS.textPrimary,
                        fontWeight: "700",
                      }}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* My Questions Modal */}
        <Modal
          visible={showMyQuestions}
          animationType="fade"
          transparent
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowMyQuestions(false)}
        >
          <View style={styles.centeredOverlay}>
            <View style={styles.centeredCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {userRole === "teacher"
                    ? "Questions I Answered"
                    : "My Questions & Answers"}
                </Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowMyQuestions(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{
                  paddingBottom: Math.max(insets.bottom, 12),
                }}
              >
                {(userRole === "teacher" ? allQuestions : questions)
                  .filter((q) =>
                    userRole === "teacher"
                      ? q.answers?.some(
                          (ans) => ans.answeredBy === auth.currentUser?.uid
                        )
                      : q.askedBy === auth.currentUser?.uid
                  )
                  .map((q) => (
                    <BlurCard key={q.id} style={styles.questionCard}>
                      <Pressable
                        onPress={() =>
                          setExpandedQuestion(
                            expandedQuestion === q.id ? null : q.id
                          )
                        }
                      >
                        {q.image && (
                          <Pressable
                            onPress={() => {
                              setModalImage(q.image);
                              setShowImageModal(true);
                            }}
                          >
                            <Image
                              source={{ uri: q.image }}
                              style={styles.questionImage}
                            />
                          </Pressable>
                        )}
                        {!!q.title && (
                          <Text style={styles.questionTitle}>{q.title}</Text>
                        )}
                        <Text style={styles.questionText}>{q.question}</Text>
                        <Text style={styles.readOnlyText}>
                          Status: {q.status} • 💬 {q.answers?.length || 0}
                        </Text>
                      </Pressable>

                      {expandedQuestion === q.id && q.answers?.length > 0 && (
                        <View style={styles.answersSection}>
                          <Text style={styles.answersTitle}>Answers</Text>
                          {q.answers.map((ans, index) => (
                            <View key={index} style={styles.answerCard}>
                              <Text style={styles.answerText}>
                                {ans.answer}
                              </Text>
                              <View style={styles.answerMetaRow}>
                                <Text style={styles.answerMeta}>
                                  By {ans.answeredByName}
                                </Text>
                                {ans.rating ? (
                                  <Text style={styles.ratedText}>
                                    Rated: ⭐{ans.rating}
                                  </Text>
                                ) : (
                                  q.askedBy === auth.currentUser?.uid && (
                                    <View style={styles.ratingButtons}>
                                      {[5, 10, 15, 20, 25].map((rating) => (
                                        <Pressable
                                          key={rating}
                                          style={styles.ratingBtn}
                                          onPress={() =>
                                            handleRateAnswer(
                                              q.id,
                                              index,
                                              rating,
                                              ans.answeredBy
                                            )
                                          }
                                        >
                                          <Text style={styles.ratingText}>
                                            ⭐{rating}
                                          </Text>
                                        </Pressable>
                                      ))}
                                    </View>
                                  )
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </BlurCard>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Fullscreen Image */}
        <Modal
          visible={showImageModal}
          transparent
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowImageModal(false)}
        >
          <View style={styles.imageModalOverlay}>
            <Pressable
              style={[
                styles.imageModalClose,
                { top: Math.max(insets.top, 24) },
              ]}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={styles.imageModalCloseText}>×</Text>
            </Pressable>

            {modalImage && (
              <Image
                source={{ uri: modalImage }}
                style={[
                  styles.fullscreenImage,
                  { marginBottom: Math.max(insets.bottom, 0) },
                ]}
              />
            )}
          </View>
        </Modal>

        {/* Global toast */}
        <Toast
          position="top"
          topOffset={Math.max(insets.top + 10, 24)}
          visibilityTime={2600}
        />
      </Screen>
    </PaperProvider>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  content: { flex: 1 },

  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },

  /* ---------- Blur Card (shared) ---------- */
  blurCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Surfaces.border,
    padding: 12,
    overflow: "hidden",
  },

  /* ---------- Subject Chips Rail ---------- */
  chipsRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    backgroundColor: EDU_COLORS.gray50,
  },
  chipActive: {
    backgroundColor: Buttons.chipActiveBg,
    borderColor: EDU_COLORS.accent,
  },
  chipPressed: { opacity: 0.9 },
  chipText: {
    fontSize: 13,
    color: EDU_COLORS.textPrimary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: Buttons.chipActiveText,
  },

  /* ---------- Empty State ---------- */
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: EDU_COLORS.gray600,
    marginBottom: 10,
  },
  ctaAsk: {
    marginTop: 8,
    borderRadius: 12,
  },

  /* ---------- Chat List & Bubbles ---------- */
  chatContainer: {
    width: "100%",
    marginBottom: 12,
  },
  myQuestionContainer: {
    alignItems: "flex-end",
  },
  othersQuestionContainer: {
    alignItems: "flex-start",
  },

  chatNameLabel: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    marginBottom: 4,
    marginLeft: 6,
  },

  chatBubble: {
    maxWidth: "90%",
    padding: 12,
  },

  chatTitleText: {
    fontSize: 15,
    color: EDU_COLORS.textPrimary,
    marginBottom: 6,
  },
  textStrong: { fontWeight: "800" },

  chatQuestionText: {
    fontSize: 15,
    lineHeight: 20,
    color: EDU_COLORS.textPrimary,
  },

  subjectPill: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  mySubjectPill: {
    backgroundColor: Buttons.subtleBg,
    borderColor: EDU_COLORS.gray200,
  },
  othersSubjectPill: {
    backgroundColor: Buttons.chipActiveBg,
    borderColor: EDU_COLORS.accent,
  },
  subjectPillText: { fontSize: 12, fontWeight: "700" },
  mySubjectPillText: { color: Buttons.subtleText },
  othersSubjectPillText: { color: Buttons.chipActiveText },

  chatMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  chatMeta: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
  },
  longPressHint: { color: EDU_COLORS.gray500 },

  answerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.primary,
  },
  answerBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  chatAnswersSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: EDU_COLORS.gray100,
    paddingTop: 10,
    gap: 8,
  },
  chatAnswerCard: {
    backgroundColor: EDU_COLORS.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    padding: 10,
  },
  chatAnswerText: {
    fontSize: 14,
    color: EDU_COLORS.textPrimary,
    marginBottom: 4,
  },
  chatAnswerMeta: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    fontStyle: "italic",
  },

  /* ---------- Subject Selection Bar (Tag) ---------- */
  subjectSelectionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: EDU_COLORS.gray100,
  },
  subjectTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: EDU_COLORS.accent,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  subjectTagText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  subjectTagClose: {
    marginLeft: 8,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: EDU_COLORS.accent600,
  },
  subjectTagCloseText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },

  /* ---------- Composer / Input Bar ---------- */
  inputBar: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: EDU_COLORS.borderLight,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chatInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },

  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: EDU_COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 2,
  },
  imageButtonText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },

  textInputContainer: {
    flex: 1,
    maxHeight: 150,
    borderRadius: 22,
    backgroundColor: EDU_COLORS.gray50,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    overflow: "hidden",
  },
  inputField: {
    flex: 1,
    minHeight: 44,
    maxHeight: 150,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
  },
  inputContent: {
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    ...paperTheme.shadows.light,
  },
  sendButtonActive: { backgroundColor: EDU_COLORS.primary },
  sendButtonInactive: { backgroundColor: EDU_COLORS.gray200 },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },

  characterCount: {
    alignSelf: "flex-end",
    fontSize: 12,
    marginTop: -2,
    marginBottom: 8,
    marginRight: 10,
  },

  /* ---------- Image Preview (composer) ---------- */
  imagePreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    backgroundColor: EDU_COLORS.gray50,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    gap: 12,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.error,
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "800",
  },

  /* ---------- Draggable FAB ---------- */
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: EDU_COLORS.primary,
    ...paperTheme.shadows.medium,
  },
  fabPressable: { flex: 1, justifyContent: "center", alignItems: "center" },
  fabText: { fontSize: 24, lineHeight: 26, color: "#FFFFFF" },

  /* ---------- Modals Base ---------- */
  centeredOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  centeredCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: EDU_COLORS.surfaceSolid,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    ...paperTheme.shadows.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: EDU_COLORS.gray100,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: EDU_COLORS.gray100,
  },
  closeButtonText: { color: EDU_COLORS.gray700, fontSize: 22, lineHeight: 24 },
  modalBody: { paddingHorizontal: 16, paddingTop: 16 },

  /* ---------- Ask Modal ---------- */
  questionInput: {
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: EDU_COLORS.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
  },
  subjectSection: { marginTop: 6, marginBottom: 16 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 8,
  },
  subjectButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: Buttons.subtleBg,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
  },
  activeSubject: {
    backgroundColor: Buttons.chipActiveBg,
    borderColor: EDU_COLORS.accent,
  },
  subjectText: { color: Buttons.subtleText, fontWeight: "600" },
  activeSubjectText: { color: Buttons.chipActiveText, fontWeight: "800" },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  askButton: { flex: 1, borderRadius: 12 },
  secondaryBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.gray100,
    alignItems: "center",
  },

  /* ---------- Answer Modal ---------- */
  questionPreview: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: EDU_COLORS.gray50,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: EDU_COLORS.primary,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: EDU_COLORS.primary,
    marginBottom: 4,
  },
  previewText: { fontSize: 15, color: EDU_COLORS.textPrimary },
  answerInput: {
    minHeight: 160,
    fontSize: 16,
    backgroundColor: EDU_COLORS.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
  },
  submitButton: { flex: 1, borderRadius: 12 },

  /* ---------- History Modal ---------- */
  questionCard: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: EDU_COLORS.surfaceSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
  },
  questionImage: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 4,
  },
  questionText: {
    fontSize: 15,
    color: EDU_COLORS.textPrimary,
    marginBottom: 6,
  },
  questionMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: EDU_COLORS.gray100,
  },
  readOnlyText: { fontSize: 12.5, color: EDU_COLORS.gray600 },

  answersSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: EDU_COLORS.gray200,
    gap: 8,
  },
  answersTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: EDU_COLORS.primary600,
    marginBottom: 2,
  },
  answerCard: {
    padding: 10,
    backgroundColor: EDU_COLORS.gray50,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: EDU_COLORS.secondary,
  },
  answerText: { fontSize: 14, color: EDU_COLORS.textPrimary, marginBottom: 6 },
  answerMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  answerMeta: { fontSize: 12, color: EDU_COLORS.gray600, fontStyle: "italic" },
  ratedText: { fontSize: 13, fontWeight: "800", color: EDU_COLORS.accent700 },
  ratingButtons: { flexDirection: "row", gap: 6 },
  ratingBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: EDU_COLORS.accent,
  },
  ratingText: { fontSize: 12, color: "#FFFFFF", fontWeight: "800" },

  /* ---------- Fullscreen Image ---------- */
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalClose: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalCloseText: { color: "#FFFFFF", fontSize: 24, lineHeight: 24 },
  fullscreenImage: { width: "100%", height: "100%" },
});
