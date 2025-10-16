// screens/LoginScreen.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Image,
  ScrollView,
  Keyboard,
} from "react-native";
import {
  TextInput,
  Button,
  Snackbar,
  Provider as PaperProvider,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithEmailAndPassword } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import { auth } from "../services/firebaseAuth";
import {
  EDU_COLORS,
  paperTheme as baseTheme,
  APP_GRADIENT,
} from "../theme/colors";

/* ---------- Paper surfaces transparent for subtle white gradient ---------- */
const paperTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    background: "transparent",
    surface: "transparent",
  },
};

/* ---------- Input theme with palette tokens (no hard-coded colors) ---------- */
const INPUT_THEME = {
  roundness: 16,
  colors: {
    primary: EDU_COLORS.primary, // focus/active
    onSurfaceVariant: EDU_COLORS.textMuted,
    outline: EDU_COLORS.gray300,
    outlineVariant: EDU_COLORS.gray200,
    placeholder: EDU_COLORS.textMuted,
    text: EDU_COLORS.textPrimary,
    background: "transparent",
    surface: "transparent",
  },
};

export default function LoginScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  const msg = route?.params?.msg;

  /* ---------- Animations ---------- */
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  // small ambient dots (subtle, white-on-white)
  const dotA = useRef(new Animated.Value(0)).current;
  const dotB = useRef(new Animated.Value(0)).current;
  const dotC = useRef(new Animated.Value(0)).current;

  const [kbOpen, setKbOpen] = useState(false);
  const keyboardOffset = Math.max(insets.top + 24, 24); // give extra offset for header/logo

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKbOpen(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKbOpen(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 900,
        easing: Easing.elastic(1.1),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Background gentle rotation
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(bgAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // ambient dots pulse
    const pulse = (v, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 1800,
            delay,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ])
      ).start();

    pulse(dotA, 0);
    pulse(dotB, 400);
    pulse(dotC, 800);
  }, []);

  useEffect(() => {
    if (msg) showMessage(msg);
  }, [msg]);

  const showMessage = (m, error = false) => {
    setMessage(m);
    setIsError(error);
    setSnackbarVisible(true);
  };

  const onPressIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.96,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();

  const handleLogin = async () => {
    const mail = (email || "").trim();
    if (!mail || !password)
      return showMessage("Please enter email and password", true);

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, mail, password);
      const u = cred.user;
      try {
        await AsyncStorage.setItem("userEmail", u.email ?? mail);
      } catch {
        // no-op
      }
      showMessage("Login successful! Welcome to EduLink");
      // navigation.replace("Home");
    } catch {
      showMessage("Oops! Login failed", true);
    } finally {
      setLoading(false);
    }
  };

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const bgRotation = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <PaperProvider theme={paperTheme}>
      <View style={styles.root}>
        {/* Animated white-on-white background (keeps global white) */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: bgRotation }] },
          ]}
        >
          <LinearGradient
            colors={APP_GRADIENT}
            start={{ x: 0.1, y: 0.0 }}
            end={{ x: 0.9, y: 1.0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Subtle ambient dots */}
        <Animated.View
          style={[
            styles.dot,
            {
              top: 90,
              left: 40,
              opacity: dotA.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.35],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              top: 220,
              right: 36,
              opacity: dotB.interpolate({
                inputRange: [0, 1],
                outputRange: [0.12, 0.3],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              bottom: 120,
              left: 80,
              opacity: dotC.interpolate({
                inputRange: [0, 1],
                outputRange: [0.12, 0.28],
              }),
            },
          ]}
        />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={"padding"}
          keyboardVerticalOffset={keyboardOffset}
        >
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fade,
                transform: [
                  { translateY: slideY },
                  { scale: logoScale },
                  { rotate: logoRotation },
                ],
                paddingTop: Math.max(insets.top, 16),
              },
            ]}
            accessibilityRole="header"
            accessibilityLabel="EduLink Login"
          >
            {/* Transparent logo (PNG) */}
            <Animated.Image
              source={require("../assets/logo-2.png")} // <-- use a transparent PNG
              style={styles.logo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.appTitle}>Welcome Back !</Text>
          </Animated.View>
          <ScrollView
            style={styles.scroll}
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={true}
            contentContainerStyle={[
              styles.contentContainer,
              {
                // center on tall screens; when keyboard is open, start at top
                justifyContent: kbOpen ? "flex-start" : "center",
                paddingBottom: kbOpen
                  ? Math.max(insets.bottom + 320, 340)
                  : Math.max(insets.bottom + 20, 32),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="always"
          >
            {/* Form */}
            <Animated.View
              style={[
                styles.form,
                { opacity: fade, transform: [{ translateY: slideY }] },
              ]}
            >
              <TextInput
                mode="outlined"
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                left={
                  <TextInput.Icon
                    icon="email-outline"
                    color={EDU_COLORS.textMuted}
                  />
                }
                theme={INPUT_THEME}
                style={styles.input}
                returnKeyType="next"
              />
              <TextInput
                mode="outlined"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secureTextEntry}
                autoComplete="password"
                left={
                  <TextInput.Icon
                    icon="lock-outline"
                    color={EDU_COLORS.textMuted}
                  />
                }
                right={
                  <TextInput.Icon
                    icon={secureTextEntry ? "eye-off" : "eye"}
                    onPress={() => setSecureTextEntry(!secureTextEntry)}
                    color={EDU_COLORS.textMuted}
                  />
                }
                theme={INPUT_THEME}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </Animated.View>

            {/* CTA */}
            <Animated.View
              style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}
            >
              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                icon="arrow-right"
                contentStyle={styles.buttonContent}
                style={styles.button}
                labelStyle={styles.buttonLabel}
              >
                {loading ? "Starting ..." : "Start Learning"}
              </Button>
            </Animated.View>

            {/* Links */}
            <Animated.View style={[styles.links, { opacity: fade }]}>
              <Text style={styles.linkText}>
                New here?{" "}
                <Text
                  style={styles.linkHighlight}
                  onPress={() => navigation.navigate("Register")}
                >
                  Join EduLink
                </Text>
              </Text>
              <Text
                style={styles.linkSub}
                onPress={() => navigation.navigate("ForgotPassword")}
              >
                Forgot Password?
              </Text>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[styles.footer, { opacity: fade }]}>
              <Text style={styles.footerText}>
                Powered by Firebase • Built for learners
              </Text>
            </Animated.View>

            {/* Snackbar */}
            <Snackbar
              visible={snackbarVisible}
              onDismiss={() => setSnackbarVisible(false)}
              duration={4000}
              style={[
                styles.snackbar,
                {
                  backgroundColor: isError
                    ? EDU_COLORS.error
                    : EDU_COLORS.primary700,
                },
              ]}
              action={{
                label: "Dismiss",
                onPress: () => setSnackbarVisible(false),
              }}
            >
              <Text style={{ color: "#FFFFFF" }}>{message}</Text>
            </Snackbar>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </PaperProvider>
  );
}

/* --------------------------------- STYLES --------------------------------- */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    // don't vertically center the entire screen; let ScrollView manage layout
  },
  kav: { flex: 1 },
  scroll: { flex: 1 },

  contentContainer: {
    flexGrow: 1, // allows content to grow and scroll
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 24,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
  },

  /* ambient dot */
  dot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: EDU_COLORS.gray100,
  },

  header: {
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 10,
    backgroundColor: "transparent",
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary,
    marginBottom: 0,
  },
  appTagline: {
    color: EDU_COLORS.textMuted,
    fontSize: 15,
    letterSpacing: 0.3,
  },

  form: {
    width: "100%",
    gap: 16,
    alignItems: "center",
  },
  input: {
    borderRadius: 13,
    fontSize: 16,
    marginVertical: 5,
    width: 300,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    paddingHorizontal: 14,
    color: EDU_COLORS.textPrimary,
    backgroundColor: EDU_COLORS.surfaceSolid, // readable on white
  },

  btnWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 16,
  },
  button: {
    backgroundColor: EDU_COLORS.primary,
    borderRadius: 16,
    width: 300,
    elevation: 3,
    shadowColor: EDU_COLORS.shadow,
  },
  buttonContent: {
    height: 50,
    justifyContent: "center",
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  links: {
    flexDirection: "column",
    alignItems: "center",
    marginTop: 20,
    width: 300,
  },
  linkText: {
    color: EDU_COLORS.textMuted,
    fontSize: 14,
    marginVertical: 2,
  },
  linkHighlight: {
    color: EDU_COLORS.primary,
    fontWeight: "700",
  },
  linkSub: {
    color: EDU_COLORS.accent,
    fontSize: 13,
    marginTop: 8,
  },

  footer: {
    marginTop: 0,
    paddingBottom: 10,
  },
  footerText: {
    textAlign: "center",
    color: EDU_COLORS.gray400,
    fontSize: 12,
  },

  snackbar: {
    borderRadius: 16,
    margin: 12,
    elevation: 4,
  },
});

