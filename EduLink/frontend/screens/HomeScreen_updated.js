// frontend/screens/ClassroomScreen.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Animated,
  StyleSheet,
  RefreshControl,
} from "react-native";
import {
  TextInput,
  Button,
  Provider as PaperProvider,
  ActivityIndicator,
  Snackbar,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

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
  serverTimestamp,
  where,
} from "firebase/firestore";

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

export default function ClassroomScreen({ route }) {
  const insets = useSafeAreaInsets();

  // Accept both shapes: { classroom: { id, title, grade } } OR { classroomId, title, grade }
  const {
    classroom,
    classroomId: paramId,
    title: paramTitle,
    grade: paramGrade,
  } = route.params || {};
  const classroomSafe = useMemo(
    () =>
      classroom
        ? classroom
        : {
            id: paramId || paramGrade || "unknown",
            title: paramTitle || (paramGrade ? `Grade ${paramGrade}` : "Class"),
            grade: paramGrade || classroom?.grade || null,
          },
    [classroom, paramId, paramTitle, paramGrade]
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

  /* ---------- In-modal snackbar (for inline, but Toast is primary) ---------- */
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackText, setSnackText] = useState("");

  /* ---------- Image modal ---------- */
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);

  /* ---------- Refs ---------- */
  const flatListRef = useRef(null);

  /* ---------- Toast helper (always visible; floats above) ---------- */
  const showToast = (type, text1, text2) =>
    Toast.show({
      type,
      text1,
      text2,
      position: "top",
      topOffset: Math.max(insets.top + 16, 60),
      visibilityTime: 2600,
    });

  /* ---------- Draggable FAB ---------- */
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);
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
        setTimeout(() => (isDragging.current = false), 80);
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

  /* ---------- Effects ---------- */
  useEffect(() => {
    (async () => {
      await fetchUser();
      await fetchAllQuestions();
      setInitialLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setQuestions(
      filterForRoleAndSubject(
        allQuestions,
        userRole,
        userGrade,
        classroomSafe?.grade,
        selectedSubject
      )
    );
  }, [
    allQuestions,
    userRole,
    userGrade,
    classroomSafe?.grade,
    selectedSubject,
  ]);

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
        setUserName(data.displayName || data.email || "Student");
      }
    } catch {
      showToast("error", "Failed to load user", "Please try again.");
    }
  };

  const fetchAllQuestions = async () => {
    try {
      // Teachers can see all; others see their grade filtered in render step
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
  const filterForRoleAndSubject = (list, role, grade, clsGrade, subject) => {
    const filterGrade = clsGrade || grade;

    let out = list;
    if ((role === "student" || role === "tutor") && filterGrade) {
      out = out.filter((q) => q.grade === filterGrade);
    } else if (role === "teacher" && clsGrade) {
      out = out.filter((q) => q.grade === clsGrade);
    }

    if (subject) out = out.filter((q) => q.subject === subject);
    return out;
  };

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast("error", "Permission required", "Photos access is needed.");
        return;
      }
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
    // Validations: need subject AND (text or image)
    if (!selectedSubject) {
      setSnackText("Please select a subject.");
      setSnackVisible(true);
      return;
    }
    if (!question.trim() && !selectedImage) {
      setSnackText("Type a question or attach an image.");
      setSnackVisible(true);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        showToast("error", "Not signed in");
        return;
      }

      const questionGrade = classroomSafe?.grade || userGrade;

      const payload = {
        title: (questionTitle || "").trim(),
        question: question.trim(),
        image: selectedImage || null,
        subject: selectedSubject,
        askedBy: user.uid,
        askedByEmail: user.email,
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
      showToast("success", "Your question was posted!");
      setShowQuestionForm(false);

      await fetchAllQuestions();
    } catch {
      setSnackText("Failed to post question.");
      setSnackVisible(true);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      setSnackText("Please enter your answer.");
      setSnackVisible(true);
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) {
        showToast("error", "Not signed in");
        return;
      }
      const qRef = doc(db, "questions", selectedQuestionItem.id);
      const newAnswer = {
        answer: answer.trim(),
        answeredBy: user.uid,
        answeredByName: userName,
        createdAt: serverTimestamp(),
        upvotes: 0,
      };
      const updatedAnswers = [
        ...(selectedQuestionItem.answers || []),
        newAnswer,
      ];

      await updateDoc(qRef, {
        answers: updatedAnswers,
        status: "answered",
      });

      // +5 points for students -> tutor promotion if >= 200
      const meRef = doc(db, "users", user.uid);
      const me = await getDoc(meRef);
      if (me.exists()) {
        const currentPoints = me.data().points || 0;
        const nextPoints = currentPoints + 5;
        const updates = { points: nextPoints };
        if (nextPoints >= 200 && me.data().role === "student") {
          updates.role = "tutor";
          showToast("success", "Promoted to Peer Tutor 🎓");
        }
        await updateDoc(meRef, updates);
      }

      // Soft notification (best effort)
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
          createdAt: serverTimestamp(),
        });
      } catch {}

      setAnswer("");
      setShowAnswerForm(false);
      setSelectedQuestionItem(null);
      showToast("success", "Answer submitted! (+5 points)");

      await fetchAllQuestions();
    } catch {
      setSnackText("Failed to submit answer.");
      setSnackVisible(true);
    }
  };

  /* ---------- Renderers ---------- */
  const Header = () => (
    <View
      style={[
        styles.header,
        {
          paddingTop: Math.max(insets.top, 60), // leave ~60px for breadcrumb bar
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {classroomSafe?.title ||
            `${(userRole || "Student").slice(0, 1).toUpperCase()}${(
              userRole || "student"
            )
              .slice(1)
              .toLowerCase()} Dashboard`}
        </Text>
        <Text style={styles.subtitle}>Learn together • Grow together 🎯</Text>
      </View>

      <BlurView intensity={30} tint="light" style={styles.nameTag}>
        {userRole === "tutor" ? (
          <Text style={styles.tutorBadgeText}>🎓 TUTOR</Text>
        ) : (
          <Text style={styles.nameText}>{userName}</Text>
        )}
      </BlurView>
    </View>
  );

  const SubjectRail = () =>
    (userRole === "student" || userRole === "tutor") && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.subjectScrollTop}
        contentContainerStyle={{
          paddingHorizontal: 16,
          gap: 8,
          paddingBottom: 6,
        }}
      >
        {SUBJECTS.map((subject) => {
          const active = selectedSubject === subject;
          return (
            <Pressable
              key={subject}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedSubject(active ? null : subject)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${subject}`}
            >
              <LinearGradient
                colors={
                  active
                    ? [Buttons.chipActiveBg, Buttons.chipActiveBg]
                    : [Buttons.chipBg, Buttons.chipBg]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chipGrad}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {subject}
                </Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>
    );

  const Empty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>💬 No questions yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Be the first to ask a question!
      </Text>

      {(userRole === "student" || userRole === "tutor") && (
        <Button
          mode="contained"
          onPress={() => setShowQuestionForm(true)}
          style={styles.ctaAsk}
          labelStyle={styles.askButtonText}
        >
          Ask a Question
        </Button>
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

        <BlurView intensity={25} tint="light" style={styles.chatBubble}>
          <Pressable
            onPress={() =>
              setExpandedQuestion(expandedQuestion === q.id ? null : q.id)
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
              </Text>
              {!isMine && (
                <Button
                  mode="contained"
                  compact
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setSelectedQuestionItem(q);
                    setShowAnswerForm(true);
                  }}
                  style={styles.answerBtn}
                  labelStyle={styles.answerBtnLabel}
                >
                  Answer
                </Button>
              )}
            </View>
          </Pressable>

          {expandedQuestion === q.id && q.answers?.length > 0 && (
            <View style={styles.chatAnswersSection}>
              {q.answers.map((ans, i) => (
                <View key={i} style={styles.chatAnswerCard}>
                  <Text style={styles.chatAnswerText}>{ans.answer}</Text>
                  <Text style={styles.chatAnswerMeta}>
                    By {ans.answeredByName || "Anonymous"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </BlurView>
      </View>
    );
  };

  const renderList = () => (
    <FlatList
      ref={flatListRef}
      data={questions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        questions.length === 0
          ? { flex: 1, paddingHorizontal: 12 }
          : {
              paddingVertical: 12,
              paddingBottom: INPUT_BAR_HEIGHT + Math.max(insets.bottom, 24),
              paddingHorizontal: 8,
            }
      }
      ListEmptyComponent={<Empty />}
      showsVerticalScrollIndicator={false}
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Child’s Progress</Text>
        <BlurView intensity={25} tint="light" style={styles.childCard}>
          <Text style={styles.childName}>👤 Child: John Doe</Text>
          <Text style={styles.childGrade}>📚 Grade: {userGrade || "N/A"}</Text>
          <Text style={styles.childPoints}>🏆 Points: 150</Text>
          <Text style={styles.childRank}>🥇 Class Rank: #12</Text>
        </BlurView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <BlurView intensity={25} tint="light" style={styles.activityCard}>
          <Text style={styles.activityText}>✅ Answered 3 questions today</Text>
          <Text style={styles.activityText}>📖 Downloaded Math notes</Text>
          <Text style={styles.activityText}>🏆 Earned “Helper” badge</Text>
        </BlurView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Digest</Text>
        <BlurView intensity={25} tint="light" style={styles.digestCard}>
          <Text style={styles.digestText}>📊 Questions Asked: 5</Text>
          <Text style={styles.digestText}>💡 Questions Answered: 12</Text>
          <Text style={styles.digestText}>⭐ Points Earned: 45</Text>
          <Text style={styles.digestText}>📈 Improvement: +15%</Text>
        </BlurView>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    if (initialLoading) {
      return (
        <View style={styles.loaderWrap}>
          <ActivityIndicator animating color={EDU_COLORS.primary} />
          <Text style={styles.loaderText}>Loading your classroom…</Text>
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

  /* ---------- UI ---------- */
  return (
    <PaperProvider theme={paperTheme}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={
          Platform.OS === "ios" ? Math.max(insets.top, 48) : 0
        }
      >
        {/* Top spacing for breadcrumb (~60px) is reserved by header paddingTop */}

        {/* Header */}
        <Header />

        {/* Subject rail */}
        {userRole && <SubjectRail />}

        {/* Content */}
        {renderContent()}

        {/* Composer (Students/Tutors) */}
        {(userRole === "student" || userRole === "tutor") && (
          <View>
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

            <View
              style={[
                styles.inputBar,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <Pressable
                style={styles.imageButton}
                onPress={pickImage}
                accessibilityRole="button"
              >
                <Text style={styles.imageButtonText}>📷</Text>
              </Pressable>

              <TextInput
                mode="outlined"
                theme={INPUT_THEME}
                style={styles.inputField}
                placeholder="Ask a question…"
                value={question}
                onChangeText={setQuestion}
                multiline
                outlineColor={EDU_COLORS.primary + "33"}
                activeOutlineColor={EDU_COLORS.primary}
                placeholderTextColor={EDU_COLORS.placeholder}
              />

              <Pressable
                style={styles.sendButton}
                onPress={() => {
                  if (!selectedSubject) {
                    setSnackText("Please select a subject from the top row.");
                    setSnackVisible(true);
                    return;
                  }
                  if (!question.trim() && !selectedImage) {
                    setSnackText("Type a question or attach an image.");
                    setSnackVisible(true);
                    return;
                  }
                  postQuestion();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.sendButtonText}>➤</Text>
              </Pressable>
            </View>
          </View>
        )}

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
          animationType="fade"
          transparent
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowQuestionForm(false)}
        >
          <View style={styles.centeredOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalKav}
              keyboardVerticalOffset={
                Platform.OS === "ios" ? Math.max(insets.top, 24) : 0
              }
            >
              <View style={styles.centeredCard}>
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
                    placeholder="Question title… (optional)"
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
                            onPress={() => setSelectedSubject(subject)}
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
                    <Button
                      mode="contained"
                      onPress={postQuestion}
                      style={styles.askButton}
                      labelStyle={styles.askButtonText}
                    >
                      Ask Question
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() =>
                        showToast("info", "Snap & Solve coming soon!")
                      }
                      style={styles.secondaryBtn}
                    >
                      📷 Snap & Solve
                    </Button>
                  </View>
                </ScrollView>

                <Snackbar
                  visible={snackVisible}
                  onDismiss={() => setSnackVisible(false)}
                  duration={2200}
                  style={[
                    styles.snackbar,
                    { marginBottom: Math.max(insets.bottom, 10) },
                  ]}
                >
                  {snackText}
                </Snackbar>
              </View>
            </KeyboardAvoidingView>
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
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalKav}
              keyboardVerticalOffset={
                Platform.OS === "ios" ? Math.max(insets.top, 24) : 0
              }
            >
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
                    <Button
                      mode="contained"
                      onPress={submitAnswer}
                      style={styles.submitButton}
                      labelStyle={styles.askButtonText}
                    >
                      Submit
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => setShowAnswerForm(false)}
                      style={styles.secondaryBtn}
                    >
                      Cancel
                    </Button>
                  </View>
                </ScrollView>

                <Snackbar
                  visible={snackVisible}
                  onDismiss={() => setSnackVisible(false)}
                  duration={2200}
                  style={[
                    styles.snackbar,
                    { marginBottom: Math.max(insets.bottom, 10) },
                  ]}
                >
                  {snackText}
                </Snackbar>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* My Questions / My Answers Modal */}
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
                      ? (q.answers || []).some(
                          (ans) => ans.answeredBy === auth.currentUser?.uid
                        )
                      : q.askedBy === auth.currentUser?.uid
                  )
                  .map((q) => (
                    <View key={q.id} style={styles.questionCard}>
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
                        {!!q.question && (
                          <Text style={styles.questionText}>{q.question}</Text>
                        )}
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
                              <Text style={styles.answerMeta}>
                                By {ans.answeredByName || "Anonymous"}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
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

        {/* Global toast (top; uses safe area) */}
        <Toast
          position="top"
          topOffset={Math.max(insets.top + 16, 60)}
          visibilityTime={2600}
        />
      </KeyboardAvoidingView>
    </PaperProvider>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  /* Root */
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },

  /* Header (reserve ~60px for breadcrumb above content visually) */
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { marginTop: 4, fontSize: 12.5, color: "#fff" },
  nameTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: EDU_COLORS.surfaceSolid,
    borderWidth: 1,
    borderColor: EDU_COLORS.borderLight,
    overflow: "hidden",
  },
  tutorBadgeText: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.2,
    backgroundColor: Buttons.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nameText: { color: EDU_COLORS.textPrimary, fontWeight: "600" },

  /* Subject rail (chips) */
  subjectScrollTop: {
    minHeight: 54,
    maxHeight: 56,
    paddingVertical: 4,
    zIndex: 1,
    ...Platform.select({ android: { elevation: 1 } }),
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Buttons.outlineBorder,
    overflow: "hidden",
  },
  chipGrad: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  chipActive: {
    borderColor: "transparent",
  },
  chipText: {
    color: EDU_COLORS.textPrimary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 18,
  },

  /* Content base */
  content: { flex: 1, paddingHorizontal: 12 },

  /* Empty/Loading */
  loaderWrap: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: INPUT_BAR_HEIGHT + 12,
  },
  loaderText: { color: EDU_COLORS.gray600 },
  emptyState: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
  },
  emptyStateSubtext: { color: EDU_COLORS.gray600, marginBottom: 12 },
  ctaAsk: { backgroundColor: Buttons.primaryBg, borderRadius: 16 },

  askButtonText: { color: "#fff", fontWeight: "800" },

  /* Chat list & bubble */
  chatContainer: {
    marginHorizontal: 8,
    marginVertical: 6,
  },
  myQuestionContainer: { alignItems: "flex-end" },
  othersQuestionContainer: { alignItems: "flex-start" },

  chatBubble: {
    maxWidth: "88%",
    borderRadius: 18,
    padding: 12,
    backgroundColor: EDU_COLORS.surfaceSolid,
    borderWidth: 1,
    borderColor: Surfaces.border,
  },

  textStrong: { color: EDU_COLORS.textPrimary },
  chatTitleText: {
    fontSize: 15.5,
    fontWeight: "700",
    marginBottom: 4,
    color: EDU_COLORS.textPrimary,
  },
  chatQuestionText: {
    fontSize: 14.5,
    lineHeight: 20,
    color: EDU_COLORS.textPrimary,
  },

  subjectPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
    borderWidth: 1,
  },
  mySubjectPill: {
    backgroundColor: Buttons.accentBg,
    borderColor: Buttons.outlineBorder,
  },
  othersSubjectPill: {
    backgroundColor: Buttons.accentBg,
    borderColor: Buttons.secondaryBorder || Buttons.outlineBorder,
  },
  subjectPillText: { fontSize: 12.5, fontWeight: "700" },
  mySubjectPillText: { color: Buttons.primaryText },
  othersSubjectPillText: { color: Buttons.primaryText },

  chatNameLabel: {
    fontSize: 12,
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
  chatMeta: { fontSize: 12.5, color: EDU_COLORS.gray600 },

  answerBtn: {
    backgroundColor: Buttons.primaryBg,
    borderRadius: 12,
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  answerBtnLabel: {
    color: Buttons.primaryText,
    fontSize: 13,
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
  chatAnswerText: { color: EDU_COLORS.textPrimary },
  chatAnswerMeta: { marginTop: 4, fontSize: 12, color: EDU_COLORS.gray600 },

  /* Sections (parent view) */
  section: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },

  childCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Surfaces.solid,
    borderWidth: 1,
    borderColor: Surfaces.border,
    gap: 6,
    overflow: "hidden",
  },
  childName: { fontWeight: "700", color: EDU_COLORS.textPrimary },
  childGrade: { color: EDU_COLORS.gray700 },
  childPoints: { color: EDU_COLORS.gray700 },
  childRank: { color: EDU_COLORS.gray700 },

  activityCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Surfaces.elevated,
    borderWidth: 1,
    borderColor: Surfaces.border,
    gap: 6,
    overflow: "hidden",
  },
  activityText: { color: EDU_COLORS.textPrimary },

  digestCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: Surfaces.solid,
    borderWidth: 1,
    borderColor: Surfaces.border,
    gap: 6,
    overflow: "hidden",
  },
  digestText: { color: EDU_COLORS.textPrimary },

  /* Input bar — anchored with safe-area */
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: INPUT_BAR_HEIGHT,
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  imageButtonText: { fontSize: 20, color: EDU_COLORS.textPrimary },
  inputField: { flex: 1, borderRadius: 16 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Buttons.primaryBg,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  /* Image preview (composer) */
  imagePreview: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    position: "relative",
    alignSelf: "flex-start",
  },
  previewImage: { width: 120, height: 80, borderRadius: 10 },
  removeImageBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.error,
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: { color: "#fff", fontWeight: "800" },

  /* FAB */
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

  /* --------- Modal foundations (overlay kept as-is) --------- */
  modalKav: {
    width: "100%",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },

  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.55)", // KEEP OVERLAY
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

  /* Ask form */
  questionInput: { marginBottom: 12 },
  subjectSection: { marginTop: 6, marginBottom: 6 },
  fieldLabel: { color: EDU_COLORS.gray700, fontWeight: "700", marginBottom: 8 },
  subjectButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  askButton: { flex: 1, backgroundColor: Buttons.primaryBg, borderRadius: 16 },
  submitButton: {
    flex: 1,
    backgroundColor: Buttons.successBg,
    borderRadius: 16,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    borderColor: Buttons.outlineBorder,
    backgroundColor: Buttons.subtleBg,
  },
  snackbar: { marginHorizontal: 16, borderRadius: 10 },

  /* Answer preview */
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

  /* My Questions modal list */
  questionCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Surfaces.elevated,
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

  /* Fullscreen image (overlay fixed to full screen) */
  imageModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalClose: {
    position: "absolute",
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: EDU_COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  imageModalCloseText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  fullscreenImage: {
    width: "92%",
    height: "70%",
    borderRadius: 16,
    resizeMode: "contain",
  },
});
