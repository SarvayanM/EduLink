// frontend/screens/QuestionFeedScreen.js
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  FlatList,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Easing,
} from "react-native";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Button, TextInput, Divider } from "react-native-paper";
import Toast from "react-native-toast-message";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

import {
  EDU_COLORS as THEME,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";

import { auth, db } from "../services/firebaseAuth";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ---------- Color fallbacks for safety ---------- */
const EDU_COLORS = {
  primary: THEME?.primary || "#0A8CA0",
  textPrimary: THEME?.textPrimary || "#0F172A",
  textSecondary: THEME?.textSecondary || "#64748B",
  shadow: THEME?.shadow || "#000",
};

/* ---------- Constants ---------- */
const PAGE_TOP_OFFSET = 4;

/* ---------- Styled blur card (used only for Question cards) ---------- */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

/* ---------- Toast helper (always from top) ---------- */
function useToast() {
  const insets = useSafeAreaInsets();
  const topOffset = (insets?.top || 0) + (NAVBAR_HEIGHT || 0) + 8;

  return React.useCallback(
    (type, text1, text2) => {
      Toast.show({
        type, // 'success' | 'error' | 'info'
        text1,
        text2,
        position: "top",
        topOffset:
          topOffset || Platform.select({ ios: 48, android: 28, default: 32 }),
        visibilityTime: 3200,
      });
    },
    [topOffset]
  );
}

/* ---------- Compact, tile-like loading card ---------- */
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

/* ---------- Animated appearance wrapper for list items ---------- */
const Appear = ({ children, delay = 0, style }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [a, delay]);
  return (
    <Animated.View
      style={[
        {
          opacity: a,
          transform: [
            {
              translateY: a.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
            {
              scale: a.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default function QuestionFeedScreen() {
  const showToast = useToast();
  const insets = useSafeAreaInsets();

  const [questions, setQuestions] = useState([]);
  const [userGrade, setUserGrade] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");

  const [loading, setLoading] = useState(false);
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("All");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("All");

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  /* ---------- Effects ---------- */
  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (userRole && (userGrade || userRole === "teacher")) {
      fetchQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGrade, userRole]);

  /* ---------- Data fetching ---------- */
  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.role);
        setUserGrade(userData.grade);
        setUserName(userData.displayName || "User");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      showToast("error", "Couldn’t load your profile", "Please try again.");
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "questions"),
        where("status", "==", "unanswered")
      );
      const querySnapshot = await getDocs(q);

      let questionsData = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Filter by role + grade and exclude own questions
      const myId = auth.currentUser?.uid;
      if (userRole === "teacher") {
        questionsData = questionsData.filter((qq) => qq.askedBy !== myId);
      } else if (userRole === "tutor" && userGrade) {
        const allowed = Array.from(
          { length: parseInt(userGrade, 10) - 5 },
          (_, i) => String(6 + i)
        );
        questionsData = questionsData.filter(
          (qq) => allowed.includes(qq.grade) && qq.askedBy !== myId
        );
      } else if (userGrade) {
        questionsData = questionsData.filter(
          (qq) => qq.grade === userGrade && qq.askedBy !== myId
        );
      }

      // Newest first
      questionsData.sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(0);
        const dbb = b.createdAt?.toDate?.() || new Date(0);
        return dbb - da;
      });

      setQuestions(questionsData);
    } catch (error) {
      console.error("Error fetching questions:", error);
      showToast(
        "error",
        "Couldn’t load questions",
        "Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Validated submit ---------- */
  const handleSubmitAnswer = async () => {
    // Basic validations
    if (!selectedQuestion?.id) {
      showToast("error", "No question selected", "Please pick a question.");
      return;
    }
    const trimmed = answer.trim();
    if (!trimmed) {
      showToast("error", "Answer required", "Please type your answer first.");
      return;
    }
    if (trimmed.length < 12) {
      showToast(
        "info",
        "Add more detail",
        "A helpful answer is at least 12 characters."
      );
      return;
    }
    if (trimmed.length > 4000) {
      showToast(
        "error",
        "Answer too long",
        "Please keep it under 4000 characters."
      );
      return;
    }
    if (selectedQuestion.askedBy === auth.currentUser?.uid) {
      showToast("error", "Not allowed", "You can’t answer your own question.");
      return;
    }

    try {
      const questionRef = doc(db, "questions", selectedQuestion.id);
      const newAnswer = {
        answer: trimmed,
        answeredBy: auth.currentUser.uid,
        answeredByName: userName || "User",
        createdAt: serverTimestamp(),
        upvotes: 0,
      };
      const updatedAnswers = [...(selectedQuestion.answers || []), newAnswer];
      await updateDoc(questionRef, {
        answers: updatedAnswers,
        status: "answered",
      });

      // Best-effort notify asker
      try {
        await addDoc(collection(db, "notifications"), {
          userId: selectedQuestion.askedBy,
          type: "answer",
          title: "New answer to your question",
          message: `${
            userName || "Someone"
          } answered: “${selectedQuestion.question.substring(0, 50)}${
            selectedQuestion.question.length > 50 ? "..." : ""
          }”`,
          questionId: selectedQuestion.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.log("Notification best-effort failed:", e);
      }

      setAnswer("");
      setShowAnswerForm(false);
      setSelectedQuestion(null);
      showToast(
        "success",
        "Answer posted",
        "Thanks for helping the community!"
      );

      // Refresh feed
      fetchQuestions();
    } catch {
      showToast("error", "Failed to submit", "Please try again.");
    }
  };

  /* ---------- Client-side filters ---------- */
  const filteredQuestions = useMemo(() => {
    let filtered = questions;

    if (selectedSubjectFilter !== "All") {
      filtered = filtered.filter((q) => q.subject === selectedSubjectFilter);
    }
    if (
      (userRole === "teacher" || userRole === "tutor") &&
      selectedGradeFilter !== "All"
    ) {
      filtered = filtered.filter((q) => q.grade === selectedGradeFilter);
    }
    return filtered;
  }, [questions, selectedSubjectFilter, selectedGradeFilter, userRole]);

  const unansweredCount = filteredQuestions.filter(
    (q) => !q.answers || q.answers.length === 0
  ).length;

  const unansweredSafeCount = Number.isFinite(Number(unansweredCount))
    ? Number(unansweredCount)
    : 0;

  /* ---------- Render item ---------- */
  const renderQuestionItem = ({ item: q, index }) => {
    if (q.answers?.length > 0) return null;
    const isMyQuestion = q.askedBy === auth.currentUser?.uid;
    const created = q.createdAt?.toDate?.()?.toLocaleDateString?.() || "Recent";

    return (
      <Appear delay={index * 20}>
        <BlurCard
          style={[styles.questionCard, isMyQuestion && styles.questionCardMine]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.questionText}>{q.question}</Text>
            {q.image && (
              <Pressable
                accessibilityRole="imagebutton"
                onPress={() => {
                  setSelectedImage(q.image);
                  setShowImageModal(true);
                }}
                style={styles.imagePressable}
              >
                <Image source={{ uri: q.image }} style={styles.questionImage} />
              </Pressable>
            )}
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.footerTags}>
              {(userRole === "teacher" || userRole === "tutor") && q.grade && (
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>🎓 Grade {q.grade}</Text>
                </View>
              )}
              {!!q.subject && (
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>📚 {q.subject}</Text>
                </View>
              )}
            </View>

            <View style={styles.footerMeta}>
              <Text style={styles.metaText}>
                👤 {q.askedByName || "Anonymous"} • 📅 {created}
              </Text>
              {!isMyQuestion && (
                <Button
                  mode="contained"
                  compact
                  icon="reply"
                  onPress={() => {
                    setSelectedQuestion(q);
                    setShowAnswerForm(true);
                  }}
                  style={styles.answerBtn}
                  labelStyle={styles.answerBtnLabel}
                >
                  Answer
                </Button>
              )}
            </View>
          </View>
        </BlurCard>
      </Appear>
    );
  };

  /* ---------- UI ---------- */
  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        data={filteredQuestions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={renderQuestionItem}
        ListHeaderComponent={
          <>
            {/* Header / Title — compact tile like your reference image */}
            <View style={styles.tile}>
              <View style={[styles.tileHeaderRow, styles.px16]}>
                <Text style={styles.tileTitle}>🧠 Knowledge Exchange</Text>

                <View
                  style={styles.pill}
                  accessibilityRole="text"
                  accessibilityLabel={`Unanswered ${unansweredSafeCount}`}
                >
                  <Text style={styles.pillLabel}>Unanswered</Text>
                  <Text style={styles.pillValue}>{unansweredSafeCount}</Text>
                </View>
              </View>

              <Text style={[styles.tileSubtitle, styles.px16]}>
                Engage with unanswered questions and share your insights
              </Text>
            </View>

            {/* Subject filter chips inside a compact tile */}
            <View style={styles.tileCard}>
              <Text style={styles.tileTitle}>🎯 Subjects</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {[
                  "All",
                  "Mathematics",
                  "Science",
                  "English",
                  "History",
                  "Geography",
                  "Other",
                ].map((subject) => {
                  const active = selectedSubjectFilter === subject;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by ${subject}`}
                      key={subject}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedSubjectFilter(subject)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {active ? "✓ " : ""}
                        {subject}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Grade filter chips (teacher/tutor) inside a compact tile */}
            {(userRole === "teacher" || userRole === "tutor") && (
              <View style={styles.tileCard}>
                <Text style={styles.tileTitle}>🏷️ Grades</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {(() => {
                    let gradeOptions = ["All"];
                    if (userRole === "teacher") {
                      gradeOptions = [
                        "All",
                        "Grade 6",
                        "Grade 7",
                        "Grade 8",
                        "Grade 9",
                        "Grade 10",
                        "Grade 11",
                      ];
                    } else if (userRole === "tutor" && userGrade) {
                      gradeOptions = ["All"];
                      for (let i = 6; i <= parseInt(userGrade, 10); i++) {
                        gradeOptions.push(`Grade ${i}`);
                      }
                    }
                    return gradeOptions.map((grade) => {
                      const value =
                        grade === "All" ? "All" : grade.replace("Grade ", "");
                      const active = selectedGradeFilter === value;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Filter by ${grade}`}
                          key={grade}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSelectedGradeFilter(value)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active && styles.chipTextActive,
                            ]}
                          >
                            {active ? "✓ " : ""}
                            {grade}
                          </Text>
                        </Pressable>
                      );
                    });
                  })()}
                </ScrollView>
              </View>
            )}
          </>
        }
        ListFooterComponent={
          loading ? (
            <LoadingCard
              title="Loading questions"
              subtitle="Personalizing by your role and grade…"
            />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.tileCard}>
              <Text style={styles.emptyTitle}>🔍 No matches yet</Text>
              <Text style={styles.emptySubText}>
                Try widening your criteria or check back later. ✨
              </Text>
            </View>
          ) : null
        }
      />

      {/* ---------------- Answer Modal ---------------- */}
      <Modal
        visible={showAnswerForm}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowAnswerForm(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 20 : 0}
          >
            <View style={styles.modalCardSolid}>
              <View style={styles.modalHeaderSolid}>
                <Text style={styles.modalTitle}>✍️ Submit Your Answer</Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.modalClose}
                  onPress={() => setShowAnswerForm(false)}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {selectedQuestion && (
                  <View style={styles.previewBoxSolid}>
                    <Text style={styles.previewLabel}>
                      Question from{" "}
                      {selectedQuestion.askedByName || "Anonymous"}
                    </Text>
                    <Text style={styles.previewText}>
                      {selectedQuestion.question}
                    </Text>
                    {!!selectedQuestion.subject && (
                      <>
                        <Divider style={styles.previewDivider} />
                        <Text style={styles.previewMeta}>
                          📚 {selectedQuestion.subject}
                          {selectedQuestion.grade
                            ? ` • Grade ${selectedQuestion.grade}`
                            : ""}
                        </Text>
                      </>
                    )}
                  </View>
                )}

                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={6}
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Type your detailed answer here..."
                  outlineStyle={{
                    borderRadius: 12,
                    borderColor: Surfaces?.border ?? "#1F2937",
                  }}
                  style={styles.answerInput}
                  theme={{
                    colors: {
                      primary: EDU_COLORS.primary,
                      surfaceVariant: Surfaces?.solid ?? "#0B1220",
                      onSurfaceVariant: EDU_COLORS.textSecondary,
                    },
                  }}
                />

                <View style={styles.modalBtnRow}>
                  <Button
                    mode="contained"
                    icon="send"
                    onPress={handleSubmitAnswer}
                    style={styles.submitBtn}
                    labelStyle={styles.submitLabel}
                  >
                    Post Answer
                  </Button>
                  <Button
                    mode="outlined"
                    icon="close"
                    onPress={() => setShowAnswerForm(false)}
                    style={styles.cancelBtn}
                    labelStyle={styles.cancelLabel}
                  >
                    Cancel
                  </Button>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
        <Toast position="top" />
      </Modal>

      {/* ---------------- Image Modal ---------------- */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalTopBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share Image"
              style={styles.iconBtn}
              onPress={async () => {
                if (selectedImage) {
                  try {
                    await Sharing.shareAsync(selectedImage);
                  } catch {
                    showToast(
                      "error",
                      "Share failed",
                      "Couldn’t share the image."
                    );
                  }
                }
              }}
            >
              <Text style={styles.iconBtnText}>📤</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Image Preview"
              style={styles.iconBtn}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={[styles.iconBtnText, { fontSize: 22 }]}>×</Text>
            </Pressable>
          </View>

          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
        <Toast position="top" />
      </Modal>
    </View>
  );
}

/* ===================== Styles ===================== */
const CARD_BG = Surfaces?.solid ?? "#FFFFFF";
const CARD_BORDER = Surfaces?.border ?? "rgba(148,163,184,0.24)";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,
    backgroundColor: "#F8FAFC",
  },

  /* ---- Generic “tile” (header) ---- */
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

  /* ---- Pill badge ---- */
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Buttons.accentBg,
    borderWidth: 1,
    borderColor: Buttons.accentBg,
  },
  pillLabel: {
    fontSize: 12,
    color: "#FFFFFF",
    marginRight: 6,
    fontWeight: "600",
  },
  pillValue: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "800",
    minWidth: 18,
    textAlign: "center",
  },

  /* ---- Generic tileCard (filters/empty/loading) ---- */
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

  /* ---- Blur card (question item) ---- */
  blurCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
  },

  chipsRow: { paddingHorizontal: 2, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: {
    backgroundColor: Buttons?.primaryBg || "#0EA5E9",
    borderColor: Buttons?.primaryBg || "#0EA5E9",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
  },
  chipTextActive: {
    color: Buttons?.primaryText || "#FFFFFF",
    fontWeight: "800",
  },

  list: { flex: 1, marginTop: 6 },
  listContainer: { paddingHorizontal: 0, paddingBottom: 120 },

  /* ---- Empty state as a tile ---- */
  emptyTitle: {
    fontSize: 18,
    color: EDU_COLORS.textPrimary,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    color: EDU_COLORS.textSecondary,
    textAlign: "center",
  },

  /* ---- Question item ---- */
  questionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 18,
  },
  questionCardMine: {
    backgroundColor: PALETTE_60_30_10?.color30 || "rgba(14,165,233,0.08)",
    borderColor: PALETTE_60_30_10?.color30 || Buttons?.primaryBg || "#0EA5E9",
  },
  cardHeader: { marginBottom: 12 },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: EDU_COLORS.textPrimary,
  },
  imagePressable: { marginTop: 10, borderRadius: 10, overflow: "hidden" },
  questionImage: { width: "100%", height: 180, borderRadius: 10 },
  cardFooter: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CARD_BORDER,
    flexDirection: "column",
  },
  footerTags: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tagPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: (EDU_COLORS.primary || "#0ea5e9") + "1A",
    borderWidth: 1,
    borderColor: (EDU_COLORS.primary || "#0ea5e9") + "33",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "800",
    color: EDU_COLORS.primary,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 13,
    color: EDU_COLORS.textSecondary,
    fontWeight: "600",
  },
  answerBtn: {
    backgroundColor: Buttons?.primaryBg || "#0EA5E9",
    borderRadius: 10,
    paddingHorizontal: 6,
    minHeight: 36,
    justifyContent: "center",
  },
  answerBtnLabel: {
    color: Buttons?.primaryText || "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  /* ---- Modals ---- */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  keyboardAvoidingView: { width: "100%", alignItems: "center" },
  modalCardSolid: {
    width: "100%",
    maxWidth: 580,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 15,
      },
      android: { elevation: 12 },
    }),
  },
  modalHeaderSolid: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Surfaces?.elevated ?? "#F8FAFC",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  modalCloseText: {
    fontSize: 20,
    color: EDU_COLORS.textSecondary,
    fontWeight: "600",
    lineHeight: 22,
  },
  modalBody: { padding: 20 },
  previewBoxSolid: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: EDU_COLORS.textSecondary,
    marginBottom: 6,
  },
  previewText: { fontSize: 16, color: EDU_COLORS.textPrimary, lineHeight: 24 },
  previewDivider: { marginVertical: 10, backgroundColor: CARD_BORDER },
  previewMeta: { fontSize: 13, color: EDU_COLORS.textSecondary },
  answerInput: {
    borderRadius: 12,
    fontSize: 15,
    textAlignVertical: "top",
    marginBottom: 20,
    minHeight: 120,
    backgroundColor: "#FFFFFF",
  },
  modalBtnRow: { flexDirection: "row", columnGap: 10 },
  submitBtn: {
    flex: 2,
    backgroundColor: Buttons?.primaryBg || "#0EA5E9",
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  submitLabel: {
    color: Buttons?.primaryText || "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
    borderColor: CARD_BORDER,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
  },

  /* ---- Image Modal ---- */
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  imageModalTopBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    right: 20,
    flexDirection: "row",
    gap: 10,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  iconBtnText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  modalImage: { width: "100%", height: "100%", borderRadius: 8 },

  /* ---- Loading (centered on screen - full width) ---- */
  loadingCenterWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 20,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 8,
    backgroundColor: CARD_BORDER,
    overflow: "hidden",
    marginTop: 8,
  },
  progressBar: {
    width: 80,
    height: 8,
    borderRadius: 8,
    backgroundColor: Buttons?.primaryBg || "#0EA5E9",
  },
});
