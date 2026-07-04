import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { DEFAULT_THEME_ID, getThemeById } from './themes';

// Legacy export — synced at runtime when theme changes (see syncLegacyColors)
export const COLORS = { ...getThemeById(DEFAULT_THEME_ID).colors };

export function syncLegacyColors(colors) {
  Object.assign(COLORS, colors);
}

// Exercise Categories
export const CATEGORIES = ["Legs", "Push", "Pull", "Biceps", "Forearms", "Cardio", "Recovery", "Custom"];

export const CATEGORY_COLORS = {
  Legs: "#ff6b2b",
  Push: "#ff3d71",
  Pull: "#00d4ff",
  Biceps: "#a78bfa",
  Forearms: "#34d399",
  Cardio: "#fbbf24",
  Recovery: "#6ee7b7",
  Custom: "#94a3b8",
};

// Preset Exercises
export const PRESET_EXERCISES = [
  // Legs
  { name: "Back Squat", category: "Legs" },
  { name: "Romanian Deadlift", category: "Legs" },
  { name: "Leg Extension", category: "Legs" },
  { name: "Seated Leg Curl", category: "Legs" },
  { name: "Standing Calf Raise", category: "Legs" },
  { name: "Smith Squat", category: "Legs" },
  { name: "Leg Press", category: "Legs" },

  // Push
  { name: "Incline Barbell Bench Press", category: "Push" },
  { name: "Flat Bench Press", category: "Push" },
  { name: "Front Overhead Press", category: "Push" },
  { name: "Reverse Pec Deck", category: "Push" },
  { name: "Tricep Pulley Pushdown", category: "Push" },
  { name: "Incline Dumbbell Press", category: "Push" },
  { name: "Decline DB Fly", category: "Push" },
  { name: "Machine Shoulder Press", category: "Push" },
  { name: "Lateral Raises", category: "Push" },
  { name: "Dumbbell Kickbacks", category: "Push" },

  // Pull
  { name: "Pull-ups", category: "Pull" },
  { name: "Wide Grip Pull-ups", category: "Pull" },
  { name: "Bent Over Rows", category: "Pull" },
  { name: "Lat Pulldown", category: "Pull" },
  { name: "Close Grip Pull Down", category: "Pull" },
  { name: "Seated Row", category: "Pull" },
  { name: "Mid Row Machine", category: "Pull" },
  { name: "Dumbbell Row", category: "Pull" },
  { name: "Hyper Extension Machine", category: "Pull" },
  { name: "Conventional Deadlift", category: "Pull" },

  // Biceps
  { name: "EZ Bar Bicep Curl", category: "Biceps" },
  { name: "Barbell Curl", category: "Biceps" },
  { name: "Dumbbell Curl", category: "Biceps" },
  { name: "Hammer Curl", category: "Biceps" },
  { name: "Cable Curl", category: "Biceps" },

  // Forearms
  { name: "Wrist Curl", category: "Forearms" },
  { name: "Reverse Wrist Curl", category: "Forearms" },
  { name: "Barbell Forearm Flexion", category: "Forearms" },

  // Recovery
  { name: "Yoga Class", category: "Recovery", tracking: "duration" },
  { name: "Full Body Stretching", category: "Recovery", tracking: "duration" },
  { name: "Foam Rolling", category: "Recovery", tracking: "duration" },

  // Cardio
  { name: "Light Walk", category: "Cardio", tracking: "cardio" },
  { name: "Running", category: "Cardio", tracking: "cardio" },
  { name: "Cycling", category: "Cardio", tracking: "cardio" },
];

// Workout Plans
export const WORKOUT_PLANS = {
  "💪 Leg Day — Calorie Crusher": ["Back Squat", "Romanian Deadlift", "Leg Extension", "Seated Leg Curl", "Standing Calf Raise"],
  "🔥 Push A — Pump & Burn": ["Incline Barbell Bench Press", "Flat Bench Press", "Front Overhead Press", "Reverse Pec Deck", "Tricep Pulley Pushdown"],
  "🦅 Pull A — V-Taper Builder": ["Pull-ups", "Bent Over Rows", "Lat Pulldown", "Seated Row", "EZ Bar Bicep Curl", "Wrist Curl"],
  "🧘 Active Recovery": ["Yoga Class", "Full Body Stretching", "Light Walk", "Foam Rolling"],
  "⚡ Push B — Hypertrophy & Sculpt": ["Incline Dumbbell Press", "Flat Bench Press", "Decline DB Fly", "Machine Shoulder Press", "Lateral Raises"],
  "💀 Pull B — Power & Deadlift": ["Conventional Deadlift", "Wide Grip Pull-ups", "EZ Bar Bicep Curl", "Barbell Forearm Flexion"],
};

// Date utilities
export const toDateStr = (dateObj = new Date()) => {
  const d = new Date(dateObj);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const todayStr = () => toDateStr(new Date());
export const timeStr = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
export const prettyDate = (s) => new Date(s + "T12:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
export const shortDate = (s) => new Date(s + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const getTrackingType = (exerciseName, category = "") => {
  const match = PRESET_EXERCISES.find((ex) => ex.name === exerciseName);
  if (match?.tracking) return match.tracking;
  if (category === "Cardio") return "cardio";
  if (category === "Recovery") return "duration";
  return "strength";
};

export const USER_GOALS_DEFAULT = {
  activitiesPerWeek: 3,
  targetWeeks: 20,
  activeDaysPerWeek: 3,
};
