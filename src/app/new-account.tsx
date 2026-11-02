import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirm, notify } from '@/components/dialog';
import { Txt } from '@/components/txt';
import { Button, IconButton, Segmented, tap } from '@/components/ui';
import { useLedger } from '@/lib/ledger';
import type { AccountKind } from '@/lib/types';
import { C, F } from '@/theme/tokens';

const COLORS = [C.volt, '#4CC9FF', C.ion, '#FF8A4C', '#FF5FA2', '#3DDC97'];

export default function NewAccount() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accounts, addAccount, updateAccount } = useLedger();
  // Opened with an id, this screen edits that account.
  const editing = id ? accounts.find((a) => a.id === id) : undefined;
  const [kind, setKind] = useState<AccountKind>(editing?.kind ?? 'bank');
  const [name, setName] = useState(editing?.name ?? '');
  const [last4, setLast4] = useState(editing?.last4 ?? '');
  const [opening, setOpening] = useState(editing ? String(Math.abs(editing.opening_balance)) : '');
  const [color, setColor] = useState(editing?.color ?? COLORS[1]);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && (last4 === '' || last4.length === 4);

  async function save() {
    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        kind,
        last4: last4 || null,
        color,
        opening_balance: Number(opening.replace(/,/g, '')) * (kind === 'credit' ? -1 : 1) || 0,
      };
      if (editing) await updateAccount(editing.id, fields);
      else await addAccount(fields);
      router.back();
    } catch (e) {
      notify(editing ? 'Could not save account' : 'Could not add account', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function archive() {
    if (!editing) return;
    const ok = await confirm({
      title: `Hide ${editing.name}?`,
      message: 'It disappears from lists and pickers. Its past entries stay in your ledger and reports.',
      confirm: 'Hide account',
      destructive: true,
    });
    if (!ok) return;
    await updateAccount(editing.id, { archived: true }).catch((e) => notify('Could not hide account', e instanceof Error ? e.message : String(e)));
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ink }}>
      <View style={styles.header}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Txt variant="title">{editing ? 'Edit account' : 'New account'}</Txt>
        {editing ? <IconButton icon="trash" label="Hide account" color={C.danger} onPress={archive} /> : <View style={{ width: 44 }} />}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'bank', label: 'Bank' },
            { value: 'credit', label: 'Credit card' },
            { value: 'cash', label: 'Cash' },
            { value: 'wallet', label: 'Wallet' },
          ]}
        />
        <Field label="Name">
          <TextInput value={name} onChangeText={setName} placeholder={kind === 'cash' ? 'Cash wallet' : 'HDFC Bank'} placeholderTextColor={C.muted} style={styles.input} />
        </Field>
        {kind !== 'cash' && (
          <Field label="Last 4 digits (optional)">
            <TextInput
              value={last4}
              onChangeText={(t) => setLast4(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="4821"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              style={[styles.input, { fontFamily: F.mono, letterSpacing: 4 }]}
            />
          </Field>
        )}
        <Field label={editing ? 'Starting balance (before any Ginti entries)' : kind === 'credit' ? 'Amount currently owed' : 'Current balance'}>
          <TextInput
            value={opening}
            onChangeText={(t) => setOpening(t.replace(/[^\d.]/g, ''))}
            placeholder="0"
            placeholderTextColor={C.muted}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </Field>
        <Field label="Colour">
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ checked: c === color }}
                accessibilityLabel={`Colour ${c}`}
                onPress={() => {
                  tap();
                  setColor(c);
                }}
                style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
              />
            ))}
          </View>
        </Field>
      </ScrollView>
      <View style={{ padding: 20 }}>
        <Button title={editing ? 'Save changes' : 'Add account'} icon="check" onPress={save} busy={saving} disabled={!canSave} />
      </View>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  content: { padding: 20, gap: 20 },
  input: { height: 54, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.body, fontSize: 16, paddingHorizontal: 16 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchOn: { borderWidth: 3, borderColor: C.ink, outlineWidth: 2, outlineColor: C.text, outlineStyle: 'solid' },
});
