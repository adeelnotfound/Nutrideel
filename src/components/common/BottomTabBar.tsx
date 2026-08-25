import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { haptics } from '../../utils/haptics';

export type TabId = 'today' | 'history' | 'progress' | 'ai' | 'profile';

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'today', label: 'Today', icon: 'calendar-outline' },
  { id: 'history', label: 'History', icon: 'time-outline' },
  { id: 'progress', label: 'Analytics', icon: 'trending-up-outline' },
  { id: 'ai', label: 'AI Coach', icon: 'sparkles-outline' },
  { id: 'profile', label: 'Profile', icon: 'person-outline' },
];

function TabButton({ tab, isActive, onPress }: { tab: (typeof TABS)[number]; isActive: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, speed: 30, bounciness: 10 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
      ]).start();
    }
  }, [isActive, scale]);

  return (
    <Pressable
      onPress={() => {
        if (!isActive) haptics.selection();
        onPress();
      }}
      style={styles.tabBtn}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={tab.icon} size={21} color={isActive ? colors.emerald : colors.textFaint} />
      </Animated.View>
      <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

export default function BottomTabBar({ activeTab, onChangeTab }: { activeTab: TabId; onChangeTab: (t: TabId) => void }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.row}>
        {TABS.map((tab) => (
          <TabButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onPress={() => onChangeTab(tab.id)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', height: 60 },
  tabBtn: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 },
  label: { fontSize: 10, color: colors.textFaint, fontWeight: '600' },
  labelActive: { color: colors.emerald, fontWeight: '800' },
});
