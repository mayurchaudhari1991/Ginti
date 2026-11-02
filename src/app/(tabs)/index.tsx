import { router } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryRing, ProgressBar } from '@/components/charts';
import { Icon } from '@/components/icon';
import { Pulse, Rise } from '@/components/motion';
import { TxnRow } from '@/components/txn-row';
import { Txt } from '@/components/txt';
import { Button, Card, Chip, Empty, IconButton, SectionHeader, tap } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { greeting, inr, monthName } from '@/lib/format';
import { inboxAvailable, scanInbox, usePendingImports } from '@/lib/inbox';
import { useLedger } from '@/lib/ledger';
import { usePrefs } from '@/lib/prefs';
import { byCategory, expenses, monthRange, previousMonth, sum } from '@/lib/stats';
import { firstName } from '@/lib/user';
import { C, F } from '@/theme/tokens';

export default function Home() {
  const { session } = useAuth();
  const { accounts, categories, txns, loading, refresh, error } = useLedger();
  const { monthlyBudget } = usePrefs();
  const name = firstName(session) ?? 'there';
  const pending = usePendingImports();
  const ready = !loading && accounts.length > 0;

  // Pick up new bank SMS and payment notifications on launch and whenever the app comes back.
  const scan = useEffectEvent(() => {
    scanInbox(accounts, categories, txns).catch(() => {});
  });
  useEffect(() => {
    if (!inboxAvailable || !ready) return;
    scan();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && scan());
    return () => sub.remove();
  }, [ready]);

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // The React Compiler memoizes these; no manual useMemo needed.
  const range = monthRange(y, m);
  const p = previousMonth(y, m);
  const monthExpenses = expenses(txns, range);
  const cats = byCategory(txns, categories, range, monthRange(p.year, p.month));
  const perAccount = new Map<string, number>();
  for (const t of monthExpenses) perAccount.set(t.account_id, (perAccount.get(t.account_id) ?? 0) + t.amount);
  // The single most useful nudge: the category that grew most against last month.
  const riser = cats.filter((c) => c.previous > 0 && c.total > c.previous).sort((a, b) => b.total / b.previous - a.total / a.previous)[0];
  const data = { spent: sum(monthExpenses), cats, perAccount, riser };

  const daysLeft = new Date(y, m + 1, 0).getDate() - now.getDate() + 1;
  const left = monthlyBudget - data.spent;
  const used = monthlyBudget > 0 ? data.spent / monthlyBudget : 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.ink }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={C.volt} colors={[C.volt]} progressBackgroundColor={C.surface} />}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/profile')} style={styles.avatar}>
            <Txt style={{ fontFamily: F.semibold, color: C.ionText }}>{name[0]}</Txt>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="small" style={{ fontSize: 13 }}>
              {greeting(now)}
            </Txt>
            <Txt variant="title">{name}</Txt>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/insights')} style={styles.monthPill}>
            <Txt style={{ fontSize: 14 }}>
              {monthName(m)} {y}
            </Txt>
            <Icon name="chevron-down" size={14} color={C.text} strokeWidth={2} />
          </Pressable>
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        </View>

        {error && (
          <Card tone="ai">
            <Txt color={C.ionTextSoft}>Could not sync: {error}</Txt>
          </Card>
        )}

        <Rise>
          <Card style={styles.hero}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="label">SPENT THIS MONTH</Txt>
              <Txt variant="hero" style={{ marginTop: 8, fontSize: 28 }} adjustsFontSizeToFit numberOfLines={1}>
                {inr(data.spent)}
              </Txt>
              <Pressable onPress={() => router.push('/budgets')}>
                <Txt variant="small" style={{ marginTop: 6, fontSize: 13 }}>
                  of {inr(monthlyBudget)} budget ›
                </Txt>
              </Pressable>
              <View style={{ marginTop: 12 }}>
                <ProgressBar value={used} color={used > 1 ? C.warn : C.volt} />
              </View>
              <Txt style={{ marginTop: 10, fontSize: 12, color: left >= 0 ? C.volt : C.warn }}>
                {left >= 0 ? `${inr(left)} left · ${daysLeft} days to go` : `${inr(-left)} over budget`}
              </Txt>
            </View>
            <CategoryRing segments={data.cats.map((c) => ({ color: c.category?.color ?? C.muted, value: c.total }))} size={140}>
              <Txt style={{ fontFamily: F.display, fontSize: 19 }}>{Math.round(used * 100)}%</Txt>
              <Txt variant="small" style={{ fontSize: 11 }}>
                used
              </Txt>
            </CategoryRing>
          </Card>
        </Rise>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
          <View style={{ width: 12 }} />
          <Chip label="Month" active />
          <Chip label="Year" onPress={() => router.push({ pathname: '/insights', params: { period: 'year' } })} />
          <Chip label="Bank" onPress={() => router.push({ pathname: '/insights', params: { filter: 'bank' } })} />
          <Chip label="Cash" onPress={() => router.push({ pathname: '/insights', params: { filter: 'cash' } })} />
          <Chip label="Category" onPress={() => router.push('/insights')} />
          <View style={{ width: 12 }} />
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -20 }}>
          <View style={{ width: 10 }} />
          {accounts
            .filter((a) => !a.archived)
            .map((a, i) => (
              <Rise key={a.id} delay={i * 80}>
                <Pressable onPress={() => router.push('/accounts')} style={styles.accountCard}>
                  <Txt variant="mono" numberOfLines={1}>
                    {a.last4 ? `${a.name.split(' ')[0].toUpperCase()} ••${a.last4}` : a.name.toUpperCase()}
                  </Txt>
                  <Txt variant="strong" style={{ marginTop: 8, fontSize: 16 }}>
                    {inr(a.balance)}
                  </Txt>
                  <Txt style={{ marginTop: 4, fontSize: 12, color: C.warn }}>
                    {data.perAccount.get(a.id) ? inr(-(data.perAccount.get(a.id) ?? 0)) : '—'}
                  </Txt>
                </Pressable>
              </Rise>
            ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add account" onPress={() => router.push('/new-account')} style={[styles.accountCard, styles.addAccount]}>
            <Icon name="plus" size={20} color={C.volt} />
            <Txt style={{ fontSize: 12, color: C.text2, marginTop: 6 }}>Bank or card</Txt>
          </Pressable>
          <View style={{ width: 10 }} />
        </ScrollView>

        {inboxAvailable && (
          <Pressable
            onPress={() => {
              tap();
              router.push('/import');
            }}>
            <Card style={styles.importCard}>
              <View style={styles.importIcon}>
                <Icon name={pending.length ? 'sync' : 'scan'} size={18} color={C.ink} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="strong">{pending.length ? `${pending.length} new payment${pending.length === 1 ? '' : 's'} detected` : 'Track payments automatically'}</Txt>
                <Txt variant="small" style={{ marginTop: 2 }}>
                  {pending.length ? 'From bank SMS and payment apps. Tap to review.' : 'Bank SMS, Google Pay, PhonePe and Paytm'}
                </Txt>
              </View>
              {pending.length > 0 && (
                <Pulse>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.volt }} />
                </Pulse>
              )}
              <Icon name="chevron-right" size={18} color={C.muted} />
            </Card>
          </Pressable>
        )}

        {data.riser?.category && (
          <Pressable
            onPress={() => {
              tap();
              router.push({ pathname: '/assistant', params: { q: `Why is my ${data.riser!.category!.name} spending up this month and how can I cut it?` } });
            }}>
            <Card tone="ai" style={styles.aiCard}>
              <View style={styles.aiIcon}>
                <Icon name="sparkle" size={18} color={C.ink} strokeWidth={2} />
                <Pulse style={styles.aiHalo} />
              </View>
              <Txt style={{ flex: 1, fontSize: 13, lineHeight: 19, color: C.ionTextSoft }}>
                {data.riser.category.name} is up {Math.round((data.riser.total / data.riser.previous - 1) * 100)}% on last month. Tap to ask Ginti AI why.
              </Txt>
              <Icon name="arrow" size={18} color={C.ionText} />
            </Card>
          </Pressable>
        )}

        <View>
          <SectionHeader title="Recent" action={txns.length ? 'See all' : undefined} onAction={() => router.push('/insights')} />
          {txns.length === 0 && !loading ? (
            <Empty icon="sparkle" title="Your ledger is empty" body={'Tap + and type something like\n"450 swiggy dinner on hdfc".'}>
              <Button title="Add first expense" icon="plus" onPress={() => router.push('/add')} style={{ marginTop: 10, alignSelf: 'stretch' }} />
            </Empty>
          ) : (
            <View style={{ marginTop: 6 }}>
              {txns.slice(0, 8).map((t) => (
                <TxnRow key={t.id} txn={t} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 130, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1640', borderWidth: 1, borderColor: C.ionLine, alignItems: 'center', justifyContent: 'center' },
  monthPill: { height: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 26, padding: 20 },
  accountCard: { width: 132, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 },
  addAccount: { borderStyle: 'dashed', borderColor: C.line2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink2 },
  importCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20 },
  importIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.volt, alignItems: 'center', justifyContent: 'center' },
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20 },
  aiIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.ion, alignItems: 'center', justifyContent: 'center' },
  aiHalo: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 15, borderWidth: 1, borderColor: C.ion },
});
