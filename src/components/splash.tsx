import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { defaultRings, GMark, OrbitField, Wordmark } from '@/components/brand';
import { KF } from '@/components/motion';
import { Txt } from '@/components/txt';
import { C, R } from '@/theme/tokens';

const sweep = css.keyframes({ from: { transform: [{ translateX: -120 }] }, to: { transform: [{ translateX: 300 }] } });

/** Plays on every launch above the app, then fades away once `ready` and the intro have both finished. */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const [introDone, setIntroDone] = useState(false);
  const [gone, setGone] = useState(false);
  const leaving = ready && introDone;

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), 500);
    return () => clearTimeout(t);
  }, [leaving]);

  if (gone) return null;

  return (
    <Animated.View
      pointerEvents={leaving ? 'none' : 'auto'}
      style={[styles.root, { opacity: leaving ? 0 : 1, transform: [{ scale: leaving ? 1.06 : 1 }], transitionProperty: ['opacity', 'transform'], transitionDuration: 450 }]}>
      <View style={styles.center}>
        <View style={styles.orbit}>
          <OrbitField size={320} rings={defaultRings(320)} />
          <Animated.View
            style={[
              styles.tile,
              { animationName: KF.breathe, animationDuration: 3200, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' },
            ]}>
            <GMark size={84} draw orbitCoin />
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', animationName: KF.rise, animationDuration: 700, animationDelay: 500, animationFillMode: 'both' }}>
          <Wordmark size={52} />
          <Txt style={{ marginTop: 10, fontSize: 16, color: C.text2 }}>Money, in orbit.</Txt>
        </Animated.View>
      </View>
      <View style={styles.footer}>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.bar,
              { animationName: sweep, animationDuration: 1600, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' },
            ]}
          />
        </View>
        <Txt variant="label">{ready ? 'READY' : 'SYNCING YOUR LEDGER'}</Txt>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: C.ink, zIndex: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  orbit: { width: 320, height: 320, alignItems: 'center', justifyContent: 'center' },
  tile: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 36,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { position: 'absolute', left: 48, right: 48, bottom: 72, alignItems: 'center', gap: 12 },
  track: { width: '100%', height: 3, borderRadius: R.pill, backgroundColor: '#1A1D27', overflow: 'hidden' },
  bar: { width: 110, height: 3, borderRadius: R.pill, backgroundColor: C.volt },
});
