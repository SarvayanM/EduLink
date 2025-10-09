import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
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

export default function ResourcesScreen() {
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
      console.error("User fetch error:", e);
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
        } catch (err) {
          console.error("Download resource fetch error:", err);
        }
      }
      out.sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
      setDownloadedFiles(out);
    } catch (e) {
      console.error("Downloads fetch error:", e);
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

      // Filter by role/grade
      if (userRole === "tutor" && userGrade) {
        const allowed = Array.from(
          { length: parseInt(userGrade, 10) - 5 },
          (_, i) => String(6 + i)
        );
        data = data.filter((r) => allowed.includes(r.grade));
      } else if (userRole !== "teacher" && userGrade) {
        data = data.filter((r) => r.grade === userGrade);
      }

      // Sort newest first
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setResources(data);
    } catch (e) {
      console.error("Resources fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

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
          type: f.mimeType?.includes("pdf") ? "pdf" : "image",
          uri: f.uri,
          size: f.size,
        });
      }
    } catch (e) {
      console.error("Pick file error:", e);
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const uploadResource = async () => {
    if (!uploadData.title.trim() || !selectedFile) {
      Alert.alert("Error", "Please fill all fields and select a file");
      return;
    }
    setUploading(true);
    try {
      const user = auth.currentUser;
      if (!user) return Alert.alert("Error", "User not authenticated");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) return Alert.alert("Error", "User data not found");

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
      Alert.alert("Success", "Resource shared successfully!");
      setShowUploadModal(false);
      setUploadData({
        title: "",
        description: "",
        subject: "Mathematics",
        grade: "6",
      });
      setSelectedFile(null);
      fetchResources();
    } catch (e) {
      console.error("Upload error:", e);
      Alert.alert("Error", "Failed to share resource");
    } finally {
      setUploading(false);
    }
  };

  const filtered = resources.filter((r) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch =
      r.title.toLowerCase().includes(s) || r.subject.toLowerCase().includes(s);
    const matchesSubject =
      selectedSubjectFilter === "All" || r.subject === selectedSubjectFilter;
    const matchesGrade =
      selectedGradeFilter === "All" || r.grade === selectedGradeFilter;
    return matchesSearch && matchesSubject && matchesGrade;
  });

  const viewResource = async (resource) => {
    if (resource.fileType === "image" && resource.fileUri) {
      setSelectedImage(resource);
      setShowImageModal(true);
    } else if (resource.fileType === "pdf" && resource.fileUri) {
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(resource.fileUri);
        } else {
          Alert.alert("PDF", `${resource.title}\n${resource.fileName}`);
        }
      } catch {
        Alert.alert("Error", "Cannot open PDF");
      }
    } else {
      Alert.alert(
        resource.title,
        `Subject: ${resource.subject}\nGrade: ${resource.grade}\nUploaded by: ${resource.uploadedByName}`
      );
    }
  };

  const downloadResource = async (resource) => {
    try {
      const fileUri = FileSystem.documentDirectory + resource.fileName;
      await FileSystem.copyAsync({ from: resource.fileUri, to: fileUri });

      setDownloadedFiles((prev) => [
        {
          ...resource,
          fileUri,
          downloadedAt: new Date(),
        },
        ...prev,
      ]);

      await addDoc(collection(db, "downloads"), {
        userId: auth.currentUser.uid,
        resourceId: resource.id,
        resourceTitle: resource.title,
        fileName: resource.fileName,
        downloadedAt: new Date(),
      });

      Alert.alert("Downloaded", `${resource.fileName} saved successfully!`);
    } catch (e) {
      console.error("Download error:", e);
      Alert.alert("Download Failed", "Could not download the file");
    }
  };

  /* ---------- UI ---------- */
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.card, styles.headerCard]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Resources</Text>
          <Text style={styles.subtitle}>
            {userRole === "teacher"
              ? "All Grades"
              : userRole === "tutor"
              ? `Grade ${userGrade} & Below`
              : userGrade
              ? `Grade ${userGrade}`
              : "All Grades"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={[styles.pillBtn, styles.successBtn]}
            onPress={() => setShowDownloadsModal(true)}
          >
            <Ionicons name="folder-open" size={18} color="#fff" />
            <Text style={styles.pillBtnText}>{downloadedFiles.length}</Text>
          </Pressable>

          <Pressable
            style={[styles.pillBtn, styles.primaryBtn]}
            onPress={() => setShowUploadModal(true)}
          >
            <Ionicons name="share-outline" size={16} color="#fff" />
            <Text style={styles.pillBtnText}>Share</Text>
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.card, styles.searchCard]}>
        <Ionicons
          name="search"
          size={18}
          color={EDU_COLORS.gray500}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search resources..."
          placeholderTextColor={EDU_COLORS.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      <View style={[styles.card, styles.filterCard]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Text style={styles.filterLabel}>Subject:</Text>
          {["All", ...subjects].map((s) => {
            const active = selectedSubjectFilter === s;
            return (
              <Pressable
                key={s}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedSubjectFilter(s)}
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

        {(userRole === "teacher" || userRole === "tutor") && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
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
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              });
            })()}
          </ScrollView>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Loading Resources ...</Text>
          </View>
        ) : filtered.length ? (
          filtered.map((r) => (
            <View key={r.id} style={styles.resourceCard}>
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
                      size={24}
                      color="#EF4444"
                    />
                  ) : r.fileType === "image" ? (
                    <MaterialCommunityIcons
                      name="image"
                      size={24}
                      color={EDU_COLORS.success}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="file"
                      size={24}
                      color={EDU_COLORS.gray500}
                    />
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
                    <Text style={styles.subjectText}>{r.subject}</Text>
                  </View>
                  {(userRole === "teacher" || userRole === "tutor") && (
                    <View style={styles.gradeTag}>
                      <Text style={styles.gradeText}>Grade {r.grade}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaText}>By {r.uploadedByName}</Text>
                  <Text style={styles.dateText}>
                    {r.createdAt?.toLocaleDateString() || "Recent"}
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.smallBtn, styles.primaryBtn]}
                    onPress={() => viewResource(r)}
                  >
                    <Ionicons name="eye-outline" size={16} color="#fff" />
                    <Text style={styles.smallBtnText}>View</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallBtn, styles.successBtn]}
                    onPress={() => downloadResource(r)}
                  >
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={styles.smallBtnText}>Download</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <MaterialIcons
              name="find-in-page"
              size={50}
              color={EDU_COLORS.gray300}
            />
            <Text style={styles.emptyTitle}>No resources found</Text>
            <Text style={styles.emptySub}>
              Be the first to share a resource for Grade {userGrade}!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowUploadModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        statusBarTranslucent // <= Android: let the modal extend under status bar
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
              >
                <Ionicons name="close" size={22} color={EDU_COLORS.gray500} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLabel}>Resource Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter a descriptive title"
                placeholderTextColor={EDU_COLORS.gray400}
                value={uploadData.title}
                onChangeText={(v) => setUploadData((p) => ({ ...p, title: v }))}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what this resource contains"
                placeholderTextColor={EDU_COLORS.gray400}
                multiline
                numberOfLines={4}
                value={uploadData.description}
                onChangeText={(v) =>
                  setUploadData((p) => ({ ...p, description: v }))
                }
              />

              <Text style={styles.inputLabel}>Subject</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
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

              {(userRole === "teacher" || userRole === "tutor") && (
                <>
                  <Text style={styles.inputLabel}>Grade</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}
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

              {userRole === "student" && (
                <View style={styles.infoBanner}>
                  <Text style={styles.infoTitle}>Grade: {userGrade}</Text>
                  <Text style={styles.infoText}>
                    Resources will be shared with your grade
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>File Attachment</Text>
              <Pressable style={styles.filePicker} onPress={pickFile}>
                {selectedFile ? (
                  <View style={styles.fileRow}>
                    <MaterialCommunityIcons
                      name={selectedFile.type === "pdf" ? "file-pdf" : "image"}
                      size={22}
                      color={PALETTE_60_30_10.accent10}
                    />
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={styles.fileNamePick} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.fileSize}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Text>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={EDU_COLORS.success}
                    />
                  </View>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={28}
                      color={PALETTE_60_30_10.accent10}
                    />
                    <Text style={styles.pickText}>
                      Select PDF or Image file
                    </Text>
                    <Text style={styles.pickSub}>Max file size: 10MB</Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={[styles.submitLarge, uploading && styles.submitDisabled]}
                onPress={uploadResource}
                disabled={uploading}
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
        statusBarTranslucent // <= Android: let the modal extend under status bar
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
              >
                <Ionicons name="close" size={22} color={EDU_COLORS.gray500} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {downloadedFiles.length ? (
                downloadedFiles.map((f, idx) => (
                  <View key={idx} style={styles.downloadCard}>
                    <View style={styles.downloadHead}>
                      <MaterialCommunityIcons
                        name={f.fileType === "pdf" ? "file-pdf-box" : "image"}
                        size={22}
                        color={
                          f.fileType === "pdf" ? "#EF4444" : EDU_COLORS.success
                        }
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
                        if (f.fileType === "image" && f.fileUri) {
                          setSelectedImage({ ...f, fileUri: f.fileUri });
                          setShowImageModal(true);
                        } else if (f.fileType === "pdf" && f.fileUri) {
                          try {
                            if (await Sharing.isAvailableAsync())
                              await Sharing.shareAsync(f.fileUri);
                            else
                              Alert.alert("PDF", `${f.title}\n${f.fileName}`);
                          } catch {
                            Alert.alert("Error", "Cannot open PDF file");
                          }
                        }
                      }}
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
                    color={EDU_COLORS.gray300}
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
        statusBarTranslucent // <= Android: let the modal extend under status bar
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageOverlay}>
          <View style={styles.imageTop}>
            <Pressable
              style={styles.imageIconBtn}
              onPress={async () => {
                if (selectedImage?.fileUri) {
                  try {
                    await Sharing.shareAsync(selectedImage.fileUri);
                  } catch {
                    Alert.alert("Error", "Failed to share image");
                  }
                }
              }}
            >
              <Ionicons name="share-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.imageIconBtn}
              onPress={() => setShowImageModal(false)}
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

/* ================= styles ================= */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent", // let global gradient show
  },

  /* Cards */
  card: {
    backgroundColor: Surfaces.solid,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    marginHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  headerCard: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchCard: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  filterCard: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  /* Header */
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: EDU_COLORS.gray600,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryBtn: { backgroundColor: Buttons.primaryBg },
  successBtn: { backgroundColor: Buttons.successBg },
  pillBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  /* Search */
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    color: EDU_COLORS.textPrimary,
  },

  /* Chips */
  chipsRow: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 8,
  },
  filterLabel: {
    alignSelf: "center",
    fontSize: 13,
    fontWeight: "700",
    color: EDU_COLORS.gray600,
    marginRight: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: Buttons.chipBg,
  },
  chipActive: { backgroundColor: Buttons.chipActiveBg },
  chipText: { fontSize: 13, color: Buttons.chipText, fontWeight: "700" },
  chipTextActive: { color: Buttons.chipActiveText },

  /* Content */
  content: { flex: 1, marginTop: 12 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 120 },

  resourceCard: {
    backgroundColor: Surfaces.solid,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  resourceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  fileIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: EDU_COLORS.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  fileIconPdf: { backgroundColor: "#FEF2F2" },
  fileIconImg: { backgroundColor: "#F0FDF4" },

  fileName: {
    fontSize: 15,
    fontWeight: "700",
    color: EDU_COLORS.gray800,
    marginBottom: 2,
  },
  resourceTitle: {
    fontSize: 13,
    color: EDU_COLORS.gray600,
    fontWeight: "600",
    marginBottom: 2,
  },
  resourceDescription: {
    fontSize: 13,
    color: EDU_COLORS.gray500,
    lineHeight: 19,
  },

  tagsCol: { alignItems: "flex-end", gap: 6 },
  subjectTag: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectText: { fontSize: 12, color: "#2563EB", fontWeight: "700" },
  gradeTag: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gradeText: { fontSize: 12, color: "#16A34A", fontWeight: "700" },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surfaces.border,
    paddingTop: 10,
    gap: 10,
  },
  metaText: { fontSize: 12, color: EDU_COLORS.gray600, fontWeight: "600" },
  dateText: { fontSize: 12, color: EDU_COLORS.gray400 },

  actionsRow: { flexDirection: "row", gap: 8 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  smallBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  /* Empty / Loading */
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 20, // Increased font size
    color: "white",
    fontWeight: "600",
    textAlign: "center",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.gray600,
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: EDU_COLORS.gray400,
    textAlign: "center",
    lineHeight: 20,
  },

  /* FAB */
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Buttons.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },

  /* Modal base */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 540,
    backgroundColor: Surfaces.solid,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 10 },
    }),
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Surfaces.elevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surfaces.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: EDU_COLORS.textPrimary,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: EDU_COLORS.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: { padding: 16 },

  inputLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: EDU_COLORS.gray700,
    marginBottom: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: EDU_COLORS.gray300,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
    color: EDU_COLORS.textPrimary,
    fontSize: 15,
    marginBottom: 14,
  },
  textArea: { height: 100, textAlignVertical: "top" },

  infoBanner: {
    backgroundColor: "#F0F9FF",
    borderLeftWidth: 4,
    borderLeftColor: "#0EA5E9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  infoTitle: { fontSize: 14, fontWeight: "800", color: EDU_COLORS.gray700 },
  infoText: { fontSize: 13, color: EDU_COLORS.gray600, marginTop: 4 },

  filePicker: {
    borderWidth: 2,
    borderColor: EDU_COLORS.gray200,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    backgroundColor: EDU_COLORS.gray50,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fileNamePick: {
    fontSize: 14,
    fontWeight: "700",
    color: EDU_COLORS.gray800,
    marginBottom: 2,
  },
  fileSize: { fontSize: 12, color: EDU_COLORS.gray500 },
  pickText: {
    marginTop: 8,
    fontSize: 15,
    color: PALETTE_60_30_10.accent10,
    fontWeight: "800",
  },
  pickSub: { fontSize: 12, color: EDU_COLORS.gray400 },

  submitLarge: {
    backgroundColor: Buttons.primaryBg,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitDisabled: { backgroundColor: EDU_COLORS.gray400 },
  submitLargeText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  /* Downloads list */
  downloadCard: {
    backgroundColor: Surfaces.soft,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
  },
  downloadHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  downloadName: {
    fontSize: 14,
    fontWeight: "800",
    color: EDU_COLORS.gray800,
    marginBottom: 2,
  },
  downloadTitle: { fontSize: 12, color: EDU_COLORS.gray600 },
  downloadDate: { fontSize: 12, color: EDU_COLORS.gray400, marginBottom: 10 },
  emptyDownloads: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  emptyDownloadsText: {
    fontSize: 15,
    color: EDU_COLORS.gray500,
    marginTop: 10,
  },

  /* Image modal */
  imageOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  imageTop: {
    position: "absolute",
    top: 50,
    right: 20,
    flexDirection: "row",
    gap: 10,
  },
  imageIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrap: { width: "90%", height: "80%", alignItems: "center" },
  modalImage: { width: "100%", height: "100%", flex: 1, borderRadius: 8 },
  imageInfo: {
    backgroundColor: "rgba(0,0,0,0.7)",
    marginTop: 14,
    width: "100%",
    borderRadius: 8,
    padding: 12,
  },
  imageTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  imageDesc: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  imageMeta: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
});
