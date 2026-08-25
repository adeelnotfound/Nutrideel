import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme';
import { haptics } from '../../utils/haptics';

interface Props {
  onAddFood: () => void;
  onLogWeight: () => void;
  onLogActivity: () => void;
  onLogFast: () => void;
  onOpenHypothetical: () => void;
}

const ACTIONS_META: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'food', label: 'Add Food', icon: 'restaurant-outline', color: colors.emerald },
  { key: 'weight', label: 'Log Weight', icon: 'scale-outline', color: colors.violet },
  { key: 'activity', label: 'Log Activity', icon: 'walk-outline', color: colors.sky },
  { key: 'fast', label: 'Log Fasting', icon: 'time-outline', color: colors.amber },
  { key: 'hypothetical', label: 'What If Meal', icon: 'bulb-outline', color: colors.rose },
];

export default function QuickActions({ onAddFood, onLogWeight, onLogActivity, onLogFast, onOpenHypothetical }: Props) {
  const [open, setOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const handlers: Record<string, () => void> = {
    food: onAddFood,
    weight: onLogWeight,
    activity: onLogActivity,
    fast: onLogFast,
    hypothetical: onOpenHypothetical,
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(progress, { toValue: open ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 6 }),
      Animated.timing(rotation, { toValue: open ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [open, progress, rotation]);

  const toggle = () => {
    haptics.medium();
    setOpen((o) => !o);
  };

  const select = (key: string) => {
    haptics.light();
    setOpen(false);
    handlers[key]();
  };

  const fabRotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.menu} pointerEvents={open ? 'auto' : 'none'}>
        {ACTIONS_META.map((a, index) => {
          // Reverse the stagger so the item closest to the FAB animates first, giving a
          // natural "unfurling" feel rather than every item appearing at once.
          const delayIndex = ACTIONS_META.length - 1 - index;
          const itemOpacity = progress.interpolate({
            inputRange: [delayIndex / ACTIONS_META.length, (delayIndex + 0.6) / ACTIONS_META.length, 1],
            outputRange: [0, 1, 1],
            extrapolate: 'clamp',
          });
          const itemTranslate = progress.interpolate({
            inputRange: [delayIndex / ACTIONS_META.length, (delayIndex + 0.6) / ACTIONS_META.length, 1],
            outputRange: [16, 0, 0],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View key={a.key} style={{ opacity: itemOpacity, transform: [{ translateY: itemTranslate }] }}>
              <Pressable style={styles.menuItem} onPress={() => select(a.key)}>
                <Text style={styles.menuLabel}>{a.label}</Text>
                <View style={[styles.menuIcon, { backgroundColor: a.color }]}>
                  <Ionicons name={a.icon} size={16} color="#fff" />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <Pressable style={styles.fab} onPress={toggle}>
        <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
          <Ionicons name="add" size={26} color="#fff" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 18, bottom: 76, alignItems: 'flex-end' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.emerald,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menu: { marginBottom: 12, gap: 8, alignItems: 'flex-end' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuLabel: {
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
