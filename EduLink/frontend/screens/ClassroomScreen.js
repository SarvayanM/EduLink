// frontend/screens/ClassroomScreen.js
import Screen from "../components/Screen";
import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Modal,
  FlatList,
  Animated,
  StyleSheet,
  RefreshControl,
  Keyboard,
  Dimensions,
  Alert,
  PanResponder,
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
      colors={[Buttons.primaryBg, Buttons.primaryBg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientBtn, disabled && { opacity: 0.6 }, style]}
    >
      <View style={styles.gradientBtnInner}>
        {left}
        <Text style={[styles.gradientBtnText, textStyle]}>{title}</Text>
        {right}
      </View>
    </LinearGradient>
  </Pressable>
);

/* ---------- Bubble component (FIX: hooks are legal here) ---------- */
const QuestionBubble = memo(function QuestionBubble({
  q,
  index,
  isMine,
  expanded,
  onToggleExpand,
  onDelete,
  onAnswerPress,
}) {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 240,
      delay: index * 20,
      useNativeDriver: true,
    }).start();
  }, [appear, index]);

  return (
    <Animated.View
      style={[
        styles.chatContainer,
        isMine ? styles.myQuestionContainer : styles.othersQuestionContainer,
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {!isMine && (
        <Text style={styles.chatNameLabel}>{q.askedByName || "Anonymous"}</Text>
      )}

      <BlurCard style={[styles.chatBubble]}>
        <Pressable
          onPress={() => onToggleExpand(q.id)}
          onLongPress={
            isMine
              ? () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onDelete(q.id, q.question || "");
                }
              : undefined
          }
          accessibilityRole="button"
        >
          {q.image ? (
            <Pressable
              onPress={() => onToggleExpand(q.id, true /* open image */)}
              accessibilityRole="imagebutton"
              style={{ marginBottom: 8 }}
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

          {!!q.question && (
            <Text style={styles.chatQuestionText}>{q.question}</Text>
          )}

          {q.subject && (
            <View
              style={[
                styles.subjectPill,
                isMine ? styles.mySubjectPill : styles.othersSubjectPill,
              ]}
            >
              <Ionicons
                name="pricetag-outline"
                size={12}
                color={isMine ? Buttons.subtleText : Buttons.chipActiveText}
                style={{ marginRight: 6 }}
              />
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
              {q.status} •{" "}
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={12}
                color={EDU_COLORS.gray600}
              />{" "}
              {q.answers?.length || 0}
              {isMine && (
                <Text style={styles.longPressHint}> • Hold to delete</Text>
              )}
            </Text>

            {!isMine && (
              <GradientButton
                title="Answer"
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onAnswerPress(q);
                }}
                style={styles.answerBtn}
                textStyle={styles.answerBtnLabel}
                left={<Ionicons name="send-outline" size={14} color="#fff" />}
              />
            )}
          </View>

          {expanded && q.answers?.length > 0 && (
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
        </Pressable>
      </BlurCard>
    </Animated.View>
  );
});

/* ================================================================ */
export default function ClassroomScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { classroom } = route.params || {};

  /* ---------- Toast ---------- */
  const showToast = useCallback(
    (type, text1, text2) => {
      Toast.show({
        type,
        text1,
        text2,
        position: "top",
        topOffset: insets.top + NAVBAR_HEIGHT + 8,
        visibilityTime: 2600,
      });
    },
    [insets.top]
  );

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

  /* ---------- Refs & animation ---------- */
  const flatListRef = useRef(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const modalAnimAsk = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const modalAnimAnswer = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const modalAnimHistory = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);

  /* ---------- Effects: load ---------- */
  useEffect(() => {
    (async () => {
      await fetchUser();
      await fetchAllQuestions();
      setInitialLoading(false);
    })();
  }, []);

  /* ---------- Effects: role/grade filter ---------- */
  useEffect(() => {
    setQuestions(
      filterByRoleAndGrade(allQuestions, userRole, userGrade, classroom?.grade)
    );
  }, [allQuestions, userRole, userGrade, classroom?.grade]);

  /* ---------- Effects: auto-scroll to latest ---------- */
  useEffect(() => {
    if (questions.length > 0 && flatListRef.current) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
          console.log("Scroll error (non-critical):", error);
        }
      }, 120);
    }
  }, [questions]);

  /* ---------- Effects: keyboard (applied to input bar) ---------- */
  useEffect(() => {
    const onShow = (e) => {
      const h = e?.endCoordinates?.height ?? 0;
      Animated.timing(keyboardOffset, {
        toValue: h,
        duration: e?.duration ?? 200,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e?.duration ?? 200,
        useNativeDriver: true,
      }).start();
    };

    const subs = [
      Keyboard.addListener("keyboardWillShow", onShow),
      Keyboard.addListener("keyboardWillHide", onHide),
      Keyboard.addListener("keyboardDidShow", onShow),
      Keyboard.addListener("keyboardDidHide", onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [keyboardOffset]);

  /* ---------- Effects: modal slide-ins (separate anims) ---------- */
  useEffect(() => {
    Animated.timing(modalAnimAsk, {
      toValue: showQuestionForm ? 0 : Dimensions.get("window").height,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showQuestionForm, modalAnimAsk]);

  useEffect(() => {
    Animated.timing(modalAnimAnswer, {
      toValue: showAnswerForm ? 0 : Dimensions.get("window").height,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showAnswerForm, modalAnimAnswer]);

  useEffect(() => {
    Animated.timing(modalAnimHistory, {
      toValue: showMyQuestions ? 0 : Dimensions.get("window").height,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showMyQuestions, modalAnimHistory]);

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
    if (!answer.trim()) {
      showToast("error", "Please enter your answer.");
      return;
    }
    if (!selectedQuestionItem) {
      showToast("error", "No question selected.");
      return;
    }
    if (!auth.currentUser) {
      showToast("error", "Please log in to submit answers.");
      return;
    }
    if (!userName) {
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

      // +5 points & potential promotion
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
      showToast("success", "Answer submitted! (+5 points)");

      await fetchAllQuestions();

      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
          console.log("Scroll error (non-critical):", error);
        }
      }, 300);
    } catch (error) {
      showToast(
        "error",
        "Failed to submit answer",
        error?.message || "Unknown error"
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
      const questionRef = doc(db, "questions", questionId);
      const questionDoc = await getDoc(questionRef);
      if (questionDoc.exists()) {
        const questionData = questionDoc.data();
        const updatedAnswers = [...questionData.answers];
        updatedAnswers[answerIndex] = {
          ...updatedAnswers[answerIndex],
          rating,
          ratedBy: auth.currentUser.uid,
        };

        await updateDoc(questionRef, { answers: updatedAnswers });

        // Update user points of answerer
        const userRef = doc(db, "users", answeredBy);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentPoints = userData.points || 0;
          const newPoints = currentPoints + rating;
          await updateDoc(userRef, { points: newPoints });

          if (newPoints >= 200 && userData.role === "student") {
            await updateDoc(userRef, { role: "tutor" });
          }
        }

        showToast(
          "success",
          `Rated ⭐${rating}`,
          `Points added to ${updatedAnswers[answerIndex].answeredByName}`
        );
        await fetchAllQuestions();
      }
    } catch (error) {
      showToast("error", "Failed to rate answer", error?.message || "");
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
              showToast("success", "Question deleted");
              await fetchAllQuestions();
            } catch (error) {
              showToast(
                "error",
                "Failed to delete question",
                error?.message || ""
              );
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
                <Ionicons
                  name={
                    subject === "Mathematics"
                      ? "calculator-outline"
                      : subject === "Science"
                      ? "flask-outline"
                      : subject === "English"
                      ? "book-outline"
                      : subject === "History"
                      ? "time-outline"
                      : subject === "Geography"
                      ? "earth-outline"
                      : "ellipse-outline"
                  }
                  size={14}
                  color={active ? Buttons.chipActiveText : EDU_COLORS.gray600}
                  style={{ marginRight: 6 }}
                />
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
      <MaterialCommunityIcons
        name="chat-question"
        size={28}
        color={EDU_COLORS.primary}
      />
      <Text style={styles.emptyStateText}>No questions yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Be the first to ask a question!
      </Text>

      {(userRole === "student" || userRole === "tutor") && (
        <GradientButton
          title="Ask a Question"
          onPress={() => setShowQuestionForm(true)}
          style={styles.ctaAsk}
          left={<Ionicons name="create-outline" size={18} color="#fff" />}
        />
      )}
    </View>
  );

  const renderItem = ({ item, index }) => {
    const isMine = item.askedBy === auth.currentUser?.uid;
    return (
      <QuestionBubble
        q={item}
        index={index}
        isMine={isMine}
        expanded={expandedQuestion === item.id}
        onToggleExpand={(id, openImage) => {
          if (openImage && item.image) {
            setModalImage(item.image);
            setShowImageModal(true);
            return;
          }
          setExpandedQuestion((prev) => (prev === id ? null : id));
        }}
        onDelete={handleDeleteQuestion}
        onAnswerPress={(q) => {
          setSelectedQuestionItem(q);
          setShowAnswerForm(true);
        }}
      />
    );
  };

  const renderList = () => (
    <FlatList
      ref={flatListRef}
      data={questions}
      keyExtractor={(item) => item.id}
      inverted
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
      renderItem={renderItem}
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
      <BlurCard style={styles.tileCard}>
        <View style={styles.tileRow}>
          <View style={styles.tileIconCircle}>
            <Ionicons
              name="person-circle-outline"
              size={22}
              color={EDU_COLORS.primary}
            />
          </View>
          <View style={styles.tileContent}>
            <Text style={styles.tileTitle}>Child</Text>
            <Text style={styles.tileValue}>John Doe</Text>
          </View>
        </View>
        <View style={styles.tileDivider} />
        <View style={styles.tileRow}>
          <View style={styles.tileIconCircle}>
            <Ionicons
              name="school-outline"
              size={20}
              color={EDU_COLORS.primary}
            />
          </View>
          <View style={styles.tileContent}>
            <Text style={styles.tileTitle}>Grade</Text>
            <Text style={styles.tileValue}>{userGrade || "N/A"}</Text>
          </View>
        </View>
        <View style={styles.tileDivider} />
        <View style={styles.tileRow}>
          <View style={styles.tileIconCircle}>
            <Ionicons
              name="trophy-outline"
              size={20}
              color={EDU_COLORS.primary}
            />
          </View>
          <View style={styles.tileContent}>
            <Text style={styles.tileTitle}>Points</Text>
            <Text style={styles.tileValue}>150</Text>
          </View>
        </View>
        <View style={styles.tileDivider} />
        <View style={styles.tileRow}>
          <View style={styles.tileIconCircle}>
            <Ionicons
              name="podium-outline"
              size={20}
              color={EDU_COLORS.primary}
            />
          </View>
          <View style={styles.tileContent}>
            <Text style={styles.tileTitle}>Class Rank</Text>
            <Text style={styles.tileValue}>#12</Text>
          </View>
        </View>
      </BlurCard>

      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
        Recent Activity
      </Text>
      <BlurCard style={styles.tileListCard}>
        {[
          {
            icon: "checkmark-done-outline",
            text: "Answered 3 questions today",
          },
          { icon: "download-outline", text: "Downloaded Math notes" },
          { icon: "star-outline", text: "Earned “Helper” badge" },
        ].map((it, idx) => (
          <View
            key={it.text}
            style={[styles.tileListRow, idx !== 0 && styles.tileListRowBorder]}
          >
            <Ionicons name={it.icon} size={18} color={EDU_COLORS.primary} />
            <Text style={styles.activityText}>{it.text}</Text>
          </View>
        ))}
      </BlurCard>

      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
        Weekly Digest
      </Text>
      <BlurCard style={styles.digestRow}>
        <View style={styles.digestItem}>
          <Text style={styles.digestValue}>5</Text>
          <Text style={styles.digestLabel}>Asked</Text>
        </View>
        <View style={styles.digestDivider} />
        <View style={styles.digestItem}>
          <Text style={styles.digestValue}>12</Text>
          <Text style={styles.digestLabel}>Answered</Text>
        </View>
        <View style={styles.digestDivider} />
        <View style={styles.digestItem}>
          <Text style={styles.digestValue}>45</Text>
          <Text style={styles.digestLabel}>Points</Text>
        </View>
        <View style={styles.digestDivider} />
        <View style={styles.digestItem}>
          <Text style={styles.digestValue}>+15%</Text>
          <Text style={styles.digestLabel}>Growth</Text>
        </View>
      </BlurCard>
    </ScrollView>
  );

  const renderContent = () => {
    if (initialLoading) {
      return (
        <View style={styles.loaderWrap}>
          <ActivityIndicator animating color={EDU_COLORS.primary} />
          <Text style={styles.loaderText}>Loading Your Classroom …</Text>
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

  const negativeKeyboardOffset = Animated.multiply(keyboardOffset, -1);

  /* ---------- UI ---------- */
  return (
    <PaperProvider theme={paperTheme}>
      <Screen>
        {/* Content */}
        {renderContent()}

        <View>
          {/* Subject rail */}
          {userRole && <SubjectRail />}

          {/* Subject Selection Bar */}
          {(userRole === "student" || userRole === "tutor") &&
            selectedSubject && (
              <View style={styles.subjectSelectionBar}>
                <View style={styles.subjectTag}>
                  <Ionicons
                    name="pricetag-outline"
                    size={14}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
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

          {/* Main Input Bar (animated with keyboard) */}
          <Animated.View
            style={[
              styles.inputBar,
              { paddingBottom: Math.max(insets.bottom, 8) },
              { transform: [{ translateY: negativeKeyboardOffset }] },
            ]}
          >
            <View style={styles.chatInputContainer}>
              {/* Attachment Button */}
              <Pressable
                style={styles.imageButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  pickImage();
                }}
                accessibilityRole="button"
              >
                <Ionicons name="add-outline" size={22} color="#fff" />
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
                      text: EDU_COLORS.textPrimary,
                      placeholder: EDU_COLORS.gray500,
                    },
                  }}
                  style={styles.inputField}
                  contentStyle={styles.inputContent}
                  placeholder="Select subject and Ask..."
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  numberOfLines={1}
                  maxLength={500}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholderTextColor={EDU_COLORS.gray500}
                  autoCorrect
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
                onPress={() => {
                  if (question.trim() && selectedSubject) {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                  }
                  postQuestion();
                }}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-up" size={18} color="#fff" />
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
          </Animated.View>

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
                <Ionicons name="close" size={16} color="#fff" />
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
            <Ionicons name="documents-outline" size={24} color="#fff" />
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
                { transform: [{ translateY: modalAnimAsk }] },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ask a Question</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowQuestionForm(false)}
                >
                  <Ionicons name="close" size={18} color={EDU_COLORS.gray700} />
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
                    left={
                      <Ionicons name="send-outline" size={16} color="#fff" />
                    }
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
          animationType="none"
          transparent
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowAnswerForm(false)}
        >
          <View style={styles.centeredOverlay}>
            <Animated.View
              style={[
                styles.centeredCard,
                { transform: [{ translateY: modalAnimAnswer }] },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Answer Question</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowAnswerForm(false)}
                >
                  <Ionicons name="close" size={18} color={EDU_COLORS.gray700} />
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
                    left={
                      <MaterialCommunityIcons
                        name="check-bold"
                        size={16}
                        color="#fff"
                      />
                    }
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
            </Animated.View>
          </View>
        </Modal>

        {/* My Questions / History Modal */}
        <Modal
          visible={showMyQuestions}
          animationType="none"
          transparent
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowMyQuestions(false)}
        >
          <View style={styles.centeredOverlay}>
            <Animated.View
              style={[
                styles.centeredCard,
                { transform: [{ translateY: modalAnimHistory }] },
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
                  onPress={() => setShowMyQuestions(false)}
                >
                  <Ionicons name="close" size={18} color={EDU_COLORS.gray700} />
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
                          setExpandedQuestion((prev) =>
                            prev === q.id ? null : q.id
                          )
                        }
                      >
                        {q.image && (
                          <Pressable
                            onPress={() => {
                              setModalImage(q.image);
                              setShowImageModal(true);
                            }}
                            style={{ marginBottom: 8 }}
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
                        {!!q.question && (
                          <Text style={styles.questionText}>{q.question}</Text>
                        )}
                        <View style={styles.questionMetaRow}>
                          <Text style={styles.readOnlyText}>
                            Status: {q.status} •{" "}
                            <Ionicons
                              name="chatbubble-outline"
                              size={12}
                              color={EDU_COLORS.gray600}
                            />{" "}
                            {q.answers?.length || 0}
                          </Text>
                        </View>
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
            </Animated.View>
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
              <Ionicons name="close" size={22} color="#fff" />
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

/* ===================== Styles (compact card design) ===================== */
const styles = StyleSheet.create({
  content: { flex: 1 },

  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  loaderText: {
    fontSize: 18,
    color: EDU_COLORS.textPrimary,
    fontWeight: "700",
  },

  /* ---------- Blur Card ---------- */
  blurCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Surfaces.border,
    padding: 12,
    overflow: "hidden",
    ...shadow(8),
  },

  /* ---------- Chips ---------- */
  chipsRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
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
  chipPressed: { opacity: 0.92 },
  chipText: { fontSize: 13, color: EDU_COLORS.textPrimary, fontWeight: "600" },
  chipTextActive: { color: Buttons.chipActiveText },

  /* ---------- Empty ---------- */
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: EDU_COLORS.gray600,
    marginBottom: 8,
  },
  ctaAsk: { marginTop: 4, borderRadius: 12 },

  /* ---------- Chat ---------- */
  chatContainer: { width: "100%", marginBottom: 12 },
  myQuestionContainer: { alignItems: "flex-end" },
  othersQuestionContainer: { alignItems: "flex-start" },

  chatNameLabel: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    marginBottom: 4,
    marginLeft: 6,
  },
  chatBubble: { maxWidth: "90%", padding: 12 },
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
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
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
  chatMeta: { fontSize: 12, color: EDU_COLORS.gray600 },
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
    marginLeft: 6,
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

  /* ---------- Subject Selection Bar ---------- */
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
  subjectTagText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
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

  /* ---------- Composer ---------- */
  inputBar: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: EDU_COLORS.borderLight,
    paddingHorizontal: 16,
    paddingTop: 10,
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
    ...shadow(6),
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
  inputContent: { paddingTop: 0, paddingBottom: 0, margin: 0 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    ...shadow(8),
  },
  sendButtonActive: { backgroundColor: EDU_COLORS.primary },
  sendButtonInactive: { backgroundColor: EDU_COLORS.gray200 },
  characterCount: {
    alignSelf: "flex-end",
    fontSize: 12,
    marginTop: -2,
    marginBottom: 6,
    marginRight: 10,
  },

  /* ---------- Image Preview ---------- */
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
  previewImage: { width: 64, height: 64, borderRadius: 8 },
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

  /* ---------- FAB ---------- */
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: EDU_COLORS.primary,
    ...shadow(10),
  },
  fabPressable: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* ---------- Modals ---------- */
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
    ...shadow(12),
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
  questionImage: { width: "100%", height: 160, borderRadius: 10 },
  questionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginTop: 8,
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
  answerMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  answerMeta: { fontSize: 12, color: EDU_COLORS.gray600, fontStyle: "italic" },
  ratedText: { fontSize: 13, fontWeight: "800", color: EDU_COLORS.accent700 },
  ratingButtons: { flexDirection: "row", gap: 6, alignItems: "center" },
  ratingBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: EDU_COLORS.accent,
  },
  ratingText: { fontSize: 12, color: "#FFFFFF", fontWeight: "800" },

  /* ---------- Parent Tiles ---------- */
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tileCard: { marginHorizontal: 16, padding: 12 },
  tileRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  tileIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EDU_COLORS.gray100,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  tileContent: { flex: 1 },
  tileTitle: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    marginBottom: 2,
    fontWeight: "700",
  },
  tileValue: {
    fontSize: 14.5,
    color: EDU_COLORS.textPrimary,
    fontWeight: "800",
  },
  tileDivider: {
    height: 1,
    backgroundColor: EDU_COLORS.gray100,
    marginVertical: 6,
  },

  tileListCard: { marginHorizontal: 16, padding: 8 },
  tileListRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tileListRowBorder: { borderTopWidth: 1, borderTopColor: EDU_COLORS.gray100 },
  activityText: {
    marginLeft: 8,
    color: EDU_COLORS.textPrimary,
    fontWeight: "600",
  },

  digestRow: {
    marginHorizontal: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  digestItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  digestValue: {
    fontSize: 16,
    color: EDU_COLORS.textPrimary,
    fontWeight: "800",
  },
  digestLabel: { fontSize: 11.5, color: EDU_COLORS.gray600, marginTop: 2 },
  digestDivider: {
    width: 1,
    backgroundColor: EDU_COLORS.gray100,
    marginVertical: 4,
  },

  /* ---------- Image modal ---------- */
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
  fullscreenImage: { width: "100%", height: "100%" },

  /* ---------- Buttons ---------- */
  gradientBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  gradientBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  gradientBtnText: { color: "#fff", fontWeight: "800" },
});

/* ---------- Shadow helper ---------- */
function shadow(elevation = 6) {
  return {
    elevation,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: Math.max(1, elevation / 2),
    shadowOffset: { width: 0, height: Math.min(12, Math.ceil(elevation / 2)) },
  };
}
