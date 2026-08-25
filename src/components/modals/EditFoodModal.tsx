import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Modal from '../common/Modal';
import { colors, radius } from '../../theme';
import { FoodEntry } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mealId: string;
  food: FoodEntry | null;
  onSave: (mealId: string, food: FoodEntry) => void;
  onDelete: (mealId: string, foodId: string) => void;
}

export default function EditFoodModal({ isOpen, onClose, mealId, food, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [cals, setCals] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');

  useEffect(() => {
    if (food) {
      setName(food.food_name);
      setCals(String(food.calories));
      setProtein(String(food.protein));
      setCarbs(String(food.carbs));
      setFat(String(food.fat));
      setQuantity(String(food.quantity));
      setUnit(food.unit);
    }
  }, [food]);

  if (!food) return null;

  const handleSave = () => {
    onSave(mealId, {
      ...food,
      food_name: name.trim() || food.food_name,
      calories: Number(cals) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      quantity: Number(quantity) || food.quantity,
      unit: unit || food.unit,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Food">
      <View style={{ gap: 10 }}>
        <Field label="Food name" value={name} onChangeText={setName} />
        <View style={styles.row2}>
          <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
          <Field label="Unit" value={unit} onChangeText={setUnit} />
        </View>
        <View style={styles.row2}>
          <Field label="Calories" value={cals} onChangeText={setCals} keyboardType="numeric" />
          <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="numeric" />
        </View>
        <View style={styles.row2}>
          <Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
          <Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="numeric" />
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </Pressable>
        <Pressable
          style={styles.deleteBtn}
          onPress={() => {
            onDelete(mealId, food.id);
            onClose();
          }}
        >
          <Text style={styles.deleteBtnText}>Delete Food</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Field(props: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'numeric' }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        placeholderTextColor={colors.textFaint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: 10 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  fieldInput: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: 10, color: colors.text, borderWidth: 1, borderColor: colors.border },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  deleteBtn: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.rose },
  deleteBtnText: { color: colors.rose, fontWeight: '800', fontSize: 13 },
});
