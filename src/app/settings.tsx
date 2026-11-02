import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Pulse } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Chip, IconButton, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLock } from '@/lib/lock';
import { ping } from '@/lib/ollama';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { C, F } from '@/theme/tokens';

export default function Settings() {
  const prefs = usePrefs();
  const { available } = useLock();
  const { session, signOut } = useAuth();
  const [url, setUrl] = useState(prefs.ollamaUrl);
  const [model, setModel] = useState(prefs.ollamaModel);
  const [budget, setBudget] = useState(String(prefs.monthlyBudget));
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function testConnection() {
    setPrefs({ ollamaUrl: url.trim(), ollamaModel: model.trim() });
    setTesting(true);
    const r = await ping();
    setTesting(false);
    setTest(r.ok ? { ok: true, text: `Connected · ${r.ms} ms` } : { ok: false, text: r.reason });
  }

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Txt variant="display" style={{ fontSize: 22 }}>
          Settings
        </Txt>
      </View>

      <Group title="SECURITY">
        <Row label="Fingerprint and face unlock" hint={available ? undefined : 'No biometrics enrolled on this phone'}>
          <Switch
            value={prefs.biometricLock && available}
            disabled={!available}
            onValueChange={(v) => setPrefs({ biometricLock: v })}
            trackColor={{ true: C.volt, false: C.line2 }}
            thumbColor={C.ink}
          />
        </Row>
        <Row label="Auto-lock after" last>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[30, 60, 300].map((s) => (
              <Chip key={s} label={s < 60 ? `${s}s` : `${s / 60}m`} active={prefs.autoLockSeconds === s} onPress={() => setPrefs({ autoLockSeconds: s })} />
            ))}
          </View>
        </Row>
      </Group>

      <Group title="GINTI AI" tone="ai">
        <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#241F55' }]}>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontSize: 14 }}>Use Ginti AI</Txt>
            <Txt variant="small" style={{ fontSize: 11, color: '#A9A2E8', marginTop: 2 }}>
              {prefs.aiEnabled
                ? 'Reads typed expenses and receipts, and answers questions, using the model on your PC'
                : 'Off: entries are read on the phone, and chat and receipt reading are paused'}
            </Txt>
          </View>
          <Switch value={prefs.aiEnabled} onValueChange={(v) => setPrefs({ aiEnabled: v })} trackColor={{ true: C.ion, false: C.line2 }} thumbColor={C.text} />
        </View>
        <View style={{ padding: 14, gap: 10, opacity: prefs.aiEnabled ? 1 : 0.4 }} pointerEvents={prefs.aiEnabled ? 'auto' : 'none'}>
          <Txt style={{ fontSize: 13, color: C.ionText }}>Ollama address on your PC</Txt>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
          <Txt style={{ fontSize: 13, color: C.ionText }}>Model</Txt>
          <TextInput value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Button title="Test connection" variant="ai" onPress={testConnection} busy={testing} style={{ flex: 1, height: 46 }} />
          </View>
          {test && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pulse>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: test.ok ? C.good : C.warn }} />
              </Pulse>
              <Txt style={{ fontSize: 13, color: test.ok ? C.good : C.warn }}>{test.text}</Txt>
            </View>
          )}
          <Txt variant="small" style={{ color: '#8D88C4', lineHeight: 17 }}>
            Phone and PC must be on the same Wi-Fi, and Ollama must listen on the network (OLLAMA_HOST=0.0.0.0).
          </Txt>
        </View>
      </Group>

      <Group title="BUDGET">
        <Row label="Monthly budget (₹)" last>
          <TextInput
            value={budget}
            onChangeText={(t) => setBudget(t.replace(/\D/g, ''))}
            onEndEditing={() => setPrefs({ monthlyBudget: Number(budget) || 0 })}
            keyboardType="number-pad"
            style={[styles.input, { width: 120, height: 40, textAlign: 'right' }]}
          />
        </Row>
      </Group>

      <Group title="ACCOUNT">
        <Row label={session?.user.email ?? 'Signed out'}>
          <Icon name="sync" size={18} color={C.volt} />
        </Row>
        <Row label="Categories" onPress={() => router.push('/categories')}>
          <Icon name="chevron-right" size={18} color={C.muted} />
        </Row>
        <Row label="Auto-import from SMS and payment apps" onPress={() => router.push('/import')}>
          <Icon name="chevron-right" size={18} color={C.muted} />
        </Row>
        <Row label="Budgets by category" last onPress={() => router.push('/budgets')}>
          <Icon name="chevron-right" size={18} color={C.muted} />
        </Row>
      </Group>

      <Button title="Sign out" variant="danger" icon="logout" onPress={signOut} />
    </Screen>
  );
}

function Group({ title, children, tone }: { title: string; children: ReactNode; tone?: 'ai' }) {
  return (
    <View>
      <Txt variant="label" style={{ marginLeft: 4, marginBottom: 8 }}>
        {title}
      </Txt>
      <View style={[styles.group, tone === 'ai' && { backgroundColor: C.ionBg, borderColor: C.ionLine }]}>{children}</View>
    </View>
  );
}

function Row({ label, hint, children, last, onPress }: { label: string; hint?: string; children?: ReactNode; last?: boolean; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={[styles.row, !last && styles.rowDivider]}>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontSize: 14 }}>{label}</Txt>
        {hint && <Txt variant="small" style={{ fontSize: 11 }}>{hint}</Txt>}
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: 'hidden' },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#1A1D27' },
  input: { height: 46, borderRadius: 12, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.mono, fontSize: 13, paddingHorizontal: 12 },
});
