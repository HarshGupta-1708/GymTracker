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

const getUid = () => auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");

// Legacy single-chat key (pre-multi-chat versions stored everything here).
const getLegacyChatKey = () => `gt_coach_chat_${getUid()}`;

const getChatKey = (sessionId) => `gt_coach_chat_${getUid()}_${sessionId}`;
const getSessionsListKey = () => `gt_coach_sessions_${getUid()}`;
const getActiveSessionKey = () => `gt_coach_session_active_${getUid()}`;

const getUsageKey = () => {
  const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");
  return `gt_coach_usage_${uid}_${todayKey()}`;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ===== CHAT SESSIONS (multi-chat like ChatGPT) =====

export async function listChatSessions() {
  try {
    const raw = await AsyncStorage.getItem(getSessionsListKey());
    let sessions = raw ? JSON.parse(raw) : null;

    if (!sessions) {
      // First run after upgrade: migrate the old single chat into a session
      // so nobody loses their existing conversation.
      sessions = [];
      const legacy = await AsyncStorage.getItem(getLegacyChatKey());
      if (legacy) {
        const now = Date.now();
        sessions.push({ id: "default", title: "Previous chat", createdAt: now, updatedAt: now });
        await AsyncStorage.setItem(getChatKey("default"), legacy);
        await AsyncStorage.removeItem(getLegacyChatKey());
      }
      await AsyncStorage.setItem(getSessionsListKey(), JSON.stringify(sessions));
    }

    return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

export async function createChatSession() {
  const now = Date.now();
  const session = { id: `chat_${now}`, title: "New Chat", createdAt: now, updatedAt: now };
  const sessions = await listChatSessions();
  await AsyncStorage.setItem(getSessionsListKey(), JSON.stringify([session, ...sessions]));
  await setActiveSessionId(session.id);
  return session;
}

export async function deleteChatSession(sessionId) {
  const sessions = await listChatSessions();
  const next = sessions.filter((s) => s.id !== sessionId);
  await AsyncStorage.setItem(getSessionsListKey(), JSON.stringify(next));
  await AsyncStorage.removeItem(getChatKey(sessionId));
  const active = await getActiveSessionId();
  if (active === sessionId) {
    await AsyncStorage.removeItem(getActiveSessionKey());
  }
  return next;
}

export async function getActiveSessionId() {
  try {
    return await AsyncStorage.getItem(getActiveSessionKey());
  } catch {
    return null;
  }
}

export async function setActiveSessionId(sessionId) {
  try {
    await AsyncStorage.setItem(getActiveSessionKey(), sessionId);
  } catch {
    /* ignore */
  }
}

async function touchSession(sessionId, messages) {
  try {
    const sessions = await listChatSessions();
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx < 0) return;
    const updated = { ...sessions[idx], updatedAt: Date.now() };
    if (!updated.title || updated.title === "New Chat") {
      const firstUser = messages.find((m) => m.role === "user");
      if (firstUser?.content) {
        updated.title = String(firstUser.content).slice(0, 42);
      }
    }
    sessions[idx] = updated;
    await AsyncStorage.setItem(getSessionsListKey(), JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
}

export async function loadCoachMessages(sessionId = "default") {
  try {
    const local = await AsyncStorage.getItem(getChatKey(sessionId));
    if (local) return JSON.parse(local);
  } catch {
    /* ignore */
  }

  if (auth.currentUser && !auth.isDemo) {
    try {
      const uid = auth.currentUser.uid;
      const ref = collection(db, "users", uid, "coachChats", sessionId, "messages");
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

export async function saveCoachMessages(messages, sessionId = "default") {
  const trimmed = messages.slice(-50);
  await AsyncStorage.setItem(getChatKey(sessionId), JSON.stringify(trimmed));
  await touchSession(sessionId, trimmed);

  if (auth.currentUser && !auth.isDemo) {
    try {
      const uid = auth.currentUser.uid;
      const batch = trimmed.slice(-10);
      await Promise.all(
        batch.map((msg, i) =>
          setDoc(
            doc(db, "users", uid, "coachChats", sessionId, "messages", msg.id || `m_${i}`),
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

export async function clearCoachChat(sessionId = "default") {
  await AsyncStorage.removeItem(getChatKey(sessionId));
}
