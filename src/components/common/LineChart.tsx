import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

interface Point {
  label: string;
  value: number;
}

interface Props {
  data: Point[];
  color?: string;
  height?: number;
  unit?: string;
  targetLine?: number;
}

export default function LineChart({ data, color, height = 160, unit = '', targetLine }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const lineColor = color ?? colors.emerald;
  const width = 320;
  const padding = 28;

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Not enough data yet</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const allValues = targetLine !== undefined ? [...values, targetLine] : values;
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rangePad = (max - min) * 0.12;
  min -= rangePad;
  max += rangePad;

  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const toX = (i: number) => padding + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const toY = (v: number) => padding + chartH - ((v - min) / (max - min)) * chartH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');

  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((t) => (
          <Line
            key={t}
            x1={padding}
            x2={width - padding}
            y1={padding + chartH * t}
            y2={padding + chartH * t}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}

        {targetLine !== undefined && (
          <Line
            x1={padding}
            x2={width - padding}
            y1={toY(targetLine)}
            y2={toY(targetLine)}
            stroke={colors.amber}
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />
        )}

        <Polyline points={points} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(d.value)} r={3.5} fill={lineColor} />
        ))}

        <SvgText x={padding} y={height - 6} fontSize={9} fill={colors.textFaint}>
          {data[0].label}
        </SvgText>
        <SvgText x={width - padding} y={height - 6} fontSize={9} fill={colors.textFaint} textAnchor="end">
          {data[data.length - 1].label}
        </SvgText>
      </Svg>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textFaint, fontSize: 12 },
});
