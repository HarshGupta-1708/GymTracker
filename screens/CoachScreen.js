import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  COACH_API_URL,
  COACH_DAILY_LIMIT,
  COACH_DISCLAIMER,
  COACH_QUICK_PROMPTS,
} from "../constants/coach";
import { USER_GOALS_DEFAULT } from "../constants/data";
import { useTheme } from "../context/ThemeContext";
import { askCoach, checkCoachApiHealth } from "../utils/coachApi";
import {
  clearCoachChat,
  createChatSession,
  createMessage,
  deleteChatSession,
  getActiveSessionId,
  getDailyQuestionCount,
  listChatSessions,
  loadCoachMessages,
  saveCoachMessages,
  setActiveSessionId,
} from "../utils/coachChat";
import { listenUserSettings } from "../utils/firestore";

export default function CoachScreen({ workouts = {}, exercises = [] }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const listRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [settings, setSettings] = useState({
    goalsPerWeek: USER_GOALS_DEFAULT.activitiesPerWeek,
    activeDaysPerWeek: USER_GOALS_DEFAULT.activeDaysPerWeek,
  });
  const [usageCount, setUsageCount] = useState(0);
  const [apiStatus, setApiStatus] = useState({ ok: true, mode: COACH_API_URL ? "cloud" : "local" });
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState("default");
  const [showHistory, setShowHistory] = useState(false);

  const WELCOME_TEXT =
    "Hey! I'm your AI Coach 🏋️\n\nAsk anything about YOUR workouts — progression, what to train today, weekly goals, form tips, or diet basics.\n\nTap a quick prompt below or type your question.";

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [sessionList, savedActiveId, count, health] = await Promise.all([
        listChatSessions(),
        getActiveSessionId(),
        getDailyQuestionCount(),
        checkCoachApiHealth(),
      ]);
      if (!mounted) return;

      let list = sessionList;
      let activeId = savedActiveId && list.some((s) => s.id === savedActiveId)
        ? savedActiveId
        : list[0]?.id;
      if (!activeId) {
        const created = await createChatSession();
        list = [created];
        activeId = created.id;
      }

      const saved = await loadCoachMessages(activeId);
      if (!mounted) return;

      setSessions(list);
      setActiveSession(activeId);
      setMessages(
        saved.length === 0
          ? [createMessage("assistant", WELCOME_TEXT, { welcome: true })]
          : saved,
      );
      setUsageCount(count);
      setApiStatus(health);
      setBooting(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openHistory = async () => {
    setSessions(await listChatSessions());
    setShowHistory(true);
  };

  const switchSession = async (sessionId) => {
    if (sessionId === activeSession) {
      setShowHistory(false);
      return;
    }
    const saved = await loadCoachMessages(sessionId);
    await setActiveSessionId(sessionId);
    setActiveSession(sessionId);
    setMessages(
      saved.length === 0
        ? [createMessage("assistant", WELCOME_TEXT, { welcome: true })]
        : saved,
    );
    setShowHistory(false);
  };

  const startNewChat = async () => {
    const session = await createChatSession();
    setSessions(await listChatSessions());
    setActiveSession(session.id);
    setMessages([createMessage("assistant", WELCOME_TEXT, { welcome: true })]);
    setShowHistory(false);
  };

  const removeSession = (sessionId) => {
    Alert.alert("Delete chat?", "This conversation will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const next = await deleteChatSession(sessionId);
          setSessions(next);
          if (sessionId === activeSession) {
            if (next.length > 0) {
              await switchSession(next[0].id);
            } else {
              await startNewChat();
            }
          }
        },
      },
    ]);
  };

  useEffect(() => {
    const unsub = listenUserSettings(setSettings);
    return unsub;
  }, []);

  useEffect(() => {
    if (messages.length && activeSession) {
      saveCoachMessages(messages, activeSession);
    }
  }, [messages, activeSession]);

  const sendMessage = useCallback(
    async ({ text = input, quickPromptId = null } = {}) => {
      const question = String(text || "").trim();
      if (!question && !quickPromptId) return;
      if (loading) return;

      if (usageCount >= COACH_DAILY_LIMIT) {
        Alert.alert("Daily limit", `You can ask ${COACH_DAILY_LIMIT} questions per day on the free plan.`);
        return;
      }

      const userMsg = createMessage("user", question || COACH_QUICK_PROMPTS.find((p) => p.id === quickPromptId)?.question || "Help me train smarter.");
      const history = [...messages, userMsg];
      setMessages(history);
      setInput("");
      setLoading(true);

      try {
        const result = await askCoach({
          message: question,
          quickPromptId,
          history: messages,
          workouts,
          exercises,
          settings,
        });

        const badge =
          result.source === "groq"
            ? "AI"
            : result.source === "local-fallback"
              ? "Local fallback"
              : "Local data";

        setMessages((prev) => [
          ...prev,
          createMessage("assistant", result.reply, {
            source: result.source,
            model: result.model,
            badge,
          }),
        ]);
        setUsageCount((c) => c + 1);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", `Sorry — ${err.message || "something went wrong"}. Your workout data is still safe.`),
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [input, loading, messages, workouts, exercises, settings, usageCount],
  );

  const handleClear = () => {
    Alert.alert("Clear chat?", "This removes the current conversation on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearCoachChat(activeSession);
          setMessages([
            createMessage("assistant", "Chat cleared. What do you want to work on today?", { welcome: true }),
          ]);
        },
      },
    ]);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="robot" size={16} color={C.accent} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
          <Text style={[styles.msgText, isUser && styles.msgTextUser]}>{item.content}</Text>
          {!isUser && item.badge ? (
            <Text style={styles.badge}>{item.badge}{item.model ? ` · ${item.model}` : ""}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  if (booting) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading Coach...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI COACH</Text>
          <Text style={styles.subtitle}>
            {apiStatus.mode === "local" || !COACH_API_URL
              ? "Local mode · connect Groq for AI replies"
              : apiStatus.ok
                ? "Powered by free Groq AI"
                : "API offline · using local data"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={startNewChat} style={styles.iconBtn}>
            <MaterialCommunityIcons name="chat-plus-outline" size={20} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openHistory} style={styles.iconBtn}>
            <MaterialCommunityIcons name="history" size={20} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear} style={styles.iconBtn}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={C.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.usageBar}>
        <MaterialCommunityIcons name="counter" size={14} color={C.muted} />
        <Text style={styles.usageText}>
          {usageCount}/{COACH_DAILY_LIMIT} free questions today
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.chipsWrap}>
            {COACH_QUICK_PROMPTS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.chip}
                onPress={() => sendMessage({ text: p.question, quickPromptId: p.id })}
                disabled={loading}
              >
                <MaterialCommunityIcons name={p.icon} size={14} color={C.accent} />
                <Text style={styles.chipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={styles.typingText}>Coach is thinking...</Text>
            </View>
          ) : null
        }
      />

      <Text style={styles.disclaimer}>{COACH_DISCLAIMER}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask about progression, today’s workout, diet..."
          placeholderTextColor={C.muted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <MaterialCommunityIcons name="send" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Chat history sidebar */}
      <Modal visible={showHistory} transparent animationType="slide">
        <View style={styles.historyOverlay}>
          <View style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>CHAT HISTORY</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <MaterialCommunityIcons name="close" size={22} color={C.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
              <MaterialCommunityIcons name="plus" size={16} color="#000" />
              <Text style={styles.newChatText}>NEW CHAT</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {sessions.length === 0 ? (
                <Text style={styles.historyEmpty}>No past chats yet.</Text>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSession;
                  return (
                    <View
                      key={s.id}
                      style={[styles.historyItem, isActive && { borderColor: C.accent, backgroundColor: `${C.accent}10` }]}
                    >
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => switchSession(s.id)}>
                        <Text
                          style={[styles.historyItemTitle, isActive && { color: C.accent }]}
                          numberOfLines={1}
                        >
                          {s.title || "New Chat"}
                        </Text>
                        <Text style={styles.historyItemDate}>
                          {new Date(s.updatedAt || s.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                          {" · "}
                          {new Date(s.updatedAt || s.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeSession(s.id)}
                        style={styles.historyDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={C.error || C.muted} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowHistory(false)} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centered: { justifyContent: "center", alignItems: "center" },
    loadingText: { color: C.muted, marginTop: 12 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: { fontSize: 16, fontWeight: "900", color: C.text, letterSpacing: 1.2 },
    subtitle: { fontSize: 11, color: C.muted, marginTop: 2 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    usageBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: `${C.accent}10`,
    },
    usageText: { color: C.muted, fontSize: 11 },
    chatList: { padding: 16, paddingBottom: 8 },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    chipText: { color: C.text, fontSize: 11, fontWeight: "700" },
    msgRow: { flexDirection: "row", marginBottom: 12, alignItems: "flex-end", gap: 8 },
    msgRowUser: { justifyContent: "flex-end" },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: `${C.accent}20`,
      alignItems: "center",
      justifyContent: "center",
    },
    bubble: {
      maxWidth: "82%",
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
    },
    bubbleCoach: {
      backgroundColor: C.card,
      borderColor: C.border,
    },
    bubbleUser: {
      backgroundColor: C.accent,
      borderColor: C.accent,
    },
    msgText: { color: C.text, fontSize: 14, lineHeight: 20 },
    msgTextUser: { color: "#000", fontWeight: "600" },
    badge: { color: C.muted, fontSize: 9, marginTop: 6, fontWeight: "700" },
    typingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    typingText: { color: C.muted, fontSize: 12 },
    disclaimer: {
      color: C.muted,
      fontSize: 9,
      textAlign: "center",
      paddingHorizontal: 16,
      paddingBottom: 6,
      lineHeight: 13,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.card,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 100,
      backgroundColor: C.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: C.text,
      fontSize: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    historyOverlay: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    historyPanel: {
      width: "78%",
      maxWidth: 320,
      backgroundColor: C.card,
      borderRightWidth: 1,
      borderRightColor: C.border,
      padding: 16,
    },
    historyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    historyTitle: {
      color: C.text,
      fontSize: 14,
      fontWeight: "900",
      letterSpacing: 1,
    },
    newChatBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: C.accent,
      borderRadius: 10,
      paddingVertical: 11,
      marginBottom: 14,
    },
    newChatText: {
      color: "#000",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    historyEmpty: {
      color: C.muted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 20,
    },
    historyItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    historyItemTitle: {
      color: C.text,
      fontSize: 13,
      fontWeight: "700",
    },
    historyItemDate: {
      color: C.muted,
      fontSize: 10,
      marginTop: 2,
    },
    historyDeleteBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${C.muted}12`,
    },
  });
