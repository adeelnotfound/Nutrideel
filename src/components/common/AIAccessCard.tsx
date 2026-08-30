import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal as RNModal, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { storage } from '../../services/storage';
import { AI_PROVIDERS, OFFLINE_PROVIDER_ID, getProviderDef, modelSupportsVision } from '../../services/aiProviders';
import { useToast } from './ToastProvider';
import { haptics } from '../../utils/haptics';

// Full AI provider settings: pick a provider, pick a model for that provider, enter
// its API key (stored encrypted via expo-secure-store), and — for the Custom Endpoint
// provider — a base URL. Selecting "Offline Engine" runs the app's local heuristic
// engine and needs no key at all.

export default function AIAccessCard() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toast = useToast();

  const [providerId, setProviderId] = useState(() => storage.getAIProvider());
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [fallbackProviderId, setFallbackProviderId] = useState(() => storage.getAIFallbackProvider());
  const [fallbackPickerOpen, setFallbackPickerOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(() => storage.getAIKeyFor(storage.getAIProvider()));
  const [keyVisible, setKeyVisible] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState(() => storage.getCustomBaseUrl());

  const isOffline = providerId === OFFLINE_PROVIDER_ID;
  const def = isOffline ? null : getProviderDef(providerId);
  const selectedModel = isOffline ? '' : storage.getSelectedModel(providerId);
  const currentModelOption = def?.models.find((m) => m.id === selectedModel) || def?.models[0];
  const savedKey = isOffline ? '' : storage.getAIKeyFor(providerId);
  const keyDirty = !isOffline && keyInput !== savedKey;
  const canUseVision = def ? modelSupportsVision(providerId, selectedModel) : false;

  const isFallbackOffline = fallbackProviderId === OFFLINE_PROVIDER_ID;
  const fallbackDef = isFallbackOffline ? null : getProviderDef(fallbackProviderId);
  const fallbackHasKey = isFallbackOffline || !!storage.getAIKeyFor(fallbackProviderId);

  const selectProvider = (id: string) => {
    setProviderId(id);
    storage.saveAIProvider(id);
    setKeyInput(id === OFFLINE_PROVIDER_ID ? '' : storage.getAIKeyFor(id));
    setProviderPickerOpen(false);
    haptics.selection();
    toast.show(id === OFFLINE_PROVIDER_ID ? 'Switched to Offline Engine' : `Switched to ${getProviderDef(id).label}`, 'info');
  };

  const selectModel = (modelId: string) => {
    storage.saveSelectedModel(providerId, modelId);
    setModelPickerOpen(false);
    haptics.selection();
  };

  const selectFallbackProvider = (id: string) => {
    setFallbackProviderId(id);
    storage.saveAIFallbackProvider(id);
    setFallbackPickerOpen(false);
    haptics.selection();
    toast.show(id === OFFLINE_PROVIDER_ID ? 'Fallback disabled' : `${getProviderDef(id).label} set as fallback`, 'info');
  };

  const saveKey = () => {
    storage.saveAIKeyFor(providerId, keyInput);
    haptics.success();
    toast.show(keyInput.trim() ? `${def?.label} key saved` : `${def?.label} key removed`, 'success');
  };

  const saveBaseUrl = () => {
    storage.saveCustomBaseUrl(baseUrlInput);
    haptics.success();
    toast.show('Custom endpoint URL saved', 'success');
  };

  return (
    <View>
      {/* Provider selector */}
      <Text style={styles.label}>Provider</Text>
      <Pressable style={styles.trigger} onPress={() => setProviderPickerOpen(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.triggerLabel}>{isOffline ? 'Offline Engine' : def?.label}</Text>
          <Text style={styles.triggerDesc} numberOfLines={1}>
            {isOffline ? 'No key needed — runs fully on-device' : def?.description}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      {!isOffline && def && (
        <>
          {/* Model selector */}
          <Text style={[styles.label, { marginTop: 14 }]}>Model</Text>
          <Pressable style={styles.trigger} onPress={() => setModelPickerOpen(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.triggerLabel}>{currentModelOption?.label || selectedModel}</Text>
              <Text style={styles.triggerDesc} numberOfLines={1}>{currentModelOption?.description}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>

          {!canUseVision && (
            <View style={styles.noticeRow}>
              <Ionicons name="camera-outline" size={13} color={colors.amber} />
              <Text style={styles.noticeText}>This model is text-only — photo logging will fall back to your typed note.</Text>
            </View>
          )}

          {/* Custom base URL, only for the custom provider */}
          {providerId === 'custom' && (
            <>
              <Text style={[styles.label, { marginTop: 14 }]}>Base URL</Text>
              <TextInput
                style={styles.input}
                value={baseUrlInput}
                onChangeText={setBaseUrlInput}
                placeholder="http://localhost:11434/v1"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Pressable
                style={[styles.saveBtn, baseUrlInput.trim() === storage.getCustomBaseUrl() && styles.saveBtnDisabled]}
                onPress={saveBaseUrl}
                disabled={baseUrlInput.trim() === storage.getCustomBaseUrl()}
              >
                <Text style={styles.saveBtnText}>Save Base URL</Text>
              </Pressable>
            </>
          )}

          {/* API key */}
          <Text style={[styles.label, { marginTop: 14 }]}>
            API Key{!def.requiresKey ? ' (optional)' : ''}
          </Text>
          <View style={styles.keyRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder={def.keyPlaceholder}
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!keyVisible}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.eyeBtn} onPress={() => setKeyVisible((v) => !v)}>
              <Ionicons name={keyVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <Pressable style={[styles.saveBtn, !keyDirty && styles.saveBtnDisabled]} onPress={saveKey} disabled={!keyDirty}>
            <Text style={styles.saveBtnText}>{keyInput.trim() ? 'Save Key' : 'Remove Key'}</Text>
          </Pressable>

          {def.keyHelpUrl && (
            <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(def.keyHelpUrl!)}>
              <Text style={styles.linkBtnText}>Get a {def.label} API key ↗</Text>
            </Pressable>
          )}

          <View style={styles.secureNote}>
            <Ionicons name="lock-closed-outline" size={12} color={colors.textFaint} />
            <Text style={styles.secureNoteText}>Keys are encrypted on-device with your OS keychain and never leave your phone except in requests directly to {def.label}.</Text>
          </View>

          {/* Fallback provider */}
          <Text style={[styles.label, { marginTop: 18 }]}>Fallback Provider (optional)</Text>
          <Text style={[styles.triggerDesc, { marginBottom: 8 }]}>
            If {def.label} fails (bad key, rate limit, outage), automatically retry once with this provider before falling back to offline.
          </Text>
          <Pressable style={styles.trigger} onPress={() => setFallbackPickerOpen(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.triggerLabel}>{isFallbackOffline ? 'None' : fallbackDef?.label}</Text>
              <Text style={styles.triggerDesc} numberOfLines={1}>
                {isFallbackOffline ? 'No fallback — go straight to offline on failure' : fallbackHasKey ? fallbackDef?.description : 'No key saved for this provider yet'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          {!isFallbackOffline && !fallbackHasKey && (
            <View style={styles.noticeRow}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.amber} />
              <Text style={styles.noticeText}>Switch to {fallbackDef?.label} above and save a key for it, or this fallback won't be used.</Text>
            </View>
          )}
        </>
      )}

      {/* Provider picker modal */}
      <RNModal visible={providerPickerOpen} animationType="fade" transparent onRequestClose={() => setProviderPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setProviderPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Choose AI Provider</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                <ProviderOption
                  colors={colors}
                  active={isOffline}
                  label="Offline Engine"
                  desc="No key needed — local heuristic estimates, fully on-device"
                  icon="hardware-chip-outline"
                  onPress={() => selectProvider(OFFLINE_PROVIDER_ID)}
                />
                {AI_PROVIDERS.map((p) => (
                  <ProviderOption
                    key={p.id}
                    colors={colors}
                    active={p.id === providerId}
                    label={p.label}
                    desc={p.description}
                    icon={p.supportsVision ? 'sparkles-outline' : 'chatbubble-ellipses-outline'}
                    onPress={() => selectProvider(p.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </RNModal>

      {/* Model picker modal */}
      {!isOffline && def && (
        <RNModal visible={modelPickerOpen} animationType="fade" transparent onRequestClose={() => setModelPickerOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setModelPickerOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Choose Model</Text>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 8 }}>
                  {def.models.map((m) => {
                    const active = m.id === selectedModel;
                    const vision = typeof m.supportsVision === 'boolean' ? m.supportsVision : def.supportsVision;
                    return (
                      <Pressable
                        key={m.id}
                        style={[styles.option, active && styles.optionSelected]}
                        onPress={() => selectModel(m.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.optionLabel, active && styles.optionLabelSelected]}>{m.label}</Text>
                            {vision && <Ionicons name="camera" size={11} color={colors.emerald} />}
                          </View>
                          <Text style={styles.optionDesc}>{m.description}</Text>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </RNModal>
      )}

      {/* Fallback provider picker modal */}
      <RNModal visible={fallbackPickerOpen} animationType="fade" transparent onRequestClose={() => setFallbackPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFallbackPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Choose Fallback Provider</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                <ProviderOption
                  colors={colors}
                  active={isFallbackOffline}
                  label="None"
                  desc="Go straight to offline estimates if the primary provider fails"
                  icon="close-circle-outline"
                  onPress={() => selectFallbackProvider(OFFLINE_PROVIDER_ID)}
                />
                {AI_PROVIDERS.filter((p) => p.id !== providerId).map((p) => (
                  <ProviderOption
                    key={p.id}
                    colors={colors}
                    active={p.id === fallbackProviderId}
                    label={p.label}
                    desc={storage.getAIKeyFor(p.id) ? p.description : `${p.description} — no key saved yet`}
                    icon={p.supportsVision ? 'sparkles-outline' : 'chatbubble-ellipses-outline'}
                    onPress={() => selectFallbackProvider(p.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </RNModal>
    </View>
  );
}

function ProviderOption({
  colors,
  active,
  label,
  desc,
  icon,
  onPress,
}: {
  colors: any;
  active: boolean;
  label: string;
  desc: string;
  icon: any;
  onPress: () => void;
}) {
  const styles = makeStyles(colors);
  return (
    <Pressable style={[styles.option, active && styles.optionSelected]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={active ? colors.emerald : colors.textMuted} style={{ marginRight: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionLabel, active && styles.optionLabelSelected]}>{label}</Text>
        <Text style={styles.optionDesc} numberOfLines={2}>{desc}</Text>
      </View>
      {active && <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />}
    </Pressable>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    label: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardAlt,
      borderRadius: radius.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    triggerLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
    triggerDesc: { color: colors.textFaint, fontSize: 10.5, marginTop: 2 },
    noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    noticeText: { color: colors.amber, fontSize: 10.5, flex: 1, lineHeight: 14 },
    input: {
      backgroundColor: colors.cardAlt,
      borderRadius: radius.md,
      padding: 12,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      fontSize: 13,
    },
    keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eyeBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 2 },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    linkBtn: { paddingVertical: 10, alignItems: 'center' },
    linkBtnText: { color: colors.sky, fontSize: 11.5, fontWeight: '600' },
    secureNote: { flexDirection: 'row', gap: 6, marginTop: 6, paddingHorizontal: 4 },
    secureNoteText: { color: colors.textFaint, fontSize: 10, flex: 1, lineHeight: 14 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    sheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
    sheetTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 12 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    optionSelected: { borderColor: colors.emerald, backgroundColor: colors.emeraldBg },
    optionLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
    optionLabelSelected: { color: colors.emerald },
    optionDesc: { color: colors.textFaint, fontSize: 10.5, marginTop: 2 },
  });
