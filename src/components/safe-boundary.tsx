import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Txt } from '@/components/txt';
import { Button } from '@/components/ui';
import { C } from '@/theme/tokens';

/** The themed screen shown instead of a crash. */
export function CrashScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#3A1518', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bolt" size={28} color={C.danger} />
      </View>
      <Txt variant="display" style={{ textAlign: 'center' }}>
        Something went wrong
      </Txt>
      <Txt style={{ color: C.muted, textAlign: 'center', lineHeight: 20 }}>Your data is safe. Try again, and if it keeps happening, tell us what you tapped.</Txt>
      <Txt variant="mono" style={{ textAlign: 'center' }} numberOfLines={3}>
        {message}
      </Txt>
      <Button title="Try again" icon="sync" onPress={onRetry} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </View>
  );
}

/**
 * Catches render errors in its children. With `fallback="hide"` the broken part simply disappears
 * (used for overlays like dialogs) instead of taking the app down.
 */
export class SafeBoundary extends Component<{ children: ReactNode; fallback?: 'screen' | 'hide' }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback === 'hide') {
      // Recover on the next render pass so the overlay works again later.
      setTimeout(() => this.setState({ error: null }), 0);
      return null;
    }
    return <CrashScreen message={this.state.error.message} onRetry={() => this.setState({ error: null })} />;
  }
}
