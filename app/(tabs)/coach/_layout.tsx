import { Stack } from 'expo-router/stack';

import { TabStack } from '@/components/TabStack';

/** La chat resta alla base dello stack (es. aprendo la conversazione a voce da una notifica). */
export const unstable_settings = { initialRouteName: 'index' };

/** Chat del coach; la conversazione a voce si apre a schermo intero. */
export default function CoachLayout() {
  return (
    <TabStack>
      <Stack.Screen
        name="voice"
        options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
      />
    </TabStack>
  );
}
