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
  Dimensions,
  Platform,
} from "react-native";
import { TextInput, Button } from "react-native-paper";
import { API_BASE } from "../services/api";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  TextColors,
  // PALETTE_60_30_10 is not used in the final styles, so it's commented out for cleanliness
} from "../theme/colors";
import { BlurView } from "expo-blur";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CORNER_RADIUS = 16;
const CONTENT_HORIZONTAL_PADDING = 20;
const CARD_HORIZONTAL_PADDING = 18; // Increased slightly for more breathing room
const CARD_VERTICAL_PADDING = 18;
const paperTheme = {
  /* ... simplified theme structure for style usage ... */
  shadows: {
    light: {
      shadowColor: EDU_COLORS.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    medium: {
      shadowColor: EDU_COLORS.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};

const SUBJECTS = ["Math", "Science", "English", "History", "Geography"];
const CLASSROOMS = [
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
];

// Re-usable Blur Card component
const BlurCard = ({
  children,
  style,
  intensity = 45,
  tint = "systemMaterialLight",
}) => (
  // Increased intensity for better blur effect on a light background
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const PAGE_TOP_OFFSET = 0;

/**
 * Custom hook for showing a Toast message, ensuring it sits correctly
 * below the top navigation bar.
 */
function useToast() {
  const insets = useSafeAreaInsets();
  // Adjust top offset to clear the safe area and the navigation bar
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
      {/* Header card (visual appeal, outside the main form for separation) */}
      <BlurCard style={styles.headerCard}>
        <Text style={styles.title}>Ask a Question 🙋‍♀️</Text>
        <Text style={styles.subtitle}>
          Be clear and specific for faster, better help.
        </Text>
        {/* Subtle decorative halo with requested overlay color */}
        <View style={styles.halo} />
      </BlurCard>

      {/* Main Form Card */}

      {/* Title Input */}
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

      {/* Description Input */}
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
      <View style={[styles.helperRow, styles.descHelperRow]}>
        <Text style={styles.helperText}>Add formulas, steps you tried.</Text>
        <Text style={styles.counterText}>{description.length}/800</Text>
      </View>

      {/* Subject Chips */}
      <Text style={styles.label}>Subject</Text>
      <View style={styles.chipsRow}>
        {SUBJECTS.map((s) => {
          const active = subject === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSubject(s)}
              style={[
                styles.chip,
                active ? styles.chipActive : styles.chipInactive,
              ]}
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
                style={[
                  styles.chipText,
                  active ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Topic Input */}
      <Text style={styles.label}>Topic (Optional)</Text>
      <TextInput
        mode="outlined"
        value={topic}
        onChangeText={setTopic}
        placeholder="e.g., Algebra, Photosynthesis"
        style={[styles.paperInput, styles.topicInput]}
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

      {/* Classroom Chips */}
      <Text style={styles.label}>Classroom</Text>
      <View style={styles.chipsRow}>
        {CLASSROOMS.map((c) => {
          const active = classroom === c;
          return (
            <Pressable
              key={c}
              onPress={() => setClassroom(c)}
              style={[
                styles.chip,
                active ? styles.chipActive : styles.chipInactive,
              ]}
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
                style={[
                  styles.chipText,
                  active ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Submit Button */}
      <Button
        mode="contained"
        onPress={submitQuestion}
        disabled={busy || !title} // Disable if busy or title is empty
        style={[
          styles.cta,
          (busy || !title) && styles.ctaDisabled, // Apply disabled style
        ]}
        labelStyle={styles.ctaText}
        theme={{
          colors: {
            // Ensure the primary color used by the button is the one from Buttons.primaryBg
            primary: Buttons.primaryBg,
            onPrimary: Buttons.primaryText,
          },
        }}
      >
        {busy ? "Posting..." : "Post Question"}
      </Button>

      {/* Local Toast host (ensures messages render on this screen) */}
      <Toast position="top" topOffset={24} visibilityTime={2600} />
    </ScrollView>
  );
}

const { width } = Dimensions.get("window");
const isSmallScreen = width < 375;

/* ===================== Styles (Design-token aligned) ===================== */
const styles = StyleSheet.create({
  // Global Screen Styles
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,

    // Background color is inherited from global, as requested (i.e., not set here)
  },
  screenContent: {
    paddingHorizontal: 20,

    paddingBottom: 64,
  },

  blurCard: {
    borderRadius: CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  card: {
    // Kept the original Card styles as a fallback/pattern
    backgroundColor: Surfaces.solid,
    borderRadius: CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    padding: CARD_HORIZONTAL_PADDING,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08, // Reduced shadow for a lighter feel
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // Header Card Styles (Visual Separation and Appeal)
  headerCard: {
    // Overrides default BlurCard padding/margin if needed
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 20,
    // Slightly more rounded header
  },
  title: {
    fontSize: isSmallScreen ? 24 : 28,
    fontWeight: "700",
    color: TextColors.default, // deep neutral for long reading
    marginBottom: 4,
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: TextColors.muted, // supportive labels
    fontWeight: "500",
  },
  halo: {
    // Subtle decorative element
    position: "absolute",
    top: -10,
    right: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: EDU_COLORS.primary, // Edu Blue
    opacity: 0.1,
    zIndex: -1, // Push it behind the text
  },

  // Main Form Card Styles
  formCard: {
    padding: isSmallScreen ? 20 : 24,
    backgroundColor: Surfaces.solid, // Matte card
    borderRadius: 20,
  },

  // TextInput Styles (React Native Paper)
  paperInput: {
    marginBottom: 0, // Remove default spacing since we handle it with helperRow
    backgroundColor: EDU_COLORS.base, // Paper-like canvas as per 60% dominant rule
    fontSize: isSmallScreen ? 15 : 16,
    minHeight: 56, // Standard Paper input height
  },
  outlineStyle: {
    borderRadius: 12, // Match the paperTheme roundness style
    borderWidth: 1.5,
    borderColor: EDU_COLORS.gray200, // Soft, neutral border
  },
  contentStyle: {
    paddingHorizontal: 16,
    color: TextColors.default, // Default text color
  },
  paperTextarea: {
    minHeight: 120, // Taller for description
    height: "auto", // Ensure multiline works
  },

  // Helper/Counter Text Styles
  helperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 16, // Space before next main element
    paddingHorizontal: 4,
  },
  descHelperRow: {
    marginBottom: 24, // More space after the large textarea
  },
  helperText: {
    fontSize: 12,
    color: EDU_COLORS.gray500, // Medium gray for non-critical info
  },
  counterText: {
    fontSize: 12,
    color: EDU_COLORS.gray400, // Lighter gray for counter
  },

  // Label Text Styles (above chips/inputs)
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: TextColors.default,
    marginBottom: 8,
    marginTop: 8, // Added to separate from previous element's helper row
  },

  // Chip Styles
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8, // Spacing between chips
    marginBottom: 24, // Space before the next label/input
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  // Inactive (Default) Chip
  chipInactive: {
    backgroundColor: Buttons.chipBg, // EDU_COLORS.gray100
    borderColor: EDU_COLORS.gray200,
  },
  chipTextInactive: {
    color: Buttons.chipText, // EDU_COLORS.gray600
    fontSize: 14,
    fontWeight: "500",
  },
  // Active Chip
  chipActive: {
    backgroundColor: Buttons.chipActiveBg, // EDU_COLORS.accent
    borderColor: Buttons.chipActiveBg, // Solid look
    ...paperTheme.shadows.light, // Slight shadow for selected state
  },
  chipTextActive: {
    color: Buttons.chipActiveText, // #FFFFFF
    fontSize: 14,
    fontWeight: "600",
  },

  // Topic Input specific spacing
  topicInput: {
    marginBottom: 24, // Space between topic input and Classroom label
  },

  // Call-to-Action (CTA) Button
  cta: {
    marginTop: 16,
    height: 52, // Professional button height
    borderRadius: 12, // Match input rounding
    justifyContent: "center", // Center text vertically
    backgroundColor: Buttons.primaryBg, // Primary600 for strong buttons
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "700",
    color: Buttons.primaryText,
  },
  ctaDisabled: {
    opacity: 0.7,
    backgroundColor: EDU_COLORS.gray400, // Neutral color for disabled state
  },
});
