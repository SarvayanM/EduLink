import Toast from "react-native-toast-message";
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Modal,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Button, TextInput, HelperText, Divider } from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
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
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";
import { BlurView } from "expo-blur";
import { calculateUserStats } from "../utils/userStatsCalculator";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

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

/* ---------- Toast helper (visible + consistent) ---------- */
const showToast = (type, text1, text2) =>
  Toast.show({
    type, // 'success' | 'error' | 'info'
    text1,
    text2,
    position: "top",
    topOffset: Platform.select({ ios: 48, android: 28, default: 32 }),
    visibilityTime: 3200,
  });

/* ---------- Reusable Blur Card ---------- */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const PAGE_TOP_OFFSET = 24;

function useToast() {
  const insets = useSafeAreaInsets();
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
  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return SUBJECTS;
    return SUBJECTS.filter((s) => s.toLowerCase().includes(q));
  }, [subjectQuery]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchChildData = async (parentData) => {
    try {
      if (!parentData.studentEmail) return null;
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

  const [childData, setChildData] = useState(null);

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
    const nameOk = (updName || "").trim().length >= 3;

    if (!nameOk) {
      setTouched((t) => ({ ...t, name: true }));
      showToast(
        "error",
        "Full name is required",
        "Enter at least 3 characters."
      );
      return;
    }
    if (role === "student" && !updGrade) {
      setTouched((t) => ({ ...t, grade: true }));
      showToast("error", "Please select your grade");
      return;
    }
    if (role === "teacher" && !(updSubject || "").trim()) {
      setTouched((t) => ({ ...t, subject: true }));
      showToast("error", "Please select your teaching subject");
      return;
    }
    if (role === "parent" && !(updStudentEmail || "").trim()) {
      setTouched((t) => ({ ...t, studentEmail: true }));
      showToast("error", "Please enter your child's email");
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

      // Update Firestore
      const payload = {
        displayName: updName.trim(),
      };
      if (role === "student") payload.grade = updGrade;
      if (role === "teacher") payload.subject = updSubject.trim();
      if (role === "parent") payload.studentEmail = updStudentEmail.trim();

      // Upload image if changed and it's a local uri
      if (editImageUri && editImageUri.startsWith("file://")) {
        // NOTE: If you need actual Storage upload, wire your `storage` import and do it here.
        // Code scaffold (commented to avoid changing storage logic):
        // const imgRef = ref(storage, `profiles/${uid}.jpg`);
        // const img = await fetch(editImageUri);
        // const blob = await img.blob();
        // await uploadBytes(imgRef, blob);
        // const url = await getDownloadURL(imgRef);
        // payload.profileImage = url;
        // For now, keep existing remote image if upload logic is not enabled
      }

      await updateDoc(doc(db, "users", uid), payload);

      // Update auth profile name (optional but nice)
      try {
        await fbUpdateProfile(auth.currentUser, {
          displayName: updName.trim(),
        });
      } catch {}

      // Refresh screen data
      await fetchUserProfile();

      showToast("success", "Profile updated");
    } catch {
      showToast("error", "Update failed", "Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  /* ----------------- Change Password (inside same modal) ----------------- */
  const strongPass = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

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

  /* ----------------- Logout (toast only) ----------------- */
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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={EDU_COLORS.primary} />
        <Text
          style={{
            fontSize: 20,
            color: "white",
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Profile Is Loading ...
        </Text>
      </SafeAreaView>
    );
  }

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
        {/* Header */}
        <BlurCard style={[styles.chatBubble, styles.centered]}>
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
        </BlurCard>

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
            <View style={styles.statsGrid}>
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
        <View style={styles.modalOverlay}>
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
                onChangeText={setUpdName}
                style={styles.modalInput}
                error={touched.name && !(updName || "").trim()}
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
      </Modal>
    </View>
  );
}

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
    color: "#2563EB",
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
