// frontend/screens/QuestionFeedScreen.js
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  FlatList,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, TextInput, Snackbar, Divider } from "react-native-paper";
import Toast from "react-native-toast-message";

import {
  EDU_COLORS,
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

export default function QuestionFeedScreen() {
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

  // Modal-local feedback (so it appears ABOVE the modal & keyboard)
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackText, setSnackText] = useState("");

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (userRole && (userGrade || userRole === "teacher")) {
      fetchQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGrade, userRole]);

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
      // Global toast is fine here (no modal open)
      Toast.show({
        type: "error",
        text1: "Couldn’t load your profile",
        text2: "Please try again.",
      });
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
      Toast.show({
        type: "error",
        text1: "Couldn’t load questions",
        text2: "Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    const trimmed = answer.trim();
    if (!trimmed) {
      setSnackText("Write your answer. It can’t be empty.");
      setSnackVisible(true);
      return;
    }

    try {
      const questionRef = doc(db, "questions", selectedQuestion.id);
      const newAnswer = {
        answer: trimmed,
        answeredBy: auth.currentUser.uid,
        answeredByName: userName,
        createdAt: serverTimestamp(),
        upvotes: 0,
      };
      const updatedAnswers = [...(selectedQuestion.answers || []), newAnswer];
      await updateDoc(questionRef, {
        answers: updatedAnswers,
        status: "answered",
      });

      // best-effort notification
      try {
        await addDoc(collection(db, "notifications"), {
          userId: selectedQuestion.askedBy,
          type: "answer",
          title: "New answer to your question",
          message: `${userName} answered: “${selectedQuestion.question.substring(
            0,
            50
          )}${selectedQuestion.question.length > 50 ? "..." : ""}”`,
          questionId: selectedQuestion.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.log("Notification best-effort failed:", e);
      }

      setAnswer("");
      setSnackText("Answer posted. Thanks for helping the community! 🎉");
      setSnackVisible(true);

      // close after a short delay to let the user read the snackbar
      setTimeout(() => {
        setShowAnswerForm(false);
        setSelectedQuestion(null);
      }, 650);

      fetchQuestions();
    } catch {
      setSnackText("Failed to submit. Please try again.");
      setSnackVisible(true);
    }
  };

  // Client-side filters
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

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.surfaceCard, styles.headerCard]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Q&A Forum</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unansweredCount}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Unanswered questions</Text>
      </View>

      {/* Subject chips */}
      <View style={[styles.surfaceCard, styles.filterCard]}>
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
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {subject}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Grade chips (teacher/tutor) */}
      {(userRole === "teacher" || userRole === "tutor") && (
        <View style={[styles.surfaceCard, styles.filterCard]}>
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
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {grade}
                    </Text>
                  </Pressable>
                );
              });
            })()}
          </ScrollView>
        </View>
      )}

      {/* Questions */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        data={filteredQuestions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: q }) => {
          const isMyQuestion = q.askedBy === auth.currentUser?.uid;
          const created =
            q.createdAt?.toDate?.()?.toLocaleDateString?.() || "Recent";
          return (
            <View style={styles.itemWrap}>
              {!isMyQuestion && (
                <Text style={styles.nameLabel}>
                  {q.askedByName || "Anonymous"}
                </Text>
              )}

              <View
                style={[
                  styles.bubble,
                  isMyQuestion ? styles.bubbleMine : styles.bubbleOther,
                ]}
              >
                {q.image ? (
                  <Pressable
                    accessibilityRole="imagebutton"
                    onPress={() => {
                      setSelectedImage(q.image);
                      setShowImageModal(true);
                    }}
                  >
                    <Image
                      source={{ uri: q.image }}
                      style={styles.questionImage}
                    />
                  </Pressable>
                ) : null}

                <Text
                  style={[
                    styles.questionText,
                    isMyQuestion
                      ? styles.questionTextMine
                      : styles.questionTextOther,
                  ]}
                >
                  {q.question}
                </Text>

                {!!q.subject && (
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>📚 {q.subject}</Text>
                  </View>
                )}

                <View style={styles.metaRow}>
                  <Text
                    style={[
                      styles.metaText,
                      isMyQuestion ? styles.metaMine : styles.metaOther,
                    ]}
                  >
                    {(userRole === "teacher" || userRole === "tutor") && q.grade
                      ? `Grade ${q.grade} • `
                      : ""}
                    {created}
                  </Text>

                  {!isMyQuestion && (
                    <Button
                      mode="contained"
                      compact
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
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 20, // Increased font size
                  color: "white",
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                No questions match your filters yet.
              </Text>
            </View>
          ) : null
        }
      />

      {/* ---------------- Answer Modal (Solid + Keyboard-safe) ---------------- */}
      <Modal
        visible={showAnswerForm}
        animationType="fade"
        transparent
        statusBarTranslucent // <= Android: let the modal extend under status bar
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowAnswerForm(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%", alignItems: "center" }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
          >
            <View style={styles.modalCardSolid}>
              <View style={styles.modalHeaderSolid}>
                <Text style={styles.modalTitle}>Answer Question</Text>
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
                    <Text style={styles.previewLabel}>Question</Text>
                    <Text style={styles.previewText}>
                      {selectedQuestion.question}
                    </Text>
                    {!!selectedQuestion.subject && (
                      <>
                        <Divider
                          style={{
                            marginVertical: 10,
                            backgroundColor: "#E2E8F0",
                          }}
                        />
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
                  placeholder="Write your answer here…"
                  outlineStyle={{ borderRadius: 12 }}
                  style={styles.answerInput}
                  theme={{
                    colors: {
                      primary: EDU_COLORS.primary,
                      surfaceVariant: "#FFFFFF",
                    },
                  }}
                />

                <View style={styles.modalBtnRow}>
                  <Button
                    mode="contained"
                    onPress={handleSubmitAnswer}
                    style={styles.submitBtn}
                    labelStyle={styles.submitLabel}
                  >
                    Submit
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => setShowAnswerForm(false)}
                    style={styles.cancelBtn}
                    labelStyle={styles.cancelLabel}
                  >
                    Cancel
                  </Button>
                </View>
              </ScrollView>

              {/* In-modal snackbar so it never hides behind the modal/keyboard */}
              <Snackbar
                visible={snackVisible}
                onDismiss={() => setSnackVisible(false)}
                duration={2200}
                style={styles.snackbar}
              >
                {snackText}
              </Snackbar>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ---------------- Image Modal ---------------- */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent
        statusBarTranslucent // <= Android: let the modal extend under status bar
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalTopBar}>
            <Pressable
              accessibilityRole="button"
              style={styles.iconBtn}
              onPress={async () => {
                if (selectedImage) {
                  try {
                    await Sharing.shareAsync(selectedImage);
                  } catch {
                    Toast.show({
                      type: "error",
                      text1: "Share failed",
                      text2: "Couldn’t share the image.",
                    });
                  }
                }
              }}
            >
              <Text style={styles.iconBtnText}>📤</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
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
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Global toast (kept at top; offset uses safe area). We avoid using this while the Answer modal is open */}
      <Toast
        position="top"
        topOffset={(insets?.top || 0) + 12}
        visibilityTime={2600}
      />
    </View>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  // Root (transparent so global gradient shows)
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },

  /* ---------- Cards & layout ---------- */
  surfaceCard: {
    backgroundColor: Surfaces.solid,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    marginHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  headerCard: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    marginLeft: "auto",
    backgroundColor: Buttons.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: Buttons.accentText,
    fontWeight: "800",
    fontSize: 12,
  },
  filterCard: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  /* ---------- Typography ---------- */
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },

  /* ---------- Chips ---------- */
  chipsRow: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
  },
  chipActive: {
    backgroundColor: Buttons.accentBg,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  chipTextActive: {
    color: Buttons.accentText,
  },

  /* ---------- List ---------- */
  list: {
    flex: 1,
    marginTop: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  /* ---------- Item ---------- */
  itemWrap: {
    marginBottom: 16,
  },
  nameLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
    marginLeft: 6,
  },

  bubble: {
    padding: 14,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  bubbleMine: {
    backgroundColor: PALETTE_60_30_10.primary30,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: Surfaces.solid,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
  },

  questionImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
  },

  questionText: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 8,
  },
  questionTextMine: { color: "#FFFFFF" },
  questionTextOther: { color: EDU_COLORS.textPrimary },

  tagPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metaText: { fontSize: 12 },
  metaMine: { color: "#E2E8F0" },
  metaOther: { color: "#64748B" },

  answerBtn: {
    backgroundColor: Buttons.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    minHeight: 34,
    justifyContent: "center",
  },
  answerBtnLabel: {
    color: Buttons.primaryText,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  /* ---------- Modal: Answer (Solid) ---------- */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCardSolid: {
    width: "100%",
    maxWidth: 580,
    backgroundColor: Surfaces.solid,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  modalHeaderSolid: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: Surfaces.elevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surfaces.border,
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 20,
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 22,
  },
  modalBody: { padding: 16 },

  previewBoxSolid: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
  },
  previewText: { fontSize: 15, color: EDU_COLORS.textPrimary, lineHeight: 21 },
  previewMeta: { fontSize: 12, color: "#64748B" },

  answerInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    fontSize: 15,
    textAlignVertical: "top",
    marginBottom: 12,
  },

  modalBtnRow: { flexDirection: "row", columnGap: 10 },
  submitBtn: {
    flex: 1,
    backgroundColor: Buttons.primaryBg,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  submitLabel: { color: Buttons.primaryText, fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: "center",
    borderColor: "#CBD5E1",
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
  },
  snackbar: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
  },

  /* ---------- Modal: Image ---------- */
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  imageModalTopBar: {
    position: "absolute",
    top: 50,
    right: 20,
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  modalImage: {
    width: "90%",
    height: "78%",
    borderRadius: 8,
  },

  /* ---------- Loading Overlay ---------- */
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});
