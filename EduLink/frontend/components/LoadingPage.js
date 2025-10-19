// components/LoadingPage.js
import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from "react-native";
import { EDU_COLORS, Surfaces } from "../theme/colors";

/**
 * LoadingPage
 * Props:
 *  - title?: string
 *  - subtitle?: string
 *  - imageSource?: ImageSourcePropType  // e.g., require("../assets/logo.png") or { uri: "..." }
 *  - showSpinner?: boolean               // default true
 *  - testID?: string                     // optional for testing
 */
export default function LoadingPage({
  title = "Loading your dashboard",
  subtitle = "Please hold on while we fetch everything…",
  imageSource,
  showSpinner = true,
  testID = "loading-page",
}) {
  // Animations
  const pulse = React.useRef(new Animated.Value(0)).current;
  const bar = React.useRef(new Animated.Value(0)).current;
  const dot1 = React.useRef(new Animated.Value(0)).current;
  const dot2 = React.useRef(new Animated.Value(0)).current;
  const dot3 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Pulse for the image/logo
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Indeterminate bar
    const barLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bar, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(bar, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // Dots wave
    const mkDotLoop = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const d1 = mkDotLoop(dot1, 0);
    const d2 = mkDotLoop(dot2, 160);
    const d3 = mkDotLoop(dot3, 320);

    pulseLoop.start();
    barLoop.start();
    d1.start();
    d2.start();
    d3.start();

    return () => {
      pulseLoop.stop();
      barLoop.stop();
      d1.stop();
      d2.stop();
      d3.stop();
    };
  }, [pulse, bar, dot1, dot2, dot3]);

  // Interpolations
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  // Bar travel width tuned for phones & tablets — container clamps its width
  const barTranslate = bar.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 360],
  });
  const dotTranslate = (v) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const dotOpacity = (v) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <SafeAreaView style={styles.root} testID={testID}>
      <View style={styles.centerWrap}>
        <View style={styles.card}>
          {/* Image / Logo slot */}
          <Animated.View
            style={[styles.imageRing, { transform: [{ scale }], opacity }]}
          >
            {imageSource ? (
              <Image
                source={imageSource}
                style={styles.image}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.imageFallback}>
                <Text style={styles.fallbackText}>EDU</Text>
              </View>
            )}
          </Animated.View>

          {/* Title + Subtitle */}
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Spinner */}
          {showSpinner && (
            <ActivityIndicator
              size="large"
              color={EDU_COLORS.primary}
              style={{ marginTop: 6 }}
            />
          )}

          {/* Indeterminate progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { transform: [{ translateX: barTranslate }] },
              ]}
            />
          </View>

          {/* Dots wave */}
          <View style={styles.dotsRow}>
            <Animated.View
              style={[
                styles.dot,
                {
                  transform: [{ translateY: dotTranslate(dot1) }],
                  opacity: dotOpacity(dot1),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  transform: [{ translateY: dotTranslate(dot2) }],
                  opacity: dotOpacity(dot2),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                {
                  transform: [{ translateY: dotTranslate(dot3) }],
                  opacity: dotOpacity(dot3),
                },
              ]}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ---------- Styles: only EduLink colors ---------- */
const { width } = Dimensions.get("window");
const MAX_CARD_WIDTH = Math.min(520, width - 32);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: EDU_COLORS.base ?? "#0B1220",
  },
  centerWrap: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: MAX_CARD_WIDTH,
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 20,
    backgroundColor: EDU_COLORS.surfaceSolid, // neutral surface from your palette
    borderWidth: 1,
    borderColor: Surfaces?.border ?? "rgba(255,255,255,0.10)",
    alignItems: "center",
  },

  /* Image / Logo */
  imageRing: {
    width: 104,
    height: 104,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: EDU_COLORS.surfaceSoft ?? "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Surfaces?.border ?? "rgba(255,255,255,0.10)",
    marginBottom: 14,
  },
  image: {
    width: 72,
    height: 72,
  },
  imageFallback: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: EDU_COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 20,
    letterSpacing: 1.2,
  },

  /* Copy */
  title: {
    marginTop: 2,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary ?? "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 18,
    color: EDU_COLORS.textSecondary ?? "rgba(255,255,255,0.78)",
    textAlign: "center",
  },

  /* Progress bar */
  progressTrack: {
    marginTop: 14,
    width: "100%",
    maxWidth: 420,
    height: 6,
    borderRadius: 999,
    backgroundColor: EDU_COLORS.surfaceSoft ?? "rgba(255,255,255,0.06)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Surfaces?.border ?? "rgba(255,255,255,0.10)",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 120, // moving segment width
    borderRadius: 999,
    backgroundColor: EDU_COLORS.primary,
    opacity: 0.95,
  },

  /* Dots */
  dotsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: EDU_COLORS.accent, // 10% accent
  },
});
