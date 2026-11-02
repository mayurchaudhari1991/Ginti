import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Card, IconButton, Screen } from '@/components/ui';
import { inr } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { usePrefs } from '@/lib/prefs';
import { expenses, monthRange, sum } from '@/lib/stats';
import { C, F } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 30;
const CIRC = 2 * Math.PI * R;

export default function Budgets() {
  const { txns, categories, setCategoryBudget } = useLedger();
  const { monthlyBudget } = usePrefs();
  const now = new Date();
  const range = monthRange(now.getFullYear(), now.getMonth());

  const spentByCat = useMemo(() => {
    const out = new Map<string, number>();
    for (const t of expenses(txns, range)) if (t.category_id) out.set(t.category_id, (out.get(t.category_id) ?? 0) + t.amount);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns]);

  const spent = sum(expenses(txns, range));
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const safeToday = Math.max(0, (monthlyBudget - spent) / daysLeft);

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Txt variant="display" style={{ fontSize: 22 }}>
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
      </Card>

      <Txt variant="small" style={{ fontSize: 13 }}>
        Tap a limit to change it. Leave it empty for no limit.
      </Txt>

      <View style={styles.grid}>
        {categories
          .filter((c) => c.kind === 'expense')
          .map((c, i) => (
            <Rise key={c.id} delay={i * 60} style={{ width: '31%' }}>
              <BudgetCell
                name={c.name}
                color={c.color}
                spent={spentByCat.get(c.id) ?? 0}
                budget={c.monthly_budget}
                onChange={(b) => setCategoryBudget(c.id, b)}
              />
            </Rise>
          ))}
      </View>
    </Screen>
  );
}

function BudgetCell({ name, color, spent, budget, onChange }: { name: string; color: string; spent: number; budget: number | null; onChange: (b: number | null) => void }) {
  const [text, setText] = useState(budget ? String(budget) : '');
  const ratio = budget ? spent / budget : 0;
  const over = budget != null && spent > budget;
  const stroke = over ? C.warn : color;
  return (
    <View style={[styles.cell, over && { borderColor: '#5A3418' }]}>
      <View style={{ width: 72, height: 72 }}>
        <Svg width={72} height={72}>
          <Circle cx={36} cy={36} r={R} fill="none" stroke={C.line} strokeWidth={6} />
          {budget ? (
            <AnimatedCircle
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
                animationName: { from: { strokeDashoffset: CIRC } , to: { strokeDashoffset: 0 } },
                animationDuration: 1100,
                animationFillMode: 'both',
                animationTimingFunction: 'ease-out',
              }}
            />
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Txt style={{ fontFamily: F.semibold, fontSize: 13, color: over ? C.warn : C.text }}>{budget ? `${Math.round(ratio * 100)}%` : '—'}</Txt>
        </View>
      </View>
      <Txt variant="medium" style={{ fontSize: 13 }}>
        {name}
      </Txt>
      <Txt variant="mono" style={{ fontSize: 10, color: over ? C.warn : C.muted }}>
        {inr(spent)}
      </Txt>
      <TextInput
        accessibilityLabel={`${name} monthly limit`}
        value={text}
        onChangeText={(t) => setText(t.replace(/\D/g, ''))}
        onEndEditing={() => onChange(text ? Number(text) : null)}
        placeholder="No limit"
        placeholderTextColor={C.muted}
        keyboardType="number-pad"
        style={styles.limit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  cell: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  limit: { marginTop: 4, width: '92%', height: 34, borderRadius: 10, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.mono, fontSize: 12, textAlign: 'center', padding: 0 },
});
