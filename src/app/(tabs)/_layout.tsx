import { Tabs } from 'expo-router';

import { TabBar } from '@/components/tab-bar';
import { C } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.ink }, animation: 'shift' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="accounts" />
      <Tabs.Screen name="assistant" />
    </Tabs>
  );
}
