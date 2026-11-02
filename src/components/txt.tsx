import { StyleSheet, Text, type TextProps } from 'react-native';

import { C, F } from '@/theme/tokens';

type Variant = 'hero' | 'display' | 'title' | 'body' | 'medium' | 'strong' | 'small' | 'label' | 'mono';

export type TxtProps = TextProps & { variant?: Variant; color?: string };

export function Txt({ variant = 'body', color, style, ...rest }: TxtProps) {
  return <Text style={[styles[variant], color ? { color } : null, style]} {...rest} />;
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
