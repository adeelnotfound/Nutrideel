import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, FlatList, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Modal from '../common/Modal';
import PromptModal from '../common/PromptModal';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { FoodEntry, MealType, SavedMeal } from '../../types';
import { storage } from '../../services/storage';
import { evaluateFoodServing, evaluateFoodPhoto, EvaluatedFoodResponse } from '../../services/aiService';
import { getSystemLocalISOString } from '../../utils/date';
import { useToast } from '../common/ToastProvider';
import { haptics } from '../../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mealType: MealType;
  currentDate: string;
  onFoodAdded: (entry: FoodEntry) => void;
  onMealAdded: (items: Omit<FoodEntry, 'id'>[]) => void;
}

type Mode = 'quick' | 'photo' | 'manual' | 'saved' | 'combo';

interface ComboItem {
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

export default function AddFoodModal({ isOpen, onClose, mealType, onFoodAdded, onMealAdded }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('quick');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluatedFoodResponse | null>(null);

  const [manualName, setManualName] = useState('');
  const [manualCals, setManualCals] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
  const [photoNote, setPhotoNote] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoResult, setPhotoResult] = useState<EvaluatedFoodResponse | null>(null);

  const [comboDescription, setComboDescription] = useState('');
  const [comboLoading, setComboLoading] = useState(false);
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  const [savedMealsRefresh, setSavedMealsRefresh] = useState(0);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const savedFoods = storage
    .getSavedFoods()
    .sort((a, b) => (b.favorite === a.favorite ? b.frequency - a.frequency : b.favorite ? 1 : -1))
    .slice(0, 30);
  const savedMeals = storage.getSavedMeals().sort((a, b) => b.frequency - a.frequency);

  const reset = () => {
    setDescription('');
    setResult(null);
    setManualName('');
    setManualCals('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setComboDescription('');
    setComboItems([]);
    setPhotoUri(null);
    setPhotoBase64(null);
    setPhotoNote('');
    setPhotoResult(null);
  };

  const close = () => {
    reset();
    setMode('quick');
    onClose();
  };

  const handleEvaluate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await evaluateFoodServing(description.trim(), mealType);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  const requestImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show(fromCamera ? 'Camera permission is needed to take a photo' : 'Photo library permission is needed', 'error');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoResult(null);
    if (asset.base64) {
      const mime = asset.mimeType || 'image/jpeg';
      setPhotoBase64(asset.base64);
      setPhotoMime(mime);
      await analyzePhoto(asset.base64, mime);
    }
  };

  const analyzePhoto = async (base64: string, mimeType: string) => {
    setPhotoLoading(true);
    setPhotoResult(null);
    try {
      const res = await evaluateFoodPhoto(base64, mimeType, mealType, photoNote.trim());
      setPhotoResult(res);
    } finally {
      setPhotoLoading(false);
    }
  };

  const commitPhotoResult = () => {
    if (!photoResult) return;
    const entry: FoodEntry = {
      id: `f_${Date.now()}`,
      food_name: photoResult.food_name,
      quantity: photoResult.quantity || 1,
      serving_size: photoResult.estimated_grams || photoResult.quantity || 1,
      unit: photoResult.unit || 'portion',
      calories: photoResult.calories,
      protein: photoResult.protein,
      carbs: photoResult.carbs,
      fat: photoResult.fat,
      fiber: photoResult.fiber,
      source: 'logged',
      created_at: getSystemLocalISOString(),
    };
    onFoodAdded(entry);
    close();
  };

  const commitResult = () => {
    if (!result) return;
    const entry: FoodEntry = {
      id: `f_${Date.now()}`,
      food_name: result.food_name,
      quantity: result.quantity || 1,
      serving_size: result.estimated_grams || result.quantity || 1,
      unit: result.unit || 'portion',
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      fiber: result.fiber,
      source: 'logged',
      created_at: getSystemLocalISOString(),
    };
    onFoodAdded(entry);
    close();
  };

  const commitManual = () => {
    if (!manualName.trim() || !manualCals) return;
    const entry: FoodEntry = {
      id: `f_${Date.now()}`,
      food_name: manualName.trim(),
      quantity: 1,
      serving_size: 1,
      unit: 'serving',
      calories: Number(manualCals) || 0,
      protein: Number(manualProtein) || 0,
      carbs: Number(manualCarbs) || 0,
      fat: Number(manualFat) || 0,
      source: 'logged',
      created_at: getSystemLocalISOString(),
    };
    onFoodAdded(entry);
    close();
  };

  const commitSaved = (sf: ReturnType<typeof storage.getSavedFoods>[number]) => {
    const entry: FoodEntry = {
      id: `f_${Date.now()}`,
      food_name: sf.name,
      quantity: sf.serving_size,
      serving_size: sf.serving_size,
      unit: sf.unit,
      calories: sf.calories,
      protein: sf.protein,
      carbs: sf.carbs,
      fat: sf.fat,
      fiber: sf.fiber,
      sugar: sf.sugar,
      sodium: sf.sodium,
      source: 'logged',
      created_at: getSystemLocalISOString(),
    };
    onFoodAdded(entry);
    close();
  };

  const handleAddComboItem = async () => {
    if (!comboDescription.trim()) return;
    setComboLoading(true);
    try {
      const food = await evaluateFoodServing(comboDescription.trim(), mealType);
      setComboItems((prev) => [
        ...prev,
        {
          key: `combo_${Date.now()}`,
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
      setComboDescription('');
    } finally {
      setComboLoading(false);
    }
  };

  const removeComboItem = (key: string) => {
    setComboItems((prev) => prev.filter((i) => i.key !== key));
  };

  const comboTotals = comboItems.reduce(
    (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const toFoodItems = (): Omit<FoodEntry, 'id'>[] =>
    comboItems.map((i) => ({
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
    }));

  const handleLogCombo = () => {
    if (comboItems.length === 0) return;
    onMealAdded(toFoodItems());
    close();
  };

  const saveComboWithName = (name: string) => {
    if (!name.trim()) return;
    storage.addSavedMeal({ name: name.trim(), meal_type: mealType, items: toFoodItems(), favorite: false });
    setSavedMealsRefresh((n) => n + 1);
    setComboItems([]);
    haptics.success();
    toast.show(`"${name.trim()}" saved`, 'success');
  };

  const handleSaveCombo = () => {
    if (comboItems.length === 0) return;
    setNamePromptOpen(true);
  };

  const commitSavedMeal = (meal: SavedMeal) => {
    onMealAdded(
      meal.items.map((i) => ({
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

  const deleteSavedMeal = (id: string) => {
    storage.deleteSavedMeal(id);
    setSavedMealsRefresh((n) => n + 1);
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={`Add to ${mealType}`}>
      <PromptModal
        isOpen={namePromptOpen}
        title="Save Combo Meal"
        message='Give this combo a name (e.g. "My Usual Breakfast")'
        placeholder="Combo name"
        confirmLabel="Save"
        onCancel={() => setNamePromptOpen(false)}
        onConfirm={(name) => {
          saveComboWithName(name);
          setNamePromptOpen(false);
        }}
      />
      <View style={styles.tabRow}>
        {(['quick', 'photo', 'manual', 'saved', 'combo'] as Mode[]).map((m) => (
          <Pressable key={m} style={[styles.tabBtn, mode === m && styles.tabBtnActive]} onPress={() => setMode(m)}>
            <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
              {m === 'quick' ? 'Describe' : m === 'photo' ? 'Photo' : m === 'manual' ? 'Manual' : m === 'saved' ? 'Saved' : 'Meals'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'quick' && (
        <View>
          <Text style={styles.hint}>Describe what you ate in plain language — e.g. "a bowl of chicken biryani" or "2 slices of toast with peanut butter".</Text>
          <TextInput
            style={styles.input}
            placeholder="What did you eat?"
            placeholderTextColor={colors.textFaint}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Pressable style={styles.primaryBtn} onPress={handleEvaluate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Estimate Nutrition</Text>}
          </Pressable>

          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>{result.food_name}</Text>
              <Text style={styles.resultSub}>{result.serving_description}</Text>
              <View style={styles.macroGrid}>
                <MacroStat label="Cal" value={Math.round(result.calories)} />
                <MacroStat label="Protein" value={`${Math.round(result.protein)}g`} />
                <MacroStat label="Carbs" value={`${Math.round(result.carbs)}g`} />
                <MacroStat label="Fat" value={`${Math.round(result.fat)}g`} />
              </View>
              {!!result.nutritional_notes && <Text style={styles.notes}>{result.nutritional_notes}</Text>}
              {result.fallback && <Text style={styles.fallbackNote}>Offline estimate — connect an AI provider in Profile for AI-powered estimates.</Text>}
              <Pressable style={styles.primaryBtn} onPress={commitResult}>
                <Text style={styles.primaryBtnText}>Log This Food</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {mode === 'photo' && (
        <View>
          <Text style={styles.hint}>Snap or pick a photo of your food — AI identifies it and estimates nutrition from the portion shown.</Text>

          <View style={styles.photoBtnRow}>
            <Pressable style={styles.photoActionBtn} onPress={() => requestImage(true)}>
              <Ionicons name="camera-outline" size={18} color={colors.emerald} />
              <Text style={styles.photoActionText}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.photoActionBtn} onPress={() => requestImage(false)}>
              <Ionicons name="images-outline" size={18} color={colors.emerald} />
              <Text style={styles.photoActionText}>Choose Photo</Text>
            </Pressable>
          </View>

          {photoUri && (
            <>
              <TextInput
                style={[styles.input, { minHeight: 0, marginTop: 10 }]}
                placeholder='Optional note — e.g. "no dressing" or "large portion"'
                placeholderTextColor={colors.textFaint}
                value={photoNote}
                onChangeText={setPhotoNote}
              />
              <Pressable
                style={styles.reanalyzeBtn}
                onPress={() => photoBase64 && analyzePhoto(photoBase64, photoMime)}
                disabled={photoLoading || !photoBase64}
              >
                <Ionicons name="refresh-outline" size={14} color={colors.emerald} />
                <Text style={styles.reanalyzeBtnText}>Re-analyze with note</Text>
              </Pressable>
            </>
          )}

          {photoUri && (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              {photoLoading && (
                <View style={styles.photoLoadingOverlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.photoLoadingText}>Analyzing photo…</Text>
                </View>
              )}
            </View>
          )}

          {photoResult && !photoLoading && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>{photoResult.food_name}</Text>
              <Text style={styles.resultSub}>{photoResult.serving_description}</Text>
              <View style={styles.macroGrid}>
                <MacroStat label="Cal" value={Math.round(photoResult.calories)} />
                <MacroStat label="Protein" value={`${Math.round(photoResult.protein)}g`} />
                <MacroStat label="Carbs" value={`${Math.round(photoResult.carbs)}g`} />
                <MacroStat label="Fat" value={`${Math.round(photoResult.fat)}g`} />
              </View>
              {!!photoResult.nutritional_notes && <Text style={styles.notes}>{photoResult.nutritional_notes}</Text>}
              {photoResult.fallback && <Text style={styles.fallbackNote}>Offline estimate — connect an AI provider in Profile for AI-powered photo analysis.</Text>}
              <Pressable style={styles.primaryBtn} onPress={commitPhotoResult}>
                <Text style={styles.primaryBtnText}>Log This Food</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {mode === 'manual' && (
        <View style={{ gap: 10 }}>
          <LabeledInput label="Food name" value={manualName} onChangeText={setManualName} placeholder="e.g. Grilled chicken breast" />
          <View style={styles.row2}>
            <LabeledInput label="Calories" value={manualCals} onChangeText={setManualCals} keyboardType="numeric" placeholder="0" />
            <LabeledInput label="Protein (g)" value={manualProtein} onChangeText={setManualProtein} keyboardType="numeric" placeholder="0" />
          </View>
          <View style={styles.row2}>
            <LabeledInput label="Carbs (g)" value={manualCarbs} onChangeText={setManualCarbs} keyboardType="numeric" placeholder="0" />
            <LabeledInput label="Fat (g)" value={manualFat} onChangeText={setManualFat} keyboardType="numeric" placeholder="0" />
          </View>
          <Pressable style={styles.primaryBtn} onPress={commitManual}>
            <Text style={styles.primaryBtnText}>Log This Food</Text>
          </Pressable>
        </View>
      )}

      {mode === 'saved' && (
        <View key={savedMealsRefresh}>
          {savedFoods.length === 0 ? (
            <Text style={styles.hint}>No saved foods yet. Foods you log will appear here for quick re-adding.</Text>
          ) : (
            <FlatList
              data={savedFoods}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable style={styles.savedRow} onPress={() => commitSaved(item)}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      storage.toggleSavedFoodFavorite(item.id);
                      setSavedMealsRefresh((n) => n + 1);
                      haptics.light();
                    }}
                  >
                    <Ionicons name={item.favorite ? 'star' : 'star-outline'} size={17} color={item.favorite ? colors.amber : colors.textFaint} style={{ marginRight: 10 }} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedName}>{item.name}</Text>
                    <Text style={styles.savedMeta}>
                      {item.calories} kcal · P{item.protein} C{item.carbs} F{item.fat}
                    </Text>
                  </View>
                  <Text style={styles.savedFreq}>{item.frequency}x</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}

      {mode === 'combo' && (
        <View style={{ gap: 12 }} key={savedMealsRefresh}>
          <Text style={styles.hint}>Build a combo from multiple foods and save it to log in one tap next time — great for meals you eat often.</Text>

          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { minHeight: 0, flex: 1 }]}
              value={comboDescription}
              onChangeText={setComboDescription}
              placeholder="Add a food to this combo..."
              placeholderTextColor={colors.textFaint}
              onSubmitEditing={handleAddComboItem}
            />
            <Pressable style={styles.addBtn} onPress={handleAddComboItem} disabled={comboLoading}>
              {comboLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
            </Pressable>
          </View>

          {comboItems.length > 0 && (
            <View style={styles.itemsCard}>
              {comboItems.map((item) => (
                <View key={item.key} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.food_name}</Text>
                    <Text style={styles.itemMeta}>
                      {Math.round(item.calories)} kcal · P{Math.round(item.protein)} C{Math.round(item.carbs)} F{Math.round(item.fat)}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeComboItem(item.key)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textFaint} />
                  </Pressable>
                </View>
              ))}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Total</Text>
                <Text style={styles.totalsValue}>
                  {Math.round(comboTotals.calories)} kcal · P{Math.round(comboTotals.protein)} C{Math.round(comboTotals.carbs)} F{Math.round(comboTotals.fat)}
                </Text>
              </View>
            </View>
          )}

          {comboItems.length > 0 && (
            <View style={styles.row2}>
              <Pressable style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={handleLogCombo}>
                <Text style={styles.primaryBtnText}>Log Now</Text>
              </Pressable>
              <Pressable style={[styles.saveComboBtn, { flex: 1 }]} onPress={handleSaveCombo}>
                <Text style={styles.saveComboBtnText}>Save for Later</Text>
              </Pressable>
            </View>
          )}

          {savedMeals.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.sectionLabel}>Your Saved Meals</Text>
              {savedMeals.map((meal) => {
                const total = meal.items.reduce((acc, i) => acc + (i.calories || 0), 0);
                return (
                  <View key={meal.id} style={styles.savedMealRow}>
                    <Pressable style={{ flex: 1 }} onPress={() => commitSavedMeal(meal)}>
                      <Text style={styles.savedName}>{meal.name}</Text>
                      <Text style={styles.savedMeta}>
                        {meal.items.length} item{meal.items.length !== 1 ? 's' : ''} · {Math.round(total)} kcal
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => deleteSavedMeal(meal.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={colors.rose} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

function MacroStat({ label, value }: { label: string; value: string | number }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.macroStat}>
      <Text style={styles.macroStatValue}>{value}</Text>
      <Text style={styles.macroStatLabel}>{label}</Text>
    </View>
  );
}

function LabeledInput(props: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: 'numeric' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={props.keyboardType}
      />
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.emeraldBg, borderWidth: 1, borderColor: colors.emerald },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 11.5 },
  tabTextActive: { color: colors.emerald },
  hint: { color: colors.textFaint, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border },
  primaryBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  resultCard: { marginTop: 16, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  resultTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  resultSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  macroGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  macroStat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  macroStatValue: { color: colors.text, fontWeight: '800', fontSize: 14 },
  macroStatLabel: { color: colors.textFaint, fontSize: 10, marginTop: 1 },
  notes: { color: colors.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },
  fallbackNote: { color: colors.amber, fontSize: 10.5, marginTop: 8 },
  row2: { flexDirection: 'row', gap: 10 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  fieldInput: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: 10, color: colors.text, borderWidth: 1, borderColor: colors.border },
  savedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  savedName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  savedMeta: { color: colors.textFaint, fontSize: 10.5, marginTop: 2 },
  savedFreq: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
  itemsCard: { backgroundColor: colors.cardAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  itemMeta: { color: colors.textFaint, fontSize: 10.5, marginTop: 1 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  totalsLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  totalsValue: { color: colors.emerald, fontSize: 11.5, fontWeight: '800' },
  saveComboBtn: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: colors.emerald },
  saveComboBtnText: { color: colors.emerald, fontWeight: '800', fontSize: 13 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  savedMealRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  photoBtnRow: { flexDirection: 'row', gap: 10 },
  photoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.emeraldBg, borderRadius: radius.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.emerald },
  photoActionText: { color: colors.emerald, fontWeight: '800', fontSize: 12.5 },
  photoPreviewWrap: { marginTop: 12, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  photoPreview: { width: '100%', height: 200, backgroundColor: colors.cardAlt },
  photoLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoLoadingText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  reanalyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8, paddingVertical: 6 },
  reanalyzeBtnText: { color: colors.emerald, fontWeight: '700', fontSize: 11.5 },
});
