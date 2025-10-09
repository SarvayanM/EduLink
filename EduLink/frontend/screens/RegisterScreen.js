import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { auth, db } from "../services/firebaseAuth";
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

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

/* ---- Palette shortcuts ---- */
const C = {
  primary: EDU_COLORS.primary,
  secondary: EDU_COLORS.secondary,
  base: EDU_COLORS.base,
  white: "#FFFFFF",
  error: EDU_COLORS.error,
  placeholder: "rgba(255,255,255,0.72)",
  label: "rgba(255,255,255,0.82)",
};

/* ---- Paper theme (surfaces transparent so our glass cards pop) ---- */
const paperTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    background: "transparent",
    surface: "transparent",
    text: C.white,
  },
};

/* ---- Unified input theme (placeholder-only) ---- */
const INPUT_THEME = {
  roundness: 16,
  colors: {
    primary: C.white, // focus/outline
    onSurfaceVariant: C.placeholder, // helper/guide tones
    outline: "rgba(255,255,255,0.35)",
    outlineVariant: "rgba(255,255,255,0.2)",
    placeholder: C.placeholder,
    text: C.white,
    background: "transparent",
    surface: "transparent",
  },
};

const ROLES = ["student", "teacher", "parent"];
const GRADES_LIST = ["6", "7", "8", "9", "10", "11", "12", "13"];
const GRADE_PLACEHOLDER = "Select grade (6–13)";

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
  "Entrepreneurship and Financial Literacy",
  "Accounting",
  "Business Studies",
  "Economics",
  "Business Statistics",
  "Political Science",
  "Logic and Scientific Method",
  "Mass Media and Communication Studies",
  "Home Economics",
  "Biology",
  "Chemistry",
  "Physics",
  "Combined Mathematics",
];

export default function RegisterScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const GRADES = useMemo(() => GRADES_LIST, []);

  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("student");
  const [grade, setGrade] = useState("6");
  const [gradePickerOpen, setGradePickerOpen] = useState(false);
  const [gradeTouched, setGradeTouched] = useState(false);

  // Subject picker
  const SUBJECT_PLACEHOLDER = "Select teaching subject";
  const [subject, setSubject] = useState("");
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [subjectQuery, setSubjectQuery] = useState("");

  // Email & passwords
  const [email, setEmail] = useState("");
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

  // Animations (kept for polish)
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
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

  // Image Picker permission
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

  // Toast
  const showToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

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
        showToast("Profile picture added successfully!");
      }
    } catch {
      showToast("Failed to pick image", "error");
    }
  };

  // Button press animations
  const onPressIn = () =>
    Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

  // Validation helpers
  async function validateStudent(email, password) {
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", email.trim()),
        where("role", "==", "student")
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return false;
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await signOut(auth);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Derived flags
  const confirmMismatch =
    confirmTouched &&
    confirmPassword.length > 0 &&
    confirmPassword !== password;

  const subjectInvalidForTeacher =
    role === "teacher" && subjectTouched && !subject.trim();

  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

  // Filtered subject list (search)
  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return sriLankaSchoolSubjects;
    return sriLankaSchoolSubjects.filter((s) => s.toLowerCase().includes(q));
  }, [subjectQuery]);

  // Registration handler
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

  // Role-aware placeholder examples
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
      <StatusBar translucent barStyle="light-content" />
      <View style={styles.root}>
        {/* Breadcrumb sits above — nudge header a bit lower */}

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
                paddingTop: Math.max(insets.top + 12, 24),
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
              <Card.Content>
                {/* Header */}
                <Animated.View
                  style={[
                    styles.headerContainer,
                    {
                      transform: [
                        { scale: logoScale },
                        { rotate: logoRotation },
                      ],
                      marginTop: 8,
                    },
                  ]}
                >
                  <View style={styles.logoContainer}>
                    <Text style={styles.appTitle} accessibilityRole="header">
                      🎓 EduLink
                    </Text>
                  </View>
                  <Text style={styles.appTagline}>
                    Join our educational community
                  </Text>
                </Animated.View>

                {/* Profile Image Picker */}
                <Pressable style={styles.imageContainer} onPress={pickImage}>
                  {profileImage ? (
                    <Image
                      source={{ uri: profileImage }}
                      style={styles.profileImage}
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
                    placeholder={namePlaceholder}
                    value={displayName}
                    onChangeText={setDisplayName}
                    mode="outlined"
                    style={styles.input}
                    outlineColor="rgba(255,255,255,0.35)"
                    activeOutlineColor={C.white}
                    theme={INPUT_THEME}
                    selectionColor={C.white}
                    cursorColor={C.white}
                    contentStyle={styles.inputContent}
                    left={
                      <TextInput.Icon
                        icon="account"
                        size={20}
                        color={C.placeholder}
                      />
                    }
                  />

                  <TextInput
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
                    outlineColor={
                      emailError ? C.error : "rgba(255,255,255,0.35)"
                    }
                    activeOutlineColor={C.white}
                    theme={INPUT_THEME}
                    selectionColor={C.white}
                    cursorColor={C.white}
                    contentStyle={styles.inputContent}
                    left={
                      <TextInput.Icon
                        icon="email"
                        size={20}
                        color={C.placeholder}
                      />
                    }
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
                    placeholder="Create a strong password"
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => {
                      if (confirmPassword) setConfirmTouched(true);
                    }}
                    mode="outlined"
                    style={styles.input}
                    secureTextEntry={secureTextEntry}
                    outlineColor="rgba(255,255,255,0.35)"
                    activeOutlineColor={C.white}
                    theme={INPUT_THEME}
                    selectionColor={C.white}
                    cursorColor={C.white}
                    contentStyle={styles.inputContent}
                    left={
                      <TextInput.Icon
                        icon="lock"
                        size={20}
                        color={C.placeholder}
                      />
                    }
                    right={
                      <TextInput.Icon
                        icon={secureTextEntry ? "eye-off" : "eye"}
                        onPress={() => setSecureTextEntry(!secureTextEntry)}
                        color={C.placeholder}
                      />
                    }
                  />

                  <Text style={styles.passwordHint}>
                    Must include uppercase, lowercase, number & special
                    character (min 8 characters)
                  </Text>

                  <TextInput
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onBlur={() => setConfirmTouched(true)}
                    mode="outlined"
                    style={styles.input}
                    secureTextEntry={confirmSecureTextEntry}
                    outlineColor={
                      confirmMismatch ? C.error : "rgba(255,255,255,0.35)"
                    }
                    activeOutlineColor={C.white}
                    theme={INPUT_THEME}
                    selectionColor={C.white}
                    cursorColor={C.white}
                    contentStyle={styles.inputContent}
                    left={
                      <TextInput.Icon
                        icon="lock-check"
                        size={20}
                        color={C.placeholder}
                      />
                    }
                    right={
                      <TextInput.Icon
                        icon={confirmSecureTextEntry ? "eye-off" : "eye"}
                        onPress={() =>
                          setConfirmSecureTextEntry(!confirmSecureTextEntry)
                        }
                        color={C.placeholder}
                      />
                    }
                    error={confirmMismatch}
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
                          <RadioButton value={r} color={C.white} />
                          <Text style={styles.radioText}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </RadioButton.Group>
                </Animated.View>

                {/* Role-specific Fields */}
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
                        placeholder={GRADE_PLACEHOLDER}
                        value={grade}
                        mode="outlined"
                        style={styles.input}
                        outlineColor={
                          !String(grade || "").trim() && gradeTouched
                            ? C.error
                            : "rgba(255,255,255,0.35)"
                        }
                        activeOutlineColor={C.white}
                        theme={INPUT_THEME}
                        selectionColor={C.white}
                        cursorColor={C.white}
                        contentStyle={styles.inputContent}
                        editable={false}
                        left={
                          <TextInput.Icon
                            icon="school"
                            size={20}
                            color={C.placeholder}
                          />
                        }
                        right={
                          <TextInput.Icon
                            icon="chevron-down"
                            color={C.placeholder}
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
                            buttonColor={C.secondary}
                            textColor="#FFFFFF"
                          >
                            Confirm
                          </Button>
                        </View>
                      </Modal>
                    </Portal>
                  </Animated.View>
                )}

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
                        placeholder={SUBJECT_PLACEHOLDER}
                        value={subject}
                        mode="outlined"
                        style={styles.input}
                        outlineColor={
                          subjectInvalidForTeacher
                            ? C.error
                            : "rgba(255,255,255,0.35)"
                        }
                        activeOutlineColor={C.white}
                        theme={INPUT_THEME}
                        selectionColor={C.white}
                        cursorColor={C.white}
                        contentStyle={styles.inputContent}
                        editable={false}
                        left={
                          <TextInput.Icon
                            icon="book-education"
                            size={20}
                            color={C.placeholder}
                          />
                        }
                        right={
                          <TextInput.Icon
                            icon="chevron-down"
                            color={C.placeholder}
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
                            mode="outlined"
                            placeholder="Search subjects…"
                            value={subjectQuery}
                            onChangeText={setSubjectQuery}
                            style={styles.searchInput}
                            outlineColor={C.primary + "40"}
                            activeOutlineColor={C.primary}
                            theme={{
                              ...INPUT_THEME,
                              colors: {
                                ...INPUT_THEME.colors,
                                text: EDU_COLORS.textPrimary,
                                placeholder: "#94A3B8",
                              },
                            }}
                            left={<TextInput.Icon icon="magnify" />}
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
                              <Text style={{ color: C.primary + "CC" }}>
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
                            buttonColor={C.secondary}
                            textColor="#FFFFFF"
                          >
                            Confirm
                          </Button>
                        </View>
                      </Modal>
                    </Portal>
                  </Animated.View>
                )}

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

                    <TextInput
                      placeholder="Student email (e.g., child.name@school.lk)"
                      value={studentEmail}
                      onChangeText={setStudentEmail}
                      mode="outlined"
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      outlineColor="rgba(255,255,255,0.35)"
                      activeOutlineColor={C.white}
                      theme={INPUT_THEME}
                      selectionColor={C.white}
                      cursorColor={C.white}
                      contentStyle={styles.inputContent}
                      left={
                        <TextInput.Icon
                          icon="account-child"
                          size={20}
                          color={C.placeholder}
                        />
                      }
                    />
                    <TextInput
                      placeholder="Student password"
                      value={studentPassword}
                      onChangeText={setStudentPassword}
                      mode="outlined"
                      style={styles.input}
                      secureTextEntry
                      outlineColor="rgba(255,255,255,0.35)"
                      activeOutlineColor={C.white}
                      theme={INPUT_THEME}
                      selectionColor={C.white}
                      cursorColor={C.white}
                      contentStyle={styles.inputContent}
                      left={
                        <TextInput.Icon
                          icon="lock"
                          size={20}
                          color={C.placeholder}
                        />
                      }
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
                    buttonColor={C.secondary}
                    textColor="#FFFFFF"
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
                    <Text style={{ color: "#EAF8FF" }}>Already Joined?</Text>
                    <Button
                      mode="text"
                      onPress={() => navigation.replace("Login", {})}
                      textColor="#066A76"
                      compact
                      labelStyle={styles.link}
                    >
                      Start Learning
                    </Button>
                  </View>
                  <Text style={styles.microcopy}>
                    Secure by Firebase • Privacy-first
                  </Text>
                </Animated.View>
              </Card.Content>
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
                backgroundColor: toastType === "error" ? C.error : C.secondary,
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Solid brand background (gradient removed)
    backgroundColor: "transparent",
  },

  kav: { flex: 1 },
  scrollView: { flex: 1 },

  content: {
    paddingHorizontal: 20,
  },

  // Breadcrumb-style back (sits above header; header is nudged down a bit)
  breadcrumbBack: {
    marginTop: 40,
    marginLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#EAF8FF22",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  breadcrumbBackIcon: {
    fontSize: 18,
    color: "#EAF8FF",
    fontWeight: "700",
    marginRight: 4,
  },
  breadcrumbBackText: {
    fontSize: 15,
    color: "#EAF8FF",
    fontWeight: "700",
  },

  // Card “glass” container
  card: {
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
  },

  // Header
  headerContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoContainer: { marginBottom: 8 },
  appTitle: {
    color: C.white,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appTagline: {
    color: C.label,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // Image
  imageContainer: {
    alignItems: "center",
    marginBottom: 28,
    alignSelf: "center",
    position: "relative",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  imagePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderStyle: "dashed",
  },
  imagePlaceholderEmoji: { fontSize: 32, marginBottom: 6 },
  imageText: {
    fontSize: 14,
    color: C.white,
    fontWeight: "600",
    opacity: 0.9,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: C.secondary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  imageOverlayText: { fontSize: 16, color: C.white },

  // Sections
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: C.white,
    letterSpacing: -0.2,
  },

  // Inputs
  input: {
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    height: 56,
  },
  inputContent: {
    color: C.white,
    fontSize: 16,
    textAlignVertical: "center",
  },

  // Helpers
  helperText: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
    color: C.error,
  },
  infoHelper: {
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    marginBottom: 12,
  },
  passwordHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
    marginTop: -8,
    marginBottom: 12,
    fontStyle: "italic",
  },

  // Role selector
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
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  radioCardSelected: {
    borderColor: C.white,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  radioText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.white,
    marginLeft: 4,
  },

  // Modal
  modalContainer: {
    borderRadius: 20,
    backgroundColor: C.base,
    paddingVertical: 0,
    maxHeight: "75%",
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
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
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
    borderRadius: 12,
  },
  modalScrollView: { maxHeight: 320 },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  subjectRowSelected: { backgroundColor: C.secondary + "20" },
  subjectRowText: { fontSize: 16, color: C.primary, flex: 1 },
  subjectRowTextSelected: { color: C.secondary, fontWeight: "600" },
  checkmark: { fontSize: 18, color: C.secondary, fontWeight: "bold" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 20,
    paddingTop: 12,
  },
  modalButton: { minWidth: 100 },

  // Button
  buttonContainer: { marginTop: 8, marginBottom: 16 },
  button: {
    borderRadius: 20,
  },
  buttonContent: { height: 58 },
  buttonLabel: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: C.white,
  },

  // Footer
  footerContainer: { alignItems: "center", marginTop: 8 },
  linksRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  footerText: { color: "#EAF8FF", opacity: 0.9, fontSize: 14 },
  link: { fontWeight: "700", fontSize: 14 },
  microcopy: {
    textAlign: "center",
    fontSize: 12,
    color: C.white,
    opacity: 0.7,
  },

  // Snackbar
  snackbar: { borderRadius: 14, marginHorizontal: 16, marginBottom: 20 },
  snackbarText: { color: C.white, fontWeight: "600", fontSize: 14 },
});
