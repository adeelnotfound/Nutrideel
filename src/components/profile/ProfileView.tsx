import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Linking, Switch } from 'react-native';
import { colors, radius } from '../../theme';
import { UserProfile, WeightUnit, HeightUnit, NotificationSettings } from '../../types';
import { storage } from '../../services/storage';
import { DEFAULT_GEMINI_MODEL } from '../../services/aiService';
import { convertWeightFromKg, convertHeightFromCm } from '../../utils/calculations';
import { syncDailyReminder, getNotificationPermissionStatus } from '../../services/notificationService';
import ModelPicker from '../common/ModelPicker';
import { useToast } from '../common/ToastProvider';
import { haptics } from '../../utils/haptics';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (p: UserProfile) => void;
  onResetData: () => void;
}

const REMINDER_TIMES = ['08:00', '12:00', '18:00', '20:00', '21:00'];
const REMINDER_TYPES: { id: NotificationSettings['reminder_type']; label: string }[] = [
  { id: 'incomplete_log', label: 'Log Reminder' },
  { id: 'water', label: 'Water' },
  { id: 'weigh_in', label: 'Weigh-In' },
];

export default function ProfileView({ profile, onUpdateProfile, onResetData }: Props) {
  const toast = useToast();
  const [apiKey, setApiKey] = useState(storage.getGeminiApiKey());
  const [model, setModel] = useState(storage.getAIModel() || DEFAULT_GEMINI_MODEL);
  const [saved, setSaved] = useState(false);

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => storage.getNotifications());
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    getNotificationPermissionStatus().then((status) => setPermissionDenied(status === 'denied'));
  }, []);

  const handleSaveKey = () => {
    storage.saveGeminiApiKey(apiKey.trim());
    setSaved(true);
    haptics.success();
    toast.show('API key saved', 'success');
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSelectModel = (m: string) => {
    setModel(m);
    storage.saveAIModel(m);
    haptics.selection();
    toast.show('AI model updated', 'info');
  };

  const updateNotifSettings = async (next: NotificationSettings) => {
    setNotifSettings(next);
    storage.saveNotifications(next);
    const ok = await syncDailyReminder(next);
    if (!ok) {
      setPermissionDenied(true);
      setNotifSettings({ ...next, enabled: false });
      storage.saveNotifications({ ...next, enabled: false });
      haptics.warning();
    } else {
      setPermissionDenied(false);
      haptics.selection();
    }
  };

  const handleWeightUnitChange = (unit: WeightUnit) => {
    const updated: UserProfile = { ...profile, units: { ...profile.units, weight: unit } };
    storage.saveProfile(updated);
    onUpdateProfile(updated);
    haptics.selection();
  };

  const handleHeightUnitChange = (unit: HeightUnit) => {
    const updated: UserProfile = { ...profile, units: { ...profile.units, height: unit } };
    storage.saveProfile(updated);
    onUpdateProfile(updated);
    haptics.selection();
  };

  const confirmReset = () => {
    Alert.alert('Reset All Data', 'This will permanently delete your profile and all logged data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: onResetData },
    ]);
  };

  const weightDisplay = convertWeightFromKg(profile.current_weight_kg, profile.units.weight).formatted;
  const goalWeightDisplay = convertWeightFromKg(profile.goal_weight_kg, profile.units.weight).formatted;
  const heightDisplay = convertHeightFromCm(profile.height_cm, profile.units.height).formatted;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.card}>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.sub}>
          {profile.age}y · {profile.gender} · {heightDisplay} · {weightDisplay} → {goalWeightDisplay}
        </Text>
        <View style={styles.statRow}>
          <Stat label="Calories" value={`${profile.calorie_target}`} />
          <Stat label="Protein" value={`${profile.protein_target_g}g`} />
          <Stat label="Carbs" value={`${profile.carb_target_g}g`} />
          <Stat label="Fat" value={`${profile.fat_target_g}g`} />
        </View>
        {profile.bmi != null && (
          <Text style={styles.bmiText}>
            BMI: {profile.bmi.toFixed(1)} ({profile.bmi_category})
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Units</Text>
        <Text style={styles.sectionDesc}>Controls how weight and height are displayed throughout the app.</Text>
        <Text style={styles.miniLabel}>Weight</Text>
        <View style={styles.chipRow}>
          {(['kg', 'lb'] as WeightUnit[]).map((u) => (
            <Pressable key={u} style={[styles.chip, profile.units.weight === u && styles.chipActive]} onPress={() => handleWeightUnitChange(u)}>
              <Text style={[styles.chipText, profile.units.weight === u && styles.chipTextActive]}>{u === 'kg' ? 'Kilograms' : 'Pounds'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.miniLabel, { marginTop: 12 }]}>Height</Text>
        <View style={styles.chipRow}>
          {(['cm', 'ft_in'] as HeightUnit[]).map((u) => (
            <Pressable key={u} style={[styles.chip, profile.units.height === u && styles.chipActive]} onPress={() => handleHeightUnitChange(u)}>
              <Text style={[styles.chipText, profile.units.height === u && styles.chipTextActive]}>{u === 'cm' ? 'Centimeters' : 'Feet & Inches'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Daily Reminder</Text>
            <Text style={styles.sectionDesc}>A local notification to nudge you to log, fully on-device — no account or server involved.</Text>
          </View>
          <Switch
            value={notifSettings.enabled}
            onValueChange={(val) => updateNotifSettings({ ...notifSettings, enabled: val })}
            trackColor={{ false: colors.cardAlt, true: colors.emerald }}
            thumbColor="#fff"
          />
        </View>

        {permissionDenied && (
          <Text style={styles.permissionWarning}>
            Notification permission was denied. Enable it for Nutrideel in your device Settings to use reminders.
          </Text>
        )}

        {notifSettings.enabled && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.miniLabel}>Reminder time</Text>
            <View style={styles.chipRow}>
              {REMINDER_TIMES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.chip, notifSettings.daily_reminder_time === t && styles.chipActive]}
                  onPress={() => updateNotifSettings({ ...notifSettings, daily_reminder_time: t })}
                >
                  <Text style={[styles.chipText, notifSettings.daily_reminder_time === t && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.miniLabel, { marginTop: 12 }]}>Reminder type</Text>
            <View style={styles.chipRow}>
              {REMINDER_TYPES.map((rt) => (
                <Pressable
                  key={rt.id}
                  style={[styles.chip, notifSettings.reminder_type === rt.id && styles.chipActive]}
                  onPress={() => updateNotifSettings({ ...notifSettings, reminder_type: rt.id })}
                >
                  <Text style={[styles.chipText, notifSettings.reminder_type === rt.id && styles.chipTextActive]}>{rt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI Coach — Gemini API Key</Text>
        <Text style={styles.sectionDesc}>
          The app runs fully offline with a local heuristic engine by default. To enable full AI-powered meal
          estimates and coaching, paste your own free Gemini API key here — it's stored only on this device and
          used only for your requests.
        </Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="AIza..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          secureTextEntry
        />
        <Pressable style={styles.saveBtn} onPress={handleSaveKey}>
          <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save API Key'}</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
          <Text style={styles.linkBtnText}>Get a free key at aistudio.google.com/apikey →</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI Model</Text>
        <Text style={styles.sectionDesc}>Pick which Gemini model powers meal estimates and coaching answers.</Text>
        <ModelPicker selectedModel={model} onSelect={handleSelectModel} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <Pressable style={styles.dangerBtn} onPress={confirmReset}>
          <Text style={styles.dangerBtnText}>Reset All Data</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 14, gap: 12, paddingBottom: 100 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sub: { color: colors.textFaint, fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statBox: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center' },
  statValue: { color: colors.text, fontWeight: '800', fontSize: 13 },
  statLabel: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
  bmiText: { color: colors.textMuted, fontSize: 11, marginTop: 10, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  sectionDesc: { color: colors.textFaint, fontSize: 11.5, lineHeight: 16, marginBottom: 12 },
  miniLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  chipText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  chipTextActive: { color: colors.emerald },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  permissionWarning: { color: colors.amber, fontSize: 11, marginTop: 10, lineHeight: 15 },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  linkBtn: { paddingVertical: 10, alignItems: 'center' },
  linkBtnText: { color: colors.sky, fontSize: 11.5, fontWeight: '600' },
  dangerBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.rose },
  dangerBtnText: { color: colors.rose, fontWeight: '800', fontSize: 13 },
});
