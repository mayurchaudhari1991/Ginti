import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Txt } from '@/components/txt';
import { C, F, R } from '@/theme/tokens';

export const tap = () => Haptics.selectionAsync().catch(() => {});

export function Screen({
  children,
  scroll = true,
  bottomInset = 120,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }, style]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, tone = 'plain' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'plain' | 'ai' | 'sunk' }) {
  return <View style={[styles.card, tone === 'ai' && styles.cardAi, tone === 'sunk' && styles.cardSunk, style]}>{children}</View>;
}

export function IconButton({
  icon,
  onPress,
  label,
  color = C.text,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, style]}>
      <Icon name={icon} size={18} color={color} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'ai' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' || variant === 'ai' ? C.ink : variant === 'danger' ? C.danger : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: C.volt },
        variant === 'ai' && { backgroundColor: C.ion },
        variant === 'ghost' && { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line2 },
        variant === 'danger' && { borderWidth: 1, borderColor: '#3A2020' },
        (disabled || busy) && { opacity: 0.5 },
        pressed && styles.pressed,
        style,
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Txt style={{ fontFamily: F.semibold, fontSize: 15, color: fg }}>{title}</Txt>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, dot }: { label: string; active?: boolean; onPress?: () => void; dot?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
      <Txt style={{ fontFamily: active ? F.semibold : F.body, fontSize: 13, color: active ? C.ink : C.text2 }}>{label}</Txt>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.segment, on && { backgroundColor: C.text }]}>
            <Txt style={{ fontFamily: on ? F.semibold : F.body, fontSize: 13, color: on ? C.ink : C.text2 }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="title" style={{ fontSize: 15 }}>
        {title}
      </Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={12}>
          <Txt style={{ fontSize: 13, color: C.volt }}>{action}</Txt>
        </Pressable>
      )}
    </View>
  );
}

export function CategoryBadge({ color, icon, size = 40 }: { color: string; icon: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={(icon in ICONS ? icon : 'dot') as IconName} size={size * 0.48} color={color} />
    </View>
  );
}

const ICONS: Record<string, true> = { food: true, home: true, bag: true, bus: true, bolt: true, heart: true, game: true, wallet: true, dot: true, cash: true, bank: true, card: true };

export function Empty({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={24} color={C.volt} />
      </View>
      <Txt variant="title">{title}</Txt>
      <Txt variant="small" style={{ textAlign: 'center', lineHeight: 18 }}>
        {body}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.ink },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.xl, padding: 18 },
  cardAi: { backgroundColor: C.ionBg, borderColor: C.ionLine },
  cardSunk: { backgroundColor: C.ink2 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  button: { height: 54, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive: { backgroundColor: C.volt },
  chipIdle: { borderWidth: 1, borderColor: C.line2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  segment: { height: 36, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.voltBg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
