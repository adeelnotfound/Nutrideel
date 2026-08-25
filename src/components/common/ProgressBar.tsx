import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

export default function ProgressBar({
  pct,
  color = colors.emerald,
  bg = colors.cardAlt,
  height = 8,
}: {
  pct: number;
  color?: string;
  bg?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.track, { backgroundColor: bg, height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
