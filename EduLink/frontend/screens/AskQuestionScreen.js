// frontend/screens/AskQuestionScreen.js
import Screen from "../components/Screen";
import Toast from "react-native-toast-message";
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { TextInput, Button } from "react-native-paper";
import { API_BASE } from "../services/api";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";
import { BlurView } from "expo-blur";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

const SUBJECTS = ["Math", "Science", "English", "History", "Geography"];
const CLASSROOMS = [
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
];

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

export default function AskQuestionScreen({ navigation }) {
  const showToast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("Math");
  const [topic, setTopic] = useState("");
  const [classroom, setClassroom] = useState("Grade 10");
  const [busy, setBusy] = useState(false);

  /* ---------- Minimal, useful validations (no logic change) ---------- */
  const isValidTitle = (t) => t.trim().length >= 8 && t.trim().length <= 180;
  const isValidDesc = (d) => d.trim().length <= 800;
  const isValidTopic = (t) => t.trim().length <= 60;
  const isValidSubject = (s) => SUBJECTS.includes(s);
  const isValidClassroom = (c) => CLASSROOMS.includes(c);

  async function submitQuestion() {
    // Field checks (non-invasive, keep flow the same)
    if (!isValidTitle(title)) {
      showToast(
        "error",
        "Missing or short title",
        "Use at least 8 characters (up to 180)."
      );
      return;
    }
    if (!isValidDesc(description)) {
      showToast("error", "Description too long", "Max 800 characters.");
      return;
    }
    if (!isValidTopic(topic)) {
      showToast("error", "Topic too long", "Keep it under 60 characters.");
      return;
    }
    if (!isValidSubject(subject)) {
      showToast("error", "Invalid subject", "Pick a subject from the list.");
      return;
    }
    if (!isValidClassroom(classroom)) {
      showToast(
        "error",
        "Invalid classroom",
        "Pick a classroom from the list."
      );
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          subject,
          topic: topic.trim(),
          classroom,
          askedBy: "student@example.com", // TODO: replace with actual user
          askedByName: "Student Name",
        }),
      });

      if (response.ok) {
        showToast("success", "Success", "Question posted successfully!");
        navigation.goBack();
      } else {
        showToast("error", "Error", "Failed to post question");
      }
    } catch {
      showToast("error", "Network error", "Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header card */}
      <BlurCard style={[styles.chatBubble]}>
        <Text style={styles.title}>Ask a Question</Text>
        <Text style={styles.subtitle}>
          Be clear and specific for faster help.
        </Text>
        {/* Subtle decorative halo with requested overlay color */}
        <View style={styles.halo} />
      </BlurCard>

      {/* Form card */}
      <BlurCard style={[styles.chatBubble]}>
        {/* Title */}
        <TextInput
          mode="outlined"
          label="Question Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="Write a concise, clear question"
          maxLength={180}
          style={styles.paperInput}
          outlineStyle={styles.outlineStyle}
          contentStyle={styles.contentStyle}
          placeholderTextColor={EDU_COLORS.gray500}
          selectionColor={EDU_COLORS.secondary}
          cursorColor={EDU_COLORS.primary}
          returnKeyType="next"
          theme={{
            colors: {
              primary: EDU_COLORS.primary,
              onSurfaceVariant: EDU_COLORS.gray600,
            },
          }}
        />
        <View style={styles.helperRow}>
          <Text style={styles.helperText}>
            Tip: Include key terms (e.g., “factor,” “photosynthesis”).
          </Text>
          <Text style={styles.counterText}>{title.length}/180</Text>
        </View>

        {/* Description */}
        <TextInput
          mode="outlined"
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Add context, show your work, and say where you’re stuck…"
          multiline
          numberOfLines={6}
          maxLength={800}
          style={[styles.paperInput, styles.paperTextarea]}
          outlineStyle={styles.outlineStyle}
          contentStyle={[styles.contentStyle, { textAlignVertical: "top" }]}
          placeholderTextColor={EDU_COLORS.gray500}
          selectionColor={EDU_COLORS.secondary}
          cursorColor={EDU_COLORS.primary}
          theme={{
            colors: {
              primary: EDU_COLORS.primary,
              onSurfaceVariant: EDU_COLORS.gray600,
            },
          }}
        />
        <View style={styles.helperRow}>
          <Text style={styles.helperText}>Add formulas, steps you tried.</Text>
          <Text style={styles.counterText}>{description.length}/800</Text>
        </View>

        {/* Subject */}
        <Text style={styles.label}>Subject</Text>
        <View style={styles.chipsRow}>
          {SUBJECTS.map((s) => {
            const active = subject === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSubject(s)}
                style={[styles.chip, active && styles.chipActive]}
                android_ripple={{
                  color: "rgba(0,0,0,0.06)",
                  borderless: false,
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Subject ${s}`}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {s}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Topic */}
        <Text style={styles.label}>Topic (Optional)</Text>
        <TextInput
          mode="outlined"
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g., Algebra, Photosynthesis"
          style={styles.paperInput}
          outlineStyle={styles.outlineStyle}
          contentStyle={styles.contentStyle}
          selectionColor={EDU_COLORS.secondary}
          cursorColor={EDU_COLORS.primary}
          theme={{
            colors: {
              primary: EDU_COLORS.primary,
              onSurfaceVariant: EDU_COLORS.gray600,
            },
          }}
        />

        {/* Classroom */}
        <Text style={styles.label}>Classroom</Text>
        <View style={styles.chipsRow}>
          {CLASSROOMS.map((c) => {
            const active = classroom === c;
            return (
              <Pressable
                key={c}
                onPress={() => setClassroom(c)}
                style={[styles.chip, active && styles.chipActive]}
                android_ripple={{
                  color: "rgba(0,0,0,0.06)",
                  borderless: false,
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Classroom ${c}`}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Submit */}
        <Button
          mode="contained"
          onPress={submitQuestion}
          disabled={busy}
          style={[styles.cta, busy && styles.ctaDisabled]}
          labelStyle={styles.ctaText}
          theme={{
            colors: {
              primary: Buttons.primaryBg,
              onPrimary: Buttons.primaryText,
            },
          }}
        >
          {busy ? "Posting..." : "Post Question"}
        </Button>
      </BlurCard>

      {/* Local Toast host (ensures messages render on this screen) */}
      <Toast position="top" topOffset={24} visibilityTime={2600} />
    </ScrollView>
  );
}

/* ===================== Styles (Design-token aligned) ===================== */
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET, // keeps everything aligned under the header rail
  },

  /* Shared blur shell */
  blurCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  chatBubble: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: EDU_COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: EDU_COLORS.gray600,
    marginTop: 6,
    fontWeight: "700",
  },

  /* Form */
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 8,
  },

  /* Paper inputs */
  paperInput: {
    backgroundColor: Surfaces.inputBg,
    borderRadius: 14,
    marginBottom: 12,
  },
  paperTextarea: { minHeight: 130 },
  outlineStyle: {
    borderColor: Surfaces.border,
    borderRadius: 14,
  },
  contentStyle: {
    color: EDU_COLORS.textPrimary,
    fontSize: 16,
    textAlignVertical: "top",
  },

  /* Chips */
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Surfaces.chipBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: Buttons.accentBg,
    borderColor: Buttons.accentBg,
  },
  chipText: {
    fontSize: 13,
    color: EDU_COLORS.gray700,
    fontWeight: "700",
  },
  chipTextActive: {
    color: Buttons.accentText,
    fontWeight: "900",
  },

  /* CTA */
  cta: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { fontWeight: "900", letterSpacing: 0.2 },
  helperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: -6,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    fontWeight: "600",
  },
  counterText: {
    fontSize: 12,
    color: EDU_COLORS.gray500,
    fontWeight: "700",
  },
});
