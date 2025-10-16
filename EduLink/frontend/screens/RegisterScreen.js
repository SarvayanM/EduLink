// screens/RegisterScreen.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  Animated,
  Easing,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from "react-native";
import {
  TextInput,
  Button,
  Card,
  RadioButton,
  Text,
  HelperText,
  Portal,
  Modal,
  Divider,
  Snackbar,
  Provider as PaperProvider,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { auth, db, getSecondaryAuth } from "../services/firebaseAuth";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { EDU_COLORS, paperTheme as baseTheme } from "../theme/colors";

/* ---------- Dimensions ---------- */
const { width: screenWidth } = Dimensions.get("window");

/* ---------- Palette shortcuts ---------- */
const C = {
  primary: EDU_COLORS.primary,
  secondary: EDU_COLORS.secondary,
  base: EDU_COLORS.base,
  white: "#FFFFFF",
  error: EDU_COLORS.error,
  placeholder: EDU_COLORS.textMuted,
  label: EDU_COLORS.textSecondary,
};

/* ---------- Paper theme (transparent to let white base show) ---------- */
const paperTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    background: "transparent",
    surface: "transparent",
    text: EDU_COLORS.textPrimary,
  },
};

/* ---------- Input theme (no hard-coded colors) ---------- */
const INPUT_THEME = {
  roundness: 16,
  colors: {
    primary: C.primary,
    onSurfaceVariant: EDU_COLORS.textMuted,
    outline: EDU_COLORS.gray300,
    outlineVariant: EDU_COLORS.gray200,
    placeholder: EDU_COLORS.textMuted,
    text: EDU_COLORS.textPrimary,
    background: "transparent",
    surface: "transparent",
  },
};

const ROLES = ["student", "teacher", "parent"];
const GRADES_LIST = ["6", "7", "8", "9", "10", "11"];
const GRADE_PLACEHOLDER = "Select grade (6–11)";

const sriLankaSchoolSubjects = [
  "Sinhala",
  "Tamil",
  "English",
  "Pali",
  "Sanskrit",
  "Second National Language",
  "Mathematics",
  "Science",
  "History",
  "Geography",
  "Civics",
  "Health and Physical Education",
  "Information and Communication Technology",
  "Religion and Value Education",
  "Art",
  "Music",
  "Dance",
  "Drama and Theatre",
];

export default function RegisterScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const GRADES = useMemo(() => GRADES_LIST, []);

  // Profile / role state
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("student");
  const [grade, setGrade] = useState("6");
  const [gradePickerOpen, setGradePickerOpen] = useState(false);
  const [gradeTouched, setGradeTouched] = useState(false);

  // Teacher subject picker
  const SUBJECT_PLACEHOLDER = "Select teaching subject";
  const [subject, setSubject] = useState("");
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [subjectQuery, setSubjectQuery] = useState("");

  // Emails & passwords
  const [email, setEmail] = useState(""); // Parent/Student/Teacher account email (main)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Parent → link student
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  // UI state
  const [profileImage, setProfileImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [confirmSecureTextEntry, setConfirmSecureTextEntry] = useState(true);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  // Animations
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // Animate profile image on change
  const imgScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Header / card entrance
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
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slideY, cardScale, logoScale, logoRotate]);

  // Request gallery permission for picking avatar
  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "Please allow photo library access to add a profile picture",
          "error"
        );
      }
    })();
  }, []);

  // Toast helper
  const showToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Pick image & animate
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
        // subtle pop on change
        imgScale.setValue(0.9);
        Animated.spring(imgScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }).start();
        showToast("Profile picture added successfully!");
      }
    } catch {
      showToast("Failed to pick image", "error");
    }
  };

  // Button micro-interaction
  const onPressIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

  // Helpers
  async function validateStudent(emailIn, passwordIn) {
    try {
      const qRef = query(
        collection(db, "users"),
        where("email", "==", emailIn.trim()),
        where("role", "==", "student")
      );
      const snap = await getDocs(qRef);
      if (snap.empty) return false;

      const secondaryAuth = getSecondaryAuth();
      await signInWithEmailAndPassword(
        secondaryAuth,
        emailIn.trim(),
        passwordIn
      );
      await signOut(secondaryAuth);
      return true;
    } catch {
      return false;
    }
  }

  const confirmMismatch =
    confirmTouched &&
    confirmPassword.length > 0 &&
    confirmPassword !== password;

  const subjectInvalidForTeacher =
    role === "teacher" && subjectTouched && !subject.trim();

  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return sriLankaSchoolSubjects;
    return sriLankaSchoolSubjects.filter((s) => s.toLowerCase().includes(q));
  }, [subjectQuery]);

  // Registration handler (logic unchanged)
  async function onRegister() {
    const trimmedEmail = (email || "").trim();
    setEmailError("");

    if (!confirmTouched) setConfirmTouched(true);
    if (role === "teacher" && !subjectTouched && !subject.trim())
      setSubjectTouched(true);

    if (!displayName || !trimmedEmail) {
      showToast("Please provide your full name and email", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (!passwordRegex.test(password)) {
      showToast(
        "Password must have at least 8 characters including uppercase, lowercase, a number and a special character",
        "error"
      );
      return;
    }
    if (confirmPassword !== password) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (role === "teacher" && !subject.trim()) {
      showToast("Please select the teaching subject", "error");
      return;
    }
    if (role === "student" && !String(grade || "").trim()) {
      showToast("Please enter your class/grade", "error");
      return;
    }
    if (
      role === "parent" &&
      (!studentEmail.trim() || !studentPassword.trim())
    ) {
      showToast("Please enter your child's email and password", "error");
      return;
    }

    setBusy(true);
    try {
      if (role === "parent") {
        const ok = await validateStudent(studentEmail.trim(), studentPassword);
        if (!ok) {
          showToast("The student email or password is incorrect", "error");
          setBusy(false);
          return;
        }
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );
      await updateProfile(cred.user, { displayName });

      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        displayName,
        email: trimmedEmail,
        role,
        grade: role === "student" ? grade : null,
        registrationYear: role === "student" ? new Date().getFullYear() : null,
        subject: role === "teacher" ? subject.trim() : null,
        studentEmail: role === "parent" ? studentEmail.trim() : null,
        profileImage: profileImage || null,
        points: role === "student" ? 0 : null,
        createdAt: serverTimestamp(),
      });

      showToast("Welcome to EduLink! Your account was created successfully 🎓");
      // navigation.replace("Home");
    } catch (e) {
      showToast(
        e?.message
          ? "Oops! " + e.message
          : "We couldn’t complete your registration right now. Please try again later.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  const namePlaceholder =
    role === "student"
      ? "Full name (e.g., Tharindu Perera)"
      : role === "teacher"
      ? "Full name (e.g., Mrs. Fernando)"
      : "Full name (e.g., Mr. / Mrs. Jayasinghe)";

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar translucent barStyle="dark-content" />
      <View style={styles.root}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom: Math.max(insets.bottom + 20, 32),
              },
            ]}
          >
            <Animated.View
              style={{
                opacity: fade,
                transform: [{ translateY: slideY }, { scale: cardScale }],
              }}
            >
              <View style={styles.formContainer}>
                {/* Header (text + image animation applied) */}
                <Animated.View
                  style={[
                    styles.headerContainer,
                    {
                      transform: [
                        { scale: logoScale },
                        { rotate: logoRotation },
                      ],
                      marginTop: 4,
                    },
                  ]}
                  accessibilityRole="header"
                >
                  {/* Transparent logo image (sits above title). Replace with your transparent PNG if needed */}
                  <Animated.Image
                    source={require("../assets/logo-3.png")}
                    resizeMode="contain"
                    style={[
                      styles.brandLogo,
                      { transform: [{ scale: imgScale }] },
                    ]}
                    accessibilityIgnoresInvertColors
                  />
                  <Text style={styles.appTitle}>🎓 EduLink</Text>
                  <Text style={styles.appTagline}>
                    Join our educational community
                  </Text>
                </Animated.View>

                {/* Profile Image Picker (animated) */}
                <Pressable style={styles.imageContainer} onPress={pickImage}>
                  {profileImage ? (
                    <Animated.Image
                      source={{ uri: profileImage }}
                      style={[
                        styles.profileImage,
                        { transform: [{ scale: imgScale }] },
                      ]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imagePlaceholderEmoji}>👤</Text>
                      <Text style={styles.imageText}>Add Profile Photo</Text>
                    </View>
                  )}
                  <View style={styles.imageOverlay}>
                    <Text style={styles.imageOverlayText}>📷</Text>
                  </View>
                </Pressable>

                {/* Personal Information */}
                <Animated.View
                  style={[
                    styles.section,
                    { opacity: fade, transform: [{ translateY: slideY }] },
                  ]}
                >
                  <Text style={styles.sectionLabel}>Personal Information</Text>

                  <TextInput
                    key="parent-name"
                    nativeID="parent-name"
                    placeholder={namePlaceholder}
                    value={displayName}
                    onChangeText={setDisplayName}
                    mode="outlined"
                    style={styles.input}
                    outlineColor={EDU_COLORS.gray300}
                    activeOutlineColor={C.primary}
                    theme={INPUT_THEME}
                    selectionColor={C.primary}
                    cursorColor={C.primary}
                    contentStyle={styles.inputContent}
                    left={<TextInput.Icon icon="account" size={20} />}
                    textContentType="name"
                    autoComplete="name"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />

                  {/* PARENT / MAIN ACCOUNT EMAIL
                        Distinct autofill semantics to prevent mirroring */}
                  <TextInput
                    key="parent-email"
                    nativeID="parent-email"
                    placeholder={
                      role === "parent"
                        ? "parent.name@email.com"
                        : "student123@school.lk"
                    }
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (emailError) setEmailError("");
                    }}
                    mode="outlined"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    outlineColor={emailError ? C.error : EDU_COLORS.gray300}
                    activeOutlineColor={C.primary}
                    theme={INPUT_THEME}
                    selectionColor={C.primary}
                    cursorColor={C.primary}
                    contentStyle={styles.inputContent}
                    left={<TextInput.Icon icon="email" size={20} />}
                    textContentType="emailAddress"
                    autoComplete="email" // <-- parent/main email
                    importantForAutofill="yes"
                    autoCorrect={false}
                  />
                  {!!emailError && (
                    <HelperText type="error" style={styles.helperText}>
                      {emailError}
                    </HelperText>
                  )}
                </Animated.View>

                {/* Security */}
                <Animated.View
                  style={[
                    styles.section,
                    { opacity: fade, transform: [{ translateY: slideY }] },
                  ]}
                >
                  <Text style={styles.sectionLabel}>Security</Text>

                  <TextInput
                    key="parent-pass"
                    nativeID="parent-pass"
                    placeholder="Create a strong password"
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => {
                      if (confirmPassword) setConfirmTouched(true);
                    }}
                    mode="outlined"
                    style={styles.input}
                    secureTextEntry={secureTextEntry}
                    outlineColor={EDU_COLORS.gray300}
                    activeOutlineColor={C.primary}
                    theme={INPUT_THEME}
                    selectionColor={C.primary}
                    cursorColor={C.primary}
                    contentStyle={styles.inputContent}
                    left={<TextInput.Icon icon="lock" size={20} />}
                    right={
                      <TextInput.Icon
                        icon={secureTextEntry ? "eye-off" : "eye"}
                        onPress={() => setSecureTextEntry(!secureTextEntry)}
                      />
                    }
                    textContentType="newPassword"
                    autoComplete="password-new"
                    autoCorrect={false}
                  />

                  <Text style={styles.passwordHint}>
                    Must include uppercase, lowercase, number & special
                    character (min 8 characters)
                  </Text>

                  <TextInput
                    key="parent-pass-confirm"
                    nativeID="parent-pass-confirm"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onBlur={() => setConfirmTouched(true)}
                    mode="outlined"
                    style={styles.input}
                    secureTextEntry={confirmSecureTextEntry}
                    outlineColor={
                      confirmMismatch ? C.error : EDU_COLORS.gray300
                    }
                    activeOutlineColor={confirmMismatch ? C.error : C.primary}
                    theme={INPUT_THEME}
                    selectionColor={C.primary}
                    cursorColor={C.primary}
                    contentStyle={styles.inputContent}
                    left={<TextInput.Icon icon="lock-check" size={20} />}
                    right={
                      <TextInput.Icon
                        icon={confirmSecureTextEntry ? "eye-off" : "eye"}
                        onPress={() =>
                          setConfirmSecureTextEntry(!confirmSecureTextEntry)
                        }
                      />
                    }
                    error={confirmMismatch}
                    textContentType="oneTimeCode"
                    autoCorrect={false}
                  />
                  {confirmMismatch && (
                    <HelperText type="error" style={styles.helperText}>
                      Passwords do not match
                    </HelperText>
                  )}
                </Animated.View>

                {/* Role Selection */}
                <Animated.View
                  style={[
                    styles.section,
                    { opacity: fade, transform: [{ translateY: slideY }] },
                  ]}
                >
                  <Text style={styles.sectionLabel}>I am a</Text>
                  <RadioButton.Group
                    onValueChange={(val) => {
                      setRole(val);
                      if (val !== "teacher") {
                        setSubject("");
                        setSubjectQuery("");
                        setSubjectTouched(false);
                      }
                    }}
                    value={role}
                  >
                    <View style={styles.radioContainer}>
                      {ROLES.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.radioCard,
                            role === r && styles.radioCardSelected,
                          ]}
                          onPress={() => {
                            setRole(r);
                            if (r !== "teacher") {
                              setSubject("");
                              setSubjectQuery("");
                              setSubjectTouched(false);
                            }
                          }}
                          activeOpacity={0.85}
                        >
                          <RadioButton value={r} color={C.primary} />
                          <Text style={styles.radioText}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </RadioButton.Group>
                </Animated.View>

                {/* Student fields */}
                {role === "student" && (
                  <Animated.View
                    style={[
                      styles.section,
                      { opacity: fade, transform: [{ translateY: slideY }] },
                    ]}
                  >
                    <Text style={styles.sectionLabel}>
                      Student's Academic Information
                    </Text>

                    <Pressable
                      onPress={() => setGradePickerOpen(true)}
                      accessibilityRole="button"
                    >
                      <TextInput
                        key="student-grade"
                        nativeID="student-grade"
                        placeholder={GRADE_PLACEHOLDER}
                        value={grade}
                        mode="outlined"
                        style={styles.input}
                        outlineColor={
                          !String(grade || "").trim() && gradeTouched
                            ? C.error
                            : EDU_COLORS.gray300
                        }
                        activeOutlineColor={
                          !String(grade || "").trim() && gradeTouched
                            ? C.error
                            : C.primary
                        }
                        theme={INPUT_THEME}
                        selectionColor={C.primary}
                        cursorColor={C.primary}
                        contentStyle={styles.inputContent}
                        editable={false}
                        left={<TextInput.Icon icon="school" size={20} />}
                        right={
                          <TextInput.Icon
                            icon="chevron-down"
                            onPress={() => setGradePickerOpen(true)}
                            forceTextInputFocus={false}
                          />
                        }
                      />
                    </Pressable>
                    {!String(grade || "").trim() && gradeTouched && (
                      <HelperText type="error" style={styles.helperText}>
                        Please select your grade
                      </HelperText>
                    )}

                    <Portal>
                      <Modal
                        visible={gradePickerOpen}
                        onDismiss={() => {
                          setGradePickerOpen(false);
                          if (!String(grade || "").trim())
                            setGradeTouched(true);
                        }}
                        contentContainerStyle={[
                          styles.modalContainer,
                          {
                            alignSelf: "center",
                            width: Math.min(screenWidth - 40, 520),
                          },
                        ]}
                      >
                        <View style={styles.modalHeader}>
                          <Text style={styles.modalTitle}>Select Grade</Text>
                        </View>
                        <Divider />

                        <ScrollView
                          style={styles.modalScrollView}
                          showsVerticalScrollIndicator
                          keyboardShouldPersistTaps="handled"
                        >
                          {GRADES.map((g) => (
                            <TouchableOpacity
                              key={g}
                              onPress={() => {
                                setGrade(g);
                                setGradePickerOpen(false);
                                if (gradeTouched) setGradeTouched(false);
                              }}
                              style={[
                                styles.subjectRow,
                                grade === g && styles.subjectRowSelected,
                              ]}
                              activeOpacity={0.85}
                            >
                              <Text
                                style={[
                                  styles.subjectRowText,
                                  grade === g && styles.subjectRowTextSelected,
                                ]}
                              >
                                Grade {g}
                              </Text>
                              {grade === g && (
                                <Text style={styles.checkmark}>✓</Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                          <Button
                            onPress={() => {
                              setGradePickerOpen(false);
                              if (!String(grade || "").trim())
                                setGradeTouched(true);
                            }}
                            mode="outlined"
                            style={styles.modalButton}
                            textColor={C.primary}
                          >
                            Cancel
                          </Button>
                          <Button
                            mode="contained"
                            onPress={() => {
                              setGradePickerOpen(false);
                              if (!String(grade || "").trim())
                                setGradeTouched(true);
                            }}
                            style={styles.modalButton}
                          >
                            Confirm
                          </Button>
                        </View>
                      </Modal>
                    </Portal>
                  </Animated.View>
                )}

                {/* Teacher fields */}
                {role === "teacher" && (
                  <Animated.View
                    style={[
                      styles.section,
                      { opacity: fade, transform: [{ translateY: slideY }] },
                    ]}
                  >
                    <Text style={styles.sectionLabel}>
                      Teaching Information
                    </Text>

                    <Pressable
                      onPress={() => setSubjectPickerOpen(true)}
                      accessibilityRole="button"
                    >
                      <TextInput
                        key="teacher-subject"
                        nativeID="teacher-subject"
                        placeholder={SUBJECT_PLACEHOLDER}
                        value={subject}
                        mode="outlined"
                        style={styles.input}
                        outlineColor={
                          subjectInvalidForTeacher
                            ? C.error
                            : EDU_COLORS.gray300
                        }
                        activeOutlineColor={
                          subjectInvalidForTeacher ? C.error : C.primary
                        }
                        theme={INPUT_THEME}
                        selectionColor={C.primary}
                        cursorColor={C.primary}
                        contentStyle={styles.inputContent}
                        editable={false}
                        left={
                          <TextInput.Icon icon="book-education" size={20} />
                        }
                        right={
                          <TextInput.Icon
                            icon="chevron-down"
                            onPress={() => setSubjectPickerOpen(true)}
                            forceTextInputFocus={false}
                          />
                        }
                      />
                    </Pressable>
                    {subjectInvalidForTeacher && (
                      <HelperText type="error" style={styles.helperText}>
                        Please select the teaching subject
                      </HelperText>
                    )}

                    <Portal>
                      <Modal
                        visible={subjectPickerOpen}
                        onDismiss={() => {
                          setSubjectPickerOpen(false);
                          if (!subject.trim()) setSubjectTouched(true);
                        }}
                        contentContainerStyle={[
                          styles.modalContainer,
                          {
                            alignSelf: "center",
                            width: Math.min(screenWidth - 40, 520),
                          },
                        ]}
                      >
                        <View style={styles.modalHeader}>
                          <Text style={styles.modalTitle}>
                            Select Teaching Subject
                          </Text>
                        </View>
                        <Divider />

                        <View style={styles.searchBar}>
                          <TextInput
                            key="teacher-subject-search"
                            mode="outlined"
                            placeholder="Search subjects…"
                            value={subjectQuery}
                            onChangeText={setSubjectQuery}
                            style={styles.searchInput}
                            outlineColor={EDU_COLORS.gray300}
                            activeOutlineColor={C.primary}
                            theme={{
                              ...INPUT_THEME,
                              colors: {
                                ...INPUT_THEME.colors,
                                text: EDU_COLORS.textPrimary,
                                placeholder: EDU_COLORS.textMuted,
                              },
                            }}
                            left={<TextInput.Icon icon="magnify" />}
                            textContentType="none"
                            autoComplete="off"
                            autoCorrect={false}
                          />
                        </View>

                        <ScrollView
                          style={styles.modalScrollView}
                          showsVerticalScrollIndicator
                          keyboardShouldPersistTaps="handled"
                        >
                          {filteredSubjects.map((s) => (
                            <TouchableOpacity
                              key={s}
                              onPress={() => {
                                setSubject(s);
                                setSubjectPickerOpen(false);
                                if (subjectTouched) setSubjectTouched(false);
                              }}
                              style={[
                                styles.subjectRow,
                                subject === s && styles.subjectRowSelected,
                              ]}
                              activeOpacity={0.85}
                            >
                              <Text
                                style={[
                                  styles.subjectRowText,
                                  subject === s &&
                                    styles.subjectRowTextSelected,
                                ]}
                              >
                                {s}
                              </Text>
                              {subject === s && (
                                <Text style={styles.checkmark}>✓</Text>
                              )}
                            </TouchableOpacity>
                          ))}
                          {filteredSubjects.length === 0 && (
                            <View style={{ padding: 20 }}>
                              <Text style={{ color: C.primary }}>
                                No subjects match your search.
                              </Text>
                            </View>
                          )}
                        </ScrollView>

                        <View style={styles.modalActions}>
                          <Button
                            onPress={() => {
                              setSubjectPickerOpen(false);
                              if (!subject.trim()) setSubjectTouched(true);
                            }}
                            mode="outlined"
                            style={styles.modalButton}
                            textColor={C.primary}
                          >
                            Cancel
                          </Button>
                          <Button
                            mode="contained"
                            onPress={() => {
                              setSubjectPickerOpen(false);
                              if (!subject.trim()) setSubjectTouched(true);
                            }}
                            style={styles.modalButton}
                          >
                            Confirm
                          </Button>
                        </View>
                      </Modal>
                    </Portal>
                  </Animated.View>
                )}

                {/* Parent fields */}
                {role === "parent" && (
                  <Animated.View
                    style={[
                      styles.section,
                      { opacity: fade, transform: [{ translateY: slideY }] },
                    ]}
                  >
                    <Text style={styles.sectionLabel}>
                      Link Student Account
                    </Text>
                    <HelperText type="info" style={styles.infoHelper}>
                      Connect to your child's existing EduLink account
                    </HelperText>

                    {/* STUDENT EMAIL — disable autofill to avoid mirroring */}
                    <TextInput
                      key="student-email"
                      nativeID="student-email"
                      placeholder="Student email (e.g., child.name@school.lk)"
                      value={studentEmail}
                      onChangeText={setStudentEmail}
                      mode="outlined"
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      outlineColor={EDU_COLORS.gray300}
                      activeOutlineColor={C.primary}
                      theme={INPUT_THEME}
                      selectionColor={C.primary}
                      cursorColor={C.primary}
                      contentStyle={styles.inputContent}
                      left={<TextInput.Icon icon="account-child" size={20} />}
                      // Critical: stop OS from pairing with the parent email field
                      textContentType="none"
                      autoComplete="off"
                      importantForAutofill="no"
                      autoCorrect={false}
                    />

                    <TextInput
                      key="student-pass"
                      nativeID="student-pass"
                      placeholder="Student password"
                      value={studentPassword}
                      onChangeText={setStudentPassword}
                      mode="outlined"
                      style={styles.input}
                      secureTextEntry
                      outlineColor={EDU_COLORS.gray300}
                      activeOutlineColor={C.primary}
                      theme={INPUT_THEME}
                      selectionColor={C.primary}
                      cursorColor={C.primary}
                      contentStyle={styles.inputContent}
                      left={<TextInput.Icon icon="lock" size={20} />}
                      textContentType="password"
                      autoComplete="password"
                      autoCorrect={false}
                    />
                    <HelperText type="info" style={styles.infoHelper}>
                      Used once to securely verify your child's account
                    </HelperText>
                  </Animated.View>
                )}

                {/* Submit Button */}
                <Animated.View
                  style={[
                    styles.buttonContainer,
                    {
                      opacity: fade,
                      transform: [{ translateY: slideY }, { scale: btnScale }],
                    },
                  ]}
                >
                  <Button
                    mode="contained"
                    onPress={onRegister}
                    loading={busy}
                    style={styles.button}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}
                    accessibilityLabel="Join EduLink"
                    disabled={busy}
                  >
                    {busy ? "Joining..." : "Join EduLink"}
                  </Button>
                </Animated.View>

                {/* Footer */}
                <Animated.View
                  style={[
                    styles.footerContainer,
                    { opacity: fade, transform: [{ translateY: slideY }] },
                  ]}
                >
                  <View style={styles.linksRow}>
                    <Text style={styles.footerText}>Already Joined?</Text>
                    <Button
                      mode="text"
                      onPress={() => navigation.replace("Login", {})}
                      textColor={C.primary}
                      compact
                      labelStyle={styles.link}
                      icon="arrow-right"
                    >
                      Start Learning
                    </Button>
                  </View>
                  <Text style={styles.microcopy}>
                    Secure by Firebase • Privacy-first
                  </Text>
                </Animated.View>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Snackbar */}
          <Snackbar
            visible={toastVisible}
            onDismiss={() => setToastVisible(false)}
            duration={4000}
            style={[
              styles.snackbar,
              {
                backgroundColor: toastType === "error" ? C.error : C.primary,
              },
            ]}
            accessibilityLiveRegion="polite"
            action={{
              label: "Dismiss",
              onPress: () => setToastVisible(false),
              textColor: C.white,
            }}
          >
            <Text style={styles.snackbarText}>{toastMessage}</Text>
          </Snackbar>
        </KeyboardAvoidingView>
      </View>
    </PaperProvider>
  );
}

/* --------------------------------- STYLES --------------------------------- */
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  kav: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20 },

  /* Card */
  card: {
    borderRadius: 24,
    backgroundColor: EDU_COLORS.surfaceSolid,
    borderWidth: 1,
    borderColor: EDU_COLORS.gray200,
    elevation: 8,
    shadowColor: EDU_COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    marginBottom: 0,
    overflow: "hidden",
  },
  formContainer: {
    flexGrow: 1,

    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  /* Header */
  headerContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  brandLogo: {
    width: 200,
    height: 200,
    marginBottom: 6,
    backgroundColor: "transparent", // supports transparent PNGs
  },
  appTitle: {
    color: EDU_COLORS.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  appTagline: {
    color: EDU_COLORS.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  /* Image */
  imageContainer: {
    alignItems: "center",
    marginBottom: 24,
    alignSelf: "center",
    position: "relative",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: EDU_COLORS.gray200,
    backgroundColor: "transparent",
  },
  imagePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: EDU_COLORS.gray300,
    borderStyle: "dashed",
    backgroundColor: EDU_COLORS.surface,
  },
  imagePlaceholderEmoji: { fontSize: 32, marginBottom: 6 },
  imageText: {
    fontSize: 14,
    color: EDU_COLORS.textSecondary,
    fontWeight: "600",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: EDU_COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: EDU_COLORS.surfaceSolid,
  },
  imageOverlayText: { fontSize: 16, color: "#FFFFFF" },

  /* Sections */
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: EDU_COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  /* Inputs */
  input: {
    marginBottom: 14,
    borderRadius: 16,
    height: 56,
    backgroundColor: EDU_COLORS.surfaceSolid,
  },
  inputContent: {
    color: EDU_COLORS.textPrimary,
    fontSize: 16,
    textAlignVertical: "center",
  },

  /* Helpers */
  helperText: {
    fontSize: 13,
    marginTop: -6,
    marginBottom: 8,
    color: C.error,
  },
  infoHelper: {
    fontSize: 13,
    color: EDU_COLORS.textSecondary,
    marginBottom: 10,
  },
  passwordHint: {
    fontSize: 13,
    color: EDU_COLORS.textMuted,
    marginTop: -6,
    marginBottom: 10,
    fontStyle: "italic",
  },

  /* Role selector */
  radioContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  radioCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: EDU_COLORS.gray200,
    backgroundColor: EDU_COLORS.surfaceSolid,
  },
  radioCardSelected: {
    borderColor: C.primary,
  },
  radioText: {
    fontSize: 14,
    fontWeight: "600",
    color: EDU_COLORS.textPrimary,
    marginLeft: 4,
  },

  /* Modal */
  modalContainer: {
    borderRadius: 20,
    backgroundColor: C.base,
    paddingVertical: 0,
    maxHeight: "75%",
    elevation: 24,
    shadowColor: EDU_COLORS.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  modalHeader: { padding: 20, paddingBottom: 12 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.primary,
    textAlign: "center",
  },
  searchBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  searchInput: {
    height: 46,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.surfaceSolid,
  },
  modalScrollView: { maxHeight: 320 },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: EDU_COLORS.gray200,
    backgroundColor: EDU_COLORS.surfaceSolid,
  },
  subjectRowSelected: { backgroundColor: C.secondary },
  subjectRowText: { fontSize: 16, color: C.primary, flex: 1 },
  subjectRowTextSelected: { color: EDU_COLORS.textPrimary, fontWeight: "600" },
  checkmark: { fontSize: 18, color: C.primary, fontWeight: "bold" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 20,
    paddingTop: 12,
  },
  modalButton: { minWidth: 100 },

  /* CTA */
  buttonContainer: { marginTop: 4, marginBottom: 16 },
  button: {
    borderRadius: 20,
    backgroundColor: C.primary,
  },
  buttonContent: { height: 58 },
  buttonLabel: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },

  /* Footer */
  footerContainer: { alignItems: "center", marginTop: 4 },
  linksRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  footerText: { color: EDU_COLORS.textSecondary, fontSize: 14 },
  link: { fontWeight: "700", fontSize: 14 },
  microcopy: {
    textAlign: "center",
    fontSize: 12,
    color: EDU_COLORS.textMuted,
  },

  /* Snackbar */
  snackbar: { borderRadius: 14, marginHorizontal: 16, marginBottom: 20 },
  snackbarText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
});
