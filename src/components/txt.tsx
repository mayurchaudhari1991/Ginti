import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { C, F } from '@/theme/tokens';

type Variant = 'hero' | 'display' | 'title' | 'body' | 'medium' | 'strong' | 'small' | 'label' | 'mono';

export type TxtProps = TextProps & { variant?: Variant; color?: string };

const DISPLAY_FONTS: string[] = [F.display, F.displayBold];

export function Txt({ variant = 'body', color, style, ...rest }: TxtProps) {
  const flat: TextStyle = StyleSheet.flatten([styles[variant], color ? { color } : null, style]) ?? {};
  // A size bumped above the variant's without a matching line height gets its glyphs clipped on
  // Android (cut-off "91%", commas that look like full stops). Give every size room for its glyphs;
  // Unbounded's tall caps need more than the body font.
  const cramped = !!flat.fontSize && (!flat.lineHeight || flat.lineHeight < flat.fontSize * 1.15);
  const ratio = DISPLAY_FONTS.includes(flat.fontFamily ?? '') ? 1.3 : 1.35;
  return <Text style={cramped ? { ...flat, lineHeight: Math.ceil(flat.fontSize! * ratio) } : flat} {...rest} />;
}

const styles = StyleSheet.create({
  hero: { fontFamily: F.display, fontSize: 32, letterSpacing: -1, color: C.text },
  display: { fontFamily: F.display, fontSize: 24, letterSpacing: -0.7, color: C.text },
  title: { fontFamily: F.semibold, fontSize: 16, color: C.text },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.text },
  medium: { fontFamily: F.medium, fontSize: 14, color: C.text },
  strong: { fontFamily: F.semibold, fontSize: 14, color: C.text },
  small: { fontFamily: F.body, fontSize: 12, color: C.muted },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.1, color: C.muted },
  mono: { fontFamily: F.mono, fontSize: 11, color: C.muted },
});
