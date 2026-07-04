import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged, signOut } from "firebase/auth";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    LogBox,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import "react-native-get-random-values";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppSplash from "./components/AppSplash";
import WhatsNewModal from "./components/WhatsNewModal";
import { auth } from "./config/firebaseConfig";
import { COLORS, PRESET_EXERCISES, todayStr } from "./constants/data";

import DashboardScreen from "./screens/DashboardScreen";
import ExercisesScreen from "./screens/ExercisesScreen";
import HistoryScreen from "./screens/HistoryScreen";
import LoginScreen from "./screens/LoginScreen";
import ProgressScreen from "./screens/ProgressScreen";
import TodayScreen from "./screens/TodayScreen";

import {
    getWorkouts,
    listenExercises,
    listenWorkouts,
    loadWorkoutLocal,
    saveExercisesLib,
    saveWorkout,
} from "./utils/firestore";

LogBox.ignoreLogs([
  "Non-serializable values were found in the navigation state",
]);

const Tab = createBottomTabNavigator();
const APP_VERSION = Constants.expoConfig?.version || "1.1.0";

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
  const [showRestoreHint, setShowRestoreHint] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("gt_demo_session")
      .then((isDemo) => {
        if (isDemo === "true") {
          auth.isDemo = true;
          setUser({ uid: "demo-user", displayName: "Demo Athlete" });
          setLoading(false);
          setSplashMessage("Loading your workouts...");
          AsyncStorage.getItem("gt_workouts_local_demo-user")
            .then((data) => {
              if (data) setWorkouts(JSON.parse(data));
              setWorkoutsLoading(false);
            })
            .catch(() => setWorkoutsLoading(false));
        } else {
          const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
          });
          return unsubscribe;
        }
      })
      .catch(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
        return unsubscribe;
      });
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkouts({});
      setWorkoutsLoading(true);
      setExercises(PRESET_EXERCISES);
      setShowRestoreHint(false);
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
    AsyncStorage.getItem("gt_last_seen_version").then((seen) => {
      if (seen !== APP_VERSION) setShowWhatsNew(true);
    });
  }, [user, workoutsLoading]);

  const handleWhatsNewDismiss = async () => {
    await AsyncStorage.setItem("gt_last_seen_version", APP_VERSION);
    setShowWhatsNew(false);
  };

  const handleWorkoutsChange = useCallback((nextWorkouts) => {
    setWorkouts(nextWorkouts);
  }, []);

  const addCustomExercise = async (name, category, fields) => {
    const newEx = { name, category, ...(fields?.length ? { fields } : {}) };
    const updated = [...exercises, newEx];
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

  if (showSplash) {
    return <AppSplash message={splashMessage} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={COLORS.bg} />
        <NavigationContainer>
          {!user ? (
            <SafeAreaView
              style={{ flex: 1, backgroundColor: COLORS.bg }}
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
              screenOptions={{
                tabBarStyle: {
                  backgroundColor: COLORS.card,
                  borderTopColor: COLORS.border,
                  borderTopWidth: 1,
                  paddingBottom: 4,
                  paddingTop: 4,
                  height: 70,
                },
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.muted,
                tabBarLabelStyle: {
                  fontSize: 10,
                  fontWeight: "600",
                  marginTop: 0,
                },
                headerShown: false,
                tabBarHideOnKeyboard: true,
              }}
            >
              <Tab.Screen
                name="Dashboard"
                children={({ navigation }) => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: COLORS.bg }}
                    edges={["top"]}
                  >
                    <DashboardScreen
                      user={user}
                      workouts={workouts}
                      navigation={navigation}
                      showRestoreHint={showRestoreHint}
                      onDismissRestoreHint={() => setShowRestoreHint(false)}
                      onWorkoutsChange={handleWorkoutsChange}
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
                      onDismiss={handleWhatsNewDismiss}
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Dashboard",
                  tabBarIcon: ({ color, size }) => (
                    <MaterialCommunityIcons
                      name="view-dashboard"
                      size={size}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="Today"
                children={({ navigation }) => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: COLORS.bg }}
                    edges={["top"]}
                  >
                    <TodayScreen
                      navigation={navigation}
                      exercises={exercises}
                      workouts={workouts}
                      onWorkoutsChange={handleWorkoutsChange}
                      onAddCustomExercise={addCustomExercise}
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Today",
                  tabBarIcon: ({ color, size }) => (
                    <MaterialCommunityIcons
                      name="dumbbell"
                      size={size}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="History"
                children={() => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: COLORS.bg }}
                    edges={["top"]}
                  >
                    <HistoryScreen
                      workouts={workouts}
                      loading={workoutsLoading}
                      onWorkoutsChange={handleWorkoutsChange}
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "History",
                  tabBarIcon: ({ color, size }) => (
                    <MaterialCommunityIcons
                      name="history"
                      size={size}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="Progress"
                children={() => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: COLORS.bg }}
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
                  tabBarIcon: ({ color, size }) => (
                    <MaterialCommunityIcons
                      name="chart-line"
                      size={size}
                      color={color}
                    />
                  ),
                }}
              />
              <Tab.Screen
                name="Exercises"
                children={({ navigation }) => (
                  <SafeAreaView
                    style={{ flex: 1, backgroundColor: COLORS.bg }}
                    edges={["top"]}
                  >
                    <ExercisesScreen
                      exercises={exercises}
                      loading={false}
                      onAddCustomExercise={addCustomExercise}
                      onAddToday={(name) =>
                        addExerciseToToday(name, navigation)
                      }
                    />
                  </SafeAreaView>
                )}
                options={{
                  tabBarLabel: "Exercises",
                  tabBarIcon: ({ color, size }) => (
                    <MaterialCommunityIcons
                      name="dumbbell"
                      size={size}
                      color={color}
                    />
                  ),
                }}
              />
            </Tab.Navigator>
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
