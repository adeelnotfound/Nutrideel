import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme';
import { AIMessage, UserProfile } from '../../types';
import { AIContextSnapshot, askAIWithMetadata, DEFAULT_GEMINI_MODEL } from '../../services/aiService';
import { storage } from '../../services/storage';
import ModelPicker from '../common/ModelPicker';

interface Props {
  contextSnapshot: AIContextSnapshot;
  profile: UserProfile;
}

export default function AIChatView({ contextSnapshot }: Props) {
  const [messages, setMessages] = useState<AIMessage[]>(() => storage.getAIChat());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(storage.getAIModel() || DEFAULT_GEMINI_MODEL);
  const hasKey = !!storage.getGeminiApiKey();

  const handleSelectModel = (m: string) => {
    setModel(m);
    storage.saveAIModel(m);
  };

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: AIMessage = { id: `msg_${Date.now()}`, role: 'user', content: prompt, timestamp: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    storage.saveAIChat(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await askAIWithMetadata(prompt, contextSnapshot, nextMessages, model);
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
        <ModelPicker selectedModel={model} onSelect={handleSelectModel} compact />
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
        <Pressable style={styles.sendBtn} onPress={send} disabled={loading}>
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  loadingText: { color: colors.textFaint, fontSize: 11 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
});
