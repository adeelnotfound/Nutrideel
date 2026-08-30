import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfile, Gender, ActivityBaseline, GoalType, WeightUnit, HeightUnit } from '../../types';
import { calculateRecommendedTargets, calculateBMI, convertWeightFromKg, convertWeightToKg, convertHeightFromCm, convertHeightToCm } from '../../utils/calculations';
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
const GOALS: { id: GoalType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'lose', label: 'Lose Weight', icon: 'trending-down' },
  { id: 'maintain', label: 'Maintain', icon: 'remove' },
  { id: 'gain', label: 'Gain Weight', icon: 'trending-up' },
];

const STEPS = ['Name & Gender', 'Body Stats', 'Activity Level', 'Your Goal', 'Review'];

export default function OnboardingWizard({ onComplete }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  // Raw text fields, always in the *currently selected* unit — converted to kg/cm only
  // at submit time. Height in ft/in additionally uses a separate inches field.
  const [heightInput, setHeightInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [weightStoneLbInput, setWeightStoneLbInput] = useState('');
  const [goalWeightInput, setGoalWeightInput] = useState('');
  const [goalWeightStoneLbInput, setGoalWeightStoneLbInput] = useState('');
  const [activity, setActivity] = useState<ActivityBaseline>('moderate');
  const [goal, setGoal] = useState<GoalType>('lose');
  const [rate, setRate] = useState('0.5');
  const [error, setError] = useState('');

  // Converts whatever's currently typed (in the selected unit) into kg/cm for calculations.
  const heightCmValue = (): number => {
    if (heightUnit === 'ft_in') return convertHeightToCm(Number(heightInput) || 0, 'ft_in', Number(heightInchesInput) || 0);
    return convertHeightToCm(Number(heightInput) || 0, 'cm');
  };
  const weightKgValue = (input: string, stoneLbInput: string): number => {
    if (weightUnit === 'st_lb') return convertWeightToKg(Number(input) || 0, 'st_lb', Number(stoneLbInput) || 0);
    return convertWeightToKg(Number(input) || 0, weightUnit);
  };

  const validateStep = (): boolean => {
    setError('');
    if (step === 0 && !name.trim()) {
      setError('Please enter your name.');
      return false;
    }
    if (step === 1) {
      const heightOk = heightUnit === 'ft_in' ? Number(heightInput) > 0 : Number(heightInput) > 0;
      const weightOk = Number(weightInput) > 0 || (weightUnit === 'st_lb' && Number(weightStoneLbInput) >= 0 && Number(weightInput) > 0);
      const goalWeightOk = Number(goalWeightInput) > 0;
      if (!Number(age) || !heightOk || !weightOk || !goalWeightOk) {
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

  const heightCm = heightCmValue();
  const weightKg = weightKgValue(weightInput, weightStoneLbInput);
  const goalWeightKg = weightKgValue(goalWeightInput, goalWeightStoneLbInput);

  const targetRateInUserUnit = goal === 'lose' ? -Math.abs(Number(rate) || 0.5) : goal === 'gain' ? Math.abs(Number(rate) || 0.5) : 0;
  // target_rate_kg_week is always stored/calculated in kg/week regardless of display unit,
  // so convert the user's typed rate (which is in their chosen weight unit) to kg/week here.
  const targetRate = weightUnit === 'lb' || weightUnit === 'st_lb' ? Number((targetRateInUserUnit / 2.20462).toFixed(3)) : targetRateInUserUnit;
  const previewTargets =
    Number(age) && heightCm && weightKg
      ? calculateRecommendedTargets(weightKg, heightCm, Number(age), gender, activity, goal, targetRate)
      : null;

  const handleFinish = () => {
    const ageN = Number(age);
    const heightN = heightCm;
    const weightN = weightKg;
    const goalWeightN = goalWeightKg;

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
      units: { weight: weightUnit, height: heightUnit, food: 'serving', liquid: 'ml', energy: 'kcal' },
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

              <Text style={styles.sectionLabel}>Height unit</Text>
              <View style={styles.chipRow}>
                {(['cm', 'ft_in'] as HeightUnit[]).map((u) => (
                  <Pressable key={u} style={[styles.chip, heightUnit === u && styles.chipActive]} onPress={() => { setHeightUnit(u); setHeightInput(''); setHeightInchesInput(''); }}>
                    <Text style={[styles.chipText, heightUnit === u && styles.chipTextActive]}>{u === 'cm' ? 'cm' : 'ft / in'}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Weight unit</Text>
              <View style={styles.chipRow}>
                {(['kg', 'lb', 'st_lb'] as WeightUnit[]).map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.chip, weightUnit === u && styles.chipActive]}
                    onPress={() => { setWeightUnit(u); setWeightInput(''); setWeightStoneLbInput(''); setGoalWeightInput(''); setGoalWeightStoneLbInput(''); }}
                  >
                    <Text style={[styles.chipText, weightUnit === u && styles.chipTextActive]}>{u === 'kg' ? 'kg' : u === 'lb' ? 'lb' : 'st + lb'}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.row2, { marginTop: 14 }]}>
                <Field label="Age" value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" />
                {heightUnit === 'cm' ? (
                  <Field label="Height (cm)" value={heightInput} onChangeText={setHeightInput} keyboardType="numeric" placeholder="170" />
                ) : (
                  <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                    <Field label="Height (ft)" value={heightInput} onChangeText={setHeightInput} keyboardType="numeric" placeholder="5" />
                    <Field label="(in)" value={heightInchesInput} onChangeText={setHeightInchesInput} keyboardType="numeric" placeholder="7" />
                  </View>
                )}
              </View>

              <View style={styles.row2}>
                {weightUnit === 'st_lb' ? (
                  <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                    <Field label="Weight (st)" value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" placeholder="11" />
                    <Field label="(lb)" value={weightStoneLbInput} onChangeText={setWeightStoneLbInput} keyboardType="numeric" placeholder="0" />
                  </View>
                ) : (
                  <Field label={`Current weight (${weightUnit})`} value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" placeholder={weightUnit === 'kg' ? '70' : '154'} />
                )}
              </View>
              <View style={styles.row2}>
                {weightUnit === 'st_lb' ? (
                  <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                    <Field label="Goal weight (st)" value={goalWeightInput} onChangeText={setGoalWeightInput} keyboardType="numeric" placeholder="10" />
                    <Field label="(lb)" value={goalWeightStoneLbInput} onChangeText={setGoalWeightStoneLbInput} keyboardType="numeric" placeholder="0" />
                  </View>
                ) : (
                  <Field label={`Goal weight (${weightUnit})`} value={goalWeightInput} onChangeText={setGoalWeightInput} keyboardType="numeric" placeholder={weightUnit === 'kg' ? '65' : '143'} />
                )}
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
                    <Ionicons name={g.icon} size={22} color={goal === g.id ? colors.emerald : colors.textMuted} style={{ marginBottom: 6 }} />
                    <Text style={[styles.goalLabel, goal === g.id && styles.goalLabelActive]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
              {goal !== 'maintain' && (
                <View style={{ marginTop: 16 }}>
                  <Field label={`Target rate (${weightUnit === 'kg' ? 'kg' : 'lb'}/week)`} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0.5" />
                  <Text style={styles.rateHint}>A safe, sustainable rate is {weightUnit === 'kg' ? '0.25–1 kg/week' : '0.5–2 lb/week'}.</Text>
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
                  <ReviewRow label="Goal" value={`${convertWeightFromKg(weightKg, weightUnit).formatted} → ${convertWeightFromKg(goalWeightKg, weightUnit).formatted}`} />
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, highlight && styles.reviewValueHighlight]}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
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
