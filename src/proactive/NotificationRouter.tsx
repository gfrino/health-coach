import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Notifiche proattive: mostrate anche con l'app aperta; toccandole si apre una nuova chat
 * con il coach, che risponde subito alla domanda legata alla notifica.
 */
export function NotificationRouter() {
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      const open = (data: Record<string, unknown> | undefined) => {
        const ask = typeof data?.ask === 'string' ? data.ask : null;
        if (!ask) return;
        router.navigate({ pathname: '/coach', params: { new: String(Date.now()), ask } });
      };
      // App aperta da una notifica mentre era chiusa.
      void Notifications.getLastNotificationResponseAsync().then((r) => {
        if (r) {
          open(r.notification.request.content.data);
          void Notifications.clearLastNotificationResponseAsync();
        }
      });
      sub = Notifications.addNotificationResponseReceivedListener((r) => {
        open(r.notification.request.content.data);
        void Notifications.clearLastNotificationResponseAsync();
      });
    } catch {
      // modulo non disponibile (test)
    }
    return () => sub?.remove();
  }, []);
  return null;
}
