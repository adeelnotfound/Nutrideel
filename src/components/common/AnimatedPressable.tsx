import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import { haptics } from '../../utils/haptics';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'selection' | 'none';
  children: React.ReactNode;
}

// A drop-in replacement for Pressable that adds a subtle scale-down animation on press
// and (optionally) a haptic tick — the two cheapest, highest-impact things for making an
// app feel responsive rather than static. Uses the built-in Animated API, no extra
// dependency, so it costs nothing at the bundle level.
export default function AnimatedPressable({ style, scaleTo = 0.96, haptic = 'light', onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    if (haptic === 'light') haptics.light();
    else if (haptic === 'medium') haptics.medium();
    else if (haptic === 'selection') haptics.selection();
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    onPressOut?.(e);
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
