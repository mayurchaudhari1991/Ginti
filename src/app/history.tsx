import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { KF } from '@/components/motion';
import { TxnRow } from '@/components/txn-row';
import { Txt } from '@/components/txt';
import { Card, Empty, IconButton, Screen, tap } from '@/components/ui';
import { inr, monthName } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { byDay } from '@/lib/stats';
import { C, F } from '@/theme/tokens';

const LEVELS = ['#15181F', '#2F3D14', '#50681C', '#86AE2C', C.volt];
const LEVEL_TEXT = [C.muted, '#D6EBA8', '#EAF7C8', C.ink, C.ink];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const selectedPulse = css.keyframes({
  '0%': { borderColor: 'rgba(242,244,248,1)' },
  '50%': { borderColor: 'rgba(242,244,248,0.25)' },
  '100%': { borderColor: 'rgba(242,244,248,1)' },
});

export default function History() {
  const { txns, categories, accounts } = useLedger();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<number | null>(now.getDate());
  const [query, setQuery] = useState('');

  const days = byDay(txns, cursor.y, cursor.m);
  const total = days.reduce((s, v) => s + v, 0);
  const max = Math.max(...days, 1);
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  // Calendar rows start on Monday.
  const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const weekend = days.reduce((s, v, i) => ([0, 6].includes(new Date(cursor.y, cursor.m, i + 1).getDay()) ? s + v : s), 0);

  const shift = (delta: number) => {
    tap();
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(null);
  };

  const q = query.trim().toLowerCase();
  const results = q
    ? txns.filter((t) => {
        const cat = categories.find((c) => c.id === t.category_id)?.name ?? '';
        const acc = accounts.find((a) => a.id === t.account_id)?.name ?? '';
        const over = q.match(/(?:over|above|>)\s*(\d+)/);
        const words = q.replace(/(?:over|above|>)\s*\d+/, '').trim();
        const text = `${t.note ?? ''} ${cat} ${acc} ${t.amount}`.toLowerCase();
        return (!words || words.split(/\s+/).every((w) => text.includes(w))) && (!over || t.amount > Number(over[1]));
      })
    : [];

  const dayEntries =
    selected != null
      ? txns.filter((t) => {
          const d = new Date(t.occurred_at);
          return d.getFullYear() === cursor.y && d.getMonth() === cursor.m && d.getDate() === selected;
        })
      : [];

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={styles.search}>
          <Icon name="scan" size={16} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder='Search "swiggy over 500"'
            placeholderTextColor={C.muted}
            style={styles.searchInput}
            accessibilityLabel="Search entries"
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <Icon name="close" size={16} color={C.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {q ? (
        <View>
          <Txt variant="title" style={{ fontSize: 15, marginBottom: 4 }}>
            {results.length} match{results.length === 1 ? '' : 'es'} · {inr(results.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0))}
          </Txt>
          {results.length === 0 ? <Empty icon="scan" title="No matches" body="Try a payee, category, account or 'over 500'." /> : results.slice(0, 60).map((t) => <TxnRow key={t.id} txn={t} />)}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton icon="back" label="Previous month" onPress={() => shift(-1)} style={{ backgroundColor: 'transparent', borderColor: 'transparent' }} />
            <View style={{ alignItems: 'center' }}>
              <Txt variant="display" style={{ fontSize: 20 }}>
                {monthName(cursor.m)} {cursor.y}
              </Txt>
              <Txt variant="small" style={{ marginTop: 4 }}>
                {inr(total)}
                {total > 0 && weekend / total > 0.4 ? ' · weekends run hot' : ''}
              </Txt>
            </View>
            <IconButton
              icon="arrow"
              label="Next month"
              onPress={() => shift(1)}
              style={{ backgroundColor: 'transparent', borderColor: 'transparent', opacity: cursor.y === now.getFullYear() && cursor.m === now.getMonth() ? 0.3 : 1 }}
            />
          </View>

          <View style={styles.grid}>
            {WEEKDAYS.map((w, i) => (
              <Txt key={`h${i}`} variant="mono" style={styles.weekday}>
                {w}
              </Txt>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <View key={`e${i}`} style={styles.cell} />
            ))}
            {days.map((v, i) => {
              const lv = level(v);
              const isSel = selected === i + 1;
              return (
                <Animated.View
                  key={`${cursor.y}-${cursor.m}-${i}`}
                  style={[
                    styles.cellWrap,
                    { animationName: KF.rise, animationDuration: 400, animationDelay: Math.floor((i + lead) / 7) * 70, animationFillMode: 'both' },
                  ]}>
                  <Pressable
                    accessibilityLabel={`${i + 1} ${monthName(cursor.m)}, ${inr(v)}`}
                    onPress={() => {
                      tap();
                      setSelected(i + 1);
                    }}
                    style={{ flex: 1 }}>
                    <Animated.View
                      style={[
                        styles.cellInner,
                        { backgroundColor: LEVELS[lv] },
                        isSel && { borderWidth: 2, animationName: selectedPulse, animationDuration: 1800, animationIterationCount: 'infinite' },
                      ]}>
                      <Txt style={{ fontFamily: F.mono, fontSize: 12, color: LEVEL_TEXT[lv] }}>{i + 1}</Txt>
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <Txt variant="small" style={{ fontSize: 11 }}>
              Less
            </Txt>
            {LEVELS.map((c) => (
              <View key={c} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
            ))}
            <Txt variant="small" style={{ fontSize: 11 }}>
              More
            </Txt>
          </View>

          {selected != null && (
            <Card style={{ paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Txt variant="title" style={{ fontSize: 15 }}>
                  {new Date(cursor.y, cursor.m, selected).toDateString().slice(0, 10)}
                </Txt>
                <Txt style={{ fontFamily: F.display, fontSize: 16 }}>{inr(days[selected - 1] ?? 0)}</Txt>
              </View>
              {dayEntries.length === 0 ? (
                <Txt variant="small" style={{ marginTop: 8 }}>
                  Nothing logged this day.
                </Txt>
              ) : (
                dayEntries.map((t) => <TxnRow key={t.id} txn={t} />)
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flex: 1, height: 46, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line2, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: C.text, fontFamily: F.body, fontSize: 14, padding: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekday: { width: '12.4%', textAlign: 'center', fontSize: 10 },
  cellWrap: { width: '12.4%', height: 42 },
  cell: { width: '12.4%', height: 42 },
  cellInner: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderColor: 'transparent' },
});
