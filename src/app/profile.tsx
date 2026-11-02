import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon, type IconName } from '@/components/icon';
import { Float, Rise, Spin } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, IconButton, Screen, tap } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { inrShort } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { usePrefs } from '@/lib/prefs';
import { byMonth } from '@/lib/stats';
import { firstName } from '@/lib/user';
import { C, F } from '@/theme/tokens';

/** Consecutive days, ending today or yesterday, with at least one entry. */
function logStreak(dates: string[]) {
  const days = new Set(dates.map((d) => new Date(d).toDateString()));
  const cursor = new Date();
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (days.has(cursor.toDateString())) {
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export default function Profile() {
  const { session, signOut } = useAuth();
  const { txns, accounts, categories } = useLedger();
  const { monthlyBudget } = usePrefs();
  const name = firstName(session) ?? 'You';

  const stats = useMemo(() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    const months = byMonth(txns, y).slice(0, m);
    const saved = months.reduce((s, v) => s + Math.max(0, monthlyBudget - v), 0);
    const underBudget = months.filter((v) => v > 0 && v <= monthlyBudget).length;
    return { streak: logStreak(txns.map((t) => t.occurred_at)), entries: txns.length, saved, underBudget };
  }, [txns, monthlyBudget]);

  // Levels reward the habit of logging: one level per 50 entries.
  const level = Math.floor(stats.entries / 50) + 1;
  const progress = (stats.entries % 50) / 50;
  const ringC = 2 * Math.PI * 58;

  const menu: { icon: IconName; label: string; value?: string; to: '/settings' | '/accounts' | '/budgets' | '/insights' }[] = [
    { icon: 'target', label: 'Budgets by category', value: String(categories.filter((c) => c.monthly_budget).length), to: '/budgets' },
    { icon: 'card', label: 'Banks and cash wallets', value: String(accounts.length), to: '/accounts' },
    { icon: 'chart', label: 'Insights', to: '/insights' },
    { icon: 'settings', label: 'Settings', to: '/settings' },
  ];

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Txt variant="title">Profile</Txt>
        <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ width: 128, height: 128, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={128} height={128} style={StyleSheet.absoluteFill}>
            <Circle cx={64} cy={64} r={58} fill="none" stroke={C.line} strokeWidth={4} />
            <Circle cx={64} cy={64} r={58} fill="none" stroke={C.volt} strokeWidth={4} strokeLinecap="round" strokeDasharray={[ringC * progress, ringC]} rotation={-90} origin="64, 64" />
          </Svg>
          <Spin duration={10000} style={StyleSheet.absoluteFill}>
            <Svg width={128} height={128}>
              <Circle cx={64} cy={6} r={4} fill={C.ion} />
            </Svg>
          </Spin>
          <View style={styles.avatar}>
            <Txt style={{ fontFamily: F.display, fontSize: 36, color: C.ionText }}>{name[0]}</Txt>
          </View>
        </View>
        <Txt variant="display" style={{ fontSize: 22 }}>
          {name}
        </Txt>
        <Txt variant="label">
          LEVEL {level} · {Math.round(progress * 100)}% TO LEVEL {level + 1}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          { value: String(stats.streak), label: 'day log streak', color: C.warn },
          { value: String(stats.entries), label: 'entries logged', color: C.text },
          { value: inrShort(stats.saved), label: 'under budget this year', color: C.volt },
        ].map((s, i) => (
          <Rise key={s.label} delay={i * 80} style={styles.stat}>
            <Txt style={{ fontFamily: F.display, fontSize: 18, color: s.color }}>{s.value}</Txt>
            <Txt variant="small" style={{ marginTop: 6 }}>
              {s.label}
            </Txt>
          </Rise>
        ))}
      </View>

      <View>
        <Txt variant="title" style={{ fontSize: 14, marginBottom: 10 }}>
          Badges
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Badge earned={stats.streak >= 7} top="7" label="Day streak" bg="#2A1A10" line="#5A3418" color={C.warn} delay={0} />
          <Badge earned={stats.underBudget >= 1} top={`×${stats.underBudget}`} label="On budget" bg={C.voltBg} line="#3B5214" color={C.volt} delay={300} />
          <Badge earned={stats.entries >= 100} top="100" label="Entries" bg="#1A1640" line={C.ionLine} color={C.ionText} delay={600} />
          <Badge earned={stats.saved >= 100000} top="1L" label="Saved" bg="#10241C" line="#1E4A36" color={C.good} delay={900} />
        </View>
      </View>

      <View style={styles.menu}>
        {menu.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={() => {
              tap();
              router.push(item.to);
            }}
            style={[styles.menuRow, i < menu.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#1A1D27' }]}>
            <Icon name={item.icon} size={18} color={C.text2} />
            <Txt style={{ flex: 1 }}>{item.label}</Txt>
            {item.value && <Txt variant="small">{item.value}</Txt>}
            <Icon name="chevron-right" size={16} color={C.muted} />
          </Pressable>
        ))}
      </View>

      <Button title="Sign out" variant="danger" icon="logout" onPress={signOut} />
    </Screen>
  );
}

function Badge({ earned, top, label, bg, line, color, delay }: { earned: boolean; top: string; label: string; bg: string; line: string; color: string; delay: number }) {
  if (!earned) {
    return (
      <View style={[styles.badge, { backgroundColor: C.ink2, borderColor: C.line2, borderStyle: 'dashed' }]}>
        <Icon name="lock" size={16} color={C.muted} />
        <Txt style={{ fontSize: 11, color: C.muted }}>{label}</Txt>
      </View>
    );
  }
  return (
    <Float duration={3000} delay={delay} style={[styles.badge, { backgroundColor: bg, borderColor: line }]}>
      <Txt style={{ fontFamily: F.displayBold, fontSize: 16, color }}>{top}</Txt>
      <Txt style={{ fontSize: 11, color }}>{label}</Txt>
    </Float>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#1A1640', alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12 },
  badge: { flex: 1, height: 76, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  menu: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 20, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 54 },
});
