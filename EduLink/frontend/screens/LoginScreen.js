// screens/LoginScreen.js
import Screen from "../components/Screen";
import { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
  Pressable,
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
import { EDU_COLORS, paperTheme as baseTheme } from "../theme/colors";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

/* ---- Palette shortcuts ---- */
const C = {
  primary: EDU_COLORS.primary,
  secondary: EDU_COLORS.secondary,
  base: EDU_COLORS.base,
  white: "#FFFFFF",
};

const { width, height } = Dimensions.get("window");

/* ---- Paper surfaces transparent for gradient feel ---- */
const paperTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    background: "transparent",
    surface: "transparent",
  },
};

const INPUT_THEME = {
  roundness: 16,
  colors: {
    primary: "#FFFFFF",
    onSurfaceVariant: "rgba(255,255,255,0.72)",
    outline: "rgba(255,255,255,0.35)",
    outlineVariant: "rgba(255,255,255,0.2)",
    placeholder: "rgba(255,255,255,0.72)",
    text: "#FFFFFF",
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

  // Animations
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  /* ---- Entry Animations ---- */
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

    // Background shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(bgAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ])
    ).start();
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
      toValue: 0.95,
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
      } catch {}
      showMessage("Login successful! Welcome to EduLink");
      // navigation.replace("Home");
    } catch (e) {
      showMessage("Oops! Login failed", true);
    } finally {
      setLoading(false);
    }
  };

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const bgInterpolation = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar translucent barStyle="light-content" />
      <View style={styles.root}>
        {/* Animated Gradient Background */}
        {/* Animated Gradient Background (fills behind TopNavbar + safe areas) */}

        {/* Floating dots for educational calm motion */}
        <View style={styles.bokehLayer}>
          {[...Array(15)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  top: Math.random() * height,
                  left: Math.random() * width,
                  opacity: Math.random() * 0.25 + 0.05,
                  transform: [{ scale: Math.random() * 1.2 + 0.5 }],
                },
              ]}
            />
          ))}
        </View>

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom + 20, 32) },
            ]}
          >
            {/* Header */}
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
                },
              ]}
            >
              <Text style={styles.appTitle}>🎓 EduLink</Text>
              <Text style={styles.appTagline}>Empower. Learn. Excel.</Text>
            </Animated.View>

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
                theme={INPUT_THEME}
                style={styles.input}
                left={
                  <TextInput.Icon
                    icon="email-outline"
                    color="rgba(255,255,255,0.7)"
                  />
                }
              />
              <TextInput
                mode="outlined"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secureTextEntry}
                autoComplete="password"
                theme={INPUT_THEME}
                style={styles.input}
                left={
                  <TextInput.Icon
                    icon="lock-outline"
                    color="rgba(255,255,255,0.7)"
                  />
                }
                right={
                  <TextInput.Icon
                    icon={secureTextEntry ? "eye-off" : "eye"}
                    onPress={() => setSecureTextEntry(!secureTextEntry)}
                    color="rgba(255,255,255,0.7)"
                  />
                }
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
                contentStyle={styles.buttonContent}
                style={styles.button}
                labelStyle={styles.buttonLabel}
                buttonColor="#066A76"
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
                { backgroundColor: isError ? EDU_COLORS.error : "#066A76" },
              ]}
              action={{
                label: "Dismiss",
                onPress: () => setSnackbarVisible(false),
              }}
            >
              <Text style={{ color: "#fff" }}>{message}</Text>
            </Snackbar>
          </View>
        </KeyboardAvoidingView>
      </View>
    </PaperProvider>
  );
}

/* ---- STYLES ---- */
const styles = StyleSheet.create({
  // root must allow layering behind content
  root: { flex: 1, position: "relative", backgroundColor: "transparent" },

  kav: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingHorizontal: 28,
    gap: 24,
  },
  header: { alignItems: "center", marginBottom: 8 },
  appTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  appTagline: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 17,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  input: { borderRadius: 16, fontSize: 16, marginBottom: 8 },
  btnWrap: {
    marginTop: 16,
    shadowColor: "#00A9B8",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  button: { borderRadius: 20 },
  buttonContent: { height: 58 },
  buttonLabel: { fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
  links: { alignItems: "center", marginTop: 16 },
  linkText: { color: "#EAF8FF", fontSize: 15 },
  linkHighlight: { color: "#00E0C7", fontWeight: "700" },
  linkSub: { color: "#A9D9E8", marginTop: 4, fontSize: 14 },
  footer: { marginTop: 8 },
  footerText: {
    textAlign: "center",
    color: "#FFFFFF",
    opacity: 0.8,
    fontSize: 13,
  },
  snackbar: { borderRadius: 16, margin: 16 },
  bokehLayer: { ...StyleSheet.absoluteFillObject },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EAF8FF",
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
  },
});
