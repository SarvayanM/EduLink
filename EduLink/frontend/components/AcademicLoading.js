// components/AcademicLoading.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  Platform,
  AccessibilityInfo,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

// --- Brand tokens (falls back if your EDU_COLORS isn't imported) ---
const EDU_FALLBACK = {
  primary: "#0A8CA0",
  primary700: "#065A63",
  accent: "#F59E0B",
  base: "#F8FAFC",
  ink: "#0F172A",
};
const C = global?.EDU_COLORS || EDU_FALLBACK;
const { width, height } = Dimensions.get("window");

export default function AcademicLoading({
  loading = true,
  title = "Preparing your Dashboard…",
  subtitle = "Fetching classes, questions, and recent activity",
}) {
  const [trackW, setTrackW] = useState(220);

  // --- Animations ---
  const barAnim = useRef(new Animated.Value(0)).current; // glide
  const halo = useRef(new Animated.Value(0)).current; // ambient halo
  const subtitleFade = useRef(new Animated.Value(0)).current; // fade-in

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (!loading) return;

    // Glide loop (indeterminate progress)
    const glide = Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(barAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // Soft halo pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // Staged subtitle reveal
    const fade = Animated.timing(subtitleFade, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    });

    if (!reduceMotion) {
      glide.start();
      pulse.start();
    }
    fade.start();

    return () => {
      glide.stop();
      pulse.stop();
      barAnim.stopAnimation();
      halo.stopAnimation();
      subtitleFade.stopAnimation();
    };
  }, [loading, reduceMotion]);

  const BAR_WIDTH = 96;
  const translateX = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAR_WIDTH, Math.max(trackW - BAR_WIDTH, 0)],
  });

  const haloScale = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const haloOpacity = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.28],
  });

  // --- Accessible progress text for screen readers ---
  const a11yLabel = useMemo(
    () =>
      `${title}. ${subtitle}. Loading, progress will complete automatically.`,
    [title, subtitle]
  );

  if (!loading) return null;

  return (
    <LinearGradient
      colors={[C.base, "#FFFFFF"]}
      style={styles.full}
      start={{ x: 0.2, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    >
      {/* Center wrapper */}
      <View
        style={styles.centerWrap}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
      >
        {/* Card with halo */}
        <View style={styles.cardShadow}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                backgroundColor: C.primary,
                opacity: reduceMotion ? 0.18 : haloOpacity,
                transform: reduceMotion ? [] : [{ scale: haloScale }],
              },
            ]}
          />
          <View
            style={[
              styles.card,
              { borderColor: `${C.primary}22`, backgroundColor: "#FFFFFFEE" },
            ]}
          >
            {/* Header row */}
            <View style={styles.headerRow}>
              <ActivityIndicator size="large" color={C.primary} />
              <View style={{ marginLeft: 12, flexShrink: 1 }}>
                <Text
                  style={[styles.title, { color: C.ink }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                <Animated.Text
                  style={[
                    styles.subtitle,
                    { color: "#475569", opacity: subtitleFade },
                  ]}
                  numberOfLines={2}
                >
                  {subtitle}
                </Animated.Text>
              </View>
            </View>

            {/* Progress track */}
            <View
              style={[styles.track, { backgroundColor: "#E2E8F0" }]}
              onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
              importantForAccessibility="no-hide-descendants"
            >
              <Animated.View
                style={[
                  styles.bar,
                  {
                    width: BAR_WIDTH,
                    backgroundColor: C.primary,
                    transform: reduceMotion ? [] : [{ translateX }],
                  },
                ]}
              />
              {/* Accent shimmer cap for higher visibility */}
              <Animated.View
                style={[
                  styles.cap,
                  {
                    transform: reduceMotion
                      ? []
                      : [{ translateX }, { scaleX: 0.98 }],
                    backgroundColor: C.accent,
                  },
                ]}
              />
            </View>

            {/* Footer meta */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLeft}>EduLink • Academic Workspace</Text>
              <Text style={styles.metaRight}>Please keep the app open</Text>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    minHeight: height,
    minWidth: width,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center", // <-- strictly centers the loading component
    paddingHorizontal: 20,
  },
  cardShadow: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: "100%",
    maxWidth: 520,
    height: 200,
    borderRadius: 24,
    filter: Platform.select({ web: "blur(18px)" }),
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  bar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  cap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 10,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    opacity: 0.85,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLeft: {
    fontSize: 12,
    color: "#64748B",
  },
  metaRight: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
