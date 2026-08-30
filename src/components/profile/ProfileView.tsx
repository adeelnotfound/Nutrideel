import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfile, WeightUnit, HeightUnit, NotificationSettings } from '../../types';
import { storage } from '../../services/storage';
import { convertWeightFromKg, convertHeightFromCm } from '../../utils/calculations';
import { syncReminders, getNotificationPermissionStatus } from '../../services/notificationService';
import AIAccessCard from '../common/AIAccessCard';
import EditProfileModal from './EditProfileModal';
import { useToast } from '../common/ToastProvider';
import { haptics } from '../../utils/haptics';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (p: UserProfile) => void;
  onResetData: () => void;
}

const REMINDER_TIMES = ['08:00', '12:00', '18:00', '20:00', '21:00'];
const MEAL_REMINDER_TIMES: Record<'breakfast' | 'lunch' | 'dinner', string[]> = {
  breakfast: ['06:30', '07:30', '08:00', '09:00'],
  lunch: ['12:00', '12:30', '13:00', '14:00'],
  dinner: ['18:00', '19:00', '20:00', '21:00'],
};
const REMINDER_TYPES: { id: NotificationSettings['reminder_type']; label: string }[] = [
  { id: 'incomplete_log', label: 'Log Reminder' },
  { id: 'water', label: 'Water' },
  { id: 'weigh_in', label: 'Weigh-In' },
];

export default function ProfileView({ profile, onUpdateProfile, onResetData }: Props) {
  const { colors, themeId, setThemeId, availableThemes } = useTheme();
  const styles = makeStyles(colors);
  const toast = useToast();
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => storage.getNotifications());
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(() => storage.getAdaptiveGoalsEnabled());
  const adaptiveModel = storage.getAdaptiveGoalsLastModel();
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  useEffect(() => {
    getNotificationPermissionStatus().then((status) => setPermissionDenied(status === 'denied'));
  }, []);

  const updateNotifSettings = async (next: NotificationSettings) => {
    setNotifSettings(next);
    storage.saveNotifications(next);
    const ok = await syncReminders(next);
    if (!ok) {
      setPermissionDenied(true);
      const disabled: NotificationSettings =
        next.mode === 'per_meal'
          ? {
              ...next,
              meal_reminders: {
                breakfast: { ...next.meal_reminders.breakfast, enabled: false },
                lunch: { ...next.meal_reminders.lunch, enabled: false },
                dinner: { ...next.meal_reminders.dinner, enabled: false },
              },
            }
          : { ...next, enabled: false };
      setNotifSettings(disabled);
      storage.saveNotifications(disabled);
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
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.sub}>
              {profile.age}y · {profile.gender} · {heightDisplay} · {weightDisplay} → {goalWeightDisplay}
            </Text>
          </View>
          <Pressable style={styles.editBtn} onPress={() => setEditProfileOpen(true)}>
            <Ionicons name="pencil" size={13} color={colors.emerald} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
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
          {(['kg', 'lb', 'st_lb'] as WeightUnit[]).map((u) => (
            <Pressable key={u} style={[styles.chip, profile.units.weight === u && styles.chipActive]} onPress={() => handleWeightUnitChange(u)}>
              <Text style={[styles.chipText, profile.units.weight === u && styles.chipTextActive]}>
                {u === 'kg' ? 'Kilograms' : u === 'lb' ? 'Pounds' : 'Stone + lb'}
              </Text>
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
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Text style={styles.sectionDesc}>Pick a color theme for the whole app.</Text>
        <View style={styles.themeGrid}>
          {availableThemes.map((t) => {
            const isActive = t.id === themeId;
            return (
              <Pressable
                key={t.id}
                style={[styles.themeCard, isActive && styles.themeCardActive]}
                onPress={() => {
                  setThemeId(t.id);
                  haptics.selection();
                  toast.show(`${t.label} theme applied`, 'info');
                }}
              >
                <View style={styles.themeSwatchRow}>
                  {t.swatch.map((c, i) => (
                    <View key={i} style={[styles.themeSwatch, { backgroundColor: c }]} />
                  ))}
                </View>
                <Text style={[styles.themeLabel, isActive && styles.themeLabelActive]}>{t.label}</Text>
                {isActive && <Text style={styles.themeCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Adaptive Goals</Text>
            <Text style={styles.sectionDesc}>
              Once a week, gently nudge your calorie target toward what your logged intake and weight trend actually
              show — capped to a small correction, protein and fat stay pinned, carbs auto-balance.
            </Text>
          </View>
          <Switch
            value={adaptiveEnabled}
            onValueChange={(val) => {
              setAdaptiveEnabled(val);
              storage.saveAdaptiveGoalsEnabled(val);
              toast.show(val ? 'Adaptive Goals enabled' : 'Adaptive Goals disabled', 'info');
            }}
            trackColor={{ false: colors.cardAlt, true: colors.emerald }}
            thumbColor="#fff"
          />
        </View>
        {adaptiveEnabled && adaptiveModel && (
          <Text style={styles.calibrationLabel}>{adaptiveModel.calibrationLabel}</Text>
        )}
        {adaptiveEnabled && !adaptiveModel && (
          <Text style={styles.sectionDesc}>
            Needs at least 3 weigh-ins over 5+ days before it starts calibrating.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Daily Reminder</Text>
            <Text style={styles.sectionDesc}>A local notification to nudge you to log, fully on-device — no account or server involved.</Text>
          </View>
          <Switch
            value={notifSettings.mode === 'single' ? notifSettings.enabled : Object.values(notifSettings.meal_reminders).some((m) => m.enabled)}
            onValueChange={(val) => {
              if (notifSettings.mode === 'single') {
                updateNotifSettings({ ...notifSettings, enabled: val });
              } else {
                updateNotifSettings({
                  ...notifSettings,
                  meal_reminders: {
                    breakfast: { ...notifSettings.meal_reminders.breakfast, enabled: val },
                    lunch: { ...notifSettings.meal_reminders.lunch, enabled: val },
                    dinner: { ...notifSettings.meal_reminders.dinner, enabled: val },
                  },
                });
              }
            }}
            trackColor={{ false: colors.cardAlt, true: colors.emerald }}
            thumbColor="#fff"
          />
        </View>

        {permissionDenied && (
          <Text style={styles.permissionWarning}>
            Notification permission was denied. Enable it for Nutrideel in your device Settings to use reminders.
          </Text>
        )}

        <Text style={[styles.miniLabel, { marginTop: 14 }]}>Reminder mode</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, notifSettings.mode === 'single' && styles.chipActive]}
            onPress={() => updateNotifSettings({ ...notifSettings, mode: 'single' })}
          >
            <Text style={[styles.chipText, notifSettings.mode === 'single' && styles.chipTextActive]}>One reminder a day</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, notifSettings.mode === 'per_meal' && styles.chipActive]}
            onPress={() => updateNotifSettings({ ...notifSettings, mode: 'per_meal' })}
          >
            <Text style={[styles.chipText, notifSettings.mode === 'per_meal' && styles.chipTextActive]}>Separate per meal</Text>
          </Pressable>
        </View>

        {notifSettings.mode === 'single' && notifSettings.enabled && (
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

        {notifSettings.mode === 'per_meal' && (
          <View style={{ marginTop: 14, gap: 14 }}>
            {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
              <View key={meal}>
                <View style={styles.rowBetween}>
                  <Text style={styles.miniLabel}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Text>
                  <Switch
                    value={notifSettings.meal_reminders[meal].enabled}
                    onValueChange={(val) =>
                      updateNotifSettings({
                        ...notifSettings,
                        meal_reminders: { ...notifSettings.meal_reminders, [meal]: { ...notifSettings.meal_reminders[meal], enabled: val } },
                      })
                    }
                    trackColor={{ false: colors.cardAlt, true: colors.emerald }}
                    thumbColor="#fff"
                  />
                </View>
                {notifSettings.meal_reminders[meal].enabled && (
                  <View style={[styles.chipRow, { marginTop: 6 }]}>
                    {MEAL_REMINDER_TIMES[meal].map((t) => (
                      <Pressable
                        key={t}
                        style={[styles.chip, notifSettings.meal_reminders[meal].time === t && styles.chipActive]}
                        onPress={() =>
                          updateNotifSettings({
                            ...notifSettings,
                            meal_reminders: { ...notifSettings.meal_reminders, [meal]: { ...notifSettings.meal_reminders[meal], time: t } },
                          })
                        }
                      >
                        <Text style={[styles.chipText, notifSettings.meal_reminders[meal].time === t && styles.chipTextActive]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI Access</Text>
        <Text style={styles.sectionDesc}>
          The app runs fully offline with a local heuristic engine by default. Bring your own key from any
          supported provider below for full AI-powered meal estimates, photo analysis, and coaching — requests go
          straight from this device to the provider you choose.
        </Text>
        <AIAccessCard />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <Pressable style={styles.dangerBtn} onPress={confirmReset}>
          <Text style={styles.dangerBtnText}>Reset All Data</Text>
        </Pressable>
      </View>

      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profile}
        onSave={(updated) => {
          storage.saveProfile(updated);
          onUpdateProfile(updated);
          toast.show('Profile updated', 'success');
        }}
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
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
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  themeCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 10,
    position: 'relative',
  },
  themeCardActive: { borderColor: colors.emerald, borderWidth: 2 },
  themeSwatchRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  themeSwatch: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  themeLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  themeLabelActive: { color: colors.text },
  themeCheck: { position: 'absolute', top: 8, right: 10, color: colors.emerald, fontWeight: '900', fontSize: 13 },
  miniLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  chipText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  chipTextActive: { color: colors.emerald },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  permissionWarning: { color: colors.amber, fontSize: 11, marginTop: 10, lineHeight: 15 },
  calibrationLabel: { color: colors.emerald, fontSize: 11, fontWeight: '700', marginTop: 10, lineHeight: 15 },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  linkBtn: { paddingVertical: 10, alignItems: 'center' },
  linkBtnText: { color: colors.sky, fontSize: 11.5, fontWeight: '600' },
  dangerBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.rose },
  dangerBtnText: { color: colors.rose, fontWeight: '800', fontSize: 13 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emeraldBg, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  editBtnText: { color: colors.emerald, fontSize: 11.5, fontWeight: '800' },
});
