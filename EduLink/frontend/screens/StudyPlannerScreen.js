// frontend/screens/StudyPlannerScreen.js
import Screen from "../components/Screen";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import {
  TextInput,
  Button,
  Card,
  Title,
  Chip,
  IconButton,
  Portal,
  Dialog,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../services/firebaseAuth";
import Toast from "react-native-toast-message";
import { BlurView } from "expo-blur";
import {
  EDU_COLORS,
  Surfaces,
  Buttons,
  PALETTE_60_30_10,
} from "../theme/colors";
import { NAVBAR_HEIGHT } from "../components/TopNavbar";

/* ---------- Reusable Blur card ---------- */
const BlurCard = ({ children, style, intensity = 28, tint = "light" }) => (
  <BlurView intensity={intensity} tint={tint} style={[styles.blurCard, style]}>
    {children}
  </BlurView>
);

const PAGE_TOP_OFFSET = 12;

/* ---------- Small appear animation wrapper ---------- */
const Appear = ({ children, delay = 0, style }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [a, delay]);
  return (
    <Animated.View
      style={[
        {
          opacity: a,
          transform: [
            {
              translateY: a.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
            {
              scale: a.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

function useToast() {
  const insets = useSafeAreaInsets();
  const topOffset = (insets?.top || 0) + (NAVBAR_HEIGHT || 0) + 8;
  return useCallback(
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

export default function StudyPlannerScreen() {
  const showToast = useToast();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);

  // Task form
  const [taskTitle, setTaskTitle] = useState("");

  const [taskDescription, setTaskDescription] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskEstimatedTime, setTaskEstimatedTime] = useState("");

  // Active session state
  const [activeSession, setActiveSession] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState(null);

  // Session form
  const [sessionSubject, setSessionSubject] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [sessionDuration, setSessionDuration] = useState("60");

  // Loading bar animation
  const [trackW, setTrackW] = useState(0);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.cubic),
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

  const barTranslate = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, Math.max(trackW - 80, 0)],
  });

  useEffect(() => {
    fetchTasks();
    fetchStudySessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    let t;
    if (activeSession && !isPaused) {
      t = setInterval(
        () => setActiveSession((prev) => (prev ? { ...prev } : null)),
        1000
      );
    }
    return () => t && clearInterval(t);
  }, [activeSession, isPaused]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function refreshAll() {
    try {
      setLoading(true);
      await Promise.all([fetchTasks(true), fetchStudySessions(true)]);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Data -------------------- */
  const fetchTasks = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "studyTasks"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        dueDate: d.data().dueDate?.toDate?.() || new Date(),
        createdAt: d.data().createdAt,
      }));

      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      const forDay = all
        .filter((t) => t.dueDate >= start && t.dueDate <= end)
        .sort((a, b) => {
          if (a.dueDate.getTime() === b.dueDate.getTime()) {
            const aC = a.createdAt?.toDate?.() || new Date(0);
            const bC = b.createdAt?.toDate?.() || new Date(0);
            return bC - aC;
          }
          return a.dueDate - b.dueDate;
        });

      setTasks(forDay);
    } catch (e) {
      console.error("fetchTasks", e);
    }
  };

  const fetchStudySessions = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "studySessions"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate?.() || new Date(),
        createdAt: d.data().createdAt,
      }));

      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      const forDay = all
        .filter((s) => s.date >= start && s.date <= end)
        .sort((a, b) => {
          if (a.date.getTime() === b.date.getTime()) {
            const aC = a.createdAt?.toDate?.() || new Date(0);
            const bC = b.createdAt?.toDate?.() || new Date(0);
            return bC - aC;
          }
          return b.date - a.date;
        });

      setStudySessions(forDay);
    } catch (e) {
      console.error("fetchStudySessions", e);
    }
  };

  /* -------------------- Mutations -------------------- */
  const addTask = async () => {
    if (!taskTitle.trim()) {
      showToast("error", "Please enter a task title", "top");
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) return;

      const due = new Date(selectedDate);
      due.setHours(23, 59, 59, 999);

      await addDoc(collection(db, "studyTasks"), {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        subject: taskSubject || "General",
        priority: taskPriority,
        dueDate: due,
        estimatedTime: taskEstimatedTime || "30",
        completed: false,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setTaskTitle("");
      setTaskDescription("");
      setTaskSubject("");
      setTaskPriority("medium");
      setTaskEstimatedTime("");
      setShowAddTask(false);
      fetchTasks();

      showToast("success", "Task added", `For ${formatDate(selectedDate)} `);
    } catch (e) {
      console.error("addTask", e);
      showToast("error", "Failed to add task");
    }
  };

  const updateTask = async (id, updates) => {
    try {
      await updateDoc(doc(db, "studyTasks", id), updates);
      fetchTasks();
    } catch (e) {
      console.error("updateTask", e);
      showToast("error", "Failed to update task");
    }
  };

  const deleteTask = async (id) => {
    try {
      await deleteDoc(doc(db, "studyTasks", id));
      fetchTasks();
      showToast("success", "Task deleted");
    } catch (e) {
      console.error("deleteTask", e);
      showToast("error", "Failed to delete task");
    }
  };

  /* -------------------- Session controls -------------------- */
  const startStudySession = () => {
    if (!sessionSubject.trim()) {
      showToast("error", "Please select a subject");
      return;
    }
    const data = {
      subject: sessionSubject.trim(),
      description: sessionDescription.trim(),
      duration: parseInt(sessionDuration, 10) || 60,
      startTime: new Date(),
      userId: auth.currentUser.uid,
      date: selectedDate,
      completed: false,
      createdAt: serverTimestamp(),
    };
    setActiveSession(data);
    setSessionStartTime(new Date());
    setIsPaused(false);
    setPausedTime(0);
    setPauseStartTime(null);
    setShowAddSession(false);
    setSessionSubject("");
    setSessionDescription("");
    setSessionDuration("60");
  };

  const pauseStudySession = () => {
    if (!activeSession || isPaused) return;
    setIsPaused(true);
    setPauseStartTime(new Date());
  };

  const resumeStudySession = () => {
    if (!activeSession || !isPaused) return;
    const delta = pauseStartTime
      ? Math.round((new Date() - pauseStartTime) / 60000)
      : 0;
    setPausedTime((p) => p + delta);
    setIsPaused(false);
    setPauseStartTime(null);
  };

  const endStudySession = async () => {
    if (!activeSession) return;
    try {
      const end = new Date();
      let totalPaused = pausedTime;
      if (isPaused && pauseStartTime)
        totalPaused += Math.round((end - pauseStartTime) / 60000);

      const actual = Math.max(
        0,
        Math.round((end - sessionStartTime) / 60000) - totalPaused
      );
      await addDoc(collection(db, "studySessions"), {
        ...activeSession,
        endTime: end,
        actualDuration: actual,
        pausedTime: totalPaused,
        completed: true,
      });

      setActiveSession(null);
      setSessionStartTime(null);
      setIsPaused(false);
      setPausedTime(0);
      setPauseStartTime(null);
      fetchStudySessions();

      showToast(
        "success",
        "Study session completed 🎉",
        `Duration: ${actual} minutes`
      );
    } catch (e) {
      console.error("endStudySession", e);
      showToast("error", "Failed to save study session");
    }
  };

  /* -------------------- Helpers -------------------- */
  const getPriorityColor = (p) =>
    p === "high" ? "#EF4444" : p === "low" ? EDU_COLORS.success : "#F59E0B";

  const formatDate = (d) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTime = (d) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const getTotalStudyTime = () =>
    studySessions.reduce((sum, s) => sum + (s.actualDuration || 0), 0);

  const getCurrentSessionDuration = () => {
    if (!activeSession || !sessionStartTime) return 0;
    const now = new Date();
    let totalPaused = pausedTime;
    if (isPaused && pauseStartTime)
      totalPaused += Math.round((now - pauseStartTime) / 60000);
    const elapsed = Math.round((now - sessionStartTime) / 60000);
    return Math.max(0, elapsed - totalPaused);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingFullscreenCenter}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={EDU_COLORS.primary} />
          <Text style={styles.loadingTitle}>Loading Your Study Planner…</Text>
          <Text style={styles.loadingSubtitle}>
            Fetching today’s tasks and sessions
          </Text>

          {/* Indeterminate progress bar */}
          <View
            style={styles.progressTrackIndeterminate}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.progressBarIndeterminate,
                { transform: [{ translateX: barTranslate }] },
              ]}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ===================== UI ===================== */
  return (
    <View style={styles.screen}>
      {/* Header */}
      <BlurCard style={styles.chatBubble}>
        <Title style={styles.headerTitle}>📚 Plan Your Study Here</Title>
        <View style={styles.dateRow}>
          <IconButton
            icon="chevron-left"
            size={20}
            onPress={() =>
              setSelectedDate(
                (d) => new Date(d.getTime() - 24 * 60 * 60 * 1000)
              )
            }
          />
          <Pressable
            style={styles.datePill}
            onPress={() => setSelectedDate(new Date())}
          >
            <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            {selectedDate.toDateString() !== new Date().toDateString() && (
              <Text style={styles.todayHint}>Tap for Today</Text>
            )}
          </Pressable>
          <IconButton
            icon="chevron-right"
            size={20}
            onPress={() =>
              setSelectedDate(
                (d) => new Date(d.getTime() + 24 * 60 * 60 * 1000)
              )
            }
          />
        </View>
      </BlurCard>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <Appear>
            <View style={styles.tileCard}>
              <Text style={styles.tileTitle}>🗂️ Tasks</Text>
              <Text style={styles.tileNumber}>{tasks.length}</Text>
            </View>
          </Appear>

          <Appear delay={30}>
            <View style={styles.tileCard}>
              <Text style={styles.tileTitle}>✅ Completed</Text>
              <Text style={styles.tileNumber}>
                {tasks.filter((t) => t.completed).length}
              </Text>
            </View>
          </Appear>

          <Appear delay={60}>
            <View style={styles.tileCard}>
              <Text style={styles.tileTitle}>⏱️ Min Studied</Text>
              <Text style={styles.tileNumber}>{getTotalStudyTime()}</Text>
            </View>
          </Appear>
        </View>

        {/* Active Session */}
        {activeSession && (
          <Appear>
            <BlurCard
              style={[
                styles.chatBubble,
                styles.sessionActiveCard,
                isPaused && styles.sessionPausedCard,
              ]}
            >
              <Card.Content>
                <View style={styles.sessionHead}>
                  <Text style={styles.sessionTitle}>
                    {isPaused
                      ? "⏸️ Paused Study Session"
                      : "🎯 Active Study Session"}
                  </Text>
                  <Text style={styles.sessionSubject}>
                    {activeSession.subject}
                  </Text>
                </View>

                {!!activeSession.description && (
                  <Text style={styles.sessionDesc}>
                    {activeSession.description}
                  </Text>
                )}

                <View style={styles.statusWrap}>
                  <Text
                    style={[
                      styles.statusBadge,
                      isPaused ? styles.badgePaused : styles.badgeActive,
                    ]}
                  >
                    {isPaused ? "PAUSED" : "ACTIVE"}
                  </Text>
                </View>

                <View style={styles.sessionActions}>
                  {!isPaused ? (
                    <Button
                      mode="outlined"
                      onPress={pauseStudySession}
                      icon="pause"
                      compact
                      style={styles.btnOutlined}
                      textColor={EDU_COLORS.warning}
                      theme={{ colors: { primary: EDU_COLORS.warning } }}
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      mode="contained"
                      onPress={resumeStudySession}
                      icon="play"
                      compact
                      style={styles.btnContainedSuccess}
                    >
                      Resume
                    </Button>
                  )}
                  <Button
                    mode="contained"
                    onPress={endStudySession}
                    icon="stop"
                    compact
                    style={styles.btnContainedDanger}
                  >
                    End
                  </Button>
                </View>

                <View style={styles.durationBox}>
                  <View style={styles.durationRow}>
                    <Text style={styles.durationLabel}>Duration</Text>
                    <Text style={styles.durationValue}>
                      {getCurrentSessionDuration()} min
                    </Text>
                  </View>
                  <View style={styles.durationRow}>
                    <Text style={styles.durationSub}>Estimated</Text>
                    <Text style={styles.durationSubVal}>
                      {activeSession.duration} min
                    </Text>
                  </View>
                  {pausedTime > 0 && (
                    <View style={styles.durationRow}>
                      <Text style={styles.durationSub}>Paused</Text>
                      <Text
                        style={[
                          styles.durationSubVal,
                          { color: EDU_COLORS.warning },
                        ]}
                      >
                        {pausedTime} min
                      </Text>
                    </View>
                  )}
                </View>
              </Card.Content>
            </BlurCard>
          </Appear>
        )}

        {/* Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              📋 Tasks for {formatDate(selectedDate)}
            </Text>
            <Button
              mode="contained"
              onPress={() => setShowAddTask(true)}
              style={styles.btnSmallPrimary}
            >
              Add Task
            </Button>
          </View>

          {tasks.length === 0 ? (
            <BlurCard style={styles.chatBubble}>
              <Card.Content style={styles.emptyContent}>
                <Text style={styles.emptyTitle}>
                  No tasks for {formatDate(selectedDate)}
                </Text>
                <Text style={styles.emptySub}>Add a task to get started!</Text>
              </Card.Content>
            </BlurCard>
          ) : (
            <View style={styles.listClamp}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {tasks.map((task, i) => (
                  <Appear key={task.id} delay={i * 20}>
                    <BlurCard style={styles.chatBubble}>
                      <Card.Content>
                        <View style={styles.itemHead}>
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.itemTitle}>{task.title}</Text>
                            <Text style={styles.itemSubject}>
                              {task.subject}
                            </Text>
                          </View>
                          <View style={styles.itemActions}>
                            <Chip
                              style={[
                                styles.priorityChip,
                                {
                                  backgroundColor: getPriorityColor(
                                    task.priority
                                  ),
                                },
                              ]}
                              textStyle={styles.priorityText}
                            >
                              {task.priority}
                            </Chip>
                            <IconButton
                              icon={
                                task.completed
                                  ? "check-circle"
                                  : "circle-outline"
                              }
                              size={20}
                              onPress={() =>
                                updateTask(task.id, {
                                  completed: !task.completed,
                                })
                              }
                              iconColor={
                                task.completed
                                  ? EDU_COLORS.success
                                  : EDU_COLORS.gray500
                              }
                            />
                            <IconButton
                              icon="delete"
                              size={20}
                              onPress={() => deleteTask(task.id)}
                              iconColor="#EF4444"
                            />
                          </View>
                        </View>

                        {!!task.description && (
                          <Text style={styles.itemDesc}>
                            {task.description}
                          </Text>
                        )}

                        <View style={styles.itemMeta}>
                          <Text style={styles.metaText}>
                            Due: {formatTime(task.dueDate)} • Est:{" "}
                            {task.estimatedTime || 0} min
                          </Text>
                        </View>
                      </Card.Content>
                    </BlurCard>
                  </Appear>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Study Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>⏱️ Study Sessions</Text>
            <Button
              mode="contained"
              onPress={() => setShowAddSession(true)}
              style={styles.btnSmallPrimary}
            >
              Start Session
            </Button>
          </View>

          {studySessions.length === 0 ? (
            <BlurCard style={styles.chatBubble}>
              <Card.Content style={styles.emptyContent}>
                <Text style={styles.emptyTitle}>
                  No study sessions for {formatDate(selectedDate)}
                </Text>
                <Text style={styles.emptySub}>
                  Start a session to track your study time!
                </Text>
              </Card.Content>
            </BlurCard>
          ) : (
            <View style={styles.listClamp}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {studySessions.map((s, i) => (
                  <Appear key={s.id} delay={i * 20}>
                    {/* swapped from Paper Card (white) to compact tile */}
                    <View style={[styles.tileCard, { marginBottom: 10 }]}>
                      <View style={styles.sessionRow}>
                        <Text style={styles.sessionSubject}>{s.subject}</Text>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.sessionDuration}>
                            {s.actualDuration || s.duration || 0} min
                          </Text>
                          {!!s.actualDuration && !!s.duration && (
                            <Text style={styles.sessionEst}>
                              (Est: {s.duration} min)
                            </Text>
                          )}
                        </View>
                      </View>

                      {!!s.description && (
                        <Text style={styles.sessionDesc}>{s.description}</Text>
                      )}

                      <View style={styles.sessionMetaRow}>
                        <Text style={styles.metaText}>
                          {formatTime(s.date)} •{" "}
                          {s.completed ? "Completed" : "In Progress"}
                        </Text>
                        {!!s.actualDuration && !!s.duration && (
                          <Text
                            style={[
                              styles.timeDiff,
                              s.actualDuration > s.duration
                                ? styles.timeOver
                                : styles.timeUnder,
                            ]}
                          >
                            {s.actualDuration > s.duration ? "+" : ""}
                            {Math.abs(s.actualDuration - s.duration)} min
                          </Text>
                        )}
                      </View>
                    </View>
                  </Appear>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Task Modal (with overlay) */}
      {showAddTask && <View style={styles.overlay} pointerEvents="none" />}
      <Portal>
        <Dialog
          visible={showAddTask}
          onDismiss={() => setShowAddTask(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Add Task for {formatDate(selectedDate)}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Task Title *"
              value={taskTitle}
              onChangeText={setTaskTitle}
              style={styles.input}
            />
            <TextInput
              label="Description"
              value={taskDescription}
              onChangeText={setTaskDescription}
              multiline
              style={styles.input}
            />
            <TextInput
              label="Subject"
              value={taskSubject}
              onChangeText={setTaskSubject}
              style={styles.input}
            />

            <View style={styles.priorityRow}>
              <Text style={styles.priorityLabel}>Priority</Text>
              <View style={styles.priorityChips}>
                {["low", "medium", "high"].map((p) => {
                  const active = taskPriority === p;
                  return (
                    <Chip
                      key={p}
                      selected={active}
                      onPress={() => setTaskPriority(p)}
                      style={[
                        styles.prChip,
                        {
                          backgroundColor: active
                            ? getPriorityColor(p)
                            : EDU_COLORS.gray100,
                        },
                      ]}
                      textStyle={[
                        styles.prChipText,
                        active && { color: "#fff" },
                      ]}
                    >
                      {p}
                    </Chip>
                  );
                })}
              </View>
            </View>

            <TextInput
              label="Estimated Time (minutes)"
              value={taskEstimatedTime}
              onChangeText={setTaskEstimatedTime}
              keyboardType="numeric"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowAddTask(false)} mode="text">
              Cancel
            </Button>
            <Button
              onPress={addTask}
              mode="contained"
              style={styles.btnSmallPrimary}
            >
              Add Task
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Study Session Modal (with overlay) */}
      {showAddSession && <View style={styles.overlay} pointerEvents="none" />}
      <Portal>
        <Dialog
          visible={showAddSession}
          onDismiss={() => setShowAddSession(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Start Study Session for {formatDate(selectedDate)}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Subject *"
              value={sessionSubject}
              onChangeText={setSessionSubject}
              style={styles.input}
            />
            <TextInput
              label="What are you studying?"
              value={sessionDescription}
              onChangeText={setSessionDescription}
              multiline
              style={styles.input}
            />
            <TextInput
              label="Planned Duration (minutes)"
              value={sessionDuration}
              onChangeText={setSessionDuration}
              keyboardType="numeric"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowAddSession(false)} mode="text">
              Cancel
            </Button>
            <Button
              onPress={startStudySession}
              mode="contained"
              style={styles.btnSmallPrimary}
            >
              Start Session
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

/* ===================== Styles (tokens-driven) ===================== */
const CARD_BG = Surfaces?.solid ?? "#0B1220";
const CARD_BORDER = Surfaces?.border ?? "rgba(148,163,184,0.24)";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: PAGE_TOP_OFFSET,
  },

  /* Overlay for dialogs */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },

  /* Indeterminate progress (loading screen) */
  progressTrackIndeterminate: {
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

  /* BlurCard base + tidy rails */
  blurCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },
  chatBubble: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  /* Header */
  headerTitle: {
    color: EDU_COLORS.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  datePill: {
    backgroundColor: EDU_COLORS.gray100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  dateText: { color: EDU_COLORS.gray800, fontSize: 14, fontWeight: "800" },
  todayHint: { color: EDU_COLORS.gray500, fontSize: 10, marginTop: 2 },

  /* Content */
  content: { flex: 1, marginTop: 6 },

  /* Stats as compact tiles */
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  tileCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow || "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  tileTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: EDU_COLORS.gray600,
    marginBottom: 6,
  },
  tileNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: Buttons.accentBg,
  },

  /* Active session card */
  sessionActiveCard: {
    borderLeftWidth: 4,
    borderLeftColor: PALETTE_60_30_10.accent10,
  },
  sessionPausedCard: { borderLeftColor: EDU_COLORS.warning },
  sessionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: PALETTE_60_30_10.accent10,
  },
  sessionSubject: {
    fontSize: 14,
    fontWeight: "800",
    color: EDU_COLORS.gray700,
  },
  sessionDesc: {
    fontSize: 14,
    color: EDU_COLORS.gray700,
    marginTop: 4,
    marginBottom: 8,
  },

  statusWrap: { alignItems: "center", marginBottom: 10 },
  statusBadge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  badgeActive: { color: "#166534" },
  badgePaused: { color: "#92400E" },

  sessionActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  btnOutlined: { borderRadius: 20, borderColor: EDU_COLORS.warning },
  btnContainedSuccess: {
    borderRadius: 20,
    backgroundColor: EDU_COLORS.success,
  },
  btnContainedDanger: { borderRadius: 20 },
  btnSmallPrimary: { borderRadius: 14, backgroundColor: Buttons.primaryBg },

  durationBox: {
    backgroundColor: EDU_COLORS.gray50,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    padding: 12,
  },
  durationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  durationLabel: { fontSize: 12, color: EDU_COLORS.gray600, fontWeight: "800" },
  durationValue: {
    fontSize: 14,
    color: PALETTE_60_30_10.accent10,
    fontWeight: "900",
  },
  durationSub: { fontSize: 12, color: EDU_COLORS.gray600, fontWeight: "700" },
  durationSubVal: {
    fontSize: 12,
    color: EDU_COLORS.gray600,
    fontWeight: "700",
  },

  /* Sections */
  section: { marginTop: 10, marginHorizontal: 16 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: EDU_COLORS.gray700 },

  /* Lists clamp */
  listClamp: { maxHeight: 300 },

  /* Generic list cards */
  itemHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: EDU_COLORS.gray800,
    marginBottom: 2,
  },
  itemSubject: {
    fontSize: 12,
    color: PALETTE_60_30_10.accent10,
    fontWeight: "800",
  },
  itemActions: { flexDirection: "row", alignItems: "center" },
  itemDesc: {
    fontSize: 14,
    color: EDU_COLORS.gray700,
    marginBottom: 8,
    lineHeight: 20,
  },
  itemMeta: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 12, color: EDU_COLORS.gray600, fontWeight: "700" },

  priorityChip: { marginRight: 6, borderRadius: 12 },
  priorityText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  /* Sessions list (tiles) */
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sessionDuration: {
    fontSize: 14,
    fontWeight: "900",
    color: EDU_COLORS.gray800,
  },
  sessionEst: {
    fontSize: 10,
    color: EDU_COLORS.gray600,
    marginTop: 2,
    textAlign: "right",
  },
  sessionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timeDiff: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeOver: { color: "#EF4444" },
  timeUnder: { color: EDU_COLORS.success },

  /* Dialogs (modals) */
  dialog: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: EDU_COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  dialogTitle: { fontWeight: "900", color: EDU_COLORS.gray800 },
  dialogActions: { paddingHorizontal: 10 },

  /* Inputs */
  input: {
    marginBottom: 12,
    borderRadius: 12,
  },

  priorityRow: { marginBottom: 8 },
  priorityLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: EDU_COLORS.gray700,
    marginBottom: 6,
  },
  priorityChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  prChip: { borderRadius: 12 },
  prChipText: { fontSize: 12, fontWeight: "800", color: EDU_COLORS.gray700 },

  /* Loading screen */
  loadingFullscreenCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: EDU_COLORS.surfaceSolid,
    borderWidth: 1,
    borderColor: CARD_BORDER,
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
