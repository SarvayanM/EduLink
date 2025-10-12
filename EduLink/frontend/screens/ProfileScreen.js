// --- ProfileScreen.js (cleaned & validated; no style or logic changes) ---
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Animated,
} from "react-native";
import {
  Button,
  TextInput,
  HelperText,
  Divider,
  ActivityIndicator,
} from "react-native-paper";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import {
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile as fbUpdateProfile,
} from "firebase/auth";
import { auth, db } from "../services/firebaseAuth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
// If you upload to Storage, wire these (left as-is from your code comments)
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { BlurView } from "expo-blur";
import {
  EDU_COLORS,
  Surfaces,
  Buttons, // (unused in this file — left untouched)
} from "../theme/colors";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";
import { calculateUserStats } from "../utils/userStatsCalculator";

/* ---------- Constants ---------- */
const SUBJECTS = [
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
const GRADES = ["6", "7", "8", "9", "10", "11", "12", "13"];
const PAGE_TOP_OFFSET = 8;
/* ---------- Toast: always from top, above navbar & modals ---------- */
function useToast() {
  const insets = useSafeAreaInsets();
  const topOffset = (insets?.top || 0) + (NAVBAR_HEIGHT || 0) + 8;

  return React.useCallback(
    (type, text1, text2) => {
      Toast.show({
        type, // 'success' | 'error' | 'info'
        text1,
        text2,
        position: "top",
        topOffset:
          topOffset || Platform.select({ ios: 48, android: 28, default: 32 }),
        visibilityTime: 3200,
        props: {
          style: { zIndex: 20000, elevation: 20000 },
        },
      });
    },
    [topOffset]
  );
}

/* ---------- Reusable Blur Card (kept exactly as in your styles usage) ---------- */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

/* ---------- Simple validators (role-aware) ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateProfileFields(role, { name, grade, subject, studentEmail }) {
  const errors = {};

  // Name: required, min 3
  if (!name || name.trim().length < 3) {
    errors.name = "Full name must be at least 3 characters.";
  }

  if (role === "student") {
    if (!grade) {
      errors.grade = "Please select your grade.";
    } else if (!GRADES.includes(String(grade))) {
      errors.grade = "Invalid grade selected.";
    }
  }

  if (role === "teacher") {
    const sub = (subject || "").trim();
    if (!sub) {
      errors.subject = "Please select your teaching subject.";
    } else if (!SUBJECTS.includes(sub)) {
      // Keep subject constrained to the list to match your UI intent
      errors.subject = "Select a subject from the list.";
    }
  }

  if (role === "parent") {
    const email = (studentEmail || "").trim();
    if (!email) {
      errors.studentEmail = "Please enter your child's email.";
    } else if (!EMAIL_RE.test(email)) {
      errors.studentEmail = "Please enter a valid email address.";
    }
  }

  return errors;
}

const strongPass = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

/* ======================= Component ======================= */
export default function ProfileScreen({ navigation }) {
  const showToast = useToast();

  const [userProfile, setUserProfile] = useState({});
  const [loading, setLoading] = useState(true);

  // Update Profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Editable fields (initialized when opening modal)
  const [updName, setUpdName] = useState("");
  const [updGrade, setUpdGrade] = useState("");
  const [updSubject, setUpdSubject] = useState("");
  const [updStudentEmail, setUpdStudentEmail] = useState("");
  const [subjectQuery, setSubjectQuery] = useState("");
  const [editImageUri, setEditImageUri] = useState(null);

  // Password fields (inside update modal)
  const [curPassword, setCurPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");

  // UI/validation helpers
  const [touched, setTouched] = useState({
    name: false,
    grade: false,
    subject: false,
    studentEmail: false,
  });

  const barAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(barAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading, barAnim]);

  // Interpolate to slide the bar from left to right
  const barTranslate = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 280], // will be clamped by container width; feels smooth on phones & tablets
  });

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return SUBJECTS;
    return SUBJECTS.filter((s) => s.toLowerCase().includes(q));
  }, [subjectQuery]);

  const [childData, setChildData] = useState(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchChildData = async (parentData) => {
    try {
      if (!parentData?.studentEmail) return null;
      const studentsQuery = query(
        collection(db, "users"),
        where("email", "==", parentData.studentEmail),
        where("role", "in", ["student", "tutor"])
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      if (!studentsSnapshot.empty) {
        const childDoc = studentsSnapshot.docs[0];
        return { id: childDoc.id, ...childDoc.data() };
      }
      return null;
    } catch {
      showToast("error", "Failed to load student", "Please try again later.");
      return null;
    }
  };

  const fetchUserProfile = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.role !== "parent") {
            const stats = await calculateUserStats(user.uid);
            setUserProfile({
              ...data,
              questionsCount: stats.questionsAsked,
              answersCount: stats.answersGiven,
              points: data.points || 0,
            });
            setChildData(null);
          } else {
            const child = await fetchChildData(data);
            setChildData(child);
            setUserProfile({
              ...data,
              questionsCount: 0,
              answersCount: 0,
              points: 0,
            });
          }
        }
      }
    } catch {
      showToast("error", "Failed to load profile", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openEditProfile = () => {
    setUpdName(userProfile.displayName || "");
    setUpdGrade(userProfile.grade ? String(userProfile.grade) : "");
    setUpdSubject(userProfile.subject || "");
    setUpdStudentEmail(userProfile.studentEmail || "");
    setEditImageUri(userProfile.profileImage || null);

    setCurPassword("");
    setNewPassword("");
    setConfirmNew("");
    setSubjectQuery("");

    setTouched({
      name: false,
      grade: false,
      subject: false,
      studentEmail: false,
    });

    setEditOpen(true);
  };

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!res.canceled && res.assets?.length) {
        setEditImageUri(res.assets[0].uri);
        showToast("success", "Photo selected");
      }
    } catch {
      showToast("error", "Image picker failed", "Please try again.");
    }
  };

  /* ----------------- Update Profile (role-aware fields) ----------------- */
  const saveProfile = async () => {
    const role = userProfile.role;

    // Validate
    const errors = validateProfileFields(role, {
      name: updName,
      grade: updGrade,
      subject: updSubject,
      studentEmail: updStudentEmail,
    });

    if (Object.keys(errors).length) {
      // mark touched and show the first error via toast
      setTouched((t) => ({
        ...t,
        name: t.name || !!errors.name,
        grade: t.grade || !!errors.grade,
        subject: t.subject || !!errors.subject,
        studentEmail: t.studentEmail || !!errors.studentEmail,
      }));

      const firstMsg =
        errors.name ||
        errors.grade ||
        errors.subject ||
        errors.studentEmail ||
        "Please fix the errors";
      showToast("error", "Validation error", firstMsg);
      return;
    }

    setSavingProfile(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        showToast("error", "Session error", "Please re-login and try again.");
        setSavingProfile(false);
        return;
      }

      const payload = {
        displayName: updName.trim(),
      };
      if (role === "student") payload.grade = updGrade;
      if (role === "teacher") payload.subject = updSubject.trim();
      if (role === "parent") payload.studentEmail = updStudentEmail.trim();

      // If you later enable Storage uploads, keep your scaffold here (unchanged).
      // if (editImageUri && editImageUri.startsWith("file://")) { ... }

      await updateDoc(doc(db, "users", uid), payload);

      try {
        await fbUpdateProfile(auth.currentUser, {
          displayName: updName.trim(),
        });
      } catch {
        // silent — not critical
      }

      await fetchUserProfile();
      showToast("success", "Profile updated");
      setEditOpen(false);
    } catch {
      showToast("error", "Update failed", "Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  /* ----------------- Change Password ----------------- */
  const savePassword = async () => {
    const cur = (curPassword || "").trim();
    const nxt = (newPassword || "").trim();
    const conf = (confirmNew || "").trim();

    if (!cur || !nxt || !conf) {
      showToast("error", "Enter current, new, and confirm password");
      return;
    }
    if (nxt !== conf) {
      showToast("error", "Passwords do not match");
      return;
    }
    if (!strongPass.test(nxt)) {
      showToast(
        "error",
        "Weak password",
        "Use 8+ chars with upper/lower/number/symbol."
      );
      return;
    }

    setSavingPassword(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) {
        showToast("error", "Session error", "Please re-login and try again.");
        setSavingPassword(false);
        return;
      }
      const cred = EmailAuthProvider.credential(user.email, cur);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, nxt);

      setCurPassword("");
      setNewPassword("");
      setConfirmNew("");

      showToast("success", "Password changed successfully");
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/wrong-password") {
        showToast("error", "Current password is incorrect");
      } else if (code === "auth/weak-password") {
        showToast("error", "Weak password", "Try a stronger password.");
      } else {
        showToast("error", "Password update failed", "Please try again.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  /* ----------------- Logout ----------------- */
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut(auth);
      showToast("success", "Logged out", "You’ve been signed out.");
    } catch {
      showToast("error", "Logout failed", "Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const role = userProfile.role;
  const roleLabel =
    role === "parent"
      ? "PARENT"
      : userProfile.points >= 200 && role === "student"
      ? "TUTOR"
      : (role || "user").toUpperCase();

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Inline loading (no overlay) */}
        {loading && (
          <View style={styles.loadingCenterWrap}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={EDU_COLORS.primary} />
              <Text style={styles.loadingTitle}>Loading Your Profile</Text>
              <Text style={styles.loadingSubtitle}>
                Fetching Stats and Settings …
              </Text>

              {/* Indeterminate progress bar */}
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { transform: [{ translateX: barTranslate }] },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Header */}
        <View style={[styles.chatBubble, styles.centered]}>
          <View style={styles.profileImageContainer}>
            {userProfile.profileImage ? (
              <Image
                source={{ uri: userProfile.profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View
                style={[
                  styles.defaultAvatar,
                  { backgroundColor: EDU_COLORS.primary },
                ]}
              >
                <Text style={styles.avatarText}>
                  {userProfile.displayName?.charAt(0) || "U"}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.userName}>
            {userProfile.displayName || "User"}
          </Text>
          <Text style={styles.userEmail}>{userProfile.email}</Text>

          <View
            style={[
              styles.roleTag,
              {
                backgroundColor: EDU_COLORS.primary,
                borderColor: Surfaces.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>

        {/* Profile Details */}
        <BlurCard style={[styles.chatBubble]}>
          <Text style={styles.sectionTitle}>Profile Details</Text>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Full Name</Text>
            <Text style={styles.detailValue}>
              {userProfile.displayName || "Not set"}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{userProfile.email}</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Role</Text>
            <Text style={styles.detailValue}>
              {(() => {
                const base =
                  role === "parent"
                    ? "parent"
                    : userProfile.points >= 200 && role === "student"
                    ? "tutor"
                    : role || "Not set";
                if (!base || base === "Not set") return base;
                return base.charAt(0).toUpperCase() + base.slice(1);
              })()}
            </Text>
          </View>

          {userProfile.grade && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Grade</Text>
              <Text style={styles.detailValue}>Grade {userProfile.grade}</Text>
            </View>
          )}

          {userProfile.subject && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Subject</Text>
              <Text style={styles.detailValue}>{userProfile.subject}</Text>
            </View>
          )}

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Member Since</Text>
            <Text style={styles.detailValue}>
              {userProfile.createdAt?.toDate?.()?.toLocaleDateString() ||
                "Unknown"}
            </Text>
          </View>
        </BlurCard>

        {/* Parent → Student Details */}
        {role === "parent" && childData && (
          <BlurCard style={[styles.chatBubble]}>
            <Text style={styles.sectionTitle}>Student Details</Text>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Student Name</Text>
              <Text style={styles.detailValue}>
                {childData.displayName || "Not set"}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Student Email</Text>
              <Text style={styles.detailValue}>{childData.email}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Grade</Text>
              <Text style={styles.detailValue}>Grade {childData.grade}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Points</Text>
              <Text style={styles.detailValue}>{childData.points || 0}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Level</Text>
              <Text style={styles.detailValue}>
                {Math.floor((childData.points || 0) / 200) + 1}
              </Text>
            </View>
          </BlurCard>
        )}

        {/* Non-parent → Stats */}
        {role !== "parent" && (
          <BlurCard style={[styles.chatBubble]}>
            <Text style={styles.sectionTitle}>My Stats</Text>
            <View className="statsGrid" style={styles.statsGrid}>
              <View
                style={[
                  styles.statCard,
                  { borderColor: Surfaces.border, borderWidth: 1 },
                ]}
              >
                <Text style={styles.statNumber}>{userProfile.points || 0}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { borderColor: Surfaces.border, borderWidth: 1 },
                ]}
              >
                <Text style={styles.statNumber}>
                  {userProfile.questionsCount || 0}
                </Text>
                <Text style={styles.statLabel}>Questions</Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { borderColor: Surfaces.border, borderWidth: 1 },
                ]}
              >
                <Text style={styles.statNumber}>
                  {userProfile.answersCount || 0}
                </Text>
                <Text style={styles.statLabel}>Answers</Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { borderColor: Surfaces.border, borderWidth: 1 },
                ]}
              >
                <Text style={styles.statNumber}>
                  {Math.floor((userProfile.points || 0) / 200) + 1}
                </Text>
                <Text style={styles.statLabel}>Level</Text>
              </View>
            </View>
          </BlurCard>
        )}

        {/* Actions */}
        <View style={[styles.actionsSection, { paddingHorizontal: 16 }]}>
          <Button mode="outlined" onPress={openEditProfile}>
            Edit Profile
          </Button>
          <Button
            mode="contained"
            onPress={handleLogout}
            loading={loggingOut}
            style={styles.logoutButton}
          >
            Logout
          </Button>
        </View>
      </ScrollView>

      {/* ===================== UPDATE PROFILE MODAL ===================== */}
      <Modal
        visible={editOpen}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalOverlay} pointerEvents="auto">
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Profile</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setEditOpen(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Photo */}
              <View style={styles.modalPhotoRow}>
                <Pressable onPress={pickImage} style={styles.modalPhoto}>
                  {editImageUri ? (
                    <Image
                      source={{ uri: editImageUri }}
                      style={styles.modalProfileImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.modalDefaultAvatar,
                        { backgroundColor: EDU_COLORS.primary },
                      ]}
                    >
                      <Text style={styles.modalAvatarText}>
                        {(updName || userProfile.displayName || "U").charAt(0)}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Button mode="outlined" onPress={pickImage}>
                  Change Photo
                </Button>
              </View>

              {/* Common: Full Name */}
              <TextInput
                label="Full Name"
                mode="outlined"
                value={updName}
                onChangeText={(v) => {
                  setUpdName(v);
                  if (!touched.name) return;
                }}
                style={styles.modalInput}
                error={touched.name && !(updName || "").trim()}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
              {touched.name && !(updName || "").trim() && (
                <HelperText type="error">Full name is required</HelperText>
              )}

              {/* Role-specific fields */}
              {role === "student" && (
                <>
                  <TextInput
                    label="Grade"
                    mode="outlined"
                    value={updGrade}
                    onFocus={() => {
                      if (!updGrade) setUpdGrade(GRADES[0]);
                    }}
                    right={<TextInput.Icon icon="chevron-down" />}
                    onPressIn={() => {}}
                    style={styles.modalInput}
                    error={touched.grade && !updGrade}
                    placeholder="Select grade (6–13)"
                    onBlur={() => setTouched((t) => ({ ...t, grade: true }))}
                  />
                  <View style={styles.gradeRow}>
                    {GRADES.map((g) => (
                      <Pressable
                        key={g}
                        onPress={() => setUpdGrade(g)}
                        style={[
                          styles.gradePill,
                          updGrade === g && styles.gradePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.gradePillText,
                            updGrade === g && styles.gradePillTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {touched.grade && !updGrade && (
                    <HelperText type="error">
                      Please select your grade
                    </HelperText>
                  )}
                </>
              )}

              {role === "teacher" && (
                <>
                  <TextInput
                    label="Subject"
                    mode="outlined"
                    value={updSubject}
                    onFocus={() => setSubjectQuery("")}
                    style={styles.modalInput}
                    error={touched.subject && !(updSubject || "").trim()}
                    placeholder="Select teaching subject"
                    onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
                  />
                  <TextInput
                    mode="outlined"
                    value={subjectQuery}
                    onChangeText={setSubjectQuery}
                    placeholder="Search subjects…"
                    style={styles.modalInput}
                  />
                  <View style={styles.subjectList}>
                    {filteredSubjects.slice(0, 8).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setUpdSubject(s)}
                        style={[
                          styles.subjectPill,
                          updSubject === s && styles.subjectPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.subjectPillText,
                            updSubject === s && styles.subjectPillTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {touched.subject && !(updSubject || "").trim() && (
                    <HelperText type="error">
                      Please select the teaching subject
                    </HelperText>
                  )}
                </>
              )}

              {role === "parent" && (
                <>
                  <TextInput
                    label="Student Email"
                    mode="outlined"
                    value={updStudentEmail}
                    onChangeText={setUpdStudentEmail}
                    style={styles.modalInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={
                      touched.studentEmail && !(updStudentEmail || "").trim()
                    }
                    placeholder="child.name@school.lk"
                    onBlur={() =>
                      setTouched((t) => ({ ...t, studentEmail: true }))
                    }
                  />
                  {touched.studentEmail && !(updStudentEmail || "").trim() && (
                    <HelperText type="error">
                      Please enter your child's email
                    </HelperText>
                  )}
                </>
              )}

              {/* Actions: Update Profile */}
              <View style={styles.modalActionsRow}>
                <Button
                  mode="contained"
                  onPress={saveProfile}
                  loading={savingProfile}
                  style={styles.saveButton}
                >
                  Update Profile
                </Button>
                <Button mode="outlined" onPress={() => setEditOpen(false)}>
                  Close
                </Button>
              </View>

              <Divider style={{ marginVertical: 16 }} />

              {/* Change Password */}
              <Text style={styles.sectionTitle}>Change Password</Text>
              <TextInput
                label="Current Password"
                mode="outlined"
                secureTextEntry
                value={curPassword}
                onChangeText={setCurPassword}
                style={styles.modalInput}
              />
              <TextInput
                label="New Password"
                mode="outlined"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.modalInput}
                placeholder="Min 8 chars, upper/lower/number/symbol"
              />
              <TextInput
                label="Confirm New Password"
                mode="outlined"
                secureTextEntry
                value={confirmNew}
                onChangeText={setConfirmNew}
                style={styles.modalInput}
              />
              <View style={styles.modalActionsRow}>
                <Button
                  mode="contained"
                  onPress={savePassword}
                  loading={savingPassword}
                >
                  Change Password
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
        <Toast position="top" />
      </Modal>
    </View>
  );
}

/* ========= Styles =========
   NOTE: Your existing styles object (`styles`) is assumed to be present.
   Per your instruction, no style changes were made.
*/

/* ============================ Styles ============================ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,
    backgroundColor: "transparent",
  },

  content: {
    flex: 1,
  },

  /* ---- Typographic helpers ---- */
  loadingText: {
    fontSize: 20,
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },

  /* ---- Card shells ---- */
  blurCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  chatBubble: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  centered: { alignItems: "center", justifyContent: "center" },

  /* ---- Loading ---- */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },

  /* ---- Profile header ---- */
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 36,
    fontWeight: "600",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  userEmail: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 12,
    textAlign: "center",
  },
  roleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },

  /* ---- Sections ---- */
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    minHeight: 44,
  },
  detailLabel: {
    fontSize: 16,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },

  /* ---- Stats ---- */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  statCard: {
    width: "47%",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: Buttons.accentBg,
  },
  statLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },

  /* ---- Actions ---- */
  actionsSection: {
    gap: 12,
    marginBottom: 40,
  },
  logoutButton: {
    backgroundColor: EDU_COLORS.error,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "center",
  },

  /* ---- Modal ---- */
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, // full-height coverage
    backgroundColor: "rgba(15, 23, 42, 0.75)", // requested overlay
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "92%",
    maxWidth: 560,
    maxHeight: "88%",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 22,
    color: "#6B7280",
    fontWeight: "600",
    lineHeight: 22,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalInput: {
    marginBottom: 14,
  },
  modalPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  modalPhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
  },
  modalProfileImage: {
    width: "100%",
    height: "100%",
  },
  modalDefaultAvatar: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarText: {
    color: "white",
    fontSize: 28,
    fontWeight: "700",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    marginBottom: 6,
  },

  /* Pills / pickers */
  gradeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  gradePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
  },
  gradePillActive: {
    backgroundColor: "#E0F2FE",
    borderColor: "#93C5FD",
  },
  gradePillText: { color: "#0F172A", fontWeight: "600" },
  gradePillTextActive: { color: "#1D4ED8" },

  subjectList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  /* Centered wrap that respects safe areas and stays inline */
  loadingCenterWrap: {
    width: "100%",
    minHeight: 220,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Card that matches EduLink surface language (no blur) */
  loadingCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: EDU_COLORS.surfaceSolid, // from colors.js (neutral surface)
    borderWidth: 1,
    borderColor: Surfaces?.border ?? "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: EDU_COLORS.textPrimary ?? "#0B1220",
    textAlign: "center",
  },

  loadingSubtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    color: EDU_COLORS.textSecondary ?? "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginBottom: 8,
  },

  /* Indeterminate progress bar track + fill */
  progressTrack: {
    marginTop: 6,
    width: "100%",
    maxWidth: 420,
    height: 6,
    borderRadius: 999,
    backgroundColor: EDU_COLORS.surfaceSoft ?? "rgba(255,255,255,0.06)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Surfaces?.border ?? "rgba(255,255,255,0.1)",
  },

  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 100, // width of the moving segment
    borderRadius: 999,
    backgroundColor: EDU_COLORS.primary, // brand color
    opacity: 0.9,
  },

  subjectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
  },
  subjectPillActive: {
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
  },
  subjectPillText: { color: "#0F172A", fontWeight: "600" },
  subjectPillTextActive: { color: "#6D28D9" },
});
