import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { KF, Spin } from '@/components/motion';
import { Txt } from '@/components/txt';
import { C, F } from '@/theme/tokens';

const shine = css.keyframes({ '0%': { transform: [{ translateX: -80 }] }, '60%': { transform: [{ translateX: 320 }] }, '100%': { transform: [{ translateX: 320 }] } });

/** Category donut that slowly orbits, with a satellite dot on an inner ring. */
export function CategoryRing({ segments, size = 150, children }: { segments: { color: string; value: number }[]; size?: number; children?: ReactNode }) {
  const r = size * 0.39;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const gap = segments.length > 1 ? 4 : 0;
  const lengths = segments.map((seg) => (total ? (seg.value / total) * circ : 0));
  const arcs = segments.map((seg, i) => ({
    color: seg.color,
    dash: Math.max(0, lengths[i] - gap),
    offset: -lengths.slice(0, i).reduce((s, l) => s + l, 0),
  }));
  return (
    <View style={{ width: size, height: size }}>
      <Spin duration={40000} style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={r} fill="none" stroke={C.line} strokeWidth={size * 0.08} />
          {arcs.map((a, i) => (
            <Circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={size * 0.08}
              strokeDasharray={[a.dash, circ]}
              strokeDashoffset={a.offset}
            />
          ))}
        </Svg>
      </Spin>
      <Spin duration={9000} reverse style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={size * 0.275} fill="none" stroke={C.line2} strokeWidth={1} strokeDasharray={[2, 6]} />
          <Circle cx={c} cy={c - size * 0.275} r={3.5} fill={C.volt} />
        </Svg>
      </Spin>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

/** Budget progress with a light sweeping across the filled part. */
export function ProgressBar({ value, color = C.volt, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: C.line, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color, overflow: 'hidden' }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 40,
            backgroundColor: 'rgba(255,255,255,0.5)',
            animationName: shine,
            animationDuration: 2800,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      </View>
    </View>
  );
}

/** Category share row: dot, name, change vs last period, amount, and a bar that grows in. */
export function ShareRow({ color, label, value, max, delta, delay = 0 }: { color: string; label: string; value: string; max: number; delta?: number | null; delay?: number }) {
  const deltaColor = delta == null || delta === 0 ? C.muted : delta > 0 ? C.warn : C.volt;
  const deltaText = delta == null ? 'new' : delta === 0 ? 'same' : `${delta > 0 ? '↑' : '↓'} ${Math.abs(Math.round(delta * 100))}%`;
  return (
    <View style={{ paddingVertical: 8, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Txt style={{ flex: 1 }}>{label}</Txt>
        <Txt style={{ fontSize: 12, color: deltaColor }}>{deltaText}</Txt>
        <Txt variant="strong" style={{ width: 84, textAlign: 'right' }}>
          {value}
        </Txt>
      </View>
      <View style={{ height: 4, borderRadius: 4, backgroundColor: '#1A1D27' }}>
        <Animated.View
          style={{
            width: `${Math.max(2, max * 100)}%`,
            height: 4,
            borderRadius: 4,
            backgroundColor: color,
            transformOrigin: 'left',
            animationName: KF.growX,
            animationDuration: 900,
            animationDelay: delay,
            animationFillMode: 'both',
            animationTimingFunction: 'ease-out',
          }}
        />
      </View>
    </View>
  );
}

/** Monthly bars; the highlighted index gets volt and a pulsing beacon, the forecast gets a dashed outline. */
export function MonthBars({
  values,
  highlight,
  forecast,
  labels,
  height = 120,
}: {
  values: number[];
  highlight: number;
  forecast?: { index: number; value: number };
  labels: string[];
  height?: number;
}) {
  const max = Math.max(...values, forecast?.value ?? 0, 1);
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        {labels.map((_, i) => {
          const isForecast = forecast && i === forecast.index;
          const v = isForecast ? forecast.value : values[i] ?? 0;
          const h = Math.max(4, (v / max) * height);
          if (isForecast) {
            return <View key={i} style={{ flex: 1, height: h, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.ion }} />;
          }
          return (
            <Animated.View
              key={i}
              style={{
                flex: 1,
                height: h,
                borderRadius: 6,
                backgroundColor: i === highlight ? C.volt : C.line2,
                transformOrigin: 'bottom',
                animationName: KF.growY,
                animationDuration: 900,
                animationDelay: i * 40,
                animationFillMode: 'both',
                animationTimingFunction: 'ease-out',
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {labels.map((l, i) => (
          <Txt
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: F.mono,
              fontSize: 10,
              color: i === highlight ? C.volt : forecast && i === forecast.index ? C.ionText : C.muted,
            }}>
            {l}
          </Txt>
        ))}
      </View>
    </View>
  );
}

/** Stacked share bar (bank vs cash etc.). */
export function StackBar({ parts }: { parts: { color: string; share: number }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, height: 10, borderRadius: 6, overflow: 'hidden' }}>
      {parts.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            flex: Math.max(p.share, 0.001),
            backgroundColor: p.color,
            transformOrigin: 'left',
            animationName: KF.growX,
            animationDuration: 900,
            animationDelay: i * 150,
            animationFillMode: 'both',
          }}
        />
      ))}
    </View>
  );
}
