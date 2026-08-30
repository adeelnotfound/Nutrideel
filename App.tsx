import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { hydrateStorage } from './src/services/storage';
import { applyGlobalFont } from './src/utils/globalFont';
import RootNavigator from './src/RootNavigator';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { ToastProvider } from './src/components/common/ToastProvider';

function AppShell({ ready }: { ready: boolean }) {
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.emerald} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <ToastProvider>
        <RootNavigator />
      </ToastProvider>
    </>
  );
}

export default function App() {
  const [dataReady, setDataReady] = useState(false);
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    hydrateStorage().then(() => setDataReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded) applyGlobalFont();
  }, [fontsLoaded]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell ready={dataReady && fontsLoaded} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
