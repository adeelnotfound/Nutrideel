import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from '../common/Modal';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MealType, FoodEntry } from '../../types';
import { AIContextSnapshot, evaluateFoodServing, analyzeHypotheticalMeal } from '../../services/aiService';
import { getSystemLocalISOString } from '../../utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contextSnapshot: AIContextSnapshot;
  onCommitMeal: (mealType: MealType, items: Omit<FoodEntry, 'id'>[]) => void;
}

interface DraftItem {
  key: string;
  food_name: string;
  quantity: number;
  serving_size: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export default function HypotheticalMealModal({ isOpen, onClose, contextSnapshot, onCommitMeal }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [description, setDescription] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const reset = () => {
    setDescription('');
    setItems([]);
    setAnalysis(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleAddItem = async () => {
    if (!description.trim()) return;
    setAddingItem(true);
    setAnalysis(null);
    try {
      const food = await evaluateFoodServing(description.trim(), 'hypothetical');
      setItems((prev) => [
        ...prev,
        {
          key: `item_${Date.now()}`,
          food_name: food.food_name,
          quantity: food.quantity,
          serving_size: food.estimated_grams,
          unit: food.unit,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          fiber: food.fiber,
        },
      ]);
      setDescription('');
    } finally {
      setAddingItem(false);
    }
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    setAnalysis(null);
  };

  const totals = items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const handleAnalyze = async () => {
    if (items.length === 0) return;
    setAnalyzing(true);
    try {
      const advice = await analyzeHypotheticalMeal(
        {
          id: 'hyp_temp',
          name: 'Hypothetical Meal',
          meal_type: 'custom',
          items: items.map((i) => ({
            id: i.key,
            food_name: i.food_name,
            quantity: i.quantity,
            serving_size: i.serving_size,
            unit: i.unit,
            calories: i.calories,
            protein: i.protein,
            carbs: i.carbs,
            fat: i.fat,
            fiber: i.fiber,
            source: 'logged',
            created_at: new Date().toISOString(),
          })),
          created_at: new Date().toISOString(),
        },
        contextSnapshot
      );
      setAnalysis(advice);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = () => {
    if (items.length === 0) return;
    onCommitMeal(
      'snack',
      items.map((i) => ({
        food_name: i.food_name,
        quantity: i.quantity,
        serving_size: i.serving_size,
        unit: i.unit,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        fiber: i.fiber,
        source: 'logged',
        created_at: getSystemLocalISOString(),
      }))
    );
    close();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="What If I Ate...">
      <View style={{ gap: 12 }}>
        <Text style={styles.hint}>
          Build a hypothetical meal from one or more foods and check it against today's remaining budget before you commit to eating it.
        </Text>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. a slice of pepperoni pizza"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={handleAddItem}
          />
          <Pressable style={styles.addBtn} onPress={handleAddItem} disabled={addingItem}>
            {addingItem ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
          </Pressable>
        </View>

        {items.length > 0 && (
          <View style={styles.itemsCard}>
            <FlatList
              data={items}
              keyExtractor={(i) => i.key}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.food_name}</Text>
                    <Text style={styles.itemMeta}>
                      {Math.round(item.calories)} kcal · P{Math.round(item.protein)} C{Math.round(item.carbs)} F{Math.round(item.fat)}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeItem(item.key)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textFaint} />
                  </Pressable>
                </View>
              )}
            />
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total</Text>
              <Text style={styles.totalsValue}>
                {Math.round(totals.calories)} kcal · P{Math.round(totals.protein)} C{Math.round(totals.carbs)} F{Math.round(totals.fat)}
              </Text>
            </View>
          </View>
        )}

        {items.length > 0 && (
          <Pressable style={styles.analyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
            {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>Analyze This Meal</Text>}
          </Pressable>
        )}

        {analysis && (
          <View style={styles.resultCard}>
            <Text style={styles.resultText}>{analysis}</Text>
            <Pressable style={styles.commitBtn} onPress={handleCommit}>
              <Text style={styles.commitBtnText}>Log This Meal Anyway</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 17 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
  itemsCard: { backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  itemMeta: { color: colors.textFaint, fontSize: 10.5, marginTop: 1 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  totalsLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  totalsValue: { color: colors.emerald, fontSize: 11.5, fontWeight: '800' },
  analyzeBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  analyzeBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  resultCard: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  resultText: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
  commitBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  commitBtnText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
});
