import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";

const getChatKey = () => {
  const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");
  return `gt_coach_chat_${uid}`;
};

const getUsageKey = () => {
  const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");
  return `gt_coach_usage_${uid}_${todayKey()}`;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function loadCoachMessages() {
  try {
    const local = await AsyncStorage.getItem(getChatKey());
    if (local) return JSON.parse(local);
  } catch {
    /* ignore */
  }

  if (auth.currentUser && !auth.isDemo) {
    try {
      const uid = auth.currentUser.uid;
      const ref = collection(db, "users", uid, "coachChats", "default", "messages");
      const snap = await getDocs(query(ref, orderBy("createdAt", "asc"), limit(50)));
      if (!snap.empty) {
        return snap.docs.map((d) => d.data());
      }
    } catch {
      /* ignore */
    }
  }

  return [];
}

export async function saveCoachMessages(messages) {
  const trimmed = messages.slice(-50);
  await AsyncStorage.setItem(getChatKey(), JSON.stringify(trimmed));

  if (auth.currentUser && !auth.isDemo) {
    try {
      const uid = auth.currentUser.uid;
      const batch = trimmed.slice(-10);
      await Promise.all(
        batch.map((msg, i) =>
          setDoc(
            doc(db, "users", uid, "coachChats", "default", "messages", msg.id || `m_${i}`),
            msg,
            { merge: true },
          ),
        ),
      );
    } catch {
      /* local cache is enough */
    }
  }
}

export async function getDailyQuestionCount() {
  try {
    const raw = await AsyncStorage.getItem(getUsageKey());
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementDailyQuestionCount() {
  const count = (await getDailyQuestionCount()) + 1;
  await AsyncStorage.setItem(getUsageKey(), String(count));
  return count;
}

export function createMessage(role, content, meta = {}) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    createdAt: Date.now(),
    ...meta,
  };
}

export async function clearCoachChat() {
  await AsyncStorage.removeItem(getChatKey());
}
