import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { PlayfairDisplay_600SemiBold, useFonts } from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/src/AuthSheet';
import { PhotoSourceProvider } from '@/src/photoSource';
import { PresencePing } from '@/src/presence';
import { skiaReady } from '@/src/skia';
import { colors } from '@/src/theme';
import { languageReady } from '@/src/i18n';
import { track } from '@/src/track';

SplashScreen.preventAutoHideAsync();

// Development only (left out of the app): redraws the ready-made preset and AI tool pictures, see src/develop/renderThumbs.tsx.
if (__DEV__ && Platform.OS === 'web') {
  (globalThis as { camiRenderThumbs?: () => Promise<string> }).camiRenderThumbs = async () => {
    await skiaReady;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/src/develop/renderThumbs').renderThumbs();
  };
}

/**
 * On web, routes only render once we are in the browser: the server sends the spinner (screens that draw with Skia
 * need its engine, which only the browser loads; see src/skia.tsx).
 */
function useClientReady() {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => setReady(true), []);
  return ready;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });
  const clientReady = useClientReady();
  // The saved language is read before the first screen, so it never flashes in another language.
  const [langLoaded, setLangLoaded] = useState(false);
  useEffect(() => {
    languageReady.then(() => setLangLoaded(true));
  }, []);
  const ready = fontsLoaded && clientReady && langLoaded;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    track('app_open');
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      {ready ? (
        <AuthProvider>
          <PhotoSourceProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="editor" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="retouch" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="adjust" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="filters" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="export" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="generate" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="studio" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="combine" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="video" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="terms" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="delete-account" options={{ animation: 'slide_from_right' }} />
            </Stack>
            <PresencePing />
          </PhotoSourceProvider>
        </AuthProvider>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
