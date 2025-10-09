// frontend/App.js
import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
} from "react-native";
import {
  NavigationContainer,
  useNavigationContainerRef,
  CommonActions,
  DefaultTheme as NavDefaultTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider as PaperProvider } from "react-native-paper";
import { paperTheme, EDU_COLORS } from "./theme/colors";
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

/* Screens */
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

/* ---------- Gradient palette ---------- */
const C = {
  primary: EDU_COLORS.primary,
  secondary: EDU_COLORS.secondary,
  base: EDU_COLORS.base,
};

/* ---------- Shared options ---------- */
const stackCommon = {
  headerShown: false,
  contentStyle: { backgroundColor: "transparent" }, // let the global gradient show through
};

/** Floating, friendly, high-contrast tab bar */
const floatingTabBar = {
  position: "absolute",
  left: 16,
  right: 16,
  bottom: 16,
  height: 64,
  borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.95)",
  borderTopWidth: 0,
  paddingHorizontal: 6,
  ...Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
    },
    android: { elevation: 10 },
  }),
};

const tabsCommon = {
  headerShown: false,
  tabBarActiveTintColor: "#0F766E",
  tabBarInactiveTintColor: "#6B7280",
  tabBarStyle: floatingTabBar,
  tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginBottom: 6 },
  tabBarItemStyle: { paddingTop: 6 },
  sceneContainerStyle: { backgroundColor: "transparent" },
};

/* ---------- Tabs ---------- */
function StudentTabs() {
  return (
    <Tab.Navigator screenOptions={tabsCommon}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏫</Text> }}
      />
      <Tab.Screen
        name="Q&A"
        component={QuestionFeedScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>❓</Text> }}
      />
      <Tab.Screen
        name="Resources"
        component={ResourcesScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📚</Text> }}
      />
      <Tab.Screen
        name="StudyPlanner"
        component={StudyPlannerScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text> }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text> }}
      />
    </Tab.Navigator>
  );
}
const TutorTabs = StudentTabs;

function TeacherTabs() {
  return (
    <Tab.Navigator screenOptions={tabsCommon}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏫</Text> }}
      />
      <Tab.Screen
        name="Q&A"
        component={QuestionFeedScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>❓</Text> }}
      />
      <Tab.Screen
        name="Resources"
        component={ResourcesScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📚</Text> }}
      />
    </Tab.Navigator>
  );
}

function ParentTabs() {
  return (
    <Tab.Navigator screenOptions={tabsCommon}>
      <Tab.Screen
        name="Dashboard"
        component={ParentDashboard}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }}
      />
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
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔔</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

/* ---------- Tabs by role ---------- */
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

/* ---------- Friendly titles for breadcrumbs ---------- */
const FRIENDLY_TITLES = {
  Main: "Home",
  AskQuestion: "Ask Question",
  Notifications: "Notifications",
  ClassroomDetail: "Classroom",
  Profile: "Profile",
  Login: "Login",
  Register: "Create Account",
  ParentDashboard: "Parent Dashboard",
  // tabs
  Home: "Home",
  "Q&A": "Q&A",
  Resources: "Resources",
  StudyPlanner: "Study Planner",
  Progress: "Progress",
  Dashboard: "Dashboard",
};

function buildBreadcrumbsFromState(state, parents = []) {
  if (!state || !state.routes) return [];

  const results = [];
  const isStack = state.type === "stack";

  const lastIndex = state.index ?? state.routes.length - 1;
  const slice = isStack
    ? state.routes.slice(0, lastIndex + 1)
    : [state.routes[lastIndex]];

  for (const route of slice) {
    const label =
      FRIENDLY_TITLES[route.name] ||
      (route.params && route.params.title) ||
      route.name;

    results.push({
      name: route.name,
      label,
      params: route.params,
      parents: parents.map((p) => p.name),
    });

    if (route.state) {
      results.push(
        ...buildBreadcrumbsFromState(route.state, [...parents, route])
      );
    }
  }

  return results;
}

const defaultTabForRole = (role) => {
  switch (role) {
    case "parent":
      return "Dashboard";
    case "teacher":
    case "tutor":
    case "student":
    default:
      return "Home";
  }
};

/* ================= Root wrapper with SafeAreaProvider ================= */
export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <StatusBar translucent barStyle="light-content" />
        {/* One global gradient for the entire app */}
        <LinearGradient
          colors={[C.primary, C.secondary, C.base]}
          start={{ x: 0.1, y: 0.0 }}
          end={{ x: 0.95, y: 1.0 }}
          style={StyleSheet.absoluteFill}
        />
        <RootApp />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

/* ================= Inner app ================= */
function RootApp() {
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const navigationRef = useNavigationContainerRef();
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [topRouteName, setTopRouteName] = useState("");
  const insets = useSafeAreaInsets();

  // Transparent navigation theme so the global gradient shows everywhere
  const NAV_THEME = {
    ...NavDefaultTheme,
    colors: {
      ...NavDefaultTheme.colors,
      background: "transparent",
      card: "transparent",
      border: "transparent",
      text: NavDefaultTheme.colors.text,
      primary: NavDefaultTheme.colors.primary,
    },
  };

  const checkRolePromotion = async (userData, userId) => {
    if (userData.role === "student" && userData.points >= 200) {
      await updateDoc(doc(db, "users", userId), { role: "tutor" });
      return "tutor";
    }
    return userData.role;
  };

  const handleStateChange = () => {
    const state = navigationRef.getRootState();
    const full = buildBreadcrumbsFromState(state);
    setBreadcrumbs(full);
    const current = navigationRef.getCurrentRoute();
    setTopRouteName(current?.name ?? "");
  };

  const onCrumbPress = (idx) => {
    navigateToBreadcrumb(navigationRef, breadcrumbs, idx);
  };

  useEffect(() => {
    const sub = onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);
      if (u) {
        setLoadingRole(true);
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const userData = snap.data();
            const currentRole = await checkRolePromotion(userData, u.uid);
            setRole(
              ["student", "tutor", "teacher", "parent"].includes(currentRole)
                ? currentRole
                : "student"
            );
          } else {
            setRole("student");
          }
        } catch (e) {
          console.warn("Failed to read role:", e);
          setRole("student");
        } finally {
          setLoadingRole(false);
        }
      } else {
        setRole(null);
      }
    });
    return sub;
  }, []);

  if (user === undefined) return null;

  const AuthStack = () => (
    <Stack.Navigator screenOptions={stackCommon}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        initialParams={{ msg: null }}
        options={{
          // Prevent auto back affordance & gestures on Login
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          // Keep default gestures for Register (can go back to Login if needed)
          headerBackVisible: true,
          gestureEnabled: true,
        }}
      />
      <Stack.Screen name="ParentDashboard" component={ParentDashboard} />
    </Stack.Navigator>
  );

  const AppStack = () => (
    <Stack.Navigator screenOptions={stackCommon}>
      <Stack.Screen
        name="Main"
        component={MainTabs}
        initialParams={{ role }}
        key={`main-${role}`}
      />
      <Stack.Screen name="AskQuestion" component={AskQuestionScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ClassroomDetail" component={ClassroomScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );

  return (
    <SafeAreaView style={styles.safeWrap} edges={["top", "left", "right"]}>
      {/* small spacer below system status area */}
      <View style={{ height: Math.max(insets.top * 0.25, 8) }} />

      {/* Breadcrumbs (hidden on Login/Register and when unauthenticated) */}
      {user && topRouteName !== "Login" && topRouteName !== "Register" && (
        <View style={styles.breadcrumbsWrap}>
          <View style={styles.breadcrumbsPill}>
            {breadcrumbs.map((crumb, idx) => (
              <Pressable
                key={`${crumb.name}-${idx}`}
                onPress={() => onCrumbPress(idx)}
                hitSlop={8}
              >
                <Text style={styles.breadcrumbText}>
                  {crumb.label}
                  {idx < breadcrumbs.length - 1 ? " / " : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <NavigationContainer
        theme={NAV_THEME}
        ref={navigationRef}
        onReady={handleStateChange}
        onStateChange={handleStateChange}
      >
        {user ? (
          loadingRole ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  color: "white",
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                Loading Your Role …
              </Text>
            </View>
          ) : (
            <AppStack />
          )
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>

      <Toast />
    </SafeAreaView>
  );
}

function navigateToBreadcrumb(navigationRef, crumbs, targetIndex) {
  const crumb = crumbs?.[targetIndex];
  if (!crumb || !navigationRef.current) return;

  // If the target is a top-level route (no parents)
  if (!crumb.parents || crumb.parents.length === 0) {
    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: crumb.name, params: crumb.params }],
      })
    );
    return;
  }

  // For nested ones, rebuild the full parent chain
  const top = crumb.parents[0];
  let params = {};
  let cursor = params;

  for (let i = 1; i < crumb.parents.length; i++) {
    cursor.screen = crumb.parents[i];
    cursor.params = {};
    cursor = cursor.params;
  }

  cursor.screen = crumb.name;
  cursor.params = crumb.params ?? {};

  // Reset stack to this hierarchy
  navigationRef.current.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: top, params }],
    })
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safeWrap: { flex: 1, backgroundColor: "transparent" },

  /* Breadcrumbs */
  breadcrumbsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    minHeight: 24,
  },
  breadcrumbsPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    maxWidth: undefined,
    minWidth: 220,
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "nowrap",
  },
  breadcrumbText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    opacity: 0.95,
  },
});
