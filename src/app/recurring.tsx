import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Float, Pulse, Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Card, Chip, Empty, IconButton, Screen, tap } from '@/components/ui';
import { inr, monthName } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { dueDate, isPaid, paymentRef, suggestRecurring } from '@/lib/recurring';
import type { Recurring } from '@/lib/types';
import { C, F } from '@/theme/tokens';

const ping = css.keyframes({ from: { opacity: 0.8, transform: [{ scale: 1 }] }, to: { opacity: 0, transform: [{ scale: 2.6 }] } });

export default function Bills() {
  const { recurring, txns, accounts, categories, addRecurring, deleteRecurring, importTxns } = useLedger();
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const items = recurring
    .filter((r) => r.active)
    .map((r) => ({ r, due: dueDate(r, y, m), paid: isPaid(r, txns, y, m) }))
    .sort((a, b) => Number(a.paid) - Number(b.paid) || a.due.getTime() - b.due.getTime());
  const dueTotal = items.filter((i) => !i.paid).reduce((s, i) => s + i.r.amount, 0);
  const suggestions = suggestRecurring(txns, recurring, now);

  async function markPaid(r: Recurring) {
    const account = r.account_id ?? accounts.find((a) => a.kind === 'cash')?.id;
    if (!account) return Alert.alert('Pick an account', 'Add an account first so Ginti knows where this was paid from.');
    await importTxns([
      {
        kind: 'expense',
        amount: r.amount,
        account_id: account,
        to_account_id: null,
        category_id: r.category_id,
        note: r.name,
        occurred_at: new Date().toISOString(),
        source: 'recurring',
        external_ref: paymentRef(r, y, m),
      },
    ]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function actions(r: Recurring, paid: boolean) {
    tap();
    Alert.alert(r.name, `${inr(r.amount)} every month on day ${r.day_of_month}`, [
      ...(paid ? [] : [{ text: 'Mark paid', onPress: () => markPaid(r) }]),
      { text: 'Stop tracking', style: 'destructive' as const, onPress: () => deleteRecurring(r.id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Txt variant="display" style={{ fontSize: 22 }}>
            Bills and subscriptions
          </Txt>
          <Txt variant="small">
            {inr(dueTotal)} still due in {monthName(m)} · {items.length} tracked
          </Txt>
        </View>
        <IconButton icon="plus" label="Add bill" color={C.ink} style={{ backgroundColor: C.volt, borderColor: C.volt }} onPress={() => setAdding(true)} />
      </View>

      <Card style={{ paddingVertical: 20 }}>
        <View style={{ height: 50 }}>
          <View style={styles.track} />
          <View style={[styles.trackDone, { width: `${(now.getDate() / daysInMonth) * 100}%` }]} />
          {items.map(({ r, paid }) => (
            <View
              key={r.id}
              style={[styles.marker, { left: `${(dueDate(r, y, m).getDate() / daysInMonth) * 100}%`, backgroundColor: paid ? C.line2 : (categories.find((c) => c.id === r.category_id)?.color ?? C.ion) }]}
            />
          ))}
          <View style={[styles.today, { left: `${(now.getDate() / daysInMonth) * 100}%` }]}>
            <Animated.View style={[styles.todayDot, { position: 'absolute', animationName: ping, animationDuration: 1800, animationIterationCount: 'infinite' }]} />
            <View style={styles.todayDot} />
          </View>
          <Float duration={2000} style={[styles.todayLabel, { left: `${(now.getDate() / daysInMonth) * 100}%` }]}>
            <Txt variant="mono" color={C.volt} style={{ fontSize: 10 }}>
              TODAY
            </Txt>
          </Float>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Txt variant="mono" style={{ fontSize: 10 }}>
            1 {monthName(m).toUpperCase()}
          </Txt>
          <Txt variant="mono" style={{ fontSize: 10 }}>
            {daysInMonth} {monthName(m).toUpperCase()}
          </Txt>
        </View>
      </Card>

      {suggestions.map((s) => (
        <Rise key={s.name}>
          <Card tone="ai" style={styles.suggest}>
            <Pulse>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.ion }} />
            </Pulse>
            <Txt style={{ flex: 1, fontSize: 13, lineHeight: 19, color: C.ionTextSoft }}>
              {s.name} for {inr(s.amount)} repeats every month. Track it?
            </Txt>
            <Pressable onPress={() => addRecurring(s)} style={styles.trackBtn}>
              <Txt style={{ fontFamily: F.semibold, fontSize: 13, color: C.ink }}>Track</Txt>
            </Pressable>
          </Card>
        </Rise>
      ))}

      {items.length === 0 && !adding ? (
        <Empty icon="repeat" title="No bills tracked yet" body="Add rent, Wi-Fi, EMIs and subscriptions to see what is due before it hits.">
          <Button title="Add a bill" icon="plus" onPress={() => setAdding(true)} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </Empty>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map(({ r, due, paid }, i) => {
            const days = Math.ceil((due.getTime() - new Date(y, m, now.getDate()).getTime()) / 86400000);
            const acc = accounts.find((a) => a.id === r.account_id);
            const cat = categories.find((c) => c.id === r.category_id);
            return (
              <Rise key={r.id} delay={i * 60}>
                <Pressable onPress={() => actions(r, paid)} style={[styles.row, paid && { opacity: 0.6, borderStyle: 'dashed' }]}>
                  <View style={[styles.badge, { backgroundColor: (cat?.color ?? C.ion) + '22' }]}>
                    {paid ? <Icon name="check" size={18} color={C.volt} strokeWidth={2.4} /> : <Txt style={{ fontFamily: F.displayBold, fontSize: 15, color: cat?.color ?? C.ion }}>{r.name[0]?.toUpperCase()}</Txt>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="medium">{r.name}</Txt>
                    <Txt variant="mono" style={{ marginTop: 2, color: paid ? C.muted : days <= 3 ? C.warn : C.muted }}>
                      {paid ? 'PAID THIS MONTH' : days < 0 ? `${-days} DAYS OVERDUE` : days === 0 ? 'DUE TODAY' : `IN ${days} DAYS`}
                      {acc ? ` · ${acc.name.toUpperCase()}` : ''}
                    </Txt>
                  </View>
                  <Txt variant="strong">{inr(r.amount)}</Txt>
                </Pressable>
              </Rise>
            );
          })}
        </View>
      )}

      {adding && <AddBill onClose={() => setAdding(false)} />}
    </Screen>
  );
}

function AddBill({ onClose }: { onClose: () => void }) {
  const { accounts, categories, addRecurring } = useLedger();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(String(new Date().getDate()));
  const [accountId, setAccountId] = useState<string | null>(accounts.find((a) => a.kind !== 'cash')?.id ?? accounts[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(categories.find((c) => c.name === 'Bills')?.id ?? null);
  const [saving, setSaving] = useState(false);
  const d = Number(day);
  const ok = name.trim() && Number(amount) > 0 && d >= 1 && d <= 31;

  async function save() {
    setSaving(true);
    try {
      await addRecurring({ name: name.trim(), amount: Number(amount), day_of_month: d, account_id: accountId, category_id: categoryId });
      onClose();
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Rise>
      <Card style={{ gap: 12, borderColor: C.volt }}>
        <Txt variant="title">New bill</Txt>
        <TextInput value={name} onChangeText={setName} placeholder="Netflix, rent, Wi-Fi…" placeholderTextColor={C.muted} style={styles.input} accessibilityLabel="Bill name" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
            placeholder="₹ Amount"
            placeholderTextColor={C.muted}
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel="Amount"
          />
          <TextInput
            value={day}
            onChangeText={(t) => setDay(t.replace(/\D/g, '').slice(0, 2))}
            placeholder="Day"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            style={[styles.input, { width: 96, textAlign: 'center' }]}
            accessibilityLabel="Day of month it is due"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {categories
            .filter((c) => c.kind === 'expense')
            .map((c) => (
              <Chip key={c.id} label={c.name} dot={c.color} active={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
            ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <Chip key={a.id} label={a.name} active={a.id === accountId} onPress={() => setAccountId(a.id)} />
            ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Track bill" icon="check" onPress={save} busy={saving} disabled={!ok} style={{ flex: 1.4 }} />
        </View>
      </Card>
    </Rise>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, top: 24, height: 2, backgroundColor: C.line },
  trackDone: { position: 'absolute', left: 0, top: 24, height: 2, backgroundColor: C.volt },
  marker: { position: 'absolute', top: 19, width: 12, height: 12, marginLeft: -6, borderRadius: 4 },
  today: { position: 'absolute', top: 20, marginLeft: -5, width: 10, height: 10 },
  todayDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.volt },
  todayLabel: { position: 'absolute', top: 0, marginLeft: -16 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 },
  trackBtn: { height: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.ion, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  input: { height: 52, borderRadius: 14, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.body, fontSize: 15, paddingHorizontal: 14 },
});
