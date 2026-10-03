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
      const open = async (data: Record<string, unknown> | undefined) => {
        // Check-in del mattino già preparato dal coach: si apre l'analisi completa.
        const checkinId = typeof data?.checkinId === 'string' ? data.checkinId : null;
        if (checkinId) {
          const conversationId = await preparedCheckin(checkinId);
          if (conversationId) {
            router.navigate({ pathname: '/coach', params: { c: conversationId } });
            return;
          }
        }
        const ask = typeof data?.ask === 'string' ? data.ask : null;
        if (!ask) return;
        router.navigate({ pathname: '/coach', params: { new: String(Date.now()), ask } });
      };
      // App aperta da una notifica mentre era chiusa.
      void Notifications.getLastNotificationResponseAsync().then((r) => {
        if (r) {
          void open(r.notification.request.content.data);
          void Notifications.clearLastNotificationResponseAsync();
        }
      });
      sub = Notifications.addNotificationResponseReceivedListener((r) => {
        void open(r.notification.request.content.data);
        void Notifications.clearLastNotificationResponseAsync();
      });
    } catch {
      // modulo non disponibile (test)
    }
    return () => sub?.remove();
  }, []);
  return null;
}

async function preparedCheckin(id: string): Promise<string | null> {
  try {
    const { conversationRepository, getDb, programRepository } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/db') as typeof import('@/db');
    const db = await getDb();
    const c = await programRepository.getCheckin(db, id);
    if (!c?.conversationId) return null;
    return (await conversationRepository.getConversation(db, c.conversationId))
      ? c.conversationId
      : null;
  } catch {
    return null;
  }
}
