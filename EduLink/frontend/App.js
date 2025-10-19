// frontend/App.js
import { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Platform,
} from "react-native";

import {
  NavigationContainer,
  useNavigationContainerRef,
  DefaultTheme as NavDefaultTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider as PaperProvider } from "react-native-paper";
import { paperTheme, APP_GRADIENT, EDU_COLORS } from "./theme/colors";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./services/firebaseAuth";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import TopNavbar, { NAVBAR_HEIGHT } from "./components/TopNavbar";
import BottomNavbar from "./components/BottomNavbar";
import { Ionicons } from "@expo/vector-icons";

/* Screens */
import LandingScreen from "./screens/LandingScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import AskQuestionScreen from "./screens/AskQuestionScreen";
import QuestionFeedScreen from "./screens/QuestionFeedScreen";
import ResourcesScreen from "./screens/ResourcesScreen";
import ProgressScreen from "./screens/ProgressScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import ClassroomScreen from "./screens/ClassroomScreen";
import ParentDashboard from "./screens/ParentDashboard";
import ProfileScreen from "./screens/ProfileScreen";
import StudyPlannerScreen from "./screens/StudyPlannerScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/* ---------- Shared options ---------- */
const stackCommon = {
  headerShown: false,
  contentStyle: { backgroundColor: "transparent" },
};
const tabsCommon = {
  headerShown: false,
  tabBarStyle: { display: "none" },
  sceneContainerStyle: { backgroundColor: "transparent" },
};

/* ---------- Tabs ---------- */
function StudentTabs() {
  return (
    <Tab.Navigator screenOptions={tabsCommon}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Q&A" component={QuestionFeedScreen} />
      <Tab.Screen name="Resources" component={ResourcesScreen} />
      <Tab.Screen name="StudyPlanner" component={StudyPlannerScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
const TutorTabs = StudentTabs;
function TeacherTabs() {
  return (
    <Tab.Navigator screenOptions={tabsCommon}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Q&A" component={QuestionFeedScreen} />
      <Tab.Screen name="Resources" component={ResourcesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
function ParentTabs() {
  return (
    <Tab.Navigator screenOptions={tabsCommon}>
      <Tab.Screen name="Dashboard" component={ParentDashboard} />
      <Tab.Screen
        name="Notifications"
        children={() => (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600" }}>
              Weekly Summary
            </Text>
          </View>
        )}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
function TabsByRole({ role }) {
  switch (role) {
    case "tutor":
      return <TutorTabs />;
    case "teacher":
      return <TeacherTabs />;
    case "parent":
      return <ParentTabs />;
    case "student":
    default:
      return <StudentTabs />;
  }
}
function MainTabs({ route }) {
  const roleFromParams = route?.params?.role ?? "student";
  return <TabsByRole role={roleFromParams} />;
}

/* ================= Root wrapper ================= */
export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <RootApp />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

/* ---------- Animated, Academic Loading (safe) ---------- */
function AcademicLoading({
  title = "Welcome to EduLink",
  subtitle = "Preparing your learning space",
}) {
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const marquee = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const marqueeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(marquee, {
          toValue: 220,
          duration: 1300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(marquee, {
          toValue: -120,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();
    marqueeLoop.start();
    return () => {
      floatLoop.stop();
      pulseLoop.stop();
      marqueeLoop.stop();
    };
  }, [float, pulse, marquee]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <View style={styles.loadingContainer}>
      <Animated.View
        style={[styles.loadingCard, { transform: [{ translateY }] }]}
        accessibilityRole="header"
      >
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <View style={styles.logoCircle}>
            <Ionicons
              name="school-outline"
              size={38}
              color={EDU_COLORS.primary}
            />
          </View>
        </Animated.View>

        <Text style={styles.loadingTitle}>{title}</Text>
        <LoadingSubtitle text={subtitle} />

        <View
          style={styles.progressTrack}
          accessible
          accessibilityLabel="Loading progress"
        >
          <Animated.View
            style={[
              styles.progressBar,
              { transform: [{ translateX: marquee }] },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

function LoadingSubtitle({ text }) {
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dots, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(dots, {
          toValue: 2,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(dots, {
          toValue: 3,
          duration: 500,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dots]);

  const count = Math.round(dots.__getValue?.() ?? 0) % 4;
  return <Text style={styles.loadingSubtitle}>{text + ".".repeat(count)}</Text>;
}

function Hint({ icon, label }) {
  return (
    <View style={styles.hintItem}>
      <Ionicons name={icon} size={16} color="rgba(0,0,0,0.66)" />
      <Text style={styles.hintText}>{label}</Text>
    </View>
  );
}

/* ================= Inner app ================= */
function RootApp() {
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(false);

  const navigationRef = useNavigationContainerRef();
  const [topRouteName, setTopRouteName] = useState("");
  const insets = useSafeAreaInsets();

  const isAuthRoute = topRouteName === "Login" || topRouteName === "Register";
  const isLanding = topRouteName === "Landing";

  const NAV_THEME = useMemo(
    () => ({
      ...NavDefaultTheme,
      colors: {
        ...NavDefaultTheme.colors,
        background: "transparent",
        card: "transparent",
        border: "transparent",
        text: NavDefaultTheme.colors.text,
        primary: NavDefaultTheme.colors.primary,
      },
    }),
    []
  );

  const toastTopOffset = useMemo(() => {
    const isClassroom = topRouteName === "ClassroomDetail";
    return isClassroom ? 0 : (insets?.top || 0) + NAVBAR_HEIGHT + 8;
  }, [topRouteName, insets]);

  useEffect(() => {
    const sub = onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);

      if (u) {
        setLoadingRole(true);
        let nextRole = "student";
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data.role === "student" && data.points >= 200) {
              await updateDoc(doc(db, "users", u.uid), { role: "tutor" });
              nextRole = "tutor";
            } else {
              nextRole = ["student", "tutor", "teacher", "parent"].includes(
                data.role
              )
                ? data.role
                : "student";
            }
          }
        } catch {
          nextRole = "student";
        } finally {
          setRole(nextRole);
          setLoadingRole(false);
        }
      } else {
        setRole(null);
      }
    });
    return sub;
  }, [navigationRef]);

  const handleStateChange = () => {
    const current = navigationRef.getCurrentRoute();
    setTopRouteName(current?.name ?? "");
  };

  if (user === undefined) return null;

  const UnauthedStack = () => (
    <Stack.Navigator screenOptions={stackCommon} initialRouteName="Landing">
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ParentDashboard" component={ParentDashboard} />
    </Stack.Navigator>
  );

  const AuthedStack = () => (
    <Stack.Navigator screenOptions={stackCommon}>
      <Stack.Screen
        name="Main"
        component={MainTabs}
        initialParams={{ role }}
        key={`main-${role || "student"}`}
      />
      <Stack.Screen name="AskQuestion" component={AskQuestionScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ClassroomDetail" component={ClassroomScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );

  return (
    <SafeAreaView style={styles.safeWrap} edges={["top", "left", "right"]}>
      <LinearGradient
        colors={APP_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.17, 1]}
        style={StyleSheet.absoluteFill}
      />

      {!isLanding && !isAuthRoute && (
        <>
          <TopNavbar
            currentRouteName={topRouteName}
            onBack={() => navigationRef.current?.goBack?.()}
            navigationRef={navigationRef}
          />
          <View style={{ height: NAVBAR_HEIGHT }} />
        </>
      )}

      <NavigationContainer
        theme={NAV_THEME}
        ref={navigationRef}
        onReady={handleStateChange}
        onStateChange={handleStateChange}
      >
        {user ? (
          loadingRole ? (
            <AcademicLoading
              title="Welcome to EduLink"
              subtitle="Preparing your learning space"
            />
          ) : (
            <AuthedStack />
          )
        ) : (
          <UnauthedStack />
        )}
      </NavigationContainer>

      {user && !loadingRole && !isLanding && !isAuthRoute && (
        <BottomNavbar
          role={role || "student"}
          navigationRef={navigationRef}
          activeTab={topRouteName}
        />
      )}

      <Toast
        topOffset={toastTopOffset}
        style={{ zIndex: 9999, elevation: 9999 }}
      />
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safeWrap: { flex: 1, backgroundColor: "transparent" },

  // Loading UI — centered both axes, high-visibility, modern card
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: "92%",
    maxWidth: 520,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 18,

    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    gap: 10,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: EDU_COLORS?.primary ?? "#0A8CA0",
  },
  loadingTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "800",
    color: "rgba(0,0,0,0.9)",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: "rgba(0,0,0,0.66)",
    textAlign: "center",
    marginTop: 2,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginTop: 10,
    overflow: "hidden",
  },
  progressBar: {
    width: 120,
    height: "100%",
    borderRadius: 6,
    backgroundColor: EDU_COLORS?.primary ?? "#0A8CA0",
  },
  hintRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 16,
  },
  hintItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  hintText: { fontSize: 12, color: "rgba(0,0,0,0.66)", fontWeight: "600" },
});
