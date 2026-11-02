import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Spin } from '@/components/motion';
import { Txt } from '@/components/txt';
import { C, F } from '@/theme/tokens';

const G_PATH = 'M84.5 39.4 A32 32 0 1 0 92 60 H63';
const G_LENGTH = 210;

const AnimatedPath = Animated.createAnimatedComponent(Path);

type GMarkProps = {
  size?: number;
  color?: string;
  coin?: string;
  /** Draw the G stroke in when it mounts. */
  draw?: boolean;
  /** Send the coin around the G instead of resting at the top right. */
  orbitCoin?: boolean;
};

/** The Ginti mark: an open orbit forming a G, with a coin breaking free. */
export function GMark({ size = 48, color = C.volt, coin = C.ion, draw = false, orbitCoin = false }: GMarkProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {draw ? (
          <AnimatedPath
            d={G_PATH}
            fill="none"
            stroke={color}
            strokeWidth={13}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[G_LENGTH, G_LENGTH]}
            animatedProps={{
              animationName: { from: { strokeDashoffset: G_LENGTH }, to: { strokeDashoffset: 0 } },
              animationDuration: 1200,
              animationFillMode: 'both',
              animationTimingFunction: 'ease-out',
            }}
          />
        ) : (
          <Path d={G_PATH} fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {!orbitCoin && <Circle cx={99} cy={22} r={7.5} fill={coin} />}
      </Svg>
      {orbitCoin && (
        <Spin duration={2600} style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size} viewBox="0 0 120 120">
            <Circle cx={99} cy={22} r={7.5} fill={coin} />
          </Svg>
        </Spin>
      )}
    </View>
  );
}

/** "ginti" set in Unbounded with the coin as its full stop; also the app icon (option H). */
export function Wordmark({ size = 52, color = C.text, coin = C.volt }: { size?: number; color?: string; coin?: string }) {
  const dot = Math.max(6, size * 0.17);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Txt style={{ fontFamily: F.displayBold, fontSize: size, letterSpacing: -size * 0.04, lineHeight: size * 1.15, color }}>
        ginti
      </Txt>
      <View style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: coin, marginLeft: size * 0.05, marginBottom: size * 0.24 }} />
    </View>
  );
}

type Planet = { angle: number; size: number; color: string };
type Ring = { r: number; duration: number; reverse?: boolean; dashed?: boolean; stroke?: string; arc?: string; planets?: Planet[] };

/** Concentric rotating rings with category-coloured planets: the signature backdrop. */
export function OrbitField({ size, rings }: { size: number; rings: Ring[] }) {
  const c = size / 2;
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      {rings.map((ring, i) => (
        <Spin key={i} duration={ring.duration} reverse={ring.reverse} style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size}>
            <Circle
              cx={c}
              cy={c}
              r={ring.r}
              fill="none"
              stroke={ring.stroke ?? C.line2}
              strokeWidth={1}
              strokeDasharray={ring.dashed ? [2, 7] : undefined}
            />
            {ring.arc && (
              <Circle
                cx={c}
                cy={c}
                r={ring.r}
                fill="none"
                stroke={ring.arc}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={[ring.r * 1.1, ring.r * 6]}
              />
            )}
            {ring.planets?.map((p, j) => {
              const a = (p.angle * Math.PI) / 180;
              return <Circle key={j} cx={c + ring.r * Math.cos(a)} cy={c + ring.r * Math.sin(a)} r={p.size} fill={p.color} />;
            })}
          </Svg>
        </Spin>
      ))}
    </View>
  );
}

/** The default orbit set used on splash, sign-in and unlock. */
export function defaultRings(size: number): Ring[] {
  const s = size / 320;
  return [
    { r: 150 * s, duration: 22000, dashed: true, planets: [{ angle: -90, size: 6, color: '#FF8A4C' }, { angle: 168, size: 4, color: '#FFD23F' }] },
    { r: 118 * s, duration: 14000, reverse: true, planets: [{ angle: 0, size: 5, color: '#4CC9FF' }, { angle: 135, size: 6, color: '#FF5FA2' }] },
    { r: 86 * s, duration: 8000, arc: C.volt, planets: [{ angle: -45, size: 4, color: '#3DDC97' }] },
  ];
}
