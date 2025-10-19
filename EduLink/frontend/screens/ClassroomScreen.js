// frontend/screens/ClassroomScreen.js

import React, { useEffect, useRef, useState, useMemo } from "react";
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
  KeyboardAvoidingView,
  PanResponder,
} from "react-native";
import {
  TextInput,
  Provider as PaperProvider,
  ActivityIndicator,
  Portal,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

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
import { BOTTOM_NAV_HEIGHT } from "../components/BottomNavbar";

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

/* ---------- Utility: relative time ---------- */
function formatRelative(ts) {
  if (!ts) return "";
  const date = ts?.toDate
    ? ts.toDate()
    : ts instanceof Date
    ? ts
    : new Date(ts);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ---------- Custom Components ---------- */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const GradientButton = ({
  title,
  onPress,
  left,
  right,
  style,
  textStyle,
  disabled,
  a11yLabel,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
    accessibilityLabel={a11yLabel || title}
    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
  >
    <LinearGradient
      // Real gradient now (slight tint shift)
      colors={[Buttons.primaryBg, Buttons.primaryBgTint || Buttons.primaryBg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientBtn, disabled && { opacity: 0.6 }, style]}
    >
      <Text style={[styles.gradientBtnText, textStyle]}>{title}</Text>
    </LinearGradient>
  </Pressable>
);

/* ---------- Custom Hooks ---------- */
function useToast() {
  const insets = useSafeAreaInsets();
  // Single source of truth for toast offset
  const topOffset = 0;

  return React.useCallback(
    (type, text1, text2) => {
      Toast.show({
        type,
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

/* ================================================================ */
export default function ClassroomScreen({ route }) {
  const showToast = useToast();
  const insets = useSafeAreaInsets();
  const { classroom } = route.params || {};

  /* ---------- State Management ---------- */
  const [userRole, setUserRole] = useState(null);
  const [userGrade, setUserGrade] = useState(null);
  const [userName, setUserName] = useState("");
  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  /* ---------- UI State ---------- */
  const [selectedSubject, setSelectedSubject] = useState(null);
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
  const keyboardOffset = useRef(new Animated.Value(0)).current; // actually used now
  const modalAnim = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);

  /* ---------- Effects ---------- */
  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    filterQuestions();
  }, [allQuestions, userRole, userGrade, classroom?.grade]);

  useEffect(() => {
    scrollToLatest();
  }, [questions]);

  // Keyboard listeners for both platforms
  useEffect(() => {
    const showEvt = Platform.select({
      ios: "keyboardWillShow",
      android: "keyboardDidShow",
      default: "keyboardDidShow",
    });
    const hideEvt = Platform.select({
      ios: "keyboardWillHide",
      android: "keyboardDidHide",
      default: "keyboardDidHide",
    });

    const showListener = Keyboard.addListener(showEvt, (e) => {
      const h = e?.endCoordinates?.height ?? 0;
      Animated.timing(keyboardOffset, {
        toValue: h,
        duration: e?.duration ?? 250,
        useNativeDriver: true,
      }).start();
    });
    const hideListener = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e?.duration ?? 250,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, [keyboardOffset]);

  // Modal animation toggle (used by all center cards)
  useEffect(() => {
    animateModal(showQuestionForm || showAnswerForm || showMyQuestions);
  }, [showQuestionForm, showAnswerForm, showMyQuestions]);

  /* ---------- Data Initialization ---------- */
  const initializeData = async () => {
    await fetchUser();
    await fetchAllQuestions();
    setInitialLoading(false);
  };

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
      showToast("error", "Couldn't load questions", "Check your connection.");
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

  /* ---------- UI Helpers ---------- */
  const filterQuestions = () => {
    setQuestions(
      filterByRoleAndGrade(allQuestions, userRole, userGrade, classroom?.grade)
    );
  };

  const scrollToLatest = () => {
    if (questions.length > 0 && flatListRef.current) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
          console.log("Scroll error:", error);
        }
      }, 100);
    }
  };

  const animateModal = (show) => {
    Animated.timing(modalAnim, {
      toValue: show ? 0 : Dimensions.get("window").height,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  /* ---------- Business Logic ---------- */
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

  const canSend = useMemo(
    () => Boolean(question.trim()) && Boolean(selectedSubject),
    [question, selectedSubject]
  );

  const postQuestion = async () => {
    if (!canSend) {
      if (!selectedSubject) {
        showToast("error", "Please select a subject first.");
      } else {
        showToast("error", "Type a question or attach an image.");
      }
      return;
    }

    try {
      const questionGrade = classroom?.grade || userGrade;
      const payload = {
        title: (questionTitle || "").trim(),
        question: question.trim(),
        image: selectedImage || null,
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

      // Clear inputs and subject to avoid stale context
      setQuestionTitle("");
      setQuestion("");
      setSelectedImage(null);
      setSelectedSubject(null);
      setShowQuestionForm(false);
      showToast("success", "Your question was posted!");

      await fetchAllQuestions();
      scrollToLatest();
    } catch {
      showToast("error", "Failed to post question.");
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      showToast("error", "Please enter your answer.");
      return;
    }

    if (!selectedQuestionItem || !auth.currentUser || !userName) {
      showToast("error", "Missing required information.");
      return;
    }

    try {
      const qRef = doc(db, "questions", selectedQuestionItem.id);
      const newAnswer = {
        answer: answer.trim(),
        answeredBy: auth.currentUser.uid,
        answeredByName: userName,
        createdAt: serverTimestamp(), // normalized to server time
        upvotes: 0,
      };
      const updatedAnswers = [
        ...(selectedQuestionItem.answers || []),
        newAnswer,
      ];

      await updateDoc(qRef, { answers: updatedAnswers, status: "answered" });

      // Award points and check promotion
      await awardPointsAndPromote();

      // Send notification
      await sendAnswerNotification();

      setAnswer("");
      setShowAnswerForm(false);
      setSelectedQuestionItem(null);
      showToast("success", "Answer submitted! (+5 points)");

      await fetchAllQuestions();
      scrollToLatest();
    } catch (error) {
      showToast("error", "Failed to submit answer", error?.message);
    }
  };

  const awardPointsAndPromote = async () => {
    const meRef = doc(db, "users", auth.currentUser.uid);
    const me = await getDoc(meRef);
    if (me.exists()) {
      const currentPoints = me.data().points || 0;
      const nextPoints = currentPoints + 5;
      await updateDoc(meRef, { points: nextPoints });
      if (nextPoints >= 200 && me.data().role === "student") {
        await updateDoc(meRef, { role: "tutor" });
        showToast("success", "Congrats! You've been promoted to Peer Tutor 🎓");
      }
    }
  };

  const sendAnswerNotification = async () => {
    try {
      await addDoc(collection(db, "notifications"), {
        userId: selectedQuestionItem.askedBy,
        type: "answer",
        title: "New answer to your question",
        message: `${userName} answered: "${selectedQuestionItem.question?.slice(
          0,
          50
        )}${(selectedQuestionItem.question || "").length > 50 ? "..." : ""}"`,
        questionId: selectedQuestionItem.id,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.log("Notification error:", error);
    }
  };

  const handleRateAnswer = async (
    questionId,
    answerIndex,
    rating,
    answeredBy
  ) => {
    try {
      const questionRef = doc(db, "questions", questionId);
      const questionDoc = await getDoc(questionRef);
      if (questionDoc.exists()) {
        const questionData = questionDoc.data();
        const updatedAnswers = [...(questionData.answers || [])];
        updatedAnswers[answerIndex] = {
          ...updatedAnswers[answerIndex],
          rating,
          ratedBy: auth.currentUser.uid,
        };

        await updateDoc(questionRef, { answers: updatedAnswers });
        await updateUserPoints(answeredBy, rating);
        showToast("success", `Rated ${rating} points!`);
        await fetchAllQuestions();
      }
    } catch (error) {
      showToast("error", "Failed to rate answer", error?.message);
    }
  };

  const updateUserPoints = async (userId, points) => {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const currentPoints = userData.points || 0;
      const newPoints = currentPoints + points;

      await updateDoc(userRef, { points: newPoints });

      if (newPoints >= 200 && userData.role === "student") {
        await updateDoc(userRef, { role: "tutor" });
      }
    }
  };

  const handleDeleteQuestion = async (questionId, questionText) => {
    Alert.alert(
      "Delete Question",
      `Are you sure you want to delete this question?\n\n"${(
        questionText || ""
      ).slice(0, 100)}${(questionText || "").length > 100 ? "..." : ""}"`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "questions", questionId));
              showToast("success", "Question deleted successfully");
              await fetchAllQuestions();
            } catch (error) {
              showToast("error", "Failed to delete question", error?.message);
            }
          },
        },
      ]
    );
  };

  /* ---------- Render Components ---------- */
  const SubjectRail = () =>
    (userRole === "student" || userRole === "tutor") && (
      <View accessible accessibilityLabel="Subject choices">
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
                onPress={() =>
                  setSelectedSubject((prev) =>
                    prev === subject ? null : subject
                  )
                }
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Subject ${subject}${
                  active ? " selected" : ""
                }`}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {subject}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );

  /* const EmptyState = () => (
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
  ); */

  const QuestionBubble = ({ question: q }) => {
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
            {(q.askedByName || "Anonymous") +
              (q.createdAt ? ` • ${formatRelative(q.createdAt)}` : "")}
          </Text>
        )}

        <BlurCard style={styles.chatBubble}>
          <Pressable
            onPress={() =>
              setExpandedQuestion(expandedQuestion === q.id ? null : q.id)
            }
            onLongPress={
              isMine
                ? () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleDeleteQuestion(q.id, q.question || "");
                  }
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel="Open question details"
          >
            {q.image && (
              <Pressable
                onPress={() => {
                  setModalImage(q.image);
                  setShowImageModal(true);
                }}
                accessibilityRole="imagebutton"
                accessibilityLabel="View attached image"
              >
                <Image source={{ uri: q.image }} style={styles.questionImage} />
              </Pressable>
            )}

            {!!q.title && (
              <Text style={[styles.chatTitleText, styles.textStrong]}>
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
                  a11yLabel="Answer this question"
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
                    {ans.createdAt ? ` • ${formatRelative(ans.createdAt)}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </BlurCard>
      </View>
    );
  };

  const QuestionsList = () => (
    <FlatList
      ref={flatListRef}
      data={questions}
      keyExtractor={(item) => item.id}
      inverted
      contentContainerStyle={{
        paddingHorizontal: 16,
      }}
      // ListEmptyComponent={<EmptyState />}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          tintColor={EDU_COLORS.primary}
          colors={[EDU_COLORS.primary]}
          refreshing={refreshing}
          onRefresh={refreshQuestions}
        />
      }
      renderItem={({ item }) => <QuestionBubble question={item} />}
    />
  );

  const ParentView = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={{
        paddingBottom: BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, 24),
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Replace with real data or skeletons in production */}
      <Text style={styles.sectionTitle}>Child's Progress</Text>
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
        <Text style={styles.activityText}>🏆 Earned "Helper" badge</Text>
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

  const LoadingState = () => (
    <View style={styles.loaderWrap}>
      <ActivityIndicator animating color={EDU_COLORS.primary} />
      <Text style={styles.loaderText}>Loading Your Classroom …</Text>
    </View>
  );

  const renderContent = () => {
    if (initialLoading) return <LoadingState />;

    switch (userRole) {
      case "teacher":
        return <QuestionsList />;
      case "parent":
        return <ParentView />;
      case "student":
      case "tutor":
      default:
        return <QuestionsList />;
    }
  };

  /* ---------- FAB Logic ---------- */
  const panResponder = useRef(
    PanResponder.create({
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

  /* ---------- Main Render ---------- */
  return (
    <PaperProvider theme={paperTheme}>
      {/* Toast now appears at very top of screen and inside a Portal for max visibility */}
      <Portal>
        <Toast
          position="top"
          topOffset={0}
          visibilityTime={2600}
          style={{
            zIndex: 99999,
            elevation: 99999,
            position: "absolute",
            left: 0,
            right: 0,
          }}
        />
      </Portal>

      {/* The whole view respects keyboard; plus we animate critical elements */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={NAVBAR_HEIGHT}
      >
        {renderContent()}

        {/* Input Section */}
        <View>
          {/* Subject Rail (only after role resolved) */}
          {userRole && <SubjectRail />}

          {/* Subject Selection Bar */}
          {(userRole === "student" || userRole === "tutor") &&
            selectedSubject && (
              <View style={styles.subjectSelectionBar}>
                <View
                  style={styles.subjectTag}
                  accessible
                  accessibilityLabel={`Selected subject ${selectedSubject}`}
                >
                  <Text style={styles.subjectTagText}>{selectedSubject}</Text>
                  <Pressable
                    style={styles.subjectTagClose}
                    onPress={() => setSelectedSubject(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Clear subject"
                    hitSlop={10}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color={EDU_COLORS.primary}
                    />
                  </Pressable>
                </View>
              </View>
            )}

          {/* Main Input Bar (animated with keyboard) */}
          <Animated.View
            style={[
              styles.inputBar,
              {
                marginBottom: Math.max(insets.bottom, 88),
                transform: [
                  { translateY: Animated.multiply(keyboardOffset, -1.0) },
                ], // keep anchored; KeyboardAvoidingView handles main lift
              },
            ]}
          >
            <View style={styles.chatInputContainer}>
              <Pressable
                style={styles.imageButton}
                onPress={pickImage}
                accessibilityRole="button"
                accessibilityLabel="Attach image"
                hitSlop={10}
              >
                <Ionicons name="image-outline" size={22} color="#666" />
              </Pressable>

              <View style={styles.textInputContainer}>
                <TextInput
                  mode="flat"
                  theme={{
                    ...INPUT_THEME,
                    colors: {
                      ...INPUT_THEME.colors,
                      background: "transparent",
                      primary: EDU_COLORS.primary,
                      text: EDU_COLORS.textPrimary,
                      placeholder: EDU_COLORS.gray500,
                    },
                  }}
                  style={styles.inputField}
                  contentStyle={styles.inputContent}
                  placeholder="Select subject and ask…"
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  numberOfLines={1}
                  maxLength={500}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholderTextColor={EDU_COLORS.gray500}
                  textAlignVertical="center"
                  accessibilityLabel="Question input"
                />
              </View>

              <Pressable
                style={[
                  styles.sendButton,
                  canSend ? styles.sendButtonActive : styles.sendButtonInactive,
                ]}
                onPress={postQuestion}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={canSend ? "Send question" : "Send disabled"}
                hitSlop={6}
              >
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </Pressable>
            </View>

            {question.length > 0 && (
              <Text
                style={[
                  styles.characterCount,
                  {
                    color:
                      question.length > 450
                        ? EDU_COLORS.error
                        : EDU_COLORS.gray600,
                  },
                ]}
              >
                {question.length}/500
              </Text>
            )}
          </Animated.View>

          {/* Image Preview (animated to stay above keyboard) */}
          {selectedImage && (
            <Animated.View
              style={[
                styles.imagePreview,
                {
                  transform: [
                    { translateY: Animated.multiply(keyboardOffset, -0.2) },
                  ],
                  bottom: BOTTOM_NAV_HEIGHT + 8,
                  left: 20,
                },
              ]}
            >
              <Image
                source={{ uri: selectedImage }}
                style={styles.previewImage}
              />
              <Pressable
                style={styles.removeImageBtn}
                onPress={() => setSelectedImage(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove attached image"
                hitSlop={10}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </Animated.View>
          )}
        </View>

        {/* Draggable FAB */}
        <Animated.View
          style={[
            styles.fab,
            {
              bottom:
                userRole === "student" || userRole === "tutor"
                  ? INPUT_BAR_HEIGHT + Math.max(insets.bottom, 16) + 120
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
            accessibilityLabel="Open my questions"
            hitSlop={6}
          >
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={22}
              color="#fff"
            />
          </Pressable>
        </Animated.View>

        {/* Modals */}
        <QuestionFormModal
          visible={showQuestionForm}
          onClose={() => setShowQuestionForm(false)}
          questionTitle={questionTitle}
          setQuestionTitle={setQuestionTitle}
          question={question}
          setQuestion={setQuestion}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          postQuestion={postQuestion}
          showToast={showToast}
          modalAnim={modalAnim}
        />

        <AnswerFormModal
          visible={showAnswerForm}
          onClose={() => setShowAnswerForm(false)}
          selectedQuestionItem={selectedQuestionItem}
          answer={answer}
          setAnswer={setAnswer}
          submitAnswer={submitAnswer}
          modalAnim={modalAnim}
        />

        <MyQuestionsModal
          visible={showMyQuestions}
          onClose={() => setShowMyQuestions(false)}
          userRole={userRole}
          allQuestions={allQuestions}
          questions={questions}
          expandedQuestion={expandedQuestion}
          setExpandedQuestion={setExpandedQuestion}
          setModalImage={setModalImage}
          setShowImageModal={setShowImageModal}
          handleRateAnswer={handleRateAnswer}
          showToast={showToast}
          insets={insets}
          modalAnim={modalAnim}
        />

        <ImageModal
          visible={showImageModal}
          onClose={() => setShowImageModal(false)}
          modalImage={modalImage}
          insets={insets}
        />
      </KeyboardAvoidingView>
    </PaperProvider>
  );
}

/* ---------- Modal Components ---------- */
const QuestionFormModal = ({
  visible,
  onClose,
  questionTitle,
  setQuestionTitle,
  question,
  setQuestion,
  selectedSubject,
  setSelectedSubject,
  postQuestion,
  showToast,
  modalAnim,
}) => (
  <Modal
    visible={visible}
    animationType="none"
    transparent
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <View
      style={styles.centeredOverlay}
      accessible
      accessibilityRole="dialog"
      accessibilityLabel="Ask a Question dialog"
    >
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
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
          >
            <Ionicons name="close" size={18} color={EDU_COLORS.gray700} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.modalBody}
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
                    onPress={() => setSelectedSubject(active ? null : subject)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Choose subject ${subject}${
                      active ? " selected" : ""
                    }`}
                    hitSlop={6}
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
              a11yLabel="Post question"
              disabled={
                !((question?.trim()?.length ?? 0) > 0 || !!selectedSubject)
              }
            />
            <Pressable
              onPress={() => showToast("info", "Snap & Solve coming soon!")}
              style={styles.secondaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Snap and solve coming soon"
            >
              <Text style={styles.secondaryBtnText}>📷 Snap & Solve</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>
);

const AnswerFormModal = ({
  visible,
  onClose,
  selectedQuestionItem,
  answer,
  setAnswer,
  submitAnswer,
  modalAnim,
}) => (
  <Modal
    visible={visible}
    animationType="none"
    transparent
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <View
      style={styles.centeredOverlay}
      accessible
      accessibilityRole="dialog"
      accessibilityLabel="Answer Question dialog"
    >
      <Animated.View
        style={[
          styles.centeredCard,
          { transform: [{ translateY: modalAnim }] },
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Answer Question</Text>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
          >
            <Ionicons name="close" size={18} color={EDU_COLORS.gray700} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.modalBody}
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
              a11yLabel="Submit answer"
              disabled={!answer.trim()}
            />
            <Pressable
              onPress={onClose}
              style={styles.secondaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>
);

const MyQuestionsModal = ({
  visible,
  onClose,
  userRole,
  allQuestions,
  questions,
  expandedQuestion,
  setExpandedQuestion,
  setModalImage,
  setShowImageModal,
  handleRateAnswer,
  showToast,
  insets,
  modalAnim,
}) => (
  <Modal
    visible={visible}
    animationType="none"
    transparent
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <View
      style={styles.centeredOverlay}
      accessible
      accessibilityRole="dialog"
      accessibilityLabel="My Questions dialog"
    >
      <Animated.View
        style={[
          styles.centeredCard,
          { transform: [{ translateY: modalAnim }] },
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {userRole === "teacher"
              ? "Questions I Answered"
              : "My Questions & Answers"}
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
          >
            <Ionicons name="close" size={18} color={EDU_COLORS.gray700} />
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody}>
          {(userRole === "teacher" ? allQuestions : questions)
            .filter((q) =>
              userRole === "teacher"
                ? q.answers?.some(
                    (ans) => ans.answeredBy === auth.currentUser?.uid
                  )
                : q.askedBy === auth.currentUser?.uid
            )
            .map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                expandedQuestion={expandedQuestion}
                setExpandedQuestion={setExpandedQuestion}
                setModalImage={setModalImage}
                setShowImageModal={setShowImageModal}
                handleRateAnswer={handleRateAnswer}
                showToast={showToast}
              />
            ))}
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>
);

const QuestionCard = ({
  question: q,
  expandedQuestion,
  setExpandedQuestion,
  setModalImage,
  setShowImageModal,
  handleRateAnswer,
}) => (
  <BlurCard key={q.id} style={styles.questionCard}>
    <Pressable
      onPress={() =>
        setExpandedQuestion(expandedQuestion === q.id ? null : q.id)
      }
      accessibilityRole="button"
      accessibilityLabel="Toggle answers"
    >
      {q.image && (
        <Pressable
          onPress={() => {
            setModalImage(q.image);
            setShowImageModal(true);
          }}
          accessibilityRole="imagebutton"
          accessibilityLabel="View attached image"
        >
          <Image source={{ uri: q.image }} style={styles.questionImage} />
        </Pressable>
      )}
      {!!q.title && <Text style={styles.questionTitle}>{q.title}</Text>}
      <Text style={styles.questionText}>{q.question}</Text>
      <Text style={styles.readOnlyText}>
        Status: {q.status} • 💬 {q.answers?.length || 0}
        {q.createdAt ? ` • ${formatRelative(q.createdAt)}` : ""}
      </Text>
    </Pressable>

    {expandedQuestion === q.id && q.answers?.length > 0 && (
      <View style={styles.answersSection}>
        <Text style={styles.answersTitle}>Answers</Text>
        {q.answers.map((ans, index) => (
          <View key={index} style={styles.answerCard}>
            <Text style={styles.answerText}>{ans.answer}</Text>
            <View style={styles.answerMetaRow}>
              <Text style={styles.answerMeta}>
                By {ans.answeredByName}
                {ans.createdAt ? ` • ${formatRelative(ans.createdAt)}` : ""}
              </Text>
              {ans.rating ? (
                <Text style={styles.ratedText}>Rated: ⭐{ans.rating}</Text>
              ) : (
                q.askedBy === auth.currentUser?.uid && (
                  <View
                    style={styles.ratingButtons}
                    accessibilityLabel="Rate this answer"
                  >
                    {[5, 10, 15, 20, 25].map((rating) => (
                      <Pressable
                        key={rating}
                        style={styles.ratingBtn}
                        onPress={() =>
                          handleRateAnswer(q.id, index, rating, ans.answeredBy)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${rating} points`}
                        hitSlop={6}
                      >
                        <Text style={styles.ratingText}>⭐{rating}</Text>
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
);

const ImageModal = ({ visible, onClose, modalImage, insets }) => (
  <Modal
    visible={visible}
    transparent
    statusBarTranslucent
    presentationStyle="overFullScreen"
    onRequestClose={onClose}
  >
    <View style={styles.imageModalOverlay}>
      <Pressable
        style={[styles.imageModalClose, { top: Math.max(insets.top, 24) }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close image"
        hitSlop={10}
      >
        <Ionicons name="close" size={18} color="#fff" />
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
);

/* ===================== Styles ===================== */
// (Provide after this block as requested)

/* ===================== Styles ===================== */
/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  /* ---------- Layout ---------- */
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },

  /* ---------- Loading & Empty States ---------- */
  loaderWrap: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: INPUT_BAR_HEIGHT + 12,
  },
  loaderText: {
    fontSize: 20,
    color: EDU_COLORS.textPrimary,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
  },
  emptyStateSubtext: {
    color: EDU_COLORS.gray600,
    marginBottom: 12,
  },
  ctaAsk: {
    alignSelf: "center",
    minWidth: 180,
  },

  /* ---------- Content Areas ---------- */
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginLeft: 0,
  },

  /* ---------- Cards & Surfaces ---------- */
  blurCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
    padding: 12,
    backgroundColor: "transparent",
  },
  childCard: { marginHorizontal: 0 },
  activityCard: { marginHorizontal: 0 },
  digestCard: { marginHorizontal: 0 },

  /* ---------- Text Styles ---------- */
  childName: {
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
  },
  childGrade: { color: EDU_COLORS.gray700 },
  childPoints: { color: EDU_COLORS.gray700 },
  childRank: { color: EDU_COLORS.gray700 },
  activityText: { color: EDU_COLORS.textPrimary },
  digestText: { color: EDU_COLORS.textPrimary },

  /* ---------- Subject Rail ---------- */
  chipsRow: {
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: EDU_COLORS.gray100,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: Buttons.accentBg,
    borderColor: Buttons.accentBg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  chipPressed: { opacity: 0.9 },
  chipText: {
    fontSize: 14,
    fontWeight: "700",
    color: EDU_COLORS.gray700,
  },
  chipTextActive: { color: Buttons.accentText },

  /* ---------- Subject Selection Bar ---------- */
  subjectSelectionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 16,
  },
  subjectTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  subjectTagText: {
    fontSize: 13,
    fontWeight: "700",
    color: EDU_COLORS.primary,
  },
  subjectTagClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ---------- Input Bar ---------- */
  inputBar: {},
  chatInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
    minHeight: 48,
    marginHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  textInputContainer: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    justifyContent: "center",
  },
  inputField: {
    backgroundColor: "transparent",
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  inputContent: {
    paddingHorizontal: 0,
    paddingVertical: 2,
    margin: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  sendButtonActive: {
    backgroundColor: EDU_COLORS.primary,
    transform: [{ scale: 1 }],
  },
  sendButtonInactive: {
    backgroundColor: EDU_COLORS.gray400,
    transform: [{ scale: 0.95 }],
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 16,
  },
  characterCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 6,
    marginRight: 18,
    fontWeight: "500",
  },

  /* ---------- Image Preview ---------- */
  imagePreview: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: EDU_COLORS.error,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ---------- Chat Bubbles ---------- */
  chatContainer: {
    marginHorizontal: 0,
    marginVertical: 6,
  },
  myQuestionContainer: { alignItems: "flex-end" },
  othersQuestionContainer: { alignItems: "flex-start" },
  chatBubble: { maxWidth: "88%" },
  questionImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: EDU_COLORS.gray100,
  },
  textStrong: { color: EDU_COLORS.textPrimary },
  chatTitleText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    color: EDU_COLORS.textPrimary,
  },
  chatQuestionText: {
    fontSize: 15,
    lineHeight: 22,
    color: EDU_COLORS.textPrimary,
  },
  chatNameLabel: {
    fontSize: 12.5,
    color: EDU_COLORS.gray600,
    marginLeft: 8,
    marginBottom: 4,
  },
  chatMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  chatMeta: {
    fontSize: 13,
    color: EDU_COLORS.gray700,
  },
  longPressHint: {
    fontSize: 11.5,
    color: EDU_COLORS.gray600,
    fontStyle: "italic",
  },

  /* ---------- Subject Pills ---------- */
  subjectPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 8,
    borderWidth: 1,
  },
  mySubjectPill: {
    backgroundColor: "#EFF6FF",
    borderColor: Buttons.outlineBorder,
  },
  othersSubjectPill: {
    backgroundColor: "#EFF6FF",
    borderColor: Buttons.secondaryBorder || Buttons.outlineBorder,
  },
  subjectPillText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  mySubjectPillText: { color: Buttons.accentBg },
  othersSubjectPillText: { color: Buttons.accentBg },

  /* ---------- Answer Sections ---------- */
  answerBtn: {
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  answerBtnLabel: {
    color: Buttons.primaryText,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chatAnswersSection: { marginTop: 10, gap: 8 },
  chatAnswerCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.gray50,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
  },
  chatAnswerText: {
    color: EDU_COLORS.textPrimary,
    fontSize: 14.5,
    lineHeight: 21,
  },
  chatAnswerMeta: { marginTop: 4, fontSize: 12.5, color: EDU_COLORS.gray600 },

  /* ---------- Buttons ---------- */
  gradientBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientBtnText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.2,
    fontSize: 14,
  },

  /* ---------- FAB ---------- */
  fab: { position: "absolute", right: 18 },
  fabPressable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Buttons.accentBg,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: { color: "#fff", fontSize: 22 },

  /* ---------- Modals ---------- */
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centeredCard: {
    width: "92%",
    maxHeight: "82%",
    backgroundColor: Surfaces.solid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Surfaces.border,
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: EDU_COLORS.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.gray700,
  },
  modalBody: { maxHeight: "74%", padding: 16 },

  /* ---------- Form Elements ---------- */
  questionInput: { marginBottom: 12 },
  subjectSection: { marginTop: 6, marginBottom: 6 },
  fieldLabel: { color: EDU_COLORS.gray700, fontWeight: "700", marginBottom: 8 },
  subjectButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Buttons.chipBg,
    borderWidth: 1,
    borderColor: Buttons.outlineBorder,
  },
  subjectText: { color: Buttons.chipText, fontWeight: "700" },
  activeSubject: {
    backgroundColor: Buttons.chipActiveBg,
    borderColor: "transparent",
  },
  activeSubjectText: { color: Buttons.chipActiveText, fontWeight: "800" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  askButton: { flex: 1, borderRadius: 16 },
  submitButton: { flex: 1, borderRadius: 16 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Buttons.outlineBorder,
    backgroundColor: Buttons.subtleBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  secondaryBtnText: { color: EDU_COLORS.textPrimary, fontWeight: "700" },

  /* ---------- Answer Preview ---------- */
  questionPreview: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.gray50,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    marginBottom: 10,
  },
  previewLabel: {
    color: EDU_COLORS.gray600,
    marginBottom: 4,
    fontWeight: "700",
  },
  previewText: { color: EDU_COLORS.textPrimary },
  answerInput: { marginTop: 8 },

  /* ---------- My Questions Modal ---------- */
  questionCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Surfaces.border,
    marginBottom: 12,
  },
  questionTitle: {
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
    marginBottom: 2,
  },
  questionText: { color: EDU_COLORS.textPrimary },
  readOnlyText: { marginTop: 4, color: EDU_COLORS.gray600 },
  answersSection: { marginTop: 10, gap: 10 },
  answersTitle: {
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 2,
  },
  answerCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.gray50,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
  },
  answerText: { color: EDU_COLORS.textPrimary },
  answerMeta: { color: EDU_COLORS.gray600, fontSize: 12.5, marginTop: 4 },

  /* ---------- Rating System ---------- */
  answerMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  ratingButtons: { flexDirection: "row", gap: 6 },
  ratingBtn: {
    backgroundColor: EDU_COLORS.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray300,
    minWidth: 40,
    alignItems: "center",
  },
  ratingText: { fontSize: 12, color: EDU_COLORS.gray700, fontWeight: "700" },
  ratedText: { fontSize: 12.5, color: EDU_COLORS.success, fontWeight: "700" },

  /* ---------- Image Modal ---------- */
  imageModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalClose: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EDU_COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  fullscreenImage: {
    width: "92%",
    height: "70%",
    borderRadius: 16,
    resizeMode: "contain",
    backgroundColor: "#000",
  },
});
