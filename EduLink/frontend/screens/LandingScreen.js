// screens/LandingScreen.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth } from "../services/firebaseAuth";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  APP_GRADIENT,
  paperTheme,
} from "../theme/colors";

const logoSource = require("../assets/app-logo-1.png");

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // Float + pulse animations
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  // Login-like logo rotation
  const logoRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
    // One-time logo spin (same as Login)
    Animated.timing(logoRotate, {
      toValue: 1,
      duration: 900,
      easing: Easing.elastic(1.1),
      useNativeDriver: true,
    }).start();
  }, [float, pulse, logoRotate]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const arrowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const arrowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleGetStarted = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const user = auth?.currentUser;
    if (user) {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Main" }] })
      );
    } else {
      navigation.navigate("Login");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={Platform.select({
          ios: "dark-content",
          android: "dark-content",
        })}
      />
      <LinearGradient colors={APP_GRADIENT} style={StyleSheet.absoluteFill} />

      {/* Badge */}

      {/* Content */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoCard,
            {
              transform: [{ translateY }],
              shadowColor: EDU_COLORS.shadow,
              shadowOpacity: paperTheme.shadows.light.shadowOpacity,
              shadowRadius: paperTheme.shadows.light.shadowRadius,
              elevation: paperTheme.shadows.light.elevation,
            },
          ]}
        >
          <Animated.Image
            source={logoSource}
            style={[styles.logo, { transform: [{ rotate: logoRotation }] }]}
            resizeMode="contain"
            accessibilityLabel="EduLink app logo"
          />
        </Animated.View>

        <Text style={styles.title}>EduLink</Text>
        <Text style={styles.subtitle}>
          Learn together. Ask, share, and grow with mentors, tutors, and peers.
        </Text>

        <Pressable
          onPress={handleGetStarted}
          android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
          accessibilityRole="button"
          accessibilityLabel="Get Started"
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Text style={styles.ctaText}>Get Started</Text>
          <Animated.View
            style={{
              transform: [{ scale: arrowScale }],
              opacity: arrowOpacity,
            }}
          >
            <Ionicons name="arrow-forward-circle" size={22} color="#FFFFFF" />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const CARD_RADIUS = 20;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: EDU_COLORS.base },
  badgeWrap: { position: "absolute", top: 12, right: 16 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: EDU_COLORS.secondary700,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: EDU_COLORS.borderLight,
  },
  badgeText: {
    fontSize: 12,
    color: EDU_COLORS.textSecondary,
    fontFamily: "Poppins-Medium",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  logoCard: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    backgroundColor: Surfaces.solid,
    borderRadius: CARD_RADIUS,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Surfaces.border,
  },
  logo: { width: 360, height: 360 },
  title: {
    fontSize: 28,
    color: EDU_COLORS.textPrimary,
    fontFamily: "Poppins-Bold",
    fontWeight: "bold",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 14,
    color: EDU_COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 0,
    paddingHorizontal: 8,
    fontFamily: "Poppins-Regular",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Buttons.primaryBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    shadowColor: EDU_COLORS.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: {
    color: Buttons.primaryText,
    fontSize: 16,
    fontFamily: "Poppins-Medium",
  },
  footer: { alignItems: "center", justifyContent: "center" },
  footerText: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    fontFamily: "Poppins-Regular",
  },
});
