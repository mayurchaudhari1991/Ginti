import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { GMark } from '@/components/brand';
import { Icon } from '@/components/icon';
import { KF, Spin } from '@/components/motion';
import { Txt } from '@/components/txt';
import { tap } from '@/components/ui';
import { useLock } from '@/lib/lock';
import { getPrefs } from '@/lib/prefs';
import { C, F } from '@/theme/tokens';

const scan = css.keyframes({
  '0%': { transform: [{ translateY: 0 }] },
  '50%': { transform: [{ translateY: 96 }] },
  '100%': { transform: [{ translateY: 0 }] },
});

export function LockScreen({ name }: { name?: string }) {
  const { unlock } = useLock();
  const [message, setMessage] = useState('Touch the sensor to open your ledger');

  const explain = (res: { ok: boolean; reason?: string }) => {
    if (!res.ok && res.reason !== 'user_cancel') setMessage(res.reason === 'lockout' ? 'Too many tries. Use your phone PIN.' : 'Not recognised. Try again.');
  };

  const tryUnlock = () => {
    tap();
    unlock().then(explain);
  };

  // Prompt once on appear; later attempts come from the buttons.
  useEffect(() => {
    unlock().then(explain);
  }, [unlock]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <GMark size={28} />
          <Txt style={{ fontFamily: F.display, fontSize: 18 }}>ginti</Txt>
        </View>
        <Txt variant="display" style={{ marginTop: 48, fontSize: 28, textAlign: 'center' }}>
          {name ? `Welcome back, ${name}` : 'Welcome back'}
        </Txt>
        <Txt style={{ marginTop: 10, fontSize: 15, color: C.muted, textAlign: 'center' }}>{message}</Txt>

        <View style={styles.sensorWrap}>
          {[0, 1200].map((delay) => (
            <Animated.View
              key={delay}
              style={[
                styles.ripple,
                { animationName: KF.ripple, animationDuration: 2400, animationDelay: delay, animationIterationCount: 'infinite', animationTimingFunction: 'ease-out' },
              ]}
            />
          ))}
          <Spin duration={6000} style={StyleSheet.absoluteFill}>
            <Svg width={260} height={260}>
              <Circle cx={130} cy={130} r={100} fill="none" stroke={C.line} strokeWidth={2} />
              <Circle cx={130} cy={130} r={100} fill="none" stroke={C.volt} strokeWidth={2} strokeLinecap="round" strokeDasharray={[60, 568]} />
              <Circle cx={130} cy={130} r={100} fill="none" stroke={C.ion} strokeWidth={2} strokeLinecap="round" strokeDasharray={[24, 604]} strokeDashoffset={-310} />
            </Svg>
          </Spin>
          <Pressable accessibilityRole="button" accessibilityLabel="Unlock with fingerprint" onPress={tryUnlock} style={styles.sensor}>
            <Icon name="fingerprint" size={76} color={C.volt} strokeWidth={1.4} />
            <Animated.View
              style={[styles.scanLine, { animationName: scan, animationDuration: 2200, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' }]}
            />
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" onPress={tryUnlock} style={styles.alt}>
          <Icon name="lock" size={18} color={C.text} />
          <Txt variant="medium" style={{ fontSize: 15 }}>
            Use phone PIN or face
          </Txt>
        </Pressable>
        <Txt variant="label" style={{ marginTop: 18, textAlign: 'center' }}>
          DEVICE BIOMETRICS · AUTO-LOCK AFTER {getPrefs().autoLockSeconds} S
        </Txt>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: C.ink, zIndex: 90 },
  safe: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 48, paddingBottom: 32 },
  sensorWrap: { width: 260, height: 260, marginTop: 56, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: C.volt },
  sensor: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: 26,
    height: 2,
    backgroundColor: C.volt,
    shadowColor: C.volt,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  alt: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
