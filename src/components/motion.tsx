import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

/** Shared keyframes: the four motion styles from the brand board (orbit, pulse, scan, grow). */
export const KF = {
  spin: css.keyframes({ from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } }),
  spinReverse: css.keyframes({ from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '-360deg' }] } }),
  pulse: css.keyframes({
    '0%': { opacity: 0.4, transform: [{ scale: 1 }] },
    '50%': { opacity: 1, transform: [{ scale: 1.2 }] },
    '100%': { opacity: 0.4, transform: [{ scale: 1 }] },
  }),
  breathe: css.keyframes({
    '0%': { transform: [{ scale: 1 }] },
    '50%': { transform: [{ scale: 1.05 }] },
    '100%': { transform: [{ scale: 1 }] },
  }),
  float: css.keyframes({
    '0%': { transform: [{ translateY: 0 }] },
    '50%': { transform: [{ translateY: -6 }] },
    '100%': { transform: [{ translateY: 0 }] },
  }),
  rise: css.keyframes({ from: { opacity: 0, transform: [{ translateY: 16 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } }),
  ripple: css.keyframes({ from: { opacity: 0.7, transform: [{ scale: 0.6 }] }, to: { opacity: 0, transform: [{ scale: 1.5 }] } }),
  growY: css.keyframes({ from: { transform: [{ scaleY: 0.05 }] }, to: { transform: [{ scaleY: 1 }] } }),
  growX: css.keyframes({ from: { transform: [{ scaleX: 0.05 }] }, to: { transform: [{ scaleX: 1 }] } }),
  blink: css.keyframes({ '0%': { opacity: 1 }, '49%': { opacity: 1 }, '50%': { opacity: 0 }, '100%': { opacity: 0 } }),
};

type Wrap = { children?: ReactNode; style?: StyleProp<ViewStyle> };

/** Rotates its children forever; the orbit motion. */
export function Spin({ children, style, duration = 12000, reverse = false }: Wrap & { duration?: number; reverse?: boolean }) {
  return (
    <Animated.View
      style={[
        style,
        {
          animationName: reverse ? KF.spinReverse : KF.spin,
          animationDuration: duration,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** Soft scale and opacity loop for live data and AI states. */
export function Pulse({ children, style, duration = 1800, delay = 0 }: Wrap & { duration?: number; delay?: number }) {
  return (
    <Animated.View
      style={[
        style,
        {
          animationName: KF.pulse,
          animationDuration: duration,
          animationDelay: delay,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        },
      ]}>
      {children}
    </Animated.View>
  );
}

export function Float({ children, style, duration = 4000, delay = 0 }: Wrap & { duration?: number; delay?: number }) {
  return (
    <Animated.View
      style={[
        style,
        {
          animationName: KF.float,
          animationDuration: duration,
          animationDelay: delay,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** One-shot entrance: fades up into place, staggered by `delay`. */
export function Rise({ children, style, delay = 0 }: Wrap & { delay?: number }) {
  return (
    <Animated.View
      style={[
        style,
        {
          animationName: KF.rise,
          animationDuration: 600,
          animationDelay: delay,
          animationFillMode: 'both',
          animationTimingFunction: 'ease-out',
        },
      ]}>
      {children}
    </Animated.View>
  );
}
