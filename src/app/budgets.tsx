import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { notify } from '@/components/dialog';
import { Icon } from '@/components/icon';
import { Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Card, IconButton, Screen } from '@/components/ui';
import { inr } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { expenses, monthRange, sum } from '@/lib/stats';
import { C, F } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 30;
const CIRC = 2 * Math.PI * R;
const SAVE_AFTER_MS = 700;

export default function Budgets() {
  const { txns, categories, setCategoryBudget } = useLedger();
  const { monthlyBudget } = usePrefs();
  const [monthly, setMonthly] = useState(String(monthlyBudget));
  const now = new Date();
  const range = monthRange(now.getFullYear(), now.getMonth());

  const spentByCat = new Map<string, number>();
  for (const t of expenses(txns, range)) if (t.category_id) spentByCat.set(t.category_id, (spentByCat.get(t.category_id) ?? 0) + t.amount);
  const spent = sum(expenses(txns, range));
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const safeToday = Math.max(0, (monthlyBudget - spent) / daysLeft);

  // The overall budget saves as you type, like the category limits.
  useEffect(() => {
    const value = Number(monthly);
    if (!(value >= 0) || value === monthlyBudget) return;
    const t = setTimeout(() => setPrefs({ monthlyBudget: value }), SAVE_AFTER_MS);
    return () => clearTimeout(t);
  }, [monthly, monthlyBudget]);

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Txt variant="display" style={{ fontSize: 22, flex: 1 }}>
          Budgets
        </Txt>
      </View>

      <Card>
        <Txt variant="label">SAFE TO SPEND TODAY</Txt>
        <Txt variant="hero" color={C.volt} style={{ marginTop: 8, fontSize: 38 }}>
          {inr(safeToday)}
        </Txt>
        <Txt variant="small" style={{ marginTop: 4, fontSize: 13, color: C.text2 }}>
          {inr(Math.max(0, monthlyBudget - spent))} left ÷ {daysLeft} days
        </Txt>
        <View style={styles.monthlyRow}>
          <Txt style={{ flex: 1, fontSize: 14 }}>Monthly budget</Txt>
          <Txt style={{ color: C.muted }}>₹</Txt>
          <TextInput
            accessibilityLabel="Monthly budget"
            value={monthly}
            onChangeText={(t) => setMonthly(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            returnKeyType="done"
            style={styles.monthlyInput}
          />
        </View>
      </Card>

      <Txt variant="small" style={{ fontSize: 13 }}>
        Set a monthly limit per category. It saves as you type; leave it empty for no limit.
      </Txt>

      <View style={styles.grid}>
        {categories
          .filter((c) => c.kind === 'expense')
          .map((c, i) => (
            <Rise key={c.id} delay={i * 50} style={styles.gridItem}>
              <BudgetCell name={c.name} color={c.color} spent={spentByCat.get(c.id) ?? 0} budget={c.monthly_budget} onSave={(b) => setCategoryBudget(c.id, b)} />
            </Rise>
          ))}
      </View>

      <Button title="Add or edit categories" variant="ghost" icon="plus" onPress={() => router.push('/categories')} />
    </Screen>
  );
}

function BudgetCell({ name, color, spent, budget, onSave }: { name: string; color: string; spent: number; budget: number | null; onSave: (b: number | null) => Promise<void> }) {
  const [text, setText] = useState(budget ? String(budget) : '');
  const [saved, setSaved] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const ratio = budget ? spent / budget : 0;
  const over = budget != null && spent > budget;
  const stroke = over ? C.warn : color;

  useEffect(() => {
    const next = text ? Number(text) : null;
    if (next === budget) return;
    const t = setTimeout(() => {
      onSave(next)
        .then(() => {
          setSaved(true);
          Haptics.selectionAsync().catch(() => {});
          setTimeout(() => setSaved(false), 1500);
        })
        .catch((e) => notify('Could not save limit', e instanceof Error ? e.message : String(e)));
    }, SAVE_AFTER_MS);
    return () => clearTimeout(t);
    // onSave is recreated each render by the parent; the text and stored budget decide whether to save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, budget]);

  return (
    <Pressable onPress={() => input.current?.focus()} style={[styles.cell, over && { borderColor: '#5A3418' }]}>
      <View style={{ width: 72, height: 72 }}>
        <Svg width={72} height={72}>
          <Circle cx={36} cy={36} r={R} fill="none" stroke={C.line} strokeWidth={6} />
          {budget ? (
            <AnimatedCircle
              key={budget}
              cx={36}
              cy={36}
              r={R}
              fill="none"
              stroke={stroke}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={[Math.min(1, ratio) * CIRC, CIRC * 2]}
              rotation={-90}
              origin="36, 36"
              animatedProps={{
                animationName: { from: { strokeDashoffset: CIRC }, to: { strokeDashoffset: 0 } },
                animationDuration: 1100,
                animationFillMode: 'both',
                animationTimingFunction: 'ease-out',
              }}
            />
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          {saved ? (
            <Icon name="check" size={20} color={C.volt} strokeWidth={2.4} />
          ) : (
            <Txt style={{ fontFamily: F.semibold, fontSize: 13, color: over ? C.warn : budget ? C.text : C.muted }}>{budget ? `${Math.round(ratio * 100)}%` : '—'}</Txt>
          )}
        </View>
      </View>
      <Txt variant="medium" style={{ fontSize: 13 }} numberOfLines={1}>
        {name}
      </Txt>
      <Txt variant="mono" style={{ fontSize: 10, color: over ? C.warn : C.muted }}>
        {inr(spent)}
        {budget ? ` / ${inr(budget)}` : ''}
      </Txt>
      <TextInput
        ref={input}
        accessibilityLabel={`${name} monthly limit`}
        value={text}
        onChangeText={(t) => setText(t.replace(/\D/g, ''))}
        placeholder="Set limit"
        placeholderTextColor={C.muted}
        keyboardType="number-pad"
        returnKeyType="done"
        style={[styles.limit, text ? { borderColor: color } : null]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthlyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  monthlyInput: { minWidth: 110, height: 40, borderRadius: 10, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.semibold, fontSize: 15, textAlign: 'right', paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 10 },
  gridItem: { width: '31%' },
  cell: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  limit: {
    marginTop: 4,
    width: '92%',
    height: 34,
    borderRadius: 10,
    backgroundColor: C.ink2,
    borderWidth: 1,
    borderColor: C.line2,
    color: C.text,
    fontFamily: F.mono,
    fontSize: 12,
    textAlign: 'center',
    padding: 0,
  },
});
