import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { MonthBars, ShareRow, StackBar } from '@/components/charts';
import { Rise } from '@/components/motion';
import { TxnRow } from '@/components/txn-row';
import { Txt } from '@/components/txt';
import { Card, Chip, Empty, Screen, Segmented } from '@/components/ui';
import { inr, inrShort, monthName } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { byAccount, byCategory, byMonth, expenses, monthRange, previousMonth, sum, yearRange } from '@/lib/stats';
import { C } from '@/theme/tokens';

type Period = 'month' | 'year';
const SOURCE_COLORS = [C.volt, C.ion, '#4CC9FF', '#FF8A4C', C.text];

export default function Insights() {
  const params = useLocalSearchParams<{ period?: Period; filter?: string }>();
  const { txns, accounts, categories } = useLedger();
  const [period, setPeriod] = useState<Period>(params.period === 'year' ? 'year' : 'month');
  const [filter, setFilter] = useState<string>(params.filter ?? 'all');

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const accountIds = useMemo(() => {
    if (filter === 'all') return undefined;
    if (filter === 'bank') return accounts.filter((a) => a.kind !== 'cash').map((a) => a.id);
    if (filter === 'cash') return accounts.filter((a) => a.kind === 'cash').map((a) => a.id);
    return [filter];
  }, [filter, accounts]);

  const data = useMemo(() => {
    const p = previousMonth(y, m);
    const range = period === 'month' ? monthRange(y, m) : yearRange(y);
    const prev = period === 'month' ? monthRange(p.year, p.month) : yearRange(y - 1);
    const months = byMonth(txns, y, accountIds);
    // Average only months that have entries: months before someone started using Ginti aren't ₹0 months.
    const active = months.slice(0, m + 1).filter((v) => v > 0);
    const avg = active.length ? active.reduce((s, v) => s + v, 0) / active.length : 0;
    // Pace the current month from what's been spent so far, but only once a week of data exists.
    const daysIn = new Date(y, m + 1, 0).getDate();
    const paced = now.getDate() >= 7 ? months[m] / (now.getDate() / daysIn) : null;
    return {
      total: sum(expenses(txns, range, accountIds)),
      months,
      avg,
      paced,
      cats: byCategory(txns, categories, range, prev, accountIds),
      sources: byAccount(txns, accounts, range),
      entries: expenses(txns, range, accountIds).slice(0, 30),
    };
    // `now` only matters at day resolution here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txns, categories, accounts, accountIds, period, y, m]);

  const maxCat = data.cats[0]?.total || 1;
  const label = period === 'month' ? `${monthName(m)} ${y}` : `${y} so far`;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="display">Insights</Txt>
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
        <View style={{ width: 12 }} />
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="All banks" active={filter === 'bank'} onPress={() => setFilter('bank')} />
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <Chip key={a.id} label={a.kind === 'cash' ? 'Cash' : a.name} active={filter === a.id} onPress={() => setFilter(a.id)} />
          ))}
        <View style={{ width: 12 }} />
      </ScrollView>

      <Rise>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Txt variant="label">{label.toUpperCase()}</Txt>
              <Txt variant="display" style={{ marginTop: 6 }}>
                {inr(data.total)}
              </Txt>
            </View>
            <Txt variant="small" style={{ textAlign: 'right' }}>
              Avg {inrShort(data.avg)}/mo{'\n'}
              <Txt style={{ fontSize: 12, color: C.ionText }}>
                {data.paced != null ? `${monthName(m)} heading for ${inrShort(data.paced)}` : `${monthName(m)} forecast after day 7`}
              </Txt>
            </Txt>
          </View>
          <View style={{ marginTop: 16 }}>
            <MonthBars
              values={data.months}
              highlight={m}
              forecast={m < 11 ? { index: m + 1, value: data.avg } : undefined}
              labels={['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']}
            />
          </View>
        </Card>
      </Rise>

      {filter === 'all' && data.sources.length > 0 && (
        <Rise delay={100}>
          <Card style={{ paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="strong">By source</Txt>
              <Txt variant="small">{inr(data.total)}</Txt>
            </View>
            <View style={{ marginTop: 10 }}>
              <StackBar parts={data.sources.map((s, i) => ({ color: SOURCE_COLORS[i % SOURCE_COLORS.length], share: s.share }))} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
              {data.sources.map((s, i) => (
                <View key={s.account.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                  <Txt style={{ fontSize: 12, color: C.text2 }}>
                    {s.account.name} {Math.round(s.share * 100)}%
                  </Txt>
                </View>
              ))}
            </View>
          </Card>
        </Rise>
      )}

      <View>
        <Txt variant="title" style={{ fontSize: 15, marginBottom: 4 }}>
          By category · {label}
        </Txt>
        {data.cats.length === 0 ? (
          <Empty icon="chart" title="Nothing here yet" body="Entries for this period and filter will show up here." />
        ) : (
          data.cats.map((c, i) => (
            <ShareRow
              key={c.category?.id ?? 'none'}
              color={c.category?.color ?? C.muted}
              label={c.category?.name ?? 'Uncategorised'}
              value={inr(c.total)}
              max={c.total / maxCat}
              delta={c.previous > 0 ? c.total / c.previous - 1 : null}
              delay={i * 80}
            />
          ))
        )}
      </View>

      {data.entries.length > 0 && (
        <View>
          <Txt variant="title" style={{ fontSize: 15, marginBottom: 4 }}>
            Entries
          </Txt>
          {data.entries.map((t) => (
            <TxnRow key={t.id} txn={t} />
          ))}
        </View>
      )}
    </Screen>
  );
}
