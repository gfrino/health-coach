import { getShareExtensionKey } from 'expo-share-intent';

/**
 * Link di sistema: la condivisione da un'altra app apre Health Coach con un URL
 * "…dataUrl=<scheme>ShareKey". Non è una route: si va alla home e il file viene
 * importato da <ShareIntentImporter /> (app/_layout.tsx).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return path.includes(`dataUrl=${getShareExtensionKey()}`) ? '/' : path;
  } catch {
    return '/';
  }
}
