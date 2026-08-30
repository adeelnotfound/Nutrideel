import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function ProgressBar({
  pct,
  color,
  bg,
  height = 8,
}: {
  pct: number;
  color?: string;
  bg?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const barColor = color ?? colors.emerald;
  const barBg = bg ?? colors.cardAlt;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.track, { backgroundColor: barBg, height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: barColor, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
