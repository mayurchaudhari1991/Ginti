import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Txt } from '@/components/txt';
import { useAuth } from '@/lib/auth';
import { C } from '@/theme/tokens';

/** Landing route for the email link; AuthProvider turns the URL into a session, this just waits for it. */
export default function AuthCallback() {
  const { session } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  if (session) return <Redirect href="/" />;
  if (timedOut) return <Redirect href="/sign-in" />;
  return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <ActivityIndicator color={C.volt} size="large" />
      <Txt variant="label">SIGNING YOU IN</Txt>
    </View>
  );
}
