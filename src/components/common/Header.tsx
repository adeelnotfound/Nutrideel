import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { formatSystemDisplayDate, getSystemLocalDateString } from '../../utils/date';

interface Props {
  currentDate: string;
  onDateChange: (date: string) => void;
  streakCount: number;
}

export default function Header({ currentDate, onDateChange, streakCount }: Props) {
  const today = getSystemLocalDateString();
  const isToday = currentDate === today;

  const shiftDate = (deltaDays: number) => {
    const parts = currentDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + deltaDays);
    onDateChange(getSystemLocalDateString(d));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <View>
          <Text style={styles.brand}>Nutrideel</Text>
          <View style={styles.dateRow}>
            <Pressable onPress={() => shiftDate(-1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.dateText}>{isToday ? 'Today' : formatSystemDisplayDate(currentDate)}</Text>
            <Pressable onPress={() => shiftDate(1)} hitSlop={10}>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            {!isToday && (
              <Pressable onPress={() => onDateChange(today)} style={styles.todayBtn}>
                <Text style={styles.todayBtnText}>Jump to today</Text>
              </Pressable>
            )}
          </View>
        </View>
        {streakCount > 0 && (
          <View style={styles.streakPill}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streakCount}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  brand: { color: colors.text, fontSize: 18, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dateText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', minWidth: 90 },
  todayBtn: { marginLeft: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.emeraldBg },
  todayBtnText: { color: colors.emerald, fontSize: 11, fontWeight: '700' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  streakEmoji: { fontSize: 14 },
  streakText: { color: colors.amber, fontWeight: '800', fontSize: 13 },
});
