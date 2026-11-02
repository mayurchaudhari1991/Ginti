import { router, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/icon';
import { tap } from '@/components/ui';
import { C } from '@/theme/tokens';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  insights: { icon: 'chart', label: 'Insights' },
  accounts: { icon: 'card', label: 'Accounts' },
  assistant: { icon: 'sparkle', label: 'Ginti AI' },
};

const glow = css.keyframes({
  '0%': { shadowOpacity: 0.55, shadowRadius: 4 },
  '50%': { shadowOpacity: 0, shadowRadius: 18 },
  '100%': { shadowOpacity: 0.55, shadowRadius: 4 },
});

/** Floating glass bar with the add button lifted out of the middle. */
export function TabBar({ state, navigateToTab, insets }: TabBarProps) {
  const routes = state.routes.filter((r) => r.name in ICONS);
  const half = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const meta = ICONS[route.name];
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          tap();
          navigateToTab(route.key);
        }}
        style={styles.tab}>
        <Icon name={meta.icon} size={22} color={focused ? C.volt : C.muted} />
        {focused && <View style={styles.activeDot} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12) + 6 }]}>
      {routes.slice(0, half).map(renderTab)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        onPress={() => {
          tap();
          router.push('/add');
        }}>
        <Animated.View
          style={[
            styles.fab,
            { animationName: glow, animationDuration: 2200, animationIterationCount: 'infinite', animationTimingFunction: 'ease-out' },
          ]}>
          <Icon name="plus" size={26} color={C.ink} strokeWidth={2.4} />
        </Animated.View>
      </Pressable>
      {routes.slice(half).map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(20,22,30,0.96)',
    borderWidth: 1,
    borderColor: C.line2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: C.volt },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: C.volt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: C.volt,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
