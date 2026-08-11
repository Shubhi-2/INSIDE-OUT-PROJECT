import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { ModelPicker } from '@/src/components/ModelPicker';
import { DEFAULT_GEMINI_MODEL } from '@/src/firebase/models';
import { addChatMessage, getProject, listChatMessages } from '@/src/firebase/db';
import { streamChat } from '@/src/firebase/ai';

type Msg = { role: 'user' | 'assistant'; content: string; id?: string };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [model, setModel] = useState<string>(user?.preferred_model || DEFAULT_GEMINI_MODEL);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      if (!token || !id) return;
      try {
        const msgs = await listChatMessages(token, id);
        setMessages(msgs.map((m) => ({ role: m.role, content: m.content, id: m.id })));
      } catch {}
    })();
  }, [id, token]);

  const scrollBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !token || !id) return;
    setInput('');
    setSending(true);
    const historyForModel = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    scrollBottom();
    try {
      const proj = await getProject(token, id);
      if (!proj) throw new Error('Project not found');

      await addChatMessage(id, {
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
        userId: token,
      });

      const full = await streamChat({
        message: text,
        analysis: proj.analysis,
        history: historyForModel,
        model,
        preferredModel: user?.preferred_model,
        onDelta: (delta) => {
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') last.content += delta;
            return copy;
          });
          scrollBottom();
        },
      });

      await addChatMessage(id, {
        role: 'assistant',
        content: full,
        created_at: new Date().toISOString(),
        userId: token,
      });
    } catch {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          last.content = 'Sorry, something went wrong. Please try again.';
        }
        return copy;
      });
    }
    setSending(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="chat-back">
          <Ionicons name="arrow-back" size={22} color={theme.color.text} />
        </Pressable>
        <View>
          <Text style={styles.brand}>INSIDE OUT ENGINEER</Text>
          <Text style={styles.sub}>AI mentor · this project</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.modelRow}>
        <ModelPicker value={model} onChange={setModel} token={token} compact testID="chat-model-picker" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 20 }}
          onContentSizeChange={scrollBottom}
        >
          {messages.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={theme.color.brand} />
              <Text style={styles.emptyTitle}>Ask about this project</Text>
              <Text style={styles.emptyDesc}>
                Why is this resistor here? Can I replace this motor? What if I change the voltage?
              </Text>
            </View>
          )}
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' && { justifyContent: 'flex-end' }]}>
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
                <Text style={[styles.bubbleText, m.role === 'user' && { color: theme.color.onBrand }]}>
                  {m.content || (sending ? '...' : '')}
                </Text>
              </View>
            </View>
          ))}
          {sending && messages[messages.length - 1]?.content === '' && (
            <ActivityIndicator color={theme.color.brand} style={{ marginTop: 8 }} />
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask the AI Engineer..."
            placeholderTextColor={theme.color.textMuted}
            multiline
          />
          <Pressable
            testID="chat-send"
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={send} disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={18} color={theme.color.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.color.border,
  },
  brand: { color: theme.color.brand, fontSize: 12, letterSpacing: 2, fontWeight: '600', textAlign: 'center' },
  sub: { color: theme.color.textMuted, fontSize: 10, textAlign: 'center', marginTop: 2 },
  modelRow: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.divider,
  },
  empty: { alignItems: 'center', padding: theme.spacing.xl, marginTop: 40 },
  emptyTitle: { color: theme.color.text, fontSize: 15, fontWeight: '600', marginTop: 10 },
  emptyDesc: { color: theme.color.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: theme.radius.md, borderWidth: 1 },
  bubbleUser: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  bubbleAI: { backgroundColor: theme.color.surface2, borderColor: theme.color.border },
  bubbleText: { color: theme.color.text, fontSize: 13, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 42,
    backgroundColor: theme.color.surface2, color: theme.color.text,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: theme.color.brand, alignItems: 'center', justifyContent: 'center',
  },
});
