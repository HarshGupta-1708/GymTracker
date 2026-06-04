import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, LogBox, Alert, StatusBar as RNStatusBar, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './config/firebaseConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, PRESET_EXERCISES, todayStr } from './constants/data';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './screens/LoginScreen';
import TodayScreen from './screens/TodayScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProgressScreen from './screens/ProgressScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import DashboardScreen from './screens/DashboardScreen';

import { listenWorkouts, listenExercises, saveExercisesLib, saveWorkout } from './utils/firestore';

// Suppress warnings
LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);

const Tab = createBottomTabNavigator();

// Error Boundary Component for catching app crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[App Error Boundary] Caught error:', error);
    console.error('[App Error Boundary] Error Info:', errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <MaterialCommunityIcons name="alert-circle" size={60} color={COLORS.error} style={{ marginBottom: 20 }} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 10, textAlign: 'center' }}>
            Oops! Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 20, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 }}
            onPress={this.handleRetry}
          >
            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Try Again</Text>
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
  const [exercises, setExercises] = useState(PRESET_EXERCISES);

  useEffect(() => {
    // Check if there was a demo session stored locally
    AsyncStorage.getItem("gt_demo_session").then((isDemo) => {
      if (isDemo === "true") {
        auth.isDemo = true;
        setUser({ uid: "demo-user", displayName: "Demo Athlete" });
        setLoading(false);
        // Load local workouts
        AsyncStorage.getItem("gt_workouts_local_demo-user").then((data) => {
          if (data) setWorkouts(JSON.parse(data));
          setWorkoutsLoading(false);
        }).catch(() => setWorkoutsLoading(false));
      } else {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
        return unsubscribe;
      }
    }).catch(() => {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return unsubscribe;
    });
  }, []);

  useEffect(() => {
    // Reset/cleanup workouts state when user signs out or shifts session
    if (!user) {
      setWorkouts({});
      setWorkoutsLoading(true);
      setExercises(PRESET_EXERCISES);
    }
  }, [user]);

  useEffect(() => {
    if (user && !auth.isDemo) {
      const unsubscribe = listenWorkouts((data) => {
        setWorkouts(data);
        setWorkoutsLoading(false);
      });
      return unsubscribe;
    }
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
    } else if (user && auth.isDemo) {
      // Try to load local exercises for guest mode
      AsyncStorage.getItem("gt_exercises_local_demo-user").then((data) => {
        if (data) {
          setExercises(JSON.parse(data));
        } else {
          setExercises(PRESET_EXERCISES);
        }
      }).catch(() => {
        setExercises(PRESET_EXERCISES);
      });
    }
  }, [user]);

  const addCustomExercise = async (name, category) => {
    const newEx = { name, category };
    const updated = [...exercises, newEx];
    setExercises(updated);
    if (user && !auth.isDemo) {
      await saveExercisesLib(updated);
    } else {
      // Save locally if guest/demo
      await AsyncStorage.setItem("gt_exercises_local_demo-user", JSON.stringify(updated));
    }
  };

  const addExerciseToToday = async (name, navigation) => {
    const dateStr = todayStr();
    const wk = workouts[dateStr] || { exs: [] };
    
    if (!wk.exs.find((e) => e.name === name)) {
      const updatedWorkout = { ...wk, exs: [...wk.exs, { name, sets: [] }] };
      
      setWorkouts((p) => {
        const next = { ...p, [dateStr]: updatedWorkout };
        return next;
      });
      await saveWorkout(dateStr, updatedWorkout);
      
      Alert.alert(
        "✓ Added",
        `"${name}" added to today's workout!`,
        [
          { text: "OK" },
          { text: "View Today", onPress: () => navigation.navigate("Today") }
        ]
      );
    } else {
      Alert.alert("Already Added", `"${name}" is already in today's workout.`);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={COLORS.bg} />
        <NavigationContainer>
          {!user ? (
            <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top', 'left', 'right']}>
              <LoginScreen
                onGuestLogin={async () => {
                  auth.isDemo = true;
                  await AsyncStorage.setItem("gt_demo_session", "true");
                  setWorkoutsLoading(true);
                  try {
                    const data = await AsyncStorage.getItem("gt_workouts_local_demo-user");
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
                  fontWeight: '600',
                  marginTop: 0,
                },
                headerShown: false,
                tabBarHideOnKeyboard: true,
              }}
            >
            <Tab.Screen
              name="Dashboard"
              children={({ navigation }) => (
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top']}>
                  <DashboardScreen
                    user={user}
                    workouts={workouts}
                    navigation={navigation}
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
                </SafeAreaView>
              )}
              options={{
                tabBarLabel: 'Dashboard',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="Today"
              children={({ navigation }) => (
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top']}>
                  <TodayScreen
                    navigation={navigation}
                    exercises={exercises}
                    onAddCustomExercise={addCustomExercise}
                  />
                </SafeAreaView>
              )}
              options={{
                tabBarLabel: 'Today',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="dumbbell" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="History"
              children={() => (
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top']}>
                  <HistoryScreen workouts={workouts} loading={workoutsLoading} />
                </SafeAreaView>
              )}
              options={{
                tabBarLabel: 'History',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="history" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="Progress"
              children={() => (
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top']}>
                  <ProgressScreen workouts={workouts} loading={workoutsLoading} />
                </SafeAreaView>
              )}
              options={{
                tabBarLabel: 'Progress',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="chart-line" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="Exercises"
              children={({ navigation }) => (
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top']}>
                  <ExercisesScreen
                    exercises={exercises}
                    loading={false}
                    onAddCustomExercise={addCustomExercise}
                    onAddToday={(name) => addExerciseToToday(name, navigation)}
                  />
                </SafeAreaView>
              )}
              options={{
                tabBarLabel: 'Exercises',
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons name="dumbbell" size={size} color={color} />
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
