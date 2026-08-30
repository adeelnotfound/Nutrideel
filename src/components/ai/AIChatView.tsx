import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { AIMessage, UserProfile } from '../../types';
import { AIContextSnapshot, askAIWithMetadata } from '../../services/aiService';
import { getProviderDef } from '../../services/aiProviders';
import { storage } from '../../services/storage';

interface Props {
  contextSnapshot: AIContextSnapshot;
  profile: UserProfile;
}

export default function AIChatView({ contextSnapshot, profile }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [messages, setMessages] = useState<AIMessage[]>(() => storage.getAIChat());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const providerId = storage.getAIProvider();
  const providerDef = getProviderDef(providerId);
  const hasKey = providerId === 'offline' || !!storage.getAIKeyFor(providerId);

  const goal = profile.goal_type || profile.current_goal;
  const promptChips: string[] =
    goal === 'lose'
      ? [
          "What's my expected weight in 30 days?",
          'How do I break through a plateau?',
          'Suggest a lower-calorie swap for my last meal',
          "Am I eating enough protein to preserve muscle?",
        ]
      : goal === 'gain'
      ? [
          'Am I eating enough to build muscle?',
          "What's my expected weight in 30 days?",
          'Suggest a high-calorie snack idea',
          'How much protein should I aim for today?',
        ]
      : goal === 'maintain'
      ? [
          'Am I on track to maintain my weight?',
          'How consistent has my logging been?',
          'Suggest a balanced meal idea',
          'What does my calorie trend look like?',
        ]
      : [
          "What's my expected weight in 30 days?",
          'How am I tracking against my targets?',
          'Suggest a meal that fits my remaining calories',
          'Any patterns in my recent logging?',
        ];

  const send = async (override?: string) => {
    const prompt = (override ?? input).trim();
    if (!prompt || loading) return;

    const userMsg: AIMessage = { id: `msg_${Date.now()}`, role: 'user', content: prompt, timestamp: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    storage.saveAIChat(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await askAIWithMetadata(prompt, contextSnapshot, nextMessages);
      const aiMsg: AIMessage = {
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        content: res.content,
        timestamp: new Date().toISOString(),
        source: res.source,
        model_used: res.model_used,
      };
      const withReply = [...nextMessages, aiMsg];
      setMessages(withReply);
      storage.saveAIChat(withReply);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <View style={styles.headerBar}>
        <View style={styles.providerBadge}>
          <Ionicons name="hardware-chip-outline" size={13} color={colors.emerald} />
          <Text style={styles.providerBadgeText}>{providerId === 'offline' ? 'Offline Engine' : providerDef.label}</Text>
        </View>
      </View>

      {!hasKey && (
        <View style={styles.keyHint}>
          <Ionicons name="information-circle-outline" size={14} color={colors.amber} />
          <Text style={styles.keyHintText}>No API key set — running on the offline engine. Add a free key in Profile for smarter answers.</Text>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={26} color={colors.emerald} />
            <Text style={styles.emptyTitle}>Ask your AI Coach anything</Text>
            <Text style={styles.emptySub}>Try one of these, tailored to your current goal:</Text>
            <View style={styles.chipWrap}>
              {promptChips.map((chip) => (
                <Pressable key={chip} style={styles.chip} onPress={() => send(chip)} disabled={loading}>
                  <Text style={styles.chipText}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>{item.content}</Text>
            {item.role === 'assistant' && item.source === 'local_fallback' && (
              <Text style={styles.offlineTag}>Offline estimate</Text>
            )}
          </View>
        )}
      />
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.emerald} />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about calories, macros, meals..."
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={() => send()} disabled={loading}>
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  headerBar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  keyHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 14, marginTop: 6, padding: 10, backgroundColor: colors.amberBg, borderRadius: radius.sm },
  keyHintText: { color: colors.amber, fontSize: 10.5, flex: 1, lineHeight: 14 },
  list: { padding: 14, paddingBottom: 20, gap: 10 },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, padding: 12 },
  bubbleAI: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  bubbleUser: { backgroundColor: colors.emerald, alignSelf: 'flex-end' },
  bubbleText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  bubbleTextUser: { color: '#fff' },
  offlineTag: { color: colors.amber, fontSize: 10, marginTop: 6, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20, gap: 6 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 8 },
  emptySub: { color: colors.textFaint, fontSize: 12, marginBottom: 10, textAlign: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 13 },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  loadingText: { color: colors.textFaint, fontSize: 11 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
});
