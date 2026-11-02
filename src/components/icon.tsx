import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { C } from '@/theme/tokens';

export type IconName =
  | 'home' | 'chart' | 'plus' | 'card' | 'sparkle' | 'bell' | 'chevron-down' | 'chevron-right'
  | 'close' | 'back' | 'arrow' | 'scan' | 'fingerprint' | 'face' | 'lock' | 'settings' | 'send'
  | 'mic' | 'bank' | 'cash' | 'food' | 'bus' | 'bag' | 'bolt' | 'heart' | 'game' | 'wallet' | 'dot'
  | 'check' | 'sync' | 'user' | 'calendar' | 'target' | 'repeat' | 'logout'
  | 'gift' | 'book' | 'plane' | 'phone' | 'paw' | 'coffee' | 'shirt' | 'school' | 'trash';

/** Icons a category can use, in picker order. */
export const CATEGORY_ICONS: IconName[] = ['food', 'coffee', 'home', 'bag', 'shirt', 'bus', 'plane', 'bolt', 'phone', 'heart', 'game', 'gift', 'book', 'school', 'paw', 'wallet', 'cash', 'card', 'bank', 'dot'];

export const isIconName = (name: string): name is IconName => name in PATHS;

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

/** Stroke icons drawn on a 24px grid, matching the design canvas. */
export function Icon({ name, size = 20, color = C.text, strokeWidth = 1.8 }: Props) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {PATHS[name](p)}
    </Svg>
  );
}

type P = { stroke: string; strokeWidth: number; strokeLinecap: 'round'; strokeLinejoin: 'round'; fill: string };

const PATHS: Record<IconName, (p: P) => ReactNode> = {
  home: (p) => <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  chart: (p) => <Path {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  plus: (p) => <Path {...p} d="M12 5v14M5 12h14" />,
  card: (p) => (<><Rect {...p} x={2.5} y={5} width={19} height={14} rx={3} /><Path {...p} d="M2.5 10h19M6.5 15h4" /></>),
  sparkle: (p) => (<><Path {...p} d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><Path {...p} d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>),
  bell: (p) => (<><Path {...p} d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path {...p} d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  'chevron-down': (p) => <Path {...p} d="m6 9 6 6 6-6" />,
  'chevron-right': (p) => <Path {...p} d="m9 6 6 6-6 6" />,
  close: (p) => <Path {...p} d="M6 6l12 12M18 6 6 18" />,
  back: (p) => <Path {...p} d="M19 12H5M11 6l-6 6 6 6" />,
  arrow: (p) => <Path {...p} d="M5 12h14M13 6l6 6-6 6" />,
  scan: (p) => <Path {...p} d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />,
  fingerprint: (p) => (
    <>
      <Path {...p} d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <Path {...p} d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <Path {...p} d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <Path {...p} d="M2 12a10 10 0 0 1 18-6" />
      <Path {...p} d="M2 16h.01" />
      <Path {...p} d="M21.8 16c.2-2 .131-5.354 0-6" />
      <Path {...p} d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <Path {...p} d="M8.65 22c.21-.66.45-1.32.57-2" />
      <Path {...p} d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </>
  ),
  face: (p) => <Path {...p} d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />,
  lock: (p) => (<><Rect {...p} x={4} y={10} width={16} height={11} rx={2.5} /><Path {...p} d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
  settings: (p) => (<><Circle {...p} cx={12} cy={12} r={3} /><Path {...p} d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
  send: (p) => <Path {...p} d="M5 12h14M13 6l6 6-6 6" />,
  mic: (p) => (<><Rect {...p} x={9} y={3} width={6} height={11} rx={3} /><Path {...p} d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  bank: (p) => <Path {...p} d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />,
  cash: (p) => (<><Rect {...p} x={2.5} y={6} width={19} height={12} rx={2.5} /><Circle {...p} cx={12} cy={12} r={2.5} /><Path {...p} d="M6 9.5v5M18 9.5v5" /></>),
  food: (p) => <Path {...p} d="M4 3v8a3 3 0 0 0 3 3v7M7 3v6M10 3v8a3 3 0 0 1-3 3M17 21V3c-2 1-3 4-3 7s1 4 3 4" />,
  bus: (p) => (<><Rect {...p} x={4} y={3} width={16} height={14} rx={3} /><Path {...p} d="M4 11h16M8 21l-1.5-4M16 21l1.5-4M8 14h.01M16 14h.01" /></>),
  bag: (p) => <Path {...p} d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2" />,
  bolt: (p) => <Path {...p} d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  heart: (p) => <Path {...p} d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />,
  game: (p) => (<><Rect {...p} x={3} y={6} width={18} height={12} rx={4} /><Path {...p} d="M8 10v4M6 12h4M15 11h.01M17 13h.01" /></>),
  wallet: (p) => (<><Path {...p} d="M3 7a2 2 0 0 1 2-2h12v4" /><Rect {...p} x={3} y={7} width={18} height={13} rx={2.5} /><Path {...p} d="M16 13.5h.01" /></>),
  dot: (p) => <Circle {...p} cx={12} cy={12} r={4} />,
  check: (p) => <Path {...p} d="m5 12 5 5 9-10" />,
  sync: (p) => <Path {...p} d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8M18 2v4h-4M6 22v-4h4" />,
  user: (p) => (<><Circle {...p} cx={12} cy={8} r={4} /><Path {...p} d="M4 21a8 8 0 0 1 16 0" /></>),
  calendar: (p) => (<><Rect {...p} x={3} y={5} width={18} height={16} rx={3} /><Path {...p} d="M3 10h18M8 3v4M16 3v4" /></>),
  target: (p) => (<><Circle {...p} cx={12} cy={12} r={9} /><Circle {...p} cx={12} cy={12} r={5} /><Circle {...p} cx={12} cy={12} r={1} /></>),
  repeat: (p) => <Path {...p} d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />,
  logout: (p) => <Path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  gift: (p) => (<><Rect {...p} x={3} y={8} width={18} height={4} rx={1} /><Path {...p} d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>),
  book: (p) => <Path {...p} d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20" />,
  plane: (p) => <Path {...p} d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
  phone: (p) => (<><Rect {...p} x={7} y={2} width={10} height={20} rx={2} /><Path {...p} d="M11 18h2" /></>),
  paw: (p) => (<><Circle {...p} cx={11} cy={4} r={2} /><Circle {...p} cx={18} cy={8} r={2} /><Circle {...p} cx={20} cy={16} r={2} /><Path {...p} d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.05Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" /></>),
  coffee: (p) => <Path {...p} d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />,
  shirt: (p) => <Path {...p} d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />,
  school: (p) => <Path {...p} d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5" />,
  trash: (p) => <Path {...p} d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />,
};
