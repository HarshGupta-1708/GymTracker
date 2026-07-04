// Coach AI configuration — set EXPO_PUBLIC_COACH_API_URL in .env or coachApiUrl in app.json

import Constants from "expo-constants";

export const COACH_API_URL =
  process.env.EXPO_PUBLIC_COACH_API_URL ||
  Constants.expoConfig?.extra?.coachApiUrl ||
  "";

export const COACH_DAILY_LIMIT = 20;

export const COACH_QUICK_PROMPTS = [
  {
    id: "deadlift_progress",
    label: "Deadlift trend",
    icon: "weight-lifter",
    question: "What is my deadlift progression in the last month?",
  },
  {
    id: "this_week",
    label: "This week",
    icon: "calendar-week",
    question: "How am I doing this week vs my goal?",
  },
  {
    id: "train_today",
    label: "Train today?",
    icon: "dumbbell",
    question: "What should I train today based on my recent workouts?",
  },
  {
    id: "recent_prs",
    label: "Recent PRs",
    icon: "trophy",
    question: "What personal records did I hit recently?",
  },
  {
    id: "overall_progress",
    label: "Overall progress",
    icon: "chart-line",
    question: "Summarize my overall gym progress and give one focus tip.",
  },
];

export const COACH_DISCLAIMER =
  "AI Coach uses only YOUR workout logs. Not medical advice. For injury or diet plans, consult a professional.";
