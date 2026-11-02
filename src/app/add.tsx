import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { KF, Pulse, Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, CategoryBadge, IconButton, Segmented, tap } from '@/components/ui';
import { inr } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { parseLocally, parseWithModel, type ParsedEntry } from '@/lib/ollama';
import type { TxnKind } from '@/lib/types';
import { C, F } from '@/theme/tokens';

export default function AddEntry() {
  const { categories, accounts, addTxn } = useLedger();
  const liveAccounts = accounts.filter((a) => !a.archived);

  const [kind, setKind] = useState<TxnKind>('expense');
  const [sentence, setSentence] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedEntry | null>(null);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(liveAccounts.find((a) => a.kind === 'cash')?.id ?? liveAccounts[0]?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  const [saving, setSaving] = useState(false);
  const parseSeq = useRef(0);

  const kindCats = useMemo(() => categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense')), [categories, kind]);

  // Re-parse the sentence shortly after the user stops typing.
  useEffect(() => {
    const text = sentence.trim();
    if (text.length < 3 || !/\d/.test(text)) return;
    const seq = ++parseSeq.current;
    const apply = (result: ParsedEntry) => {
      setParsed(result);
      if (result.amount > 0) setAmount(String(result.amount));
      setKind(result.kind);
      if (result.categoryId) setCategoryId(result.categoryId);
      if (result.accountId) setAccountId(result.accountId);
      setNote(result.note);
      const d = Math.round((Date.now() - new Date(result.occurredAt).getTime()) / 86400000);
      setDaysAgo(Math.max(0, d));
    };
    const t = setTimeout(async () => {
      // Fill the form instantly from the on-phone parser, then refine when the model answers (~15 s).
      apply(parseLocally(text, categories, liveAccounts));
      setParsing(true);
      try {
        const result = await parseWithModel(text, categories, liveAccounts);
        if (seq !== parseSeq.current) return;
        apply(result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {
        // PC unreachable or reply unusable: the on-phone result stands.
      } finally {
        if (seq === parseSeq.current) setParsing(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // Categories and accounts are stable while this screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence]);

  const value = Number(amount.replace(/,/g, ''));
  const canSave = value > 0 && !!accountId && (kind !== 'transfer' || (!!toAccountId && toAccountId !== accountId));

  async function save() {
    if (!canSave || !accountId) return;
    setSaving(true);
    try {
      const when = new Date();
      when.setDate(when.getDate() - daysAgo);
      await addTxn({
        kind,
        amount: value,
        account_id: accountId,
        to_account_id: kind === 'transfer' ? toAccountId : null,
        category_id: kind === 'transfer' ? null : categoryId,
        note: note.trim() || null,
        occurred_at: when.toISOString(),
        source: parsed?.by === 'ai' ? 'ai' : 'manual',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const chosenCat = categories.find((c) => c.id === categoryId);
  const chosenAcc = accounts.find((a) => a.id === accountId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ink }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <IconButton icon="close" label="Close" onPress={() => router.back()} />
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
              { value: 'transfer', label: 'Transfer' },
            ]}
          />
          <IconButton icon="scan" label="Scan receipt" onPress={() => router.replace('/scan')} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {kind !== 'transfer' && (
            <Rise>
              <View style={styles.aiBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pulse duration={1400}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.ion }} />
                  </Pulse>
                  <Txt variant="label" color={C.ionText}>
                    {parsing ? 'GINTI AI IS READING…' : "TYPE IT THE WAY YOU'D SAY IT"}
                  </Txt>
                </View>
                <TextInput
                  accessibilityLabel="Describe the expense"
                  value={sentence}
                  onChangeText={setSentence}
                  placeholder="450 swiggy dinner on hdfc card"
                  placeholderTextColor="#6C6799"
                  style={styles.aiInput}
                  autoFocus
                />
                {parsed && !parsing && (
                  <View style={styles.parsedRow}>
                    {[
                      parsed.amount > 0 ? inr(parsed.amount) : null,
                      chosenCat?.name,
                      chosenAcc?.name,
                      daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`,
                    ]
                      .filter(Boolean)
                      .map((label, i) => (
                        <Animated.View
                          key={`${label}-${i}`}
                          style={[styles.parsedChip, { animationName: KF.rise, animationDuration: 450, animationDelay: i * 110, animationFillMode: 'both' }]}>
                          <Txt style={{ fontSize: 12, color: C.ionTextSoft }}>{label}</Txt>
                        </Animated.View>
                      ))}
                    <Txt variant="mono" style={{ alignSelf: 'center', color: '#8D88C4' }}>
                      {parsed.by === 'ai' ? 'via Ollama' : 'parsed on phone'}
                    </Txt>
                  </View>
                )}
              </View>
            </Rise>
          )}

          <View style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Txt variant="label">AMOUNT</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Txt style={styles.rupee}>₹</Txt>
              <TextInput
                accessibilityLabel="Amount"
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.line2}
                style={styles.amount}
              />
              <Animated.View style={[styles.caret, { animationName: KF.blink, animationDuration: 1000, animationIterationCount: 'infinite', animationTimingFunction: 'step-end' }]} />
            </View>
          </View>

          {kind === 'transfer' ? (
            <>
              <AccountPicker title="From" value={accountId} onChange={setAccountId} />
              <AccountPicker title="To" value={toAccountId} onChange={setToAccountId} exclude={accountId} />
            </>
          ) : (
            <>
              <View>
                <Txt variant="small" style={styles.sectionLabel}>
                  Category
                </Txt>
                <View style={styles.grid}>
                  {kindCats.map((c) => {
                    const on = c.id === categoryId;
                    return (
                      <Pressable
                        key={c.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          tap();
                          setCategoryId(c.id);
                        }}
                        style={[styles.catCell, on && { borderColor: c.color, backgroundColor: c.color + '1F', borderWidth: 1.5 }]}>
                        <CategoryBadge color={c.color} icon={c.icon} size={30} />
                        <Txt style={{ fontSize: 12, color: on ? C.text : C.text2 }} numberOfLines={1}>
                          {c.name}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <AccountPicker title={kind === 'income' ? 'Received in' : 'Paid from'} value={accountId} onChange={setAccountId} />
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['Today', 'Yesterday'].map((label, i) => (
              <Pressable
                key={label}
                onPress={() => {
                  tap();
                  setDaysAgo(i);
                }}
                style={[styles.dayChip, daysAgo === i && styles.dayChipOn]}>
                <Icon name="calendar" size={14} color={daysAgo === i ? C.ink : C.text2} />
                <Txt style={{ fontSize: 13, color: daysAgo === i ? C.ink : C.text2, fontFamily: daysAgo === i ? F.semibold : F.body }}>{label}</Txt>
              </Pressable>
            ))}
            <TextInput
              accessibilityLabel="Note"
              value={note}
              onChangeText={setNote}
              placeholder="Note"
              placeholderTextColor={C.muted}
              style={styles.note}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title={kind === 'income' ? 'Save income' : kind === 'transfer' ? 'Save transfer' : 'Save expense'} icon="check" onPress={save} busy={saving} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountPicker({ title, value, onChange, exclude }: { title: string; value: string | null; onChange: (id: string) => void; exclude?: string | null }) {
  const { accounts } = useLedger();
  return (
    <View>
      <Txt variant="small" style={styles.sectionLabel}>
        {title}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {accounts
          .filter((a) => !a.archived && a.id !== exclude)
          .map((a) => {
            const on = a.id === value;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tap();
                  onChange(a.id);
                }}
                style={[styles.accChip, on && { borderColor: C.volt, backgroundColor: C.voltBg, borderWidth: 1.5 }]}>
                <Icon name={a.kind === 'cash' ? 'cash' : a.kind === 'bank' ? 'bank' : 'card'} size={16} color={on ? C.volt : C.text2} />
                <Txt style={{ fontSize: 13, color: on ? C.text : C.text2, fontFamily: on ? F.semibold : F.body }}>
                  {a.name}
                  {a.last4 ? ` ••${a.last4}` : ''}
                </Txt>
              </Pressable>
            );
          })}
        <Pressable accessibilityRole="button" onPress={() => router.push('/new-account')} style={[styles.accChip, { borderStyle: 'dashed' }]}>
          <Icon name="plus" size={16} color={C.volt} />
          <Txt style={{ fontSize: 13, color: C.text2 }}>Add</Txt>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  aiBox: { backgroundColor: C.ionBg, borderWidth: 1, borderColor: C.ionLine, borderRadius: 20, padding: 16 },
  aiInput: { marginTop: 10, color: C.text, fontFamily: F.body, fontSize: 17, padding: 0 },
  parsedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  parsedChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#1F1A4D' },
  rupee: { fontFamily: F.display, fontSize: 40, color: C.muted, marginRight: 4 },
  amount: { fontFamily: F.display, fontSize: 52, color: C.text, letterSpacing: -2, minWidth: 40, padding: 0 },
  caret: { width: 3, height: 44, backgroundColor: C.volt, marginLeft: 2 },
  sectionLabel: { marginBottom: 10, fontSize: 13, color: C.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCell: {
    width: '22.5%',
    height: 76,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  accChip: { height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayChip: { height: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayChipOn: { backgroundColor: C.text, borderColor: C.text },
  note: { flex: 1, height: 44, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, color: C.text, fontFamily: F.body, paddingHorizontal: 12 },
  footer: { padding: 20, paddingTop: 8 },
});
