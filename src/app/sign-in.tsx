import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { defaultRings, GMark, OrbitField } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Float, Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Card, Segmented } from '@/components/ui';
import { useAuth, type AuthMode } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';
import { C, F } from '@/theme/tokens';

const RESEND_AFTER = 60;

export default function SignIn() {
  const { sendCode, verifyCode, linkError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const canSend = emailValid && (mode === 'login' || name.trim().length > 0) && supabaseConfigured;
  const isLink = /token=/.test(code);
  const codeReady = isLink || code.length === 6;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await sendCode(cleanEmail, mode, name.trim());
      setSentTo(cleanEmail);
      setCooldown(RESEND_AFTER);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the email');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(sentTo, code.trim());
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
          <View style={[styles.hero, sentTo && { height: 220 }]}>
            <OrbitField size={340} rings={defaultRings(340)} />
            <View style={styles.tile}>
              <GMark size={62} color={C.ink} coin={C.ionDeep} />
            </View>
          </View>

          {!supabaseConfigured && (
            <Card tone="ai">
              <Txt variant="strong" color={C.ionTextSoft}>
                Supabase key missing
              </Txt>
              <Txt style={{ marginTop: 6, color: C.ionText, fontSize: 13, lineHeight: 19 }}>
                Add EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local and rebuild.
              </Txt>
            </Card>
          )}

          {sentTo ? (
            <Rise style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Float duration={2400}>
                  <View style={styles.mailIcon}>
                    <Icon name="send" size={22} color={C.ink} strokeWidth={2.2} />
                  </View>
                </Float>
                <View style={{ flex: 1 }}>
                  <Txt variant="display" style={{ fontSize: 22 }}>
                    Check your email
                  </Txt>
                  <Txt variant="small" style={{ marginTop: 2 }} numberOfLines={1}>
                    Sent to {sentTo}
                  </Txt>
                </View>
              </View>

              <Card style={{ gap: 14 }}>
                {[
                  'Open the email from Supabase Auth on this phone.',
                  mode === 'signup' ? 'Tap "Confirm email address".' : 'Tap "Sign in".',
                  'Ginti opens and signs you in. Nothing else to do.',
                ].map((step, i) => (
                  <View key={step} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={styles.stepNum}>
                      <Txt style={{ fontFamily: F.semibold, fontSize: 12, color: C.ink }}>{i + 1}</Txt>
                    </View>
                    <Txt style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{step}</Txt>
                  </View>
                ))}
                <Txt variant="small" style={{ lineHeight: 17 }}>
                  Open the link on this phone only. Opening it on a computer uses it up.
                </Txt>
              </Card>

              {(linkError || error) && <Txt style={{ color: C.danger, fontSize: 13, lineHeight: 19 }}>{linkError ?? error}</Txt>}

              <View style={{ gap: 10 }}>
                <Txt style={{ fontSize: 13, color: C.text2 }}>Got a 6-digit code instead? Enter it here.</Txt>
                <TextInput
                  accessibilityLabel="Login code"
                  value={code}
                  onChangeText={(t) => setCode(/token=/.test(t) ? t.trim() : t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  placeholderTextColor={C.muted}
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={isLink ? 'default' : 'number-pad'}
                  style={[styles.input, !isLink && styles.code, codeReady && { borderColor: C.volt }]}
                />
                {codeReady && <Button title="Verify and continue" onPress={verify} busy={busy} />}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'} variant="ghost" onPress={send} disabled={cooldown > 0} busy={busy && !codeReady} style={{ flex: 1 }} />
                <Button
                  title="Change email"
                  variant="ghost"
                  onPress={() => {
                    setSentTo(null);
                    setCode('');
                    setError(null);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </Rise>
          ) : (
            <Rise style={{ gap: 18 }}>
              <View>
                <Txt variant="hero" style={{ fontSize: 30, lineHeight: 36 }}>
                  {mode === 'login' ? 'Welcome back.' : 'Every rupee,\naccounted for.'}
                </Txt>
                <Txt style={{ marginTop: 10, fontSize: 15, color: C.muted, lineHeight: 21 }}>
                  {mode === 'login' ? 'Log in with your email. No password to remember.' : 'Create your free account. Your data stays private to you.'}
                </Txt>
              </View>

              <Segmented
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setError(null);
                }}
                options={[
                  { value: 'login', label: 'Log in' },
                  { value: 'signup', label: 'Sign up' },
                ]}
              />

              {mode === 'signup' && (
                <Field label="Your name">
                  <TextInput value={name} onChangeText={setName} placeholder="Mayur" placeholderTextColor={C.muted} autoComplete="name" style={styles.input} />
                </Field>
              )}
              <Field label="Email">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  style={[styles.input, emailValid && { borderColor: C.volt }]}
                />
              </Field>

              {error && <Txt style={{ color: C.danger, fontSize: 13, lineHeight: 19 }}>{error}</Txt>}
              <Button title={mode === 'login' ? 'Send login email' : 'Create account'} onPress={send} busy={busy} disabled={!canSend} />

              <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} hitSlop={10}>
                <Txt variant="small" style={{ textAlign: 'center' }}>
                  {mode === 'login' ? 'New to Ginti? ' : 'Already have an account? '}
                  <Txt style={{ fontSize: 12, color: C.volt }}>{mode === 'login' ? 'Sign up' : 'Log in'}</Txt>
                </Txt>
              </Pressable>
            </Rise>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt style={{ fontSize: 13, color: C.text2 }}>{label}</Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 20 },
  hero: { height: 300, alignItems: 'center', justifyContent: 'center', marginHorizontal: -24, overflow: 'hidden' },
  tile: { position: 'absolute', width: 96, height: 96, borderRadius: 28, backgroundColor: C.volt, alignItems: 'center', justifyContent: 'center' },
  mailIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.volt, alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.volt, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
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
