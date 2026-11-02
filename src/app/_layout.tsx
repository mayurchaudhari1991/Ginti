import { InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold } from '@expo-google-fonts/inter-tight';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Unbounded_600SemiBold, Unbounded_700Bold } from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DialogHost } from '@/components/dialog';
import { LockScreen } from '@/components/lock-screen';
import { SplashOverlay } from '@/components/splash';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LedgerProvider, useLedger } from '@/lib/ledger';
import { LockProvider, useLock } from '@/lib/lock';
import { firstName } from '@/lib/user';
import { C } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    JetBrainsMono_500Medium,
  });

  // The native splash only covers font loading; the animated overlay takes over after that.
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.ink }}>
      <AuthProvider>
        <LedgerProvider>
          <LockProvider>
            <StatusBar style="light" />
            <AppStack />
          </LockProvider>
        </LedgerProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const { session, ready } = useAuth();
  const { loading } = useLedger();
  const { locked } = useLock();
  const signedIn = !!session;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.ink }, animation: 'fade_from_bottom' }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="new-account" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="profile" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="import" />
          <Stack.Screen name="scan" options={{ animation: 'fade' }} />
          <Stack.Screen name="recurring" />
          <Stack.Screen name="categories" />
          <Stack.Screen name="history" />
          <Stack.Screen name="wrapped" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" />
      </Stack>
      {signedIn && locked && <LockScreen name={firstName(session)} />}
      <SplashOverlay ready={ready && (!signedIn || !loading)} />
      <DialogHost />
    </View>
  );
}
