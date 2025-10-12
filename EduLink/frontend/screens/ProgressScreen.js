// frontend/screens/ProgressScreen.js
import Screen from "../components/Screen";
import Toast from "react-native-toast-message";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { auth, db } from "../services/firebaseAuth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { calculateUserStats } from "../utils/userStatsCalculator";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";

import { BlurView } from "expo-blur";

/* ---------- Small UI helpers (blur card) ---------- */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const PAGE_TOP_OFFSET = 8;

const LoadingStrip = ({
  title = "Loading Your Progress ...",
  subtitle = "Personalizing stats and leaderboard…",
}) => {
  const anim = React.useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = React.useState(0);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => anim.stopAnimation(() => anim.setValue(0));
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
        <ActivityIndicator size="large" color={EDU_COLORS.primary} />
        <Text style={styles.loadingTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.loadingSubtitle}>{subtitle}</Text>
        ) : null}

        <View
          style={styles.progressTrack}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.progressBarIndeterminate,
              { transform: [{ translateX }] },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

export default function ProgressScreen() {
  const [userStats, setUserStats] = useState({
    points: 0,
    rank: 0,
    questionsAsked: 0,
    answersGiven: 0,
    upvotesReceived: 0,
    badges: [],
    level: 1,
    nextLevelPoints: 200,
    currentLevelProgress: 0,
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userGrade, setUserGrade] = useState(null);
  const [userRole, setUserRole] = useState("student");
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const POINTS_PER_LEVEL = 200;

  /* ---------- Animations ---------- */
  const mountFade = useRef(new Animated.Value(0)).current;
  const pointsScale = useRef(new Animated.Value(0.85)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lbAnimVals = useRef([]).current; // one per leaderboard row

  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const barAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!leaderboard?.length) return;
    // build values once per render of leaderboard
    lbAnimVals.length = 0;
    leaderboard.forEach(() => lbAnimVals.push(new Animated.Value(0)));

    Animated.stagger(
      60,
      lbAnimVals.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true })
      )
    ).start();
  }, [leaderboard]);

  useEffect(() => {
    if (loading) return;

    // Fade in the whole screen
    Animated.timing(mountFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Pop the points circle
    Animated.spring(pointsScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

    // Fill the progress bar to the actual fraction
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation can't use native driver
    }).start();
  }, [loading]);

  // Interpolate to slide the bar from left to right
  const barTranslate = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 280], // will be clamped by container width; feels smooth on phones & tablets
  });

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data() || {};
      const grade = userData.grade;
      const currentRole = userData.role || "student";
      setUserGrade(grade);
      setUserRole(currentRole);

      const { questionsAsked, answersGiven, upvotesReceived } =
        await calculateUserStats(user.uid);

      const points = userData.points || 0;
      const level = points > 0 ? Math.floor(points / POINTS_PER_LEVEL) + 1 : 1;
      const currentLevelProgress = points > 0 ? points % POINTS_PER_LEVEL : 0;
      const nextLevelPoints = level * POINTS_PER_LEVEL;

      if (points >= 200 && currentRole === "student") {
        await promoteToPeerTutor(user.uid, userData.name);
        setUserRole("tutor");
      }

      const badges = [];
      if (questionsAsked >= 1) badges.push("First Question");
      if (answersGiven >= 4) badges.push("Helpful Answer");
      if (answersGiven >= 10) badges.push("Top Contributor");
      if (questionsAsked >= 5) badges.push("Curious Mind");
      if (points >= 400) badges.push("Peer Club");
      if (points >= 200) badges.push("Peer Tutor");
      if (level >= 5) badges.push("Level Master");

      setUserStats({
        points,
        rank: 0,
        questionsAsked,
        answersGiven,
        upvotesReceived,
        badges,
        level,
        nextLevelPoints,
        currentLevelProgress,
      });

      await fetchLeaderboard(grade, points, userData.name || "You");
    } catch (e) {
      console.error("Error fetching user data:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (grade) => {
    try {
      const usersQuery = query(
        collection(db, "users"),
        where("grade", "==", grade)
      );
      const usersSnapshot = await getDocs(usersQuery);

      const leaderboardData = [];
      for (const u of usersSnapshot.docs) {
        const data = u.data() || {};
        const userId = u.id;
        const points = data.points || 0; // source of truth
        leaderboardData.push({
          userId,
          name: data.displayName || data.name || "Anonymous",
          points,
          profileImage: data.profileImage || null,
          isCurrentUser: userId === auth.currentUser?.uid,
        });
      }

      leaderboardData.sort((a, b) => b.points - a.points);
      const ranked = leaderboardData.map((user, idx) => ({
        ...user,
        rank: idx + 1,
        badge: idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "",
      }));

      const currentUserRank = ranked.find((u) => u.isCurrentUser)?.rank || 0;
      setUserStats((prev) => ({ ...prev, rank: currentUserRank }));
      setLeaderboard(ranked.slice(0, 10));
    } catch (e) {
      console.error("Error fetching leaderboard:", e);
    }
  };

  const promoteToPeerTutor = async (userId, userName) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: "tutor" });
      Toast.show({
        type: "success",
        text1: "Congratulations! 🎉",
        text2: `${
          userName || "You"
        } have been promoted to Peer Tutor for reaching 200 points!`,
      });
    } catch (e) {
      console.error("Error promoting to peer tutor:", e);
    }
  };

  const progressToNext =
    userStats.currentLevelProgress / (POINTS_PER_LEVEL || 1);

  if (loading) {
    return <LoadingStrip />;
  }

  return (
    <Animated.ScrollView
      style={[styles.screen, { opacity: mountFade }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <BlurCard style={[styles.chatBubble]}>
        <Text style={styles.headerTitle}>Progress & Leaderboard</Text>
      </BlurCard>

      {/* Points + Level Progress */}
      <BlurCard style={[styles.chatBubble]}>
        <View style={styles.pointsRow}>
          <Animated.View
            style={[
              styles.pointsCircle,
              { transform: [{ scale: pointsScale }] },
            ]}
          >
            <Text style={styles.pointsNumber}>{userStats.points}</Text>
            <Text style={styles.pointsLabel}>Points</Text>
          </Animated.View>
          <Text style={styles.rankText}>Rank {userStats.rank}</Text>
        </View>

        <View style={styles.progressCol}>
          <Text style={styles.levelText}>Level {userStats.level}</Text>
          <Text style={styles.progressLabel}>
            Progress to Level {userStats.level + 1}
          </Text>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      "0%",
                      `${Math.min(
                        100,
                        (userStats.currentLevelProgress /
                          (POINTS_PER_LEVEL || 1)) *
                          100
                      ).toFixed(2)}%`,
                    ],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {userStats.currentLevelProgress}/{POINTS_PER_LEVEL} points
          </Text>

          {userStats.points >= 100 && userStats.points < 200 && (
            <View
              style={[
                styles.badgePill,
                { backgroundColor: EDU_COLORS.warning },
              ]}
            >
              <Text style={styles.badgePillText}>💯 Century Club</Text>
            </View>
          )}
          {userStats.points >= 200 && userRole === "tutor" && (
            <View
              style={[
                styles.badgePill,
                { backgroundColor: EDU_COLORS.success },
              ]}
            >
              <Text style={styles.badgePillText}>🎓 Peer Tutor</Text>
            </View>
          )}
        </View>
      </BlurCard>

      {/* Activity */}
      <BlurCard style={[styles.chatBubble]}>
        <Text style={styles.cardTitle}>My Activity</Text>
        <View style={styles.activityGrid}>
          <View style={styles.activityItem}>
            <View style={styles.activityIconWrap}>
              <Text style={styles.activityIcon}>❓</Text>
            </View>
            <Text style={styles.activityNumber}>
              {userStats.questionsAsked}
            </Text>
            <Text style={styles.activityLabel}>Questions Asked</Text>
          </View>
          <View style={styles.activityItem}>
            <View style={styles.activityIconWrap}>
              <Text style={styles.activityIcon}>💬</Text>
            </View>
            <Text style={styles.activityNumber}>{userStats.answersGiven}</Text>
            <Text style={styles.activityLabel}>Answers Given</Text>
          </View>
        </View>
      </BlurCard>

      {/* Badges */}
      <BlurCard style={[styles.chatBubble]}>
        <Text style={styles.cardTitle}>Achievements</Text>
        <View style={styles.badgesGrid}>
          {userStats.badges.length === 0 ? (
            <Text style={styles.emptyBadgeText}>
              Earn badges by being active!
            </Text>
          ) : (
            userStats.badges.map((b, i) => (
              <View key={`${b}-${i}`} style={styles.badgeChip}>
                <Text style={styles.badgeEmoji}>🏅</Text>
                <Text style={styles.badgeText}>{b}</Text>
              </View>
            ))
          )}
        </View>
      </BlurCard>

      {/* Leaderboard */}
      <BlurCard style={[styles.chatBubble]}>
        <Text style={styles.cardTitle}>Class Leaderboard</Text>
        {leaderboard.length === 0 ? (
          <Text style={styles.emptyLeaderboard}>
            No leaderboard data available
          </Text>
        ) : (
          leaderboard.map((u, idx) => {
            const rowAnim = lbAnimVals[idx] || new Animated.Value(1);
            return (
              <Animated.View
                key={u.userId}
                style={{
                  transform: [
                    {
                      translateY: rowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                  opacity: rowAnim,
                }}
              >
                <View style={[styles.lbRow, u.isCurrentUser && styles.lbRowMe]}>
                  <View style={styles.lbLeft}>
                    <Text style={styles.lbRank}>
                      {u.rank}
                      {u.badge}
                    </Text>
                    {u.profileImage ? (
                      <Pressable
                        onPress={() => {
                          setSelectedImage({
                            uri: u.profileImage,
                            name: u.name,
                          });
                          setShowImageModal(true);
                        }}
                      >
                        <Image
                          source={{ uri: u.profileImage }}
                          style={styles.avatar}
                        />
                      </Pressable>
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>
                          {(u.name || "A").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.lbName,
                        u.isCurrentUser && styles.lbNameMe,
                      ]}
                      numberOfLines={1}
                    >
                      {u.isCurrentUser ? "You" : u.name}
                    </Text>
                  </View>
                  <Text style={styles.lbPoints}>{u.points} pts</Text>
                </View>
              </Animated.View>
            );
          })
        )}
      </BlurCard>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <Pressable
            style={styles.imageModalClose}
            onPress={() => setShowImageModal(false)}
          >
            <Text style={styles.imageCloseText}>✕</Text>
          </Pressable>
          {selectedImage && (
            <View style={styles.imageModalBody}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <Text style={styles.imageUserName}>{selectedImage.name}</Text>
            </View>
          )}
        </View>
      </Modal>
    </Animated.ScrollView>
  );
}

/* ===================== Styles (tokens-first) ===================== */
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },

  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET, // keeps everything aligned under the header rail
  },

  /* Shared blur card base */
  blurCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Surfaces.border,
    overflow: "hidden",
    backgroundColor: "transparent",
  },

  /* Header */
  chatBubble: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: EDU_COLORS.textPrimary,
  },
  headerHalo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -40,
    right: -40,
  },

  /* Points + progress */
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pointsCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: EDU_COLORS.gray50,
    borderWidth: 3,
    borderColor: PALETTE_60_30_10.accent10,
    alignItems: "center",
    justifyContent: "center",
  },
  pointsNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: PALETTE_60_30_10.accent10,
  },
  pointsLabel: { fontSize: 12, color: EDU_COLORS.gray600, fontWeight: "800" },
  rankText: {
    fontSize: 16,
    fontWeight: "900",
    backgroundColor: Buttons.primaryBg,
    color: "#FFFF",
    padding: 4,
  },

  progressCol: { marginTop: 12 },
  levelText: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE_60_30_10.accent10,
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    marginBottom: 8,
    fontWeight: "700",
  },
  progressBar: {
    width: "100%",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: EDU_COLORS.gray200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Buttons.primaryBg,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    textAlign: "center",
    marginTop: 6,
  },

  /* --- Missing / new styles used by LoadingStrip --- */
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 8,
    backgroundColor: EDU_COLORS.gray200,
    overflow: "hidden",
    marginTop: 6,
  },
  progressBarIndeterminate: {
    width: 80,
    height: 8,
    borderRadius: 8,
    backgroundColor: Buttons.primaryBg,
  },

  /* --- Small UI polish/fixes --- */
  rankText: {
    fontSize: 16,
    fontWeight: "900",
    backgroundColor: Buttons.primaryBg,
    color: "#FFFFFF", // was "#FFFF"
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  lbRowMe: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: (EDU_COLORS.primary ?? "#088395") + "1A", // subtle highlight
  },

  headerHalo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -40,
    right: -40,
    backgroundColor: (PALETTE_60_30_10?.accent10 ?? "#7C3AED") + "22", // faint halo
  },

  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "center",
    marginTop: 10,
  },
  badgePillText: { color: "#fff", fontSize: 12, fontWeight: "900" },

  /* Section titles */
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: EDU_COLORS.textPrimary,
    marginBottom: 10,
  },

  /* Activity */
  activityGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 10,
  },
  activityItem: { alignItems: "center", flex: 1 },
  activityIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: EDU_COLORS.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
  },
  activityIcon: { fontSize: 20 },
  activityNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: PALETTE_60_30_10.accent10,
    marginTop: 2,
  },
  activityLabel: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    textAlign: "center",
    marginTop: 2,
  },

  /* Badges */
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: Buttons.accentBg,
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    }),
  },
  badgeEmoji: { fontSize: 16 },
  badgeText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  emptyBadgeText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontStyle: "italic",
    textAlign: "center",
    width: "100%",
    paddingVertical: 10,
  },

  /* Leaderboard */
  lbRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surfaces.border,
  },
  lbRowMe: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  lbLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  lbRank: {
    fontSize: 14,
    fontWeight: "900",
    color: EDU_COLORS.gray600,
    width: 46,
  },
  lbName: { fontSize: 15, color: EDU_COLORS.textPrimary, flex: 1 },
  lbNameMe: { fontWeight: "900", color: PALETTE_60_30_10.accent10 },
  lbPoints: {
    fontSize: 14,
    fontWeight: "900",
    color: PALETTE_60_30_10.accent10,
  },

  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: EDU_COLORS.gray200,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: "800",
    color: EDU_COLORS.gray600,
  },
  emptyLeaderboard: {
    fontSize: 14,
    color: EDU_COLORS.gray500,
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 14,
  },

  /* Image Modal (overlay requested) */
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)", // requested overlay
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalClose: {
    position: "absolute",
    top: 54,
    right: 20,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  imageCloseText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  imageModalBody: { alignItems: "center" },
  modalImage: { width: 300, height: 300, borderRadius: 150 },
  imageUserName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
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
});
