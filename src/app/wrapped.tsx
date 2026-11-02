import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { GMark } from '@/components/brand';
import { Float, KF, Rise, Spin } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Empty, IconButton } from '@/components/ui';
import { inr, monthName } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { usePrefs } from '@/lib/prefs';
import { byCategory, byMonth, expenses, sum, yearRange } from '@/lib/stats';
import { C, F } from '@/theme/tokens';

const SLIDES = 5;
const SLIDE_MS = 6000;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Wrapped() {
  const { txns, categories, accounts } = useLedger();
  const { monthlyBudget } = usePrefs();
  const [slide, setSlide] = useState(0);
  const y = new Date().getFullYear();

  const spent = expenses(txns, yearRange(y));
  const total = sum(spent);
  const cats = byCategory(txns, categories, yearRange(y), yearRange(y - 1));
  const top = cats[0];
  const byWeekday = new Array(7).fill(0) as number[];
  for (const t of spent) byWeekday[new Date(t.occurred_at).getDay()] += t.amount;
  const busiest = byWeekday.indexOf(Math.max(...byWeekday));
  const biggest = [...spent].sort((a, b) => b.amount - a.amount)[0];
  const cashIds = new Set(accounts.filter((a) => a.kind === 'cash').map((a) => a.id));
  const cashShare = total ? sum(spent.filter((t) => cashIds.has(t.account_id))) / total : 0;
  const months = byMonth(txns, y).slice(0, new Date().getMonth() + 1);
  const underBudget = months.filter((v) => v > 0 && v <= monthlyBudget).length;
  const activeMonths = months.filter((v) => v > 0).length || 1;

  // Stories advance on their own; tapping left or right moves manually and restarts the timer.
  useEffect(() => {
    if (slide >= SLIDES - 1) return;
    const t = setTimeout(() => setSlide((s) => s + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide]);

  if (spent.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.ink, padding: 20 }}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Empty icon="sparkle" title={`Your ${y} is just starting`} body="Log a few expenses and your year in review will build itself here." />
      </SafeAreaView>
    );
  }

  async function share() {
    await Share.share({
      message:
        `My ${y} on Ginti: ${inr(total)} across ${spent.length} entries. ` +
        `Top category: ${top?.category?.name ?? 'Other'} (${Math.round((top?.share ?? 0) * 100)}%). ` +
        `Busiest day: ${DAYS[busiest]}. Under budget in ${underBudget} of ${months.length} months.`,
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0E0B26' }}>
      <Spin duration={60000} style={styles.backdrop}>
        <Svg width={520} height={520}>
          <Circle cx={260} cy={260} r={250} fill="none" stroke={C.ionLine} strokeDasharray={[2, 9]} />
          <Circle cx={260} cy={260} r={180} fill="none" stroke="#241F55" />
        </Svg>
      </Spin>

      <SafeAreaView style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={styles.progress}>
          {Array.from({ length: SLIDES }, (_, i) => (
            <View key={i} style={styles.bar}>
              {i < slide && <View style={[StyleSheet.absoluteFill, { backgroundColor: C.text }]} />}
              {i === slide && (
                <Animated.View
                  key={`fill-${slide}`}
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: C.volt,
                      transformOrigin: 'left',
                      animationName: KF.growX,
                      animationDuration: slide === SLIDES - 1 ? 1 : SLIDE_MS,
                      animationTimingFunction: 'linear',
                      animationFillMode: 'both',
                    },
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <GMark size={22} />
          <Txt variant="label" color={C.ionText} style={{ flex: 1 }}>
            GINTI · {y} WRAPPED
          </Txt>
          <IconButton icon="close" label="Close" onPress={() => router.back()} style={{ backgroundColor: 'transparent', borderColor: 'transparent' }} />
        </View>

        <View style={{ flex: 1 }}>
          <Rise key={slide} style={{ flex: 1, paddingTop: 20 }}>
            {slide === 0 && (
              <View style={{ gap: 14 }}>
                <Txt variant="hero" style={{ fontSize: 34, lineHeight: 40 }}>
                  Your year,{'\n'}counted.
                </Txt>
                <Txt style={{ fontSize: 16, color: C.ionText, lineHeight: 23 }}>
                  You logged {spent.length} expenses in {y}, about {Math.round(spent.length / activeMonths)} a month.
                </Txt>
                <Float style={{ marginTop: 40 }}>
                  <Txt variant="label" color={C.ionText}>
                    SPENT SO FAR
                  </Txt>
                  <Txt style={{ fontFamily: F.displayBold, fontSize: 44, color: C.volt, letterSpacing: -2, marginTop: 6 }} adjustsFontSizeToFit numberOfLines={1}>
                    {inr(total)}
                  </Txt>
                  <Txt style={{ color: C.ionText }}>{inr(total / activeMonths)} a month on average</Txt>
                </Float>
              </View>
            )}

            {slide === 1 && top?.category && (
              <View style={{ flex: 1 }}>
                <Txt variant="hero" style={{ fontSize: 32, lineHeight: 38 }}>
                  {top.category.name} was your{'\n'}main character.
                </Txt>
                <Txt style={{ marginTop: 12, fontSize: 15, color: C.ionText }}>
                  {inr(top.total)}, {Math.round(top.share * 100)}% of everything you spent.
                </Txt>
                <View style={{ flex: 1, marginTop: 10 }}>
                  {cats.slice(0, 6).map((c, i) => {
                    const size = 50 + c.share * 260;
                    const spots = [
                      { left: '28%', top: '8%' },
                      { left: '2%', top: '46%' },
                      { left: '62%', top: '42%' },
                      { left: '40%', top: '62%' },
                      { left: '6%', top: '10%' },
                      { left: '74%', top: '8%' },
                    ] as const;
                    return (
                      <Float key={c.category?.id ?? i} duration={4500 + i * 600} delay={i * 300} style={[styles.bubble, spots[i], { width: size, height: size, borderRadius: size / 2, backgroundColor: c.category?.color ?? C.muted }]}>
                        <Txt style={{ fontFamily: F.displayBold, fontSize: Math.max(11, size / 7), color: C.ink }}>{Math.round(c.share * 100)}%</Txt>
                        {size > 70 && <Txt style={{ fontFamily: F.semibold, fontSize: 11, color: C.ink }}>{c.category?.name}</Txt>}
                      </Float>
                    );
                  })}
                </View>
              </View>
            )}

            {slide === 2 && (
              <View style={{ gap: 14 }}>
                <Txt variant="hero" style={{ fontSize: 32, lineHeight: 38 }}>
                  {DAYS[busiest]}s{'\n'}cost the most.
                </Txt>
                <Txt style={{ fontSize: 15, color: C.ionText, lineHeight: 22 }}>
                  {inr(byWeekday[busiest])} went out on {DAYS[busiest]}s this year.
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160, marginTop: 20 }}>
                  {[1, 2, 3, 4, 5, 6, 0].map((d, i) => (
                    <View key={d} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <Animated.View
                        style={{
                          width: '100%',
                          height: Math.max(6, (byWeekday[d] / Math.max(...byWeekday, 1)) * 130),
                          borderRadius: 6,
                          backgroundColor: d === busiest ? C.volt : C.ionLine,
                          transformOrigin: 'bottom',
                          animationName: KF.growY,
                          animationDuration: 800,
                          animationDelay: i * 80,
                          animationFillMode: 'both',
                        }}
                      />
                      <Txt variant="mono" color={d === busiest ? C.volt : C.ionText} style={{ fontSize: 10 }}>
                        {DAYS[d][0]}
                      </Txt>
                    </View>
                  ))}
                </View>
                {biggest && (
                  <Txt style={{ marginTop: 18, fontSize: 15, color: C.ionTextSoft, lineHeight: 22 }}>
                    Biggest single spend: {inr(biggest.amount)}
                    {biggest.note ? ` on ${biggest.note}` : ''} in {monthName(new Date(biggest.occurred_at).getMonth())}.
                  </Txt>
                )}
              </View>
            )}

            {slide === 3 && (
              <View style={{ gap: 14 }}>
                <Txt variant="hero" style={{ fontSize: 32, lineHeight: 38 }}>
                  {underBudget > months.length / 2 ? 'You kept\nyour promise.' : 'Room to\ngrow.'}
                </Txt>
                <Txt style={{ fontSize: 15, color: C.ionText, lineHeight: 22 }}>
                  Under your {inr(monthlyBudget)} budget in {underBudget} of {months.length} months.
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  {months.map((v, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.monthChip,
                        { backgroundColor: v === 0 ? '#1A1640' : v <= monthlyBudget ? C.volt : C.warn, animationName: KF.rise, animationDuration: 400, animationDelay: i * 70, animationFillMode: 'both' },
                      ]}>
                      <Txt style={{ fontFamily: F.semibold, fontSize: 12, color: v === 0 ? C.ionText : C.ink }}>{monthName(i)}</Txt>
                    </Animated.View>
                  ))}
                </View>
                <Txt style={{ marginTop: 16, fontSize: 15, color: C.ionTextSoft }}>
                  {Math.round(cashShare * 100)}% of your spending was cash, {100 - Math.round(cashShare * 100)}% through banks and cards.
                </Txt>
              </View>
            )}

            {slide === 4 && (
              <View style={{ gap: 18 }}>
                <View style={styles.card}>
                  <GMark size={34} color={C.ink} coin={C.ionDeep} />
                  <Txt style={{ fontFamily: F.displayBold, fontSize: 30, color: C.ink, letterSpacing: -1, marginTop: 14 }}>{inr(total)}</Txt>
                  <Txt style={{ fontFamily: F.semibold, color: C.ink, marginTop: 2 }}>my {y} on Ginti</Txt>
                  <View style={{ marginTop: 18, gap: 6 }}>
                    <Txt style={{ color: C.ink }}>Top: {top?.category?.name ?? 'Other'} · {Math.round((top?.share ?? 0) * 100)}%</Txt>
                    <Txt style={{ color: C.ink }}>Busiest day: {DAYS[busiest]}</Txt>
                    <Txt style={{ color: C.ink }}>
                      On budget: {underBudget}/{months.length} months
                    </Txt>
                  </View>
                </View>
                <Button title="Share my year" icon="send" onPress={share} />
                <Button title="Watch again" variant="ghost" onPress={() => setSlide(0)} />
              </View>
            )}
          </Rise>

          {slide < SLIDES - 1 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={{ flex: 1, flexDirection: 'row' }}>
                <Pressable accessibilityLabel="Previous" style={{ flex: 1 }} onPress={() => setSlide((s) => Math.max(0, s - 1))} />
                <Pressable accessibilityLabel="Next" style={{ flex: 2 }} onPress={() => setSlide((s) => Math.min(SLIDES - 1, s + 1))} />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', width: 520, height: 520, left: -65, top: 220 },
  progress: { flexDirection: 'row', gap: 4, marginTop: 8 },
  bar: { flex: 1, height: 3, borderRadius: 3, backgroundColor: '#3B3580', overflow: 'hidden' },
  bubble: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  monthChip: { width: 58, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.volt, borderRadius: 28, padding: 24 },
});
