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
import { auth } from "../services/firebaseAuth";
import { EDU_COLORS, paperTheme as baseTheme } from "../theme/colors";

/* ---- Palette shortcuts ---- */
const C = {
  primary: EDU_COLORS.primary,
  secondary: EDU_COLORS.secondary,
  base: EDU_COLORS.base,
  white: "#FFFFFF",
};

const { width, height } = Dimensions.get("window");

/* ---- Paper surfaces transparent so glass inputs look clean ---- */
const paperTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    background: "transparent",
    surface: "transparent",
  },
};

/* ---- Input theme: white text, refined placeholder ---- */
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

  // Micro-animations (kept subtle and snappy)
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const inputFocusAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance
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
    ]).start();

    // Content entrance
    Animated.parallel([
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
  }, [fade, slideY, logoScale, logoRotate]);

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

  const handleInputFocus = () => {
    Animated.timing(inputFocusAnim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const handleInputBlur = () => {
    Animated.timing(inputFocusAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

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
      showMessage("Oops! Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar translucent barStyle="light-content" />
      <View style={styles.root}>
     

        {/* Subtle background pattern */}
        <View style={styles.backgroundPattern}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.patternDot,
                {
                  top: Math.random() * height,
                  left: Math.random() * width,
                  opacity: Math.random() * 0.1 + 0.05,
                  transform: [{ scale: Math.random() * 0.5 + 0.5 }],
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
              {
                paddingTop: 8, // header sits slightly below breadcrumb
                paddingBottom: Math.max(insets.bottom + 20, 32),
              },
            ]}
          >
            {/* Header sits below breadcrumb for clear hierarchy */}
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
                  marginTop: 12,
                },
              ]}
            >
              <View style={styles.logoContainer}>
                <Text style={styles.appTitle} accessibilityRole="header">
                  🎓 EduLink
                </Text>
              </View>
              <Text style={styles.appTagline}>
                Learn together • Grow together
              </Text>
            </Animated.View>

            {/* Form */}
            <Animated.View
              style={[
                styles.form,
                {
                  opacity: fade,
                  transform: [{ translateY: slideY }],
                },
              ]}
            >
              <Animated.View style={styles.inputContainer}>
                <TextInput
                  mode="outlined"
                  placeholder="Enter your email address"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  selectionColor={C.white}
                  cursorColor={C.white}
                  theme={INPUT_THEME}
                  style={styles.input}
                  outlineColor="rgba(255,255,255,0.35)"
                  activeOutlineColor={C.white}
                  left={
                    <TextInput.Icon
                      icon="email-outline"
                      color="rgba(255,255,255,0.7)"
                      size={20}
                    />
                  }
                />
              </Animated.View>

              <Animated.View style={styles.inputContainer}>
                <TextInput
                  mode="outlined"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  secureTextEntry={secureTextEntry}
                  autoComplete="password"
                  textContentType="password"
                  selectionColor={C.white}
                  cursorColor={C.white}
                  theme={INPUT_THEME}
                  style={styles.input}
                  outlineColor="rgba(255,255,255,0.35)"
                  activeOutlineColor={C.white}
                  left={
                    <TextInput.Icon
                      icon="lock-outline"
                      color="rgba(255,255,255,0.7)"
                      size={20}
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
            </Animated.View>

            {/* CTA */}
            <Animated.View
              style={[
                styles.btnWrap,
                {
                  opacity: fade,
                  transform: [{ translateY: slideY }, { scale: btnScale }],
                },
              ]}
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
                accessibilityLabel="Sign in to EduLink"
                disabled={loading}
                buttonColor={C.secondary}
                textColor="#FFFFFF"
              >
                {loading ? "Starting ..." : "Start Learning"}
              </Button>
            </Animated.View>

            {/* Links */}
            <Animated.View
              style={[
                styles.linksContainer,
                { opacity: fade, transform: [{ translateY: slideY }] },
              ]}
            >
              <View
                style={[
                  styles.linksRow,
                  { flexDirection: "column", gap: 0, alignItems: "center" },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: "#EAF8FF" }}>New to EduLink?</Text>

                  <Button
                    mode="text"
                    onPress={() => navigation.navigate("Register")}
                    textColor="#066A76"
                    compact
                    labelStyle={[
                      styles.link,
                      { fontWeight: "bold", marginLeft: 4 },
                    ]}
                  >
                    Join the Community
                  </Button>
                </View>
                <Button
                  mode="text"
                  onPress={() => navigation.navigate("ForgotPassword")}
                  textColor="#066A76"
                  compact
                  labelStyle={styles.link}
                >
                  Forgot Password?
                </Button>
              </View>
            </Animated.View>

            {/* Footer */}
            <Animated.View
              style={[
                styles.footer,
                { opacity: fade, transform: [{ translateY: slideY }] },
              ]}
            >
              <Text style={styles.microcopy}>
                Secure by Firebase • Privacy-first
              </Text>
            </Animated.View>
          </View>

          {/* Snackbar */}
          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={4000}
            style={[
              styles.snackbar,
              { backgroundColor: isError ? EDU_COLORS.error : C.secondary },
            ]}
            accessibilityLiveRegion="polite"
            action={{
              label: "Dismiss",
              onPress: () => setSnackbarVisible(false),
              textColor: C.white,
            }}
            wrapperStyle={styles.snackbarWrapper}
          >
            <Text style={styles.snackbarText}>{message}</Text>
          </Snackbar>
        </KeyboardAvoidingView>
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Solid brand background (gradient removed)
    backgroundColor: "transparent",
  },
  kav: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "stretch",
    justifyContent: "center",
    gap: 24,
  },

  // Breadcrumb
  breadcrumbBack: {
    marginLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#EAF8FF22",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  breadcrumbIcon: {
    fontSize: 18,
    color: "#EAF8FF",
    fontWeight: "700",
    marginRight: 4,
  },
  breadcrumbText: {
    fontSize: 15,
    color: "#EAF8FF",
    fontWeight: "700",
  },

  // Background pattern
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  patternDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 8,
  },
  logoContainer: { marginBottom: 8 },
  appTitle: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appTagline: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // Form
  form: {
    gap: 16,
  },
  inputContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    fontSize: 16,
  },

  // Button
  btnWrap: {
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonContent: { height: 58 },
  button: { borderRadius: 20 },
  buttonLabel: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },

  // Links
  linksContainer: { marginTop: 8 },
  linksRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  link: {
    color: "#066A76",
    fontWeight: "700",
    fontSize: 14,
  },

  // Footer
  footer: { marginTop: 8 },
  microcopy: {
    textAlign: "center",
    fontSize: 13,
    color: "#FFFFFF",
    opacity: 0.8,
    letterSpacing: 0.3,
  },

  // Snackbar
  snackbar: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  snackbarWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  snackbarText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
