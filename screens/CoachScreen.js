import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
  createMessage,
  getDailyQuestionCount,
  loadCoachMessages,
  saveCoachMessages,
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [saved, count, health] = await Promise.all([
        loadCoachMessages(),
        getDailyQuestionCount(),
        checkCoachApiHealth(),
      ]);
      if (!mounted) return;
      if (saved.length === 0) {
        setMessages([
          createMessage(
            "assistant",
            "Hey! I'm your AI Coach 🏋️\n\nAsk anything about YOUR workouts — progression, what to train today, weekly goals, form tips, or diet basics.\n\nTap a quick prompt below or type your question.",
            { welcome: true },
          ),
        ]);
      } else {
        setMessages(saved);
      }
      setUsageCount(count);
      setApiStatus(health);
      setBooting(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsub = listenUserSettings(setSettings);
    return unsub;
  }, []);

  useEffect(() => {
    if (messages.length) {
      saveCoachMessages(messages);
    }
  }, [messages]);

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
    Alert.alert("Clear chat?", "This removes coach chat history on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearCoachChat();
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
        <TouchableOpacity onPress={handleClear} style={styles.iconBtn}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={C.muted} />
        </TouchableOpacity>
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
  });
