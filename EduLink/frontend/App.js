// frontend/App.js
import { useEffect, useState } from "react";
import { ImageBackground } from "react-native";

import LoadingPage from "./components/LoadingPage";

import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
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
import { paperTheme, EDU_COLORS, APP_GRADIENT } from "./theme/colors";
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
import BottomNavbar, { BOTTOM_NAV_HEIGHT } from "./components/BottomNavbar";
import AcademicLoading from "./components/AcademicLoading";
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

<LinearGradient
  colors={APP_GRADIENT}
  start={{ x: 0, y: 0 }}
  end={{ x: 0, y: 1 }}
  locations={[0, 0.4, 1]}
  style={StyleSheet.absoluteFill}
/>;

/* ---------- Global Toast host (clears fixed navbar) ---------- */
function ToastHost() {
  const insets = useSafeAreaInsets();
  return (
    <Toast
      topOffset={(insets?.top || 0) + NAVBAR_HEIGHT + 8}
      style={{ zIndex: 9999, elevation: 9999 }}
    />
  );
}

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

/* ================= Root wrapper with SafeAreaProvider ================= */
export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <RootApp />
      </PaperProvider>
      <ToastHost />
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

  const isAuthRoute = topRouteName === "Login" || topRouteName === "Register";

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
        options={{ headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerBackVisible: true, gestureEnabled: true }}
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
      {isAuthRoute ? (
        // Full-screen gradient for Login/Register
        <LinearGradient
          colors={APP_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          locations={[0, 0.17, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        // App gradient for the rest of the app
        <LinearGradient
          colors={APP_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          locations={[0, 0.17, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Fixed top navbar */}
      {/* Fixed top navbar */}
      <TopNavbar
        currentRouteName={topRouteName}
        onBack={() => navigationRef.current?.goBack?.()}
        navigationRef={navigationRef} // ✅ provide ref so navbar can navigate
      />

      {/* Spacer exactly equal to navbar */}
      <View style={{ height: NAVBAR_HEIGHT }} />

      {/* Breadcrumbs (non-auth only) */}
      {user && !isAuthRoute && (
        <View style={styles.breadcrumbsWrap}>
          {/* ...existing breadcrumb code... */}
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
            <LoadingPage
              title="Welcome to EduLink"
              subtitle="Preparing your learning space …"
              imageSource={require("./assets/app-logo.png")}
            />
          ) : (
            <AppStack />
          )
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>

      {/* Bottom nav only when signed in & not on auth routes */}
      {user && !loadingRole && !isAuthRoute && (
        <BottomNavbar
          role={role || "student"}
          navigationRef={navigationRef}
          activeTab={topRouteName}
        />
      )}
    </SafeAreaView>
  );
}

function navigateToBreadcrumb(navigationRef, crumbs, targetIndex) {
  const crumb = crumbs?.[targetIndex];
  if (!crumb || !navigationRef.current) return;

  if (!crumb.parents || crumb.parents.length === 0) {
    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: crumb.name, params: crumb.params }],
      })
    );
    return;
  }

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

  breadcrumbsWrap: {
    paddingHorizontal: 22,
    marginTop: -64,
    marginBottom: 16,
  },
  breadcrumbLine: {
    fontWeight: "900",
    letterSpacing: 0.2,
    width: "100%",
    flexShrink: 1,
    fontSize: 16,
    color: "rgba(255,255,255,0.82)",
  },
  breadcrumbLink: {
    color: "black",
    textDecorationLine: "none",
  },
  breadcrumbSep: {
    color: "black",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  loadingText: {
    marginTop: 16,
    color: "black",
    fontWeight: "600",
    fontSize: 20,
    textAlign: "center",
  },
});
