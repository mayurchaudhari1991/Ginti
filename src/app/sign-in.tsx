import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { defaultRings, GMark, OrbitField } from '@/components/brand';
import { Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';
import { C, F } from '@/theme/tokens';

export default function SignIn() {
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isLink = /token=/.test(code);
  const codeReady = isLink || code.length === 6;

  async function onSend() {
    setBusy(true);
    setError(null);
    try {
      await sendCode(email.trim().toLowerCase());
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email.trim().toLowerCase(), code.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code did not work');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ink }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <OrbitField size={340} rings={defaultRings(340)} />
            <View style={styles.tile}>
              <GMark size={62} color={C.ink} coin={C.ionDeep} />
            </View>
          </View>

          <Rise>
            <Txt variant="hero" style={{ fontSize: 30, lineHeight: 36 }}>
              Every rupee,{'\n'}accounted for.
            </Txt>
            <Txt style={{ marginTop: 12, fontSize: 15, color: C.muted, lineHeight: 21 }}>
              Sign in to sync across devices. Your AI stays on your own machine.
            </Txt>
          </Rise>

          {!supabaseConfigured && (
            <Card tone="ai">
              <Txt variant="strong" color={C.ionTextSoft}>
                Supabase key missing
              </Txt>
              <Txt style={{ marginTop: 6, color: C.ionText, fontSize: 13, lineHeight: 19 }}>
                Add EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the .env file, then restart the dev server.
              </Txt>
            </Card>
          )}

          {step === 'email' ? (
            <Rise delay={120} style={{ gap: 14 }}>
              <Txt nativeID="email-label" style={{ fontSize: 13, color: C.text2 }}>
                Email
              </Txt>
              <TextInput
                accessibilityLabelledBy="email-label"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={[styles.input, emailValid && { borderColor: C.volt }]}
              />
              <Button title="Send login code" onPress={onSend} busy={busy} disabled={!emailValid || !supabaseConfigured} />
              <Button title="I already have a code or link" variant="ghost" onPress={() => setStep('code')} disabled={!supabaseConfigured} />
            </Rise>
          ) : (
            <Rise style={{ gap: 14 }}>
              <Txt style={{ fontSize: 13, color: C.text2, lineHeight: 19 }}>
                Check {email.trim()}. Enter the 6-digit code, or long-press the link in the email, copy it, and paste it here. Do not open the link.
              </Txt>
              <TextInput
                accessibilityLabel="Login code or link"
                value={code}
                onChangeText={(t) => setCode(/token=/.test(t) ? t.trim() : t.replace(/\D/g, '').slice(0, 6))}
                placeholder="Code or link"
                placeholderTextColor={C.muted}
                autoComplete="one-time-code"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                style={[styles.input, !isLink && styles.code, codeReady && { borderColor: C.volt }]}
              />
              <Button title="Verify and continue" onPress={onVerify} busy={busy} disabled={!codeReady} />
              <Button title="Use a different email" variant="ghost" onPress={() => setStep('email')} />
            </Rise>
          )}

          {error && <Txt style={{ color: C.danger, fontSize: 13 }}>{error}</Txt>}
          <Txt variant="small" style={{ textAlign: 'center', marginTop: 8 }}>
            New here? The same code creates your account.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 20 },
  hero: { height: 300, alignItems: 'center', justifyContent: 'center', marginHorizontal: -24, overflow: 'hidden' },
  tile: { position: 'absolute', width: 96, height: 96, borderRadius: 28, backgroundColor: C.volt, alignItems: 'center', justifyContent: 'center' },
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.line2,
    color: C.text,
    fontFamily: F.body,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  code: { fontFamily: F.mono, fontSize: 24, letterSpacing: 10, textAlign: 'center' },
});
