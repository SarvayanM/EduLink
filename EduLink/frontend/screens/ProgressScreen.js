// frontend/screens/ProgressScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
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

  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      Alert.alert(
        "Congratulations! 🎉",
        `${
          userName || "You"
        } have been promoted to Peer Tutor for reaching 200 points!`,
        [{ text: "Awesome!", style: "default" }]
      );
    } catch (e) {
      console.error("Error promoting to peer tutor:", e);
    }
  };

  const progressToNext = userStats.currentLevelProgress / POINTS_PER_LEVEL;

  if (loading) {
    return (
      <View
        style={[
          styles.screen,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text
          style={{
            fontSize: 20, // Increased font size
            color: "white",
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Loading Your Progress…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {/* Header */}
      <View style={[styles.card, styles.headerCard]}>
        <Text style={styles.headerTitle}>Progress & Leaderboard</Text>
        <View style={styles.headerHalo} />
      </View>

      {/* Points + Level Progress */}
      <View style={[styles.card, styles.statsRow]}>
        <View style={styles.pointsCol}>
          <View style={styles.pointsCircle}>
            <Text style={styles.pointsNumber}>{userStats.points}</Text>
            <Text style={styles.pointsLabel}>Points</Text>
          </View>
          <Text style={styles.rankText}>Rank #{userStats.rank}</Text>
        </View>

        <View style={styles.progressCol}>
          <Text style={styles.levelText}>Level {userStats.level}</Text>
          <Text style={styles.progressLabel}>
            Progress to Level {userStats.level + 1}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressToNext * 100}%` },
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
      </View>

      {/* Activity */}
      <View style={[styles.card, { padding: 18 }]}>
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
      </View>

      {/* Badges */}
      <View style={[styles.card, { padding: 18 }]}>
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
      </View>

      {/* Leaderboard */}
      <View style={[styles.card, { padding: 18, marginBottom: 28 }]}>
        <Text style={styles.cardTitle}>Class Leaderboard</Text>
        {leaderboard.length === 0 ? (
          <Text style={styles.emptyLeaderboard}>
            No leaderboard data available
          </Text>
        ) : (
          leaderboard.map((u) => (
            <View
              key={u.userId}
              style={[styles.lbRow, u.isCurrentUser && styles.lbRowMe]}
            >
              <View style={styles.lbLeft}>
                <Text style={styles.lbRank}>
                  {u.rank}
                  {u.badge}
                </Text>
                {u.profileImage ? (
                  <Pressable
                    onPress={() => {
                      setSelectedImage({ uri: u.profileImage, name: u.name });
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
                  style={[styles.lbName, u.isCurrentUser && styles.lbNameMe]}
                >
                  {u.isCurrentUser ? "You" : u.name}
                </Text>
              </View>
              <Text style={styles.lbPoints}>{u.points} pts</Text>
            </View>
          ))
        )}
      </View>

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
    </ScrollView>
  );
}

/* ===================== Styles (tokens-first) ===================== */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent", // show global gradient
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  /* Generic card base */
  card: {
    backgroundColor: Surfaces.solid,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surfaces.border,
    marginBottom: 14,
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

  /* Header */
  headerCard: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
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
    backgroundColor: "rgba(255,255,255,0.14)",
    top: -40,
    right: -40,
  },

  /* Stats row */
  statsRow: {
    padding: 16,
    flexDirection: "row",
    gap: 16,
    alignItems: "stretch",
  },
  pointsCol: { width: 140, alignItems: "center", justifyContent: "center" },
  pointsCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: EDU_COLORS.gray50,
    borderWidth: 3,
    borderColor: PALETTE_60_30_10.accent10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pointsNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: PALETTE_60_30_10.accent10,
  },
  pointsLabel: { fontSize: 12, color: EDU_COLORS.gray600, fontWeight: "800" },
  rankText: { fontSize: 13, fontWeight: "900", color: EDU_COLORS.success },

  progressCol: { flex: 1, justifyContent: "center" },
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

  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "center",
    marginTop: 10,
  },
  badgePillText: { color: "#fff", fontSize: 12, fontWeight: "900" },

  /* Cards: Activity & Achievements */
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: EDU_COLORS.textPrimary,
    marginBottom: 10,
  },

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

  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    }),
  },
  badgeEmoji: { fontSize: 16 },
  badgeText: { fontSize: 12, fontWeight: "800", color: "#92400E" },
  emptyBadgeText: {
    fontSize: 14,
    color: EDU_COLORS.gray500,
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
    backgroundColor: "#EFF6FF",
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

  /* Image Modal */
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalClose: {
    position: "absolute",
    top: 54,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
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
});
