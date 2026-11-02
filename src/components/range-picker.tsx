import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Txt } from '@/components/txt';
import { Button, tap } from '@/components/ui';
import { monthName } from '@/lib/format';
import type { ScanRange } from '@/lib/inbox';
import { C, F } from '@/theme/tokens';

const DAY = 86400000;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const slideUp = css.keyframes({ from: { transform: [{ translateY: 500 }] }, to: { transform: [{ translateY: 0 }] } });
const EASE = cubicBezier(0.2, 0.9, 0.3, 1);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const short = (d: Date) => `${d.getDate()} ${monthName(d.getMonth())}`;

type Preset = { label: string; hint: string; range: () => ScanRange | undefined };

function presets(lastScan: number | null): Preset[] {
  const now = new Date();
  const back = (days: number): ScanRange => ({ from: startOfDay(new Date(now.getTime() - (days - 1) * DAY)).getTime(), to: now.getTime() });
  return [
    { label: 'New since last scan', hint: lastScan ? `After ${short(new Date(lastScan))}` : 'First scan: last 45 days', range: () => undefined },
    { label: 'This month', hint: `1 ${monthName(now.getMonth())} – today`, range: () => ({ from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: now.getTime() }) },
    {
      label: 'Last month',
      hint: monthName((now.getMonth() + 11) % 12),
      range: () => ({ from: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), to: new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1 }),
    },
    { label: 'Last 7 days', hint: `${short(new Date(back(7).from))} – today`, range: () => back(7) },
    { label: 'Last 30 days', hint: `${short(new Date(back(30).from))} – today`, range: () => back(30) },
    { label: 'Last 90 days', hint: `${short(new Date(back(90).from))} – today`, range: () => back(90) },
    { label: 'This year', hint: `1 Jan – today`, range: () => ({ from: new Date(now.getFullYear(), 0, 1).getTime(), to: now.getTime() }) },
  ];
}

/** Bottom sheet asking which period to scan: a preset, or a custom From → To on a calendar. */
export function RangePicker({ visible, lastScan, onClose, onPick }: { visible: boolean; lastScan: number | null; onClose: () => void; onPick: (range: ScanRange | undefined, label: string) => void }) {
  const [custom, setCustom] = useState(false);
  // Tall enough that all eight choices, including Custom dates, show without scrolling on a phone.
  const listHeight = Math.min(useWindowDimensions().height * 0.72, 720);
  if (!visible) return null;

  const close = () => {
    setCustom(false);
    onClose();
  };

  return (
    <Modal transparent visible statusBarTranslucent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <Animated.View style={[styles.sheet, { animationName: slideUp, animationDuration: 320, animationTimingFunction: EASE }]}>
          <View style={styles.grab} />
          <Txt variant="display" style={{ fontSize: 20 }}>
            {custom ? 'Pick dates' : 'Scan which period?'}
          </Txt>
          <Txt variant="small" style={{ marginTop: 4, marginBottom: 14 }}>
            {custom ? 'Tap the first day, then the last day.' : 'Payments already in your ledger are skipped.'}
          </Txt>
          {custom ? (
            <CalendarRange
              onDone={(r) => {
                setCustom(false);
                onPick(r, `${short(new Date(r.from))} – ${short(new Date(r.to))}`);
              }}
              onBack={() => setCustom(false)}
            />
          ) : (
            <ScrollView style={{ maxHeight: listHeight }} contentContainerStyle={{ gap: 8 }}>
              {presets(lastScan).map((p) => (
                <Pressable
                  key={p.label}
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    onPick(p.range(), p.label);
                  }}
                  style={({ pressed }) => [styles.option, pressed && { opacity: 0.8 }]}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="medium">{p.label}</Txt>
                    <Txt variant="mono" style={{ marginTop: 2 }}>
                      {p.hint.toUpperCase()}
                    </Txt>
                  </View>
                  <Icon name="chevron-right" size={18} color={C.muted} />
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  setCustom(true);
                }}
                style={({ pressed }) => [styles.option, { borderColor: C.volt }, pressed && { opacity: 0.8 }]}>
                <Icon name="calendar" size={20} color={C.volt} />
                <View style={{ flex: 1 }}>
                  <Txt variant="medium">Custom dates</Txt>
                  <Txt variant="mono" style={{ marginTop: 2 }}>
                    FROM → TO ON A CALENDAR
                  </Txt>
                </View>
                <Icon name="chevron-right" size={18} color={C.volt} />
              </Pressable>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function CalendarRange({ onDone, onBack }: { onDone: (r: ScanRange) => void; onBack: () => void }) {
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);

  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const atCurrentMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();

  const pick = (d: Date) => {
    tap();
    if (!from || to) {
      setFrom(d);
      setTo(null);
    } else if (d < from) {
      setTo(from);
      setFrom(d);
    } else setTo(d);
  };

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Previous month" onPress={() => shift(-1)} style={styles.navBtn}>
          <Icon name="back" size={18} color={C.text} />
        </Pressable>
        <Txt style={{ fontFamily: F.display, fontSize: 16 }}>
          {monthName(cursor.m)} {cursor.y}
        </Txt>
        <Pressable accessibilityLabel="Next month" disabled={atCurrentMonth} onPress={() => shift(1)} style={[styles.navBtn, atCurrentMonth && { opacity: 0.3 }]}>
          <Icon name="arrow" size={18} color={C.text} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <Txt key={`w${i}`} variant="mono" style={styles.weekday}>
            {w}
          </Txt>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <View key={`e${i}`} style={styles.cell} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = new Date(cursor.y, cursor.m, i + 1);
          const future = d > today;
          const isEnd = (from && +d === +from) || (to && +d === +to);
          const inside = from && to && d > from && d < to;
          return (
            <Pressable
              key={i}
              accessibilityLabel={`${i + 1} ${monthName(cursor.m)}`}
              disabled={future}
              onPress={() => pick(d)}
              style={[styles.cell, inside && { backgroundColor: C.voltBg }, isEnd && { backgroundColor: C.volt, borderRadius: 10 }, future && { opacity: 0.25 }]}>
              <Txt style={{ fontFamily: isEnd ? F.semibold : F.body, fontSize: 13, color: isEnd ? C.ink : inside ? C.volt : C.text }}>{i + 1}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="mono" style={{ textAlign: 'center' }}>
        {from ? `${short(from).toUpperCase()} → ${to ? short(to).toUpperCase() : 'PICK END'}` : 'PICK START DATE'}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Back" variant="ghost" onPress={onBack} style={{ flex: 1 }} />
        <Button
          title="Scan these dates"
          icon="scan"
          disabled={!from}
          onPress={() => from && onDone({ from: from.getTime(), to: endOfDay(to ?? from).getTime() })}
          style={{ flex: 1.5 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,5,8,0.78)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: C.line2, padding: 20, paddingBottom: 36 },
  grab: { width: 40, height: 4, borderRadius: 4, backgroundColor: C.line2, alignSelf: 'center', marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line2, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 14.28%, not 100/7: seven exact sevenths round past 100% and push Sunday onto its own row.
  weekday: { width: '14.28%', textAlign: 'center', fontSize: 10, marginBottom: 6 },
  cell: { width: '14.28%', height: 42, alignItems: 'center', justifyContent: 'center' },
});
