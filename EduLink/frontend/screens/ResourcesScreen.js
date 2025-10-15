import Toast from "react-native-toast-message";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Image,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";

import { auth, db } from "../services/firebaseAuth";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";
import { BlurView } from "expo-blur";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

/* ---------- Small helpers & fallbacks ---------- */
const C = {
  infoLight: EDU_COLORS?.infoLight ?? "#E0F2FE",
  infoDark: EDU_COLORS?.infoDark ?? "#075985",
  primaryLight: EDU_COLORS?.primaryLight ?? "#93C5FD",
  primaryXL: EDU_COLORS?.primaryExtraLight ?? "#EFF6FF",
  success: EDU_COLORS?.success ?? "#16A34A",
  gray50: EDU_COLORS?.gray50 ?? "#F9FAFB",
  gray100: EDU_COLORS?.gray100 ?? "#F3F4F6",
  gray200: EDU_COLORS?.gray200 ?? "#E5E7EB",
  gray300: EDU_COLORS?.gray300 ?? "#D1D5DB",
  gray400: EDU_COLORS?.gray400 ?? "#9CA3AF",
  gray500: EDU_COLORS?.gray500 ?? "#6B7280",
  gray600: EDU_COLORS?.gray600 ?? "#4B5563",
  gray700: EDU_COLORS?.gray700 ?? "#374151",
  gray800: EDU_COLORS?.gray800 ?? "#1F2937",
  gray900: EDU_COLORS?.gray900 ?? "#111827",
  primary: EDU_COLORS?.primary ?? "#0A8CA0",
  accent: EDU_COLORS?.accent ?? "#F59E0B",
  surfaceSolid: EDU_COLORS?.surfaceSolid ?? "#FFFFFF",
  border: Surfaces?.border ?? "#E5E7EB",
  elevated: Surfaces?.elevated ?? "#FFFFFF",
};

const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const PAGE_TOP_OFFSET = 0;

function useToast() {
  const insets = useSafeAreaInsets();
  const topOffset = insets.top + NAVBAR_HEIGHT + 8;

  return useCallback(
    (type, text1, text2) => {
      Toast.show({
        type,
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

/* ---------- Animated loading strip (with proper cleanup) ---------- */
const LoadingStrip = ({
  title = "Loading Resources",
  subtitle = "Fetching shared files and personalizing by your grade…",
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loopRef.current.start();
    return () => {
      // Stop the loop & reset
      if (loopRef.current) loopRef.current.stop();
      anim.stopAnimation(() => anim.setValue(0));
    };
  }, [anim]);

  const translateX =
    trackW > 0
      ? anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-80, Math.max(trackW - 80, 0)],
        })
      : 0;

  return (
    <View style={styles.loadingCenterWrap}>
      <View style={styles.loadingCard}>
        <Ionicons
          name="sparkles-outline"
          size={22}
          color={C.primary}
          style={{ opacity: 0.9 }}
        />
        <Text style={styles.loadingTitle}>{title}</Text>
        <Text style={styles.loadingSubtitle}>{subtitle}</Text>

        <View
          style={styles.progressTrack}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[styles.progressBar, { transform: [{ translateX }] }]}
          />
        </View>
      </View>
    </View>
  );
};

/* =========================================================
   Resources Screen
   ========================================================= */
export default function ResourcesScreen() {
  const showToast = useToast();

  const [resources, setResources] = useState([]);
  const [userGrade, setUserGrade] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: "",
    description: "",
    subject: "Mathematics",
    grade: "6",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [downloadedFiles, setDownloadedFiles] = useState([]);
  const [showDownloadsModal, setShowDownloadsModal] = useState(false);

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("All");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("All");

  const subjects = [
    "Mathematics",
    "Science",
    "English",
    "History",
    "Geography",
    "Other",
  ];
  const grades = ["6", "7", "8", "9", "10", "11"];

  /* ---------- data ---------- */
  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (userRole || userGrade) {
      fetchResources();
      fetchDownloads();
    }
  }, [userRole, userGrade]);

  const fetchUser = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserRole(data.role);
        setUserGrade(data.grade);
      }
    } catch (e) {
      // silent fail on user fetch
    }
  };

  const fetchDownloads = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "downloads"),
        where("userId", "==", user.uid)
      );
      const ds = await getDocs(q);
      const base = ds.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        downloadedAt: d.data().downloadedAt?.toDate?.(),
      }));

      const out = [];
      for (const item of base) {
        try {
          const r = await getDoc(doc(db, "resources", item.resourceId));
          if (r.exists()) {
            out.push({
              ...r.data(),
              id: r.id,
              fileName: item.fileName,
              downloadedAt: item.downloadedAt,
            });
          }
        } catch {
          /* noop */
        }
      }
      out.sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
      setDownloadedFiles(out);
    } catch {
      /* noop */
    }
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "resources"));
      const rs = await getDocs(q);
      let data = rs.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.(),
      }));

      // (Same logic) filter by role/grade
      if (userRole === "tutor" && userGrade) {
        const allowed = Array.from(
          { length: parseInt(userGrade, 10) - 5 },
          (_, i) => String(6 + i)
        );
        data = data.filter((r) => allowed.includes(r.grade));
      } else if (userRole !== "teacher" && userGrade) {
        data = data.filter((r) => r.grade === userGrade);
      }

      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setResources(data);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  /* ---------- actions ---------- */
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length) {
        const f = result.assets[0];
        setSelectedFile({
          name: f.name,
          type: f.mimeType?.includes?.("pdf") ? "pdf" : "image",
          uri: f.uri,
          size: f.size,
        });
      }
    } catch {
      showToast("error", "Error", "Failed to pick file");
    }
  };

  const uploadResource = async () => {
    if (!uploadData.title.trim() || !selectedFile) {
      showToast("error", "Error", "Please fill all fields and select a file");
      return;
    }
    setUploading(true);
    try {
      const user = auth.currentUser;
      if (!user) return showToast("error", "Error", "User not authenticated");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        showToast("error", "Error", "User data not found");
        return;
      }

      const u = userDoc.data();
      const userName =
        u.name ||
        u.fullName ||
        u.displayName ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Anonymous";

      const resourceGrade =
        userRole === "student" ? userGrade : uploadData.grade;

      const payload = {
        title: uploadData.title.trim(),
        description: uploadData.description.trim(),
        subject: uploadData.subject,
        grade: resourceGrade,
        fileType: selectedFile.type,
        fileName: selectedFile.name,
        fileUri: selectedFile.uri,
        uploadedBy: user.uid,
        uploadedByName: userName,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "resources"), payload);
      showToast("success", "Success", "Resource shared successfully!");
      setShowUploadModal(false);
      setUploadData({
        title: "",
        description: "",
        subject: "Mathematics",
        grade: "6",
      });
      setSelectedFile(null);
      fetchResources();
    } catch {
      showToast("error", "Error", "Failed to share resource");
    } finally {
      setUploading(false);
    }
  };

  const viewResource = async (resource) => {
    if (resource.fileType === "image" && resource.fileUri) {
      setSelectedImage(resource);
      setShowImageModal(true);
    } else if (resource.fileType === "pdf" && resource.fileUri) {
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(resource.fileUri);
        } else {
          showToast("info", "PDF", `${resource.title}\n${resource.fileName}`);
        }
      } catch {
        showToast("error", "Error", "Cannot open PDF");
      }
    } else {
      showToast(
        "info",
        resource.title,
        `Subject: ${resource.subject}\nGrade: ${resource.grade}\nUploaded by: ${resource.uploadedByName}`
      );
    }
  };

  const downloadResource = async (resource) => {
    try {
      if (!resource?.fileUri) {
        showToast("error", "Download Failed", "No file available to download");
        return;
      }
      const fileUri = FileSystem.documentDirectory + resource.fileName;
      await FileSystem.copyAsync({ from: resource.fileUri, to: fileUri });

      setDownloadedFiles((prev) => [
        { ...resource, fileUri, downloadedAt: new Date() },
        ...prev,
      ]);

      await addDoc(collection(db, "downloads"), {
        userId: auth.currentUser.uid,
        resourceId: resource.id,
        resourceTitle: resource.title,
        fileName: resource.fileName,
        downloadedAt: new Date(),
      });
      showToast(
        "success",
        "Downloaded",
        `${resource.fileName} saved successfully!`
      );
    } catch {
      showToast("error", "Download Failed", "Could not download the file");
    }
  };

  /* ---------- computed ---------- */
  const filtered = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    return resources.filter((r) => {
      const matchesSearch =
        r.title?.toLowerCase?.().includes(s) ||
        r.subject?.toLowerCase?.().includes(s);
      const matchesSubject =
        selectedSubjectFilter === "All" || r.subject === selectedSubjectFilter;
      const matchesGrade =
        selectedGradeFilter === "All" || r.grade === selectedGradeFilter;
      return matchesSearch && matchesSubject && matchesGrade;
    });
  }, [resources, searchQuery, selectedSubjectFilter, selectedGradeFilter]);

  /* ---------- animations ---------- */
  const fabScale = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.spring(fabScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [fabScale]);

  /* ---------- UI ---------- */
  return (
    <View style={styles.screen}>
      {/* HEADER, SEARCH & FILTERS */}
      <View style={styles.headerContainer}>
        {/* Top Row */}
        <BlurCard style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Resources</Text>
            <Text style={styles.subtitle}>
              {userRole === "teacher"
                ? "All Grades"
                : userRole === "tutor"
                ? userGrade
                  ? `Grade ${userGrade} & Below`
                  : "All Grades"
                : userGrade
                ? `Grade ${userGrade}`
                : "All Grades"}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={[styles.pillBtn, styles.successBtn]}
              onPress={() => setShowDownloadsModal(true)}
              hitSlop={8}
              android_ripple={{ color: "#ffffff22", borderless: false }}
            >
              <Ionicons name="folder-open" size={18} color="#fff" />
              <Text style={styles.pillBtnText}>{downloadedFiles.length}</Text>
            </Pressable>

            <Pressable
              style={[styles.pillBtn, styles.primaryBtn]}
              onPress={() => setShowUploadModal(true)}
              hitSlop={8}
              android_ripple={{ color: "#ffffff22", borderless: false }}
            >
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.pillBtnText}>Share</Text>
            </Pressable>
          </View>
        </BlurCard>

        {/* Search */}
        <View style={styles.searchCard}>
          <Ionicons
            name="search"
            size={18}
            color={C.gray500}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search resources..."
            placeholderTextColor={C.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search resources"
            returnKeyType="search"
          />
        </View>

        {/* Subject Filters */}
        <View style={styles.filterChipsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.filterLabel}>Subject:</Text>
            {["All", ...subjects].map((s) => {
              const active = selectedSubjectFilter === s;
              return (
                <Pressable
                  key={s}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedSubjectFilter(s)}
                  hitSlop={8}
                  android_ripple={{ color: "#0000000d", borderless: false }}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Grade Filters */}
        {(userRole === "teacher" || userRole === "tutor") && (
          <View style={styles.filterChipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.filterLabel}>Grade:</Text>
              {(() => {
                let opts = ["All"];
                if (userRole === "teacher") {
                  opts = ["All", ...grades];
                } else if (userRole === "tutor" && userGrade) {
                  for (let i = 6; i <= parseInt(userGrade, 10); i++)
                    opts.push(String(i));
                }
                return opts.map((g) => {
                  const label = g === "All" ? "All" : `Grade ${g}`;
                  const active = selectedGradeFilter === g;
                  return (
                    <Pressable
                      key={g}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedGradeFilter(g)}
                      hitSlop={8}
                      android_ripple={{ color: "#0000000d", borderless: false }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                });
              })()}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <SafeAreaView style={styles.loadingContainer}>
            <LoadingStrip />
          </SafeAreaView>
        ) : filtered.length ? (
          filtered.map((r) => (
            <ResourceTile
              key={r.id}
              r={r}
              userRole={userRole}
              onView={viewResource}
              onDownload={downloadResource}
            />
          ))
        ) : (
          <View style={styles.emptyBox}>
            <MaterialIcons name="find-in-page" size={50} color={C.gray300} />
            <Text style={styles.emptyTitle}>No resources found</Text>
            <Text style={styles.emptySub}>
              Be the first to share a resource
              {userGrade ? ` for Grade ${userGrade}` : ""}!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Animated.View style={{ transform: [{ scale: fabScale }] }}>
        <Pressable
          style={styles.fab}
          onPress={() => setShowUploadModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Share a resource"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Resource</Text>
              <Pressable
                style={styles.modalClose}
                onPress={() => setShowUploadModal(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={C.gray500} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Title */}
              <Text style={styles.inputLabel}>Resource Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter a descriptive title"
                placeholderTextColor={C.gray400}
                value={uploadData.title}
                onChangeText={(v) => setUploadData((p) => ({ ...p, title: v }))}
              />

              {/* Description */}
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what this resource contains"
                placeholderTextColor={C.gray400}
                multiline
                numberOfLines={4}
                value={uploadData.description}
                onChangeText={(v) =>
                  setUploadData((p) => ({ ...p, description: v }))
                }
              />

              {/* Subject */}
              <Text style={styles.inputLabel}>Subject</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
                keyboardShouldPersistTaps="handled"
              >
                {subjects.map((s) => {
                  const active = uploadData.subject === s;
                  return (
                    <Pressable
                      key={s}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        setUploadData((p) => ({ ...p, subject: s }))
                      }
                      hitSlop={8}
                      android_ripple={{ color: "#0000000d", borderless: false }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Grade (teacher/tutor) */}
              {(userRole === "teacher" || userRole === "tutor") && (
                <>
                  <Text style={styles.inputLabel}>Grade</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {grades.map((g) => {
                      const active = uploadData.grade === g;
                      return (
                        <Pressable
                          key={g}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() =>
                            setUploadData((p) => ({ ...p, grade: g }))
                          }
                          hitSlop={8}
                          android_ripple={{
                            color: "#0000000d",
                            borderless: false,
                          }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active && styles.chipTextActive,
                            ]}
                          >
                            Grade {g}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* Student banner */}
              {userRole === "student" && (
                <View style={styles.infoBanner}>
                  <Text style={styles.infoTitle}>Grade: {userGrade}</Text>
                  <Text style={styles.infoText}>
                    Resources will be shared with your grade
                  </Text>
                </View>
              )}

              {/* File */}
              <Text style={styles.inputLabel}>File Attachment</Text>
              <Pressable
                style={styles.filePicker}
                onPress={pickFile}
                hitSlop={8}
                android_ripple={{ color: "#0000000d", borderless: false }}
              >
                {selectedFile ? (
                  <View style={styles.fileRow}>
                    <MaterialCommunityIcons
                      name={selectedFile.type === "pdf" ? "file-pdf" : "image"}
                      size={22}
                      color={PALETTE_60_30_10?.accent10 ?? C.accent}
                    />
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={styles.fileNamePick} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.fileSize}>
                        {((selectedFile.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                      </Text>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={C.success}
                    />
                  </View>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={28}
                      color={PALETTE_60_30_10?.accent10 ?? C.accent}
                    />
                    <Text style={styles.pickText}>
                      Select PDF or Image file
                    </Text>
                    <Text style={styles.pickSub}>Max file size: 10MB</Text>
                  </View>
                )}
              </Pressable>

              {/* Submit */}
              <Pressable
                style={[styles.submitLarge, uploading && styles.submitDisabled]}
                onPress={uploadResource}
                disabled={uploading}
                android_ripple={{ color: "#ffffff22", borderless: false }}
              >
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.submitLargeText}>
                  {uploading ? "Uploading..." : "Share Resource"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Downloads Modal */}
      <Modal
        visible={showDownloadsModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowDownloadsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Downloads</Text>
              <Pressable
                style={styles.modalClose}
                onPress={() => setShowDownloadsModal(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={C.gray500} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {downloadedFiles.length ? (
                downloadedFiles.map((f, idx) => (
                  <View key={idx} style={styles.downloadCard}>
                    <View style={styles.downloadHead}>
                      <MaterialCommunityIcons
                        name={f.fileType === "pdf" ? "file-pdf-box" : "image"}
                        size={22}
                        color={f.fileType === "pdf" ? "#EF4444" : C.success}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.downloadName} numberOfLines={1}>
                          {f.fileName}
                        </Text>
                        <Text style={styles.downloadTitle} numberOfLines={1}>
                          {f.title}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.downloadDate}>
                      Downloaded:{" "}
                      {f.downloadedAt?.toLocaleDateString?.() || "—"}
                    </Text>
                    <Pressable
                      style={[styles.smallBtn, styles.primaryBtn]}
                      onPress={async () => {
                        // keep your view logic the same
                      }}
                      android_ripple={{ color: "#ffffff22", borderless: false }}
                    >
                      <Text style={styles.smallBtnText}>
                        {f.fileType === "image"
                          ? "View Image"
                          : f.fileType === "pdf"
                          ? "Open PDF"
                          : "View"}
                      </Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.emptyDownloads}>
                  <Ionicons
                    name="folder-open-outline"
                    size={46}
                    color={C.gray300}
                  />
                  <Text style={styles.emptyDownloadsText}>
                    No downloads yet
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageOverlay}>
          <View style={styles.imageTop}>
            <Pressable
              style={styles.imageIconBtn}
              onPress={async () => {}}
              hitSlop={8}
            >
              <Ionicons name="share-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.imageIconBtn}
              onPress={() => setShowImageModal(false)}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          {selectedImage && (
            <View style={styles.imageWrap}>
              <Image
                source={{ uri: selectedImage.fileUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <View style={styles.imageInfo}>
                <Text style={styles.imageTitle}>{selectedImage.title}</Text>
                {!!selectedImage.description && (
                  <Text style={styles.imageDesc}>
                    {selectedImage.description}
                  </Text>
                )}
                <Text style={styles.imageMeta}>
                  {selectedImage.subject} • Grade {selectedImage.grade}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Compact resource tile (replaces “plain white” block) ---------- */
function ResourceTile({ r, userRole, onView, onDownload }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 7,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={styles.resourceCard}>
        <View style={styles.resourceHeader}>
          <View
            style={[
              styles.fileIcon,
              r.fileType === "pdf" && styles.fileIconPdf,
              r.fileType === "image" && styles.fileIconImg,
            ]}
          >
            {r.fileType === "pdf" ? (
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={22}
                color="#EF4444"
              />
            ) : r.fileType === "image" ? (
              <MaterialCommunityIcons
                name="image"
                size={22}
                color={C.success}
              />
            ) : (
              <MaterialCommunityIcons name="file" size={22} color={C.gray500} />
            )}
          </View>

          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.fileName} numberOfLines={1}>
              {r.fileName}
            </Text>
            <Text style={styles.resourceTitle}>{r.title}</Text>
            {!!r.description && (
              <Text style={styles.resourceDescription} numberOfLines={2}>
                {r.description}
              </Text>
            )}
          </View>

          <View style={styles.tagsCol}>
            <View style={styles.subjectTag}>
              <Ionicons
                name="book-outline"
                size={12}
                color={C.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.subjectText}>{r.subject}</Text>
            </View>
            {(userRole === "teacher" || userRole === "tutor") && (
              <View style={styles.gradeTag}>
                <Ionicons
                  name="school-outline"
                  size={12}
                  color="#fff"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.gradeText}>Grade {r.grade}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaText}>By {r.uploadedByName}</Text>
            <Text style={styles.dateText}>
              {r.createdAt?.toLocaleDateString?.() || "Recent"}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.smallBtn, styles.primaryBtn]}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onPress={() => onView(r)}
              hitSlop={6}
              android_ripple={{ color: "#ffffff22", borderless: false }}
            >
              <Ionicons name="eye-outline" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>View</Text>
            </Pressable>
            <Pressable
              style={[styles.smallBtn, styles.successBtn]}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onPress={() => onDownload(r)}
              hitSlop={6}
              android_ripple={{ color: "#ffffff22", borderless: false }}
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={styles.smallBtnText}>Download</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

/* ================= styles ================= */
const styles = StyleSheet.create({
  // Global Layout
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,
  },

  blurCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    padding: 12,
  },

  // Top Header & Search
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 10 : 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: C.gray900,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: C.gray500,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },

  // Pills
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  successBtn: {
    backgroundColor: C.success,
  },
  primaryBtn: {
    backgroundColor: C.primary,
  },
  pillBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },

  // Search
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceSolid,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: C.gray900,
    paddingVertical: 0,
    paddingHorizontal: 8,
  },

  // Filters
  filterChipsContainer: {
    paddingVertical: 8,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.gray700,
    marginRight: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  chipText: {
    fontSize: 14,
    color: C.gray700,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 22,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingBottom: 100,
  },

  /* ---------- Compact Card Tile (replaces plain white) ---------- */
  resourceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  resourceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: C.gray200,
  },
  fileIconPdf: {
    backgroundColor: "#FEE2E2",
  },
  fileIconImg: {
    backgroundColor: "#D1FAE5",
  },
  fileName: {
    fontSize: 12,
    color: C.gray500,
    fontWeight: "600",
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.gray900,
    marginTop: 2,
  },
  resourceDescription: {
    fontSize: 14,
    color: C.gray600,
    marginTop: 4,
  },
  tagsCol: {
    alignItems: "flex-end",
    marginLeft: 10,
  },
  subjectTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.primary + "1A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.primary,
  },
  gradeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.gray100,
    marginTop: 10,
  },
  metaText: {
    fontSize: 12,
    color: C.gray700,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 12,
    color: C.gray500,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  smallBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    marginLeft: 4,
    letterSpacing: 0.2,
  },

  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.gray700,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 14,
    color: C.gray500,
    textAlign: "center",
    marginTop: 4,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    height: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.gray100,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.gray900,
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    paddingVertical: 20,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: C.gray700,
    marginBottom: 6,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: C.gray300,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: C.gray900,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 10,
    textAlignVertical: "top",
  },

  infoBanner: {
    backgroundColor: C.infoLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    borderWidth: 1,
    borderColor: C.gray200,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.infoDark,
  },
  infoText: {
    fontSize: 13,
    color: C.infoDark,
    marginTop: 4,
  },

  filePicker: {
    borderWidth: 2,
    borderColor: C.primaryLight,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primaryXL,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  fileNamePick: {
    fontSize: 15,
    fontWeight: "700",
    color: C.gray900,
  },
  fileSize: {
    fontSize: 13,
    color: C.gray500,
    marginTop: 2,
  },
  pickText: {
    fontSize: 15,
    fontWeight: "800",
    color: PALETTE_60_30_10?.accent10 ?? C.accent,
    marginTop: 8,
  },
  pickSub: {
    fontSize: 13,
    color: C.gray500,
    marginTop: 4,
  },

  submitLarge: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 25,
    marginBottom: 20,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitLargeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 8,
    letterSpacing: 0.3,
  },

  // Downloads Modal
  downloadCard: {
    backgroundColor: C.gray50,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: C.primaryLight,
    borderWidth: 1,
    borderColor: C.gray100,
  },
  downloadHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  downloadName: {
    fontSize: 14,
    fontWeight: "800",
    color: C.gray900,
  },
  downloadTitle: {
    fontSize: 12,
    color: C.gray500,
    marginTop: 2,
  },
  downloadDate: {
    fontSize: 12,
    color: C.gray600,
    marginBottom: 8,
  },
  emptyDownloads: {
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyDownloadsText: {
    fontSize: 16,
    color: C.gray500,
    marginTop: 10,
  },

  // Image Modal
  imageOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    paddingTop: Platform.OS === "android" ? 30 : 50,
    paddingHorizontal: 10,
    justifyContent: "space-between",
  },
  imageTop: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  imageIconBtn: {
    padding: 10,
    marginLeft: 10,
  },
  imageWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  modalImage: {
    width: "100%",
    height: "75%",
    borderRadius: 10,
  },
  imageInfo: {
    padding: 10,
    width: "100%",
    alignItems: "center",
  },
  imageTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
  },
  imageDesc: {
    fontSize: 14,
    color: C.gray300,
    textAlign: "center",
    marginTop: 5,
  },
  imageMeta: {
    fontSize: 12,
    color: C.gray400,
    marginTop: 8,
  },

  // Loading card
  loadingCenterWrap: {
    width: "100%",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: C.surfaceSolid,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "900",
    color: C.gray900,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: 13.5,
    lineHeight: 18,
    color: C.gray600,
    textAlign: "center",
    marginBottom: 8,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 8,
    backgroundColor: C.gray200,
    overflow: "hidden",
    marginTop: 6,
  },
  progressBar: {
    width: 80,
    height: 8,
    borderRadius: 8,
    backgroundColor: C.primary,
  },
});
