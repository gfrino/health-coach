import { createContext, useContext, type RefObject } from 'react';
import type { View } from 'react-native';

/**
 * Porta in vista un elemento dentro lo ScrollView di `Screen` (es. il prossimo passo da fare).
 * Fuori da uno `Screen` scorrevole non fa nulla.
 */
export type ScrollIntoView = (target: RefObject<View | null>, options?: { offset?: number }) => void;

export const ScrollIntoViewContext = createContext<ScrollIntoView>(() => undefined);

export function useScrollIntoView(): ScrollIntoView {
  return useContext(ScrollIntoViewContext);
}
