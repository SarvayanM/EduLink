// frontend/screens/AskQuestionScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
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

const SUBJECTS = ["Math", "Science", "English", "History", "Geography"];
const CLASSROOMS = [
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
];

export default function AskQuestionScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("Math");
  const [topic, setTopic] = useState("");
  const [classroom, setClassroom] = useState("Grade 10");
  const [busy, setBusy] = useState(false);

  async function submitQuestion() {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a question title");
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
        Alert.alert("Success", "Question posted successfully!");
        navigation.goBack();
      } else {
        Alert.alert("Error", "Failed to post question");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
    >
      {/* Header card */}
      <View style={[styles.card, styles.headerCard]}>
        <Text style={styles.title}>Ask a Question</Text>
        <Text style={styles.subtitle}>
          Be clear and specific for faster help.
        </Text>
        <View style={styles.halo} />
      </View>

      {/* Form card */}
      {/* Form card */}
      <View style={[styles.card, styles.formCard]}>
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
          <Text style={styles.helperText}>
            Add formulas, steps you tried.
          </Text>
          <Text style={styles.counterText}>{description.length}/800</Text>
        </View>

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

        <Text style={styles.label}>Topic (Optional)</Text>
        <TextInput
          mode="outlined"
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g., Algebra, Photosynthesis"
          style={styles.paperInput}
          outlineStyle={styles.outlineStyle}
          contentStyle={styles.contentStyle}
          theme={{
            colors: {
              primary: EDU_COLORS.primary,
              onSurfaceVariant: EDU_COLORS.gray600,
            },
          }}
        />

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
      </View>
    </ScrollView>
  );
}

/* ===================== Styles (Design-token aligned) ===================== */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent", // global gradient from App.js
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 12,
  },

  /* Reusable glassy card */
  card: {
    backgroundColor: Surfaces.solid,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    marginBottom: 14,
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

  /* Header */
  headerCard: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    overflow: "hidden",
    position: "relative",
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
  halo: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  /* Form */
  formCard: {
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 8,
  },

  /* Paper TextInputs */
  paperInput: {
    backgroundColor: Surfaces.inputBg,
    borderRadius: 14,
    marginBottom: 12,
  },
  paperTextarea: {
    minHeight: 120,
  },
  outlineStyle: {
    borderColor: Surfaces.border,
    borderRadius: 14,
  },
  contentStyle: {
    color: EDU_COLORS.textPrimary,
    fontSize: 16,
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
    backgroundColor: Buttons.accentBg, // 10% pop
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
    paddingVertical: 6, // Paper adds its own vertical padding; keep subtle
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
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontWeight: "900",
    letterSpacing: 0.2,
  },
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
  paperTextarea: {
    minHeight: 130,
  },
  contentStyle: {
    color: EDU_COLORS.textPrimary,
    fontSize: 16,
    // ensures top-left alignment for multiline placeholders and text
    textAlignVertical: "top",
  },
});
