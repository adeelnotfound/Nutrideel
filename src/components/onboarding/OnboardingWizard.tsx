import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme';
import { UserProfile, Gender, ActivityBaseline, GoalType } from '../../types';
import { calculateRecommendedTargets, calculateBMI } from '../../utils/calculations';
import { storage } from '../../services/storage';
import ProgressBar from '../common/ProgressBar';

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const GENDERS: Gender[] = ['male', 'female', 'other'];
const ACTIVITY_LEVELS: { id: ActivityBaseline; label: string; desc: string }[] = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise, desk job' },
  { id: 'light', label: 'Light', desc: 'Light exercise 1-3 days/week' },
  { id: 'moderate', label: 'Moderate', desc: 'Moderate exercise 3-5 days/week' },
  { id: 'very', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
  { id: 'extra_active', label: 'Extra Active', desc: 'Physical job or 2x/day training' },
];
const GOALS: { id: GoalType; label: string; emoji: string }[] = [
  { id: 'lose', label: 'Lose Weight', emoji: '📉' },
  { id: 'maintain', label: 'Maintain', emoji: '⚖️' },
  { id: 'gain', label: 'Gain Weight', emoji: '📈' },
];

const STEPS = ['Name & Gender', 'Body Stats', 'Activity Level', 'Your Goal', 'Review'];

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [activity, setActivity] = useState<ActivityBaseline>('moderate');
  const [goal, setGoal] = useState<GoalType>('lose');
  const [rate, setRate] = useState('0.5');
  const [error, setError] = useState('');

  const validateStep = (): boolean => {
    setError('');
    if (step === 0 && !name.trim()) {
      setError('Please enter your name.');
      return false;
    }
    if (step === 1) {
      if (!Number(age) || !Number(heightCm) || !Number(weightKg) || !Number(goalWeightKg)) {
        setError('Please fill in all fields with valid numbers.');
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const back = () => {
    setError('');
    if (step > 0) setStep(step - 1);
  };

  const targetRate = goal === 'lose' ? -Math.abs(Number(rate) || 0.5) : goal === 'gain' ? Math.abs(Number(rate) || 0.5) : 0;
  const previewTargets =
    Number(age) && Number(heightCm) && Number(weightKg)
      ? calculateRecommendedTargets(Number(weightKg), Number(heightCm), Number(age), gender, activity, goal, targetRate)
      : null;

  const handleFinish = () => {
    const ageN = Number(age);
    const heightN = Number(heightCm);
    const weightN = Number(weightKg);
    const goalWeightN = Number(goalWeightKg);

    const targets = calculateRecommendedTargets(weightN, heightN, ageN, gender, activity, goal, targetRate);
    const bmi = calculateBMI(weightN, heightN);
    const now = new Date().toISOString();

    const profile: UserProfile = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      gender,
      age: ageN,
      height_cm: heightN,
      current_weight_kg: weightN,
      goal_weight_kg: goalWeightN,
      bmi: bmi.bmi,
      bmi_category: bmi.category,
      activity_baseline: activity,
      units: { weight: 'kg', height: 'cm', food: 'serving', liquid: 'ml', energy: 'kcal' },
      current_goal: goal,
      target_rate_kg_week: targetRate,
      calorie_target: targets.calorieTarget,
      protein_target_g: targets.proteinG,
      carb_target_g: targets.carbG,
      fat_target_g: targets.fatG,
      is_custom_target: false,
      onboarding_completed: true,
      created_at: now,
      updated_at: now,
    };

    storage.saveProfile(profile);
    onComplete(profile);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.progressWrap}>
          <ProgressBar pct={((step + 1) / STEPS.length) * 100} height={5} />
          <Text style={styles.stepLabel}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View>
              <Text style={styles.brand}>Welcome to Nutrideel</Text>
              <Text style={styles.subtitle}>Let's set up your profile to calculate personalized nutrition targets.</Text>
              <Field label="What's your name?" value={name} onChangeText={setName} placeholder="Your name" />
              <Text style={styles.sectionLabel}>Gender</Text>
              <View style={styles.chipRow}>
                {GENDERS.map((g) => (
                  <Pressable key={g} style={[styles.chip, gender === g && styles.chipActive]} onPress={() => setGender(g)}>
                    <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.brand}>Your Body Stats</Text>
              <Text style={styles.subtitle}>Used to calculate your BMR and daily calorie needs.</Text>
              <View style={styles.row2}>
                <Field label="Age" value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" />
                <Field label="Height (cm)" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" placeholder="170" />
              </View>
              <View style={styles.row2}>
                <Field label="Current weight (kg)" value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" placeholder="70" />
                <Field label="Goal weight (kg)" value={goalWeightKg} onChangeText={setGoalWeightKg} keyboardType="numeric" placeholder="65" />
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.brand}>Activity Level</Text>
              <Text style={styles.subtitle}>How active are you on a typical week?</Text>
              <View style={{ gap: 8 }}>
                {ACTIVITY_LEVELS.map((a) => (
                  <Pressable key={a.id} style={[styles.optionCard, activity === a.id && styles.optionCardActive]} onPress={() => setActivity(a.id)}>
                    <Text style={[styles.optionTitle, activity === a.id && styles.optionTitleActive]}>{a.label}</Text>
                    <Text style={styles.optionDesc}>{a.desc}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.brand}>Your Goal</Text>
              <Text style={styles.subtitle}>What are you working toward?</Text>
              <View style={styles.goalRow}>
                {GOALS.map((g) => (
                  <Pressable key={g.id} style={[styles.goalCard, goal === g.id && styles.goalCardActive]} onPress={() => setGoal(g.id)}>
                    <Text style={styles.goalEmoji}>{g.emoji}</Text>
                    <Text style={[styles.goalLabel, goal === g.id && styles.goalLabelActive]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
              {goal !== 'maintain' && (
                <View style={{ marginTop: 16 }}>
                  <Field label={`Target rate (kg/week)`} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0.5" />
                  <Text style={styles.rateHint}>A safe, sustainable rate is 0.25–1 kg/week.</Text>
                </View>
              )}
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.brand}>Review Your Targets</Text>
              <Text style={styles.subtitle}>Here's what we calculated based on your profile.</Text>
              {previewTargets && (
                <View style={styles.reviewCard}>
                  <ReviewRow label="Name" value={name} />
                  <ReviewRow label="Daily Calories" value={`${previewTargets.calorieTarget} kcal`} highlight />
                  <ReviewRow label="Protein" value={`${previewTargets.proteinG}g`} />
                  <ReviewRow label="Carbs" value={`${previewTargets.carbG}g`} />
                  <ReviewRow label="Fat" value={`${previewTargets.fatG}g`} />
                  <ReviewRow label="TDEE" value={`${previewTargets.tdee} kcal`} />
                  <ReviewRow label="Goal" value={`${weightKg}kg → ${goalWeightKg}kg`} />
                </View>
              )}
            </View>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.navRow}>
            {step > 0 && (
              <Pressable style={styles.backBtn} onPress={back}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
            )}
            {step < STEPS.length - 1 ? (
              <Pressable style={styles.nextBtn} onPress={next}>
                <Text style={styles.nextBtnText}>Continue</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.nextBtn} onPress={handleFinish}>
                <Text style={styles.nextBtnText}>Start Tracking</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: 'numeric' | 'decimal-pad' }) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={props.keyboardType}
      />
    </View>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, highlight && styles.reviewValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  progressWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  stepLabel: { color: colors.textFaint, fontSize: 11, marginTop: 8, fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 60 },
  brand: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textFaint, fontSize: 13, marginTop: 6, marginBottom: 22, lineHeight: 18 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border },
  row2: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: colors.emerald },
  optionCard: { padding: 14, borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  optionCardActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  optionTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  optionTitleActive: { color: colors.emerald },
  optionDesc: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  goalRow: { flexDirection: 'row', gap: 10 },
  goalCard: { flex: 1, padding: 16, borderRadius: radius.lg, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  goalCardActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  goalEmoji: { fontSize: 26 },
  goalLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  goalLabelActive: { color: colors.emerald },
  rateHint: { color: colors.textFaint, fontSize: 10.5, marginTop: 4 },
  reviewCard: { backgroundColor: colors.cardAlt, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewLabel: { color: colors.textFaint, fontSize: 12 },
  reviewValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
  reviewValueHighlight: { color: colors.emerald, fontSize: 14, fontWeight: '800' },
  error: { color: colors.rose, fontSize: 12, marginTop: 14, fontWeight: '600' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  backBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  backBtnText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  nextBtn: { flex: 2, backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
