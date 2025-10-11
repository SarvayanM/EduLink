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
} from "react-native";
import {
  TextInput,
  Provider as PaperProvider,
  ActivityIndicator,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
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
      filterForRoleAndSubject(
        allQuestions,
        userRole,
        userGrade,
        classroom?.grade,
        selectedSubject
      )
    );
  }, [allQuestions, userRole, userGrade, classroom?.grade, selectedSubject]);

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
    try {
      const questionGrade = classroom?.grade || userGrade;

      const payload = {
        title: (questionTitle || "").trim(),
        question: question.trim(),
        image: selectedImage,
        subject: selectedSubject || "Other",
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
    } catch {
      showToast("error", "Failed to post question.");
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      showToast("error", "Please enter your answer.");
      return;
    }
    try {
      const qRef = doc(db, "questions", selectedQuestionItem.id);
      const newAnswer = {
        answer: answer.trim(),
        answeredBy: auth.currentUser.uid,
        answeredByName: userName,
        createdAt: serverTimestamp(),
        upvotes: 0,
      };
      const updatedAnswers = [
        ...(selectedQuestionItem.answers || []),
        newAnswer,
      ];

      await updateDoc(qRef, { answers: updatedAnswers, status: "answered" });

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
          createdAt: serverTimestamp(),
        });
      } catch {}

      setAnswer("");
      setShowAnswerForm(false);
      setSelectedQuestionItem(null);
      showToast("success", "Answer submitted! (+5 points)");

      await fetchAllQuestions();
    } catch {
      showToast("error", "Failed to submit answer.");
    }
  };

  /* ---------- Renderers ---------- */
  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>
            {classroom?.title ||
              `${(userRole || "Student").slice(0, 1).toUpperCase()}${(
                userRole || "student"
              )
                .slice(1)
                .toLowerCase()} Dashboard`}
          </Text>
          <Text style={styles.subtitle}>
            Learn together{"\n"}Grow together 🎯
          </Text>
        </View>

        <BlurCard style={styles.nameTagBlur}>
          {userRole === "tutor" ? (
            <Text style={styles.tutorBadgeText}>🎓 TUTOR</Text>
          ) : (
            <Text style={styles.nameText}>{userName}</Text>
          )}
        </BlurCard>
      </View>
    </View>
  );

  const SubjectRail = () =>
    (userRole === "student" || userRole === "tutor") && (
      <View>
        {/* Edge fades */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.85)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.edgeFade,
            { left: 0, transform: [{ rotateY: "180deg" }] },
          ]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.85)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.edgeFade, { right: 0 }]}
        />

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
                onPress={() => setSelectedSubject(active ? null : subject)}
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
                accessibilityLabel={`Filter by ${subject}`}
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
      contentContainerStyle={
        questions.length === 0
          ? { flex: 1, paddingHorizontal: 16 }
          : {
              paddingVertical: 12,
              paddingBottom: INPUT_BAR_HEIGHT + Math.max(insets.bottom, 24),
              paddingHorizontal: 16,
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

            <BlurCard
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

              <GradientButton
                title="➤"
                onPress={postQuestion}
                style={styles.sendButton}
                textStyle={styles.sendButtonText}
              />
            </BlurCard>
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
            </View>
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
                              <Text style={styles.answerMeta}>
                                By {ans.answeredByName}
                              </Text>
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
  /* ---------------- Root ---------------- */
  container: {
    flex: 1,
    paddingHorizontal: 16, // align with header rails
    paddingTop: 60,
  },

  /* ---------------- Header ---------------- */
  headerWrap: {
    marginTop: -16,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleCol: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", color: "black" },
  subtitle: { marginTop: 2, fontSize: 13.5, color: "black", opacity: 0.9 },
  nameTagBlur: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 160,
    marginTop: 0,
    borderColor: EDU_COLORS.borderLight,
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

  /* ---------- Subject Rail (chips) ---------- */
  subjectBar: {
    alignSelf: "stretch",
    width: "100%",
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 8, // tighter padding; content has its own gap
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    overflow: "hidden", // keep blur neat; edge fades sit above
    position: "relative",
  },
  subjectScrollTop: undefined, // REMOVE min/max height from the old style

  chipsRow: {
    paddingHorizontal: 8,
    alignItems: "center", // keeps chips vertically centered
    gap: 8,
    minHeight: 44, // consistent touch height without forcing tall rail
  },

  chip: {
    paddingHorizontal: 14,
    height: 36, // firm chip height
    borderRadius: 18,
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
  chipPressed: {
    opacity: 0.9,
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: EDU_COLORS.gray700,
  },
  chipTextActive: {
    color: Buttons.accentText,
  },

  /* ---------------- Content ---------------- */
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  /* ---------------- Empty / Loading ---------------- */
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
  emptyStateSubtext: { color: EDU_COLORS.gray600, marginBottom: 12 },
  ctaAsk: { alignSelf: "center", minWidth: 180 },

  /* ---------------- Chat List & Bubble ---------------- */
  chatContainer: { marginHorizontal: 0, marginVertical: 6 },
  myQuestionContainer: { alignItems: "flex-end" },
  othersQuestionContainer: { alignItems: "flex-start" },
  blurCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
    padding: 12,
    backgroundColor: "transparent",
  },
  chatBubble: { maxWidth: "88%" },
  questionImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
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

  /* ---------------- Subject Pills ---------------- */
  subjectPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  subjectPillText: { fontSize: 12.5, fontWeight: "700" },
  mySubjectPillText: { color: Buttons.accentBg },
  othersSubjectPillText: { color: Buttons.accentBg },

  /* ---------------- Chat Meta ---------------- */
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

  /* ---------------- Answer Section ---------------- */
  answerBtn: {
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

  /* ---------------- Sections ---------------- */
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginLeft: 0,
  },
  childCard: { marginHorizontal: 0 },
  activityCard: { marginHorizontal: 0, marginTop: 6 },
  digestCard: { marginHorizontal: 0, marginTop: 6 },
  childName: { fontWeight: "700", color: EDU_COLORS.textPrimary },
  childGrade: { color: EDU_COLORS.gray700 },
  childPoints: { color: EDU_COLORS.gray700 },
  childRank: { color: EDU_COLORS.gray700 },
  activityText: { color: EDU_COLORS.textPrimary },
  digestText: { color: EDU_COLORS.textPrimary },

  /* ---------------- Input Bar ---------------- */
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: INPUT_BAR_HEIGHT,
    marginHorizontal: 0,
    marginBottom: 4,
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
    minWidth: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  /* Gradient button (shared) */
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

  /* ---------------- Image Preview ---------------- */
  imagePreview: {
    marginHorizontal: 0,
    marginTop: 8,
    marginBottom: 2,
    position: "relative",
    alignSelf: "flex-start",
    paddingLeft: 16, // keep aligned with rails
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

  /* ---------------- FAB ---------------- */
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

  /* ---------------- Modals ---------------- */
  modalKav: {
    width: "100%",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.75)", // updated overlay
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

  /* Ask / Answer form bits that were referenced */
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

  /* Fullscreen image */
  imageModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.75)", // updated overlay
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
