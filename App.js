import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { getRedirectResult, onAuthStateChanged, signOut } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    LogBox,
    Platform,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import "react-native-get-random-values";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppSplash from "./components/AppSplash";
import OnboardingTour from "./components/OnboardingTour";
import WhatsNewModal from "./components/WhatsNewModal";
import { auth } from "./config/firebaseConfig";
import { COLORS, PRESET_EXERCISES, todayStr } from "./constants/data";
import { DEFAULT_THEME_ID, getThemeById } from "./constants/themes";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

import DashboardScreen from "./screens/DashboardScreen";
import ExercisesScreen from "./screens/ExercisesScreen";
import HistoryScreen from "./screens/HistoryScreen";
import LoginScreen from "./screens/LoginScreen";
import ProgressScreen from "./screens/ProgressScreen";
import TodayScreen from "./screens/TodayScreen";
import CoachScreen from "./screens/CoachScreen";

import {
    deleteWorkout,
    getWorkouts,
    listenExercises,
    listenUserSettings,
    listenWorkouts,
    loadWorkoutLocal,
    saveExercisesLib,
    saveWorkout,
} from "./utils/firestore";
import {
    applyNewFieldDefaults,
    getAddedFieldKeys,
    getResolvedFields,
    persistWorkoutChanges,
    removeExerciseFromWorkouts,
    renameExerciseInWorkouts,
} from "./utils/exerciseManagement";
import { checkCoachApiHealth } from "./utils/coachApi";

LogBox.ignoreLogs([
  "Non-serializable values were found in the navigation state",
]);

const Tab = createBottomTabNavigator();
const APP_VERSION = Constants.expoConfig?.version || "1.1.0";
const THEME_CACHE_KEY = "gt_theme_id";
const TAB_ICON_SIZE = 20;

function TabBarLabel({ focused, color, children }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        color,
        fontSize: 10,
        fontWeight: focused ? "700" : "600",
        lineHeight: 14,
        textAlign: "center",
        marginTop: 3,
        marginBottom: Platform.OS === "web" ? 4 : 2,
        ...(Platform.OS === "web" ? { overflow: "visible" } : {}),
      }}
    >
      {children}
    </Text>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[App Error Boundary] Caught error:", error);
    console.error("[App Error Boundary] Error Info:", errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.bg,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <MaterialCommunityIcons
            name="alert-circle"
            size={60}
            color={COLORS.error}
            style={{ marginBottom: 20 }}
          />
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: COLORS.text,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            Oops! Something went wrong
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: COLORS.muted,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.accent,
              paddingVertical: 12,
              paddingHorizontal: 30,
              borderRadius: 8,
            }}
            onPress={this.handleRetry}
          >
            <Text style={{ color: "#000", fontWeight: "bold", fontSize: 16 }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState({});
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [splashMessage, setSplashMessage] = useState("Loading GYM TRACKER...");
  const [exercises, setExercises] = useState(PRESET_EXERCISES);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRestoreHint, setShowRestoreHint] = useState(false);
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    AsyncStorage.getItem(THEME_CACHE_KEY).then((id) => {
      if (id && getThemeById(id).id === id) setThemeId(id);
    });
  }, []);

  useEffect(() => {
    if (!user || auth.isDemo) return undefined;
    const unsub = listenUserSettings((settings) => {
      if (settings?.themeId && getThemeById(settings.themeId).id === settings.themeId) {
        setThemeId(settings.themeId);
        AsyncStorage.setItem(THEME_CACHE_KEY, settings.themeId);
      }
    });
    return unsub;
  }, [user]);

  const handleThemeChange = useCallback(async (id) => {
    if (!getThemeById(id)) return;
    setThemeId(id);
    await AsyncStorage.setItem(THEME_CACHE_KEY, id);
  }, []);

  useEffect(() => {
    let unsub;
    let cancelled = false;

    const loadDemoSession = async () => {
      const data = await AsyncStorage.getItem("gt_workouts_local_demo-user");
      if (data) setWorkouts(JSON.parse(data));
      setWorkoutsLoading(false);
    };

    (async () => {
      if (Platform.OS === "web") {
        try {
          const result = await getRedirectResult(auth);
          if (result?.user) {
            console.info(
              "[GymTracker Auth] Redirect sign-in:",
              result.user.email || result.user.uid,
            );
          }
        } catch (err) {
          console.error(
            "[GymTracker Auth] Redirect failed:",
            err?.code,
            err?.message,
          );
        }
      }

      if (cancelled) return;

      try {
        const isDemo = await AsyncStorage.getItem("gt_demo_session");
        if (cancelled) return;

        if (isDemo === "true") {
          auth.isDemo = true;
          setUser({ uid: "demo-user", displayName: "Demo Athlete" });
          setLoading(false);
          setSplashMessage("Loading your workouts...");
          await loadDemoSession();
          return;
        }
      } catch (err) {
        console.warn("[GymTracker Auth] Demo session check failed:", err);
      }

      if (cancelled) return;

      unsub = onAuthStateChanged(auth, (currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        setLoading(false);
        if (Platform.OS === "web") {
          console.info(
            "[GymTracker Auth] Session:",
            currentUser?.email || currentUser?.uid || "none",
          );
        }
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkouts({});
      setWorkoutsLoading(true);
      setExercises(PRESET_EXERCISES);
      setShowRestoreHint(false);
    }
  }, [user]);

  // Warm up the Coach API as soon as the user is in, so a free-tier
  // server that went to sleep is already awake when they open the Coach tab.
  useEffect(() => {
    if (user) {
      checkCoachApiHealth().catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    if (auth.isDemo) return undefined;

    let cancelled = false;

    const bootstrapWorkouts = async () => {
      setWorkoutsLoading(true);
      setSplashMessage("Loading your workouts...");

      const local = await loadWorkoutLocal();
      const localEmpty = !local || Object.keys(local).length === 0;

      if (!cancelled && !localEmpty) {
        setWorkouts(local);
      }

      if (localEmpty) {
        setSplashMessage("Restoring your workouts from cloud...");
        setShowRestoreHint(true);
        try {
          const cloud = await getWorkouts();
          if (!cancelled) setWorkouts(cloud);
        } catch (err) {
          console.error("Cloud restore error:", err);
        }
      }

      if (!cancelled) setWorkoutsLoading(false);
    };

    bootstrapWorkouts();

    const unsubscribe = listenWorkouts((data) => {
      if (!cancelled) {
        setWorkouts(data);
        setWorkoutsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (user && !auth.isDemo) {
      const unsubscribe = listenExercises((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setExercises(data);
        } else {
          setExercises(PRESET_EXERCISES);
        }
      });
      return unsubscribe;
    }
    if (user && auth.isDemo) {
      AsyncStorage.getItem("gt_exercises_local_demo-user")
        .then((data) => {
          if (data) setExercises(JSON.parse(data));
          else setExercises(PRESET_EXERCISES);
        })
        .catch(() => setExercises(PRESET_EXERCISES));
    }
    return undefined;
  }, [user]);

  useEffect(() => {
    if (!user || workoutsLoading) return;
    AsyncStorage.multiGet(["gt_last_seen_version", "gt_onboarding_done"]).then(
      ([[, seen], [, onboarded]]) => {
        if (!onboarded) {
          // Brand-new install: show the guided tour instead of What's New.
          setShowOnboarding(true);
        } else if (seen !== APP_VERSION) {
          setShowWhatsNew(true);
        }
      },
    );
  }, [user, workoutsLoading]);

  const handleWhatsNewDismiss = async () => {
    await AsyncStorage.setItem("gt_last_seen_version", APP_VERSION);
    setShowWhatsNew(false);
  };

  const handleOnboardingDone = async () => {
    await AsyncStorage.multiSet([
      ["gt_onboarding_done", "true"],
      ["gt_last_seen_version", APP_VERSION],
    ]);
    setShowOnboarding(false);
  };

  const handleWorkoutsChange = useCallback((nextWorkouts) => {
    setWorkouts(nextWorkouts);
  }, []);

  const persistExercises = async (updated) => {
    setExercises(updated);
    if (user && !auth.isDemo) {
      await saveExercisesLib(updated);
    } else {
      await AsyncStorage.setItem(
        "gt_exercises_local_demo-user",
        JSON.stringify(updated),
      );
    }
  };

  const addCustomExercise = async (name, category, fields) => {
    const newEx = { name, category, ...(fields?.length ? { fields } : {}) };
    const updated = [...exercises, newEx];
    await persistExercises(updated);
  };

  const updateExerciseWithHistory = async (
    oldName,
    updatedExercise,
    { renameInHistory = false, fillNewFieldsWithZero = false } = {},
  ) => {
    const updated = {
      name: updatedExercise.name,
      category: updatedExercise.category,
      ...(updatedExercise.fields?.length
        ? { fields: updatedExercise.fields }
        : {}),
    };

    const nextExercises = exercises.map((ex) =>
      ex.name === oldName ? updated : ex,
    );
    await persistExercises(nextExercises);

    let nextWorkouts = { ...workouts };
    const changedDates = new Set();
    const targetName =
      renameInHistory && oldName !== updated.name ? updated.name : oldName;

    if (renameInHistory && oldName !== updated.name) {
      const result = renameExerciseInWorkouts(nextWorkouts, oldName, updated.name);
      nextWorkouts = result.workouts;
      result.changedDates.forEach((d) => changedDates.add(d));
    }

    if (fillNewFieldsWithZero) {
      const oldExercise = exercises.find((e) => e.name === oldName);
      const addedKeys = getAddedFieldKeys(
        getResolvedFields(oldExercise),
        updated.fields,
      ).map((f) => f.key);
      if (addedKeys.length) {
        const result = applyNewFieldDefaults(
          nextWorkouts,
          targetName,
          addedKeys,
          0,
        );
        nextWorkouts = result.workouts;
        result.changedDates.forEach((d) => changedDates.add(d));
      }
    }

    if (changedDates.size > 0) {
      setWorkouts(nextWorkouts);
      await persistWorkoutChanges(
        nextWorkouts,
        [...changedDates],
        saveWorkout,
        deleteWorkout,
      );
    }
  };

  const removeExerciseWithHistory = async (
    exerciseName,
    { removeFromHistory = false } = {},
  ) => {
    const nextExercises = exercises.filter((ex) => ex.name !== exerciseName);
    await persistExercises(nextExercises);

    if (removeFromHistory) {
      const { workouts: nextWorkouts, changedDates } = removeExerciseFromWorkouts(
        workouts,
        exerciseName,
      );
      setWorkouts(nextWorkouts);
      await persistWorkoutChanges(
        nextWorkouts,
        changedDates,
        saveWorkout,
        deleteWorkout,
      );
    }
  };

  const addExerciseToToday = async (name, navigation) => {
    const dateStr = todayStr();
    const wk = workouts[dateStr] || { exs: [] };

    if (!wk.exs.find((e) => e.name === name)) {
      const updatedWorkout = { ...wk, exs: [...wk.exs, { name, sets: [] }] };

      setWorkouts((p) => ({ ...p, [dateStr]: updatedWorkout }));
      await saveWorkout(dateStr, updatedWorkout);

      Alert.alert("✓ Added", `"${name}" added to today's workout!`, [
        { text: "OK" },
        { text: "View Today", onPress: () => navigation.navigate("Today") },
      ]);
    } else {
      Alert.alert("Already Added", `"${name}" is already in today's workout.`);
    }
  };

  const showSplash = loading || (user && workoutsLoading);

  return (
    <ThemeProvider themeId={themeId}>
      <SafeAreaProvider>
      {showSplash ? (
        <AppSplash message={splashMessage} />
      ) : (
        <MainApp
          user={user}
          themeId={themeId}
          onThemeChange={handleThemeChange}
          exercises={exercises}
          workouts={workouts}
          workoutsLoading={workoutsLoading}
          showWhatsNew={showWhatsNew}
          showOnboarding={showOnboarding}
          onOnboardingDone={handleOnboardingDone}
          showRestoreHint={showRestoreHint}
          onDismissRestoreHint={() => setShowRestoreHint(false)}
          onWhatsNewDismiss={handleWhatsNewDismiss}
          onWorkoutsChange={handleWorkoutsChange}
          addCustomExercise={addCustomExercise}
          updateExerciseWithHistory={updateExerciseWithHistory}
          removeExerciseWithHistory={removeExerciseWithHistory}
          addExerciseToToday={addExerciseToToday}
          setUser={setUser}
          setWorkouts={setWorkouts}
          setWorkoutsLoading={setWorkoutsLoading}
        />
      )}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function MainApp({
  user,
  themeId,
  onThemeChange,
  exercises,
  workouts,
  workoutsLoading,
  showWhatsNew,
  showOnboarding,
  onOnboardingDone,
  showRestoreHint,
  onDismissRestoreHint,
  onWhatsNewDismiss,
  onWorkoutsChange,
  addCustomExercise,
  updateExerciseWithHistory,
  removeExerciseWithHistory,
  addExerciseToToday,
  setUser,
  setWorkouts,
  setWorkoutsLoading,
}) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  const tabScreenOptions = useMemo(
    () => ({
      tabBarStyle: {
        backgroundColor: C.tabBar || C.card,
        borderTopColor: C.border,
        borderTopWidth: 1,
        // Web needs extra height so 6 tab labels are not clipped.
        height: (Platform.OS === "web" ? 74 : 58) + insets.bottom,
        paddingTop: Platform.OS === "web" ? 8 : 4,
        paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 10 : 6),
      },
      tabBarActiveTintColor: C.accent,
      tabBarInactiveTintColor: C.muted,
      tabBarIconStyle: {
        marginTop: 0,
        marginBottom: 0,
        width: TAB_ICON_SIZE,
        height: TAB_ICON_SIZE,
      },
      tabBarItemStyle: {
        paddingVertical: 0,
        justifyContent: "center",
      },
      tabBarLabel: TabBarLabel,
      headerShown: false,
      tabBarHideOnKeyboard: true,
      lazy: true,
      detachInactiveScreens: true,
    }),
    [C, insets.bottom],
  );

  return (
    <ErrorBoundary>
      <StatusBar style="light" backgroundColor={C.bg} />
        <NavigationContainer>
          {!user ? (
            <SafeAreaView
              style={{ flex: 1, backgroundColor: C.bg }}
              edges={["top", "left", "right"]}
            >
              <LoginScreen
                onGuestLogin={async () => {
                  auth.isDemo = true;
                  await AsyncStorage.setItem("gt_demo_session", "true");
                  setWorkoutsLoading(true);
                  try {
                    const data = await AsyncStorage.getItem(
                      "gt_workouts_local_demo-user",
                    );
                    if (data) setWorkouts(JSON.parse(data));
                    else setWorkouts({});
                  } catch {
                    setWorkouts({});
                  }
                  setWorkoutsLoading(false);
                  setUser({ uid: "demo-user", displayName: "Demo Athlete" });
                }}
              />
            </SafeAreaView>
          ) : (
            <Tab.Navigator
              initialRouteName="Dashboard"
              screenOptions={tabScreenOptions}
            >
              <Tab.Screen
                name="Dashboard"
                children={({ navigation }) => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: C.bg }}
                    edges={["top"]}
                  >
                    <DashboardScreen
                      user={user}
                      workouts={workouts}
                      navigation={navigation}
                      themeId={themeId}
                      onThemeChange={onThemeChange}
                      showRestoreHint={showRestoreHint}
                      onDismissRestoreHint={onDismissRestoreHint}
                      onWorkoutsChange={onWorkoutsChange}
                      onSignOut={async () => {
                        if (auth.isDemo) {
                          auth.isDemo = false;
                          await AsyncStorage.removeItem("gt_demo_session");
                          setUser(null);
                        } else {
                          signOut(auth);
                        }
                      }}
                    />
                    <WhatsNewModal
                      visible={showWhatsNew}
                      version={APP_VERSION}
                      onDismiss={onWhatsNewDismiss}
                    />
                    <OnboardingTour
                      visible={showOnboarding}
                      onDone={onOnboardingDone}
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Dashboard",
                  tabBarIcon: ({ color }) => (
                    <MaterialCommunityIcons
                      name="view-dashboard"
                      size={TAB_ICON_SIZE}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="Today"
                children={({ navigation }) => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: C.bg }}
                    edges={["top"]}
                  >
                    <TodayScreen
                      navigation={navigation}
                      exercises={exercises}
                      workouts={workouts}
                      onWorkoutsChange={onWorkoutsChange}
                      onAddCustomExercise={addCustomExercise}
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Today",
                  tabBarIcon: ({ color }) => (
                    <MaterialCommunityIcons
                      name="dumbbell"
                      size={TAB_ICON_SIZE}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="History"
                children={() => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: C.bg }}
                    edges={["top"]}
                  >
                    <HistoryScreen
                      workouts={workouts}
                      loading={workoutsLoading}
                      exercises={exercises}
                      onWorkoutsChange={onWorkoutsChange}
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "History",
                  tabBarIcon: ({ color }) => (
                    <MaterialCommunityIcons
                      name="history"
                      size={TAB_ICON_SIZE}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="Progress"
                children={() => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: C.bg }}
                    edges={["top"]}
                  >
                    <ProgressScreen
                      workouts={workouts}
                      loading={workoutsLoading}
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Progress",
                  tabBarIcon: ({ color }) => (
                    <MaterialCommunityIcons
                      name="chart-line"
                      size={TAB_ICON_SIZE}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="Exercises"
                children={({ navigation }) => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: C.bg }}
                    edges={["top"]}
                  >
                    <ExercisesScreen
                      exercises={exercises}
                      workouts={workouts}
                      loading={false}
                      onAddCustomExercise={addCustomExercise}
                      onUpdateExercise={updateExerciseWithHistory}
                      onRemoveExercise={removeExerciseWithHistory}
                      onAddToday={(name) =>
                        addExerciseToToday(name, navigation)
                      }
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Exercises",
                  tabBarIcon: ({ color }) => (
                    <MaterialCommunityIcons
                      name="dumbbell"
                      size={TAB_ICON_SIZE}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="Coach"
                children={() => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: C.bg }}
                    edges={["top"]}
                  >
                    <CoachScreen workouts={workouts} exercises={exercises} />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Coach",
                  tabBarIcon: ({ color }) => (
                    <MaterialCommunityIcons
                      name="robot"
                      size={TAB_ICON_SIZE}
                      color={color}
                    />
                  ),
                }}
              />
            </Tab.Navigator>
          )}
        </NavigationContainer>
    </ErrorBoundary>
  );
}
