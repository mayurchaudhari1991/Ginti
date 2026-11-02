import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { Float, Rise, Spin } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Empty, IconButton, Screen, tap } from '@/components/ui';
import { inr, monthName } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { expenses, monthRange } from '@/lib/stats';
import type { Account } from '@/lib/types';
import { C } from '@/theme/tokens';

const KIND_LABEL: Record<Account['kind'], string> = { bank: 'SAVINGS', cash: 'CASH', credit: 'CREDIT', wallet: 'WALLET' };
const STACK_TINTS = [
  { bg: '#1A1640', line: '#2F2A66' },
  { bg: '#14202A', line: '#1F3A4A' },
];

export default function Accounts() {
  const { accounts, txns } = useLedger();
  const live = accounts.filter((a) => !a.archived);
  const now = new Date();

  const monthStats = useMemo(() => {
    const out = new Map<string, { spent: number; count: number }>();
    for (const t of expenses(txns, monthRange(now.getFullYear(), now.getMonth()))) {
      const s = out.get(t.account_id) ?? { spent: 0, count: 0 };
      s.spent += t.amount;
      s.count += 1;
      out.set(t.account_id, s);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns]);

  const net = live.reduce((s, a) => s + a.balance, 0);
  const hero = [...live].sort((a, b) => b.balance - a.balance)[0];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Txt variant="label">NET BALANCE</Txt>
          <Txt variant="hero" style={{ marginTop: 6, fontSize: 28 }}>
            {inr(net)}
          </Txt>
        </View>
        <IconButton icon="plus" label="Add account" color={C.ink} style={{ backgroundColor: C.volt, borderColor: C.volt, width: 48, height: 48 }} onPress={() => router.push('/new-account')} />
      </View>

      {hero && (
        <View style={{ height: 236 }}>
          {STACK_TINTS.map((t, i) => (
            <Float key={i} duration={5000} delay={(STACK_TINTS.length - i) * 500} style={[styles.ghostCard, { top: i * 16, backgroundColor: t.bg, borderColor: t.line, transform: [{ scale: 0.88 + i * 0.06 }] }]} />
          ))}
          <Float duration={5000} style={styles.heroCard}>
            <Spin duration={24000} style={styles.heroOrbit}>
              <Svg width={200} height={200}>
                <Circle cx={100} cy={100} r={90} fill="none" stroke={C.volt} strokeOpacity={0.25} strokeDasharray={[3, 6]} />
                <Circle cx={100} cy={100} r={60} fill="none" stroke={C.ion} strokeOpacity={0.35} />
                <Circle cx={100} cy={40} r={4} fill={C.volt} />
              </Svg>
            </Spin>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt variant="title">{hero.name}</Txt>
              <View style={styles.kindTag}>
                <Txt variant="mono" color={C.volt}>
                  {KIND_LABEL[hero.kind]}
                </Txt>
              </View>
            </View>
            <View>
              <Txt variant="hero" style={{ fontSize: 26 }}>
                {inr(hero.balance)}
              </Txt>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Txt variant="mono" style={{ fontSize: 12 }}>
                  {hero.last4 ? `•••• ${hero.last4}` : ' '}
                </Txt>
                <Txt variant="mono" style={{ fontSize: 12 }}>
                  {monthName(now.getMonth()).toUpperCase()} {inr(-(monthStats.get(hero.id)?.spent ?? 0))}
                </Txt>
              </View>
            </View>
          </Float>
        </View>
      )}

      {live.length === 0 ? (
        <Empty icon="card" title="No accounts yet" body="Add your bank accounts, cards and cash wallet to track each one.">
          <Button title="Add account" icon="plus" onPress={() => router.push('/new-account')} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </Empty>
      ) : (
        <View style={{ gap: 10 }}>
          {live.map((a, i) => {
            const s = monthStats.get(a.id);
            return (
              <Rise key={a.id} delay={i * 70}>
                <Pressable
                  onPress={() => {
                    tap();
                    router.push({ pathname: '/insights', params: { filter: a.id } });
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
                  <View style={[styles.rowIcon, { backgroundColor: a.color + '22' }]}>
                    <Icon name={a.kind === 'cash' ? 'cash' : a.kind === 'bank' ? 'bank' : 'card'} size={20} color={a.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="medium">{a.name}</Txt>
                    <Txt variant="mono" style={{ marginTop: 2 }}>
                      {a.last4 ? `•••• ${a.last4} · ` : ''}
                      {s?.count ?? 0} ENTRIES THIS MONTH
                    </Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt variant="strong" color={a.balance < 0 ? C.warn : C.text}>
                      {inr(a.balance)}
                    </Txt>
                    <Txt style={{ fontSize: 12, color: C.warn, marginTop: 2 }}>{s ? inr(-s.spent) : '—'}</Txt>
                  </View>
                </Pressable>
              </Rise>
            );
          })}
          <View style={styles.tip}>
            <Icon name="repeat" size={16} color={C.volt} />
            <Txt style={{ flex: 1, fontSize: 12, color: C.text2, lineHeight: 17 }}>
              ATM withdrawal? Add a Transfer from your bank to Cash so both balances stay right.
            </Txt>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ghostCard: { position: 'absolute', left: 0, right: 0, height: 196, borderRadius: 24, borderWidth: 1 },
  heroCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 36,
    height: 196,
    borderRadius: 24,
    backgroundColor: '#12151D',
    borderWidth: 1,
    borderColor: '#2A2F3D',
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroOrbit: { position: 'absolute', right: -60, top: -60, width: 200, height: 200 },
  kindTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: C.voltBg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  rowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line2, backgroundColor: C.ink2 },
});
