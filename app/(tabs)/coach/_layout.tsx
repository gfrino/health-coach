import { Stack } from 'expo-router/stack';

import { TabStack } from '@/components/TabStack';

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
