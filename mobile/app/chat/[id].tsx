import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type ChatMessage } from "../../src/api";
import { Empty, Loader, Txt } from "../../src/components/ui";
import { formatTime } from "../../src/money";
import { colors, radius, space } from "../../src/theme";
import { useQuery } from "../../src/useQuery";

const POLL_MS = 4000;

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const { data, loading, reload, setData } = useQuery(() => api.messages(id), [id]);

  // Polling stands in for websockets. Fine at this size; the moment it isn't,
  // this is the only place that has to change.
  useEffect(() => {
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;

    setDraft("");
    setSending(true);
    try {
      const { message } = await api.sendMessage(id, body);
      setData({ messages: [...(data?.messages ?? []), message] });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      // Put the text back so nothing is lost.
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  if (loading && !data) return <Loader />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 0}
    >
      <FlatList
        ref={listRef}
        data={data?.messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.mine && { justifyContent: "flex-end" }]}>
            <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Txt variant="body" color={item.mine ? colors.onDark : colors.ink}>
                {item.body}
              </Txt>
              <Txt variant="micro" color={item.mine ? "rgba(251,248,243,0.6)" : colors.inkMuted}>
                {formatTime(item.createdAt)}
              </Txt>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Empty
            icon="chatbubble-ellipses-outline"
            title="Say hello"
            body="Ask about condition, agree on a pickup spot. Payment happens in the app, not in person."
          />
        }
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + space.sm }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.inkMuted}
          style={styles.input}
          multiline
          maxLength={1000}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || sending}
          style={[styles.send, (!draft.trim() || sending) && { opacity: 0.4 }]}
        >
          <Ionicons name="arrow-up" size={19} color={colors.onDark} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "78%", padding: space.md, borderRadius: radius.lg, gap: 3 },
  bubbleMine: { backgroundColor: colors.ink, borderBottomRightRadius: radius.sm },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: radius.sm,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: colors.ink,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
