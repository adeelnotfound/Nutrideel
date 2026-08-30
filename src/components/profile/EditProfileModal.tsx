import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '../common/Modal';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfile, Gender, ActivityBaseline, WeightUnit, HeightUnit } from '../../types';
import { convertWeightFromKg, convertWeightToKg, convertHeightFromCm, convertHeightToCm, calculateRecommendedTargets, calculateBMI } from '../../utils/calculations';
import { haptics } from '../../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (p: UserProfile) => void;
}

const GENDERS: Gender[] = ['male', 'female', 'other'];
const ACTIVITY_LEVELS: { id: ActivityBaseline; label: string }[] = [
  { id: 'sedentary', label: 'Sedentary' },
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'very', label: 'Very Active' },
  { id: 'extra_active', label: 'Extra Active' },
];

export default function EditProfileModal({ isOpen, onClose, profile, onSave }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const weightUnit = profile.units.weight;
  const heightUnit = profile.units.height;
  const startWeight = convertWeightFromKg(profile.current_weight_kg, weightUnit);
  const startGoalWeight = convertWeightFromKg(profile.goal_weight_kg, weightUnit);
  const startHeight = convertHeightFromCm(profile.height_cm, heightUnit);

  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [age, setAge] = useState(String(profile.age));
  const [activity, setActivity] = useState<ActivityBaseline>(profile.activity_baseline);

  const [heightInput, setHeightInput] = useState(
    heightUnit === 'ft_in' ? String(Math.floor(startHeight.value / 12)) : String(startHeight.value)
  );
  const [heightInchesInput, setHeightInchesInput] = useState(
    heightUnit === 'ft_in' ? String(Math.round(startHeight.value % 12)) : ''
  );

  const [weightInput, setWeightInput] = useState(
    weightUnit === 'st_lb' ? String(Math.floor(startWeight.value / 14)) : startWeight.value.toFixed(1)
  );
  const [weightStoneLbInput, setWeightStoneLbInput] = useState(
    weightUnit === 'st_lb' ? (startWeight.value % 14).toFixed(1) : ''
  );

  const [goalWeightInput, setGoalWeightInput] = useState(
    weightUnit === 'st_lb' ? String(Math.floor(startGoalWeight.value / 14)) : startGoalWeight.value.toFixed(1)
  );
  const [goalWeightStoneLbInput, setGoalWeightStoneLbInput] = useState(
    weightUnit === 'st_lb' ? (startGoalWeight.value % 14).toFixed(1) : ''
  );

  const heightKg = () =>
    heightUnit === 'ft_in'
      ? convertHeightToCm(Number(heightInput) || 0, 'ft_in', Number(heightInchesInput) || 0)
      : convertHeightToCm(Number(heightInput) || 0, 'cm');

  const weightKgFrom = (whole: string, stLb: string) =>
    weightUnit === 'st_lb'
      ? convertWeightToKg(Number(whole) || 0, 'st_lb', Number(stLb) || 0)
      : convertWeightToKg(Number(whole) || 0, weightUnit);

  const handleSave = () => {
    if (!name.trim()) return;
    const heightCm = heightKg();
    const currentWeightKg = weightKgFrom(weightInput, weightStoneLbInput);
    const goalWeightKg = weightKgFrom(goalWeightInput, goalWeightStoneLbInput);
    const ageNum = Number(age) || profile.age;

    if (heightCm <= 0 || currentWeightKg <= 0 || goalWeightKg <= 0) return;

    let updated: UserProfile = {
      ...profile,
      name: name.trim(),
      gender,
      age: ageNum,
      height_cm: heightCm,
      current_weight_kg: currentWeightKg,
      goal_weight_kg: goalWeightKg,
      target_weight_kg: goalWeightKg,
      activity_baseline: activity,
      activity_level: activity,
      updated_at: new Date().toISOString(),
    };

    const bmi = calculateBMI(currentWeightKg, heightCm);
    updated.bmi = bmi.bmi;
    updated.bmi_category = bmi.category;

    // Recalculate calorie/macro targets from the new stats — unless the user
    // has a custom target locked in, in which case we leave those alone and
    // only refresh BMI above.
    if (!profile.is_custom_target) {
      const targets = calculateRecommendedTargets(
        currentWeightKg,
        heightCm,
        ageNum,
        gender,
        activity,
        profile.current_goal,
        profile.target_rate_kg_week
      );
      updated.calorie_target = targets.calorieTarget;
      updated.protein_target_g = targets.proteinG;
      updated.carb_target_g = targets.carbG;
      updated.fat_target_g = targets.fatG;
      updated.macro_targets = { protein_g: targets.proteinG, carbs_g: targets.carbG, fat_g: targets.fatG };
    }

    haptics.success();
    onSave(updated);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      <View style={{ gap: 12 }}>
        <Field label="Name" value={name} onChangeText={setName} styles={styles} colors={colors} />

        <View>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <Pressable key={g} style={[styles.chip, gender === g && styles.chipActive]} onPress={() => setGender(g)}>
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field label="Age" value={age} onChangeText={setAge} keyboardType="numeric" styles={styles} colors={colors} />

        <View>
          <Text style={styles.label}>Height</Text>
          {heightUnit === 'ft_in' ? (
            <View style={styles.row}>
              <Field label="ft" value={heightInput} onChangeText={setHeightInput} keyboardType="numeric" flex styles={styles} colors={colors} />
              <Field label="in" value={heightInchesInput} onChangeText={setHeightInchesInput} keyboardType="numeric" flex styles={styles} colors={colors} />
            </View>
          ) : (
            <Field label="cm" value={heightInput} onChangeText={setHeightInput} keyboardType="numeric" styles={styles} colors={colors} />
          )}
        </View>

        <View>
          <Text style={styles.label}>Current weight</Text>
          {weightUnit === 'st_lb' ? (
            <View style={styles.row}>
              <Field label="st" value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" flex styles={styles} colors={colors} />
              <Field label="lb" value={weightStoneLbInput} onChangeText={setWeightStoneLbInput} keyboardType="decimal-pad" flex styles={styles} colors={colors} />
            </View>
          ) : (
            <Field label={weightUnit} value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" styles={styles} colors={colors} />
          )}
        </View>

        <View>
          <Text style={styles.label}>Goal weight</Text>
          {weightUnit === 'st_lb' ? (
            <View style={styles.row}>
              <Field label="st" value={goalWeightInput} onChangeText={setGoalWeightInput} keyboardType="numeric" flex styles={styles} colors={colors} />
              <Field label="lb" value={goalWeightStoneLbInput} onChangeText={setGoalWeightStoneLbInput} keyboardType="decimal-pad" flex styles={styles} colors={colors} />
            </View>
          ) : (
            <Field label={weightUnit} value={goalWeightInput} onChangeText={setGoalWeightInput} keyboardType="decimal-pad" styles={styles} colors={colors} />
          )}
        </View>

        <View>
          <Text style={styles.label}>Activity level</Text>
          <View style={styles.chipRow}>
            {ACTIVITY_LEVELS.map((a) => (
              <Pressable key={a.id} style={[styles.chip, activity === a.id && styles.chipActive]} onPress={() => setActivity(a.id)}>
                <Text style={[styles.chipText, activity === a.id && styles.chipTextActive]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {profile.is_custom_target && (
          <View style={styles.notice}>
            <Ionicons name="lock-closed" size={14} color={colors.amber} />
            <Text style={styles.noticeText}>
              You have a custom calorie/macro target set — it won't be recalculated. Only your BMI will update.
            </Text>
          </View>
        )}

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'numeric' | 'decimal-pad';
  flex?: boolean;
  styles: any;
  colors: any;
}) {
  return (
    <View style={props.flex ? { flex: 1 } : undefined}>
      <Text style={props.styles.fieldSubLabel}>{props.label}</Text>
      <TextInput
        style={props.styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        placeholderTextColor={props.colors.textFaint}
      />
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
    fieldSubLabel: { color: colors.textFaint, fontSize: 10.5, fontWeight: '600', marginBottom: 4 },
    input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, fontSize: 15, fontWeight: '700', borderWidth: 1, borderColor: colors.border },
    row: { flexDirection: 'row', gap: 10 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
    chipText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', textTransform: 'capitalize' },
    chipTextActive: { color: colors.emerald },
    notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.amberBg, borderRadius: radius.md, padding: 10 },
    noticeText: { flex: 1, color: colors.amber, fontSize: 11, lineHeight: 15, fontWeight: '600' },
    saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  });
