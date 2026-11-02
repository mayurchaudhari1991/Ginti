import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/icon';
import { Txt } from '@/components/txt';
import { C, F } from '@/theme/tokens';

type Tone = 'primary' | 'danger' | 'cancel' | 'plain';
export type DialogAction<T> = { label: string; value: T; tone?: Tone; icon?: IconName };
type Request = { title: string; message?: string; actions: DialogAction<unknown>[]; resolve: (v: unknown) => void };

// One host renders dialogs for the whole app; these functions can be called from anywhere, hooks or not.
let enqueue: ((r: Request) => void) | null = null;

/** Shows a themed dialog and resolves with the chosen action's value (undefined when dismissed). */
export function choose<T>(title: string, message: string | undefined, actions: DialogAction<T>[]): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (!enqueue) return resolve(undefined);
    enqueue({ title, message, actions: actions as DialogAction<unknown>[], resolve: resolve as (v: unknown) => void });
  });
}

export async function confirm(opts: { title: string; message?: string; confirm?: string; destructive?: boolean }) {
  const v = await choose(opts.title, opts.message, [
    { label: 'Cancel', value: false, tone: 'cancel' },
    { label: opts.confirm ?? 'OK', value: true, tone: opts.destructive ? 'danger' : 'primary' },
  ]);
  return v === true;
}

export function notify(title: string, message?: string) {
  return choose(title, message, [{ label: 'OK', value: undefined, tone: 'primary' }]);
}

// Reanimated takes curves as cubicBezier(), not CSS "cubic-bezier(...)" strings; a string crashes the app.
const POP_EASING = cubicBezier(0.2, 0.9, 0.3, 1.2);
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const popIn = css.keyframes({ from: { opacity: 0, transform: [{ translateY: 24 }, { scale: 0.96 }] }, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } });

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const current = queue[0];

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r]);
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (current?.actions.some((a) => a.tone === 'danger')) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [current]);

  if (!current) return null;

  const close = (value: unknown) => {
    current.resolve(value);
    setQueue((q) => q.slice(1));
  };
  const dismissValue = current.actions.find((a) => a.tone === 'cancel')?.value;
  const stacked = current.actions.length > 2;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={() => close(dismissValue)}>
      <Animated.View style={[styles.backdrop, { animationName: fadeIn, animationDuration: 180 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(dismissValue)} accessibilityLabel="Dismiss" />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.card, { animationName: popIn, animationDuration: 260, animationTimingFunction: POP_EASING }]}>
          <Txt style={styles.title}>{current.title}</Txt>
          {current.message ? <Txt style={styles.message}>{current.message}</Txt> : null}
          <ScrollView style={{ maxHeight: 420, flexGrow: 0 }} contentContainerStyle={stacked ? styles.stack : styles.row} scrollEnabled={stacked}>
            {current.actions.map((a, i) => (
              <Pressable
                key={`${a.label}-${i}`}
                accessibilityRole="button"
                onPress={() => close(a.value)}
                style={({ pressed }) => [
                  styles.button,
                  !stacked && { flex: 1 },
                  a.tone === 'primary' && { backgroundColor: C.volt },
                  a.tone === 'danger' && { backgroundColor: '#3A1518', borderColor: '#5C2227', borderWidth: 1 },
                  (a.tone === 'cancel' || a.tone === 'plain' || !a.tone) && { backgroundColor: C.ink2, borderColor: C.line2, borderWidth: 1 },
                  stacked && { justifyContent: 'flex-start', paddingHorizontal: 16 },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                ]}>
                {a.icon && <Icon name={a.icon} size={18} color={a.tone === 'primary' ? C.ink : a.tone === 'danger' ? C.danger : C.text2} />}
                <Txt
                  style={{
                    fontFamily: F.semibold,
                    fontSize: 15,
                    color: a.tone === 'primary' ? C.ink : a.tone === 'danger' ? C.danger : a.tone === 'cancel' ? C.text2 : C.text,
                  }}>
                  {a.label}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,5,8,0.78)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: C.surface, borderRadius: 26, borderWidth: 1, borderColor: C.line2, padding: 22, gap: 10 },
  title: { fontFamily: F.display, fontSize: 19, letterSpacing: -0.4, color: C.text },
  message: { fontSize: 14, lineHeight: 21, color: C.text2 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stack: { gap: 8, marginTop: 10 },
  button: { height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
