import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

/**
 * KeyboardAvoidingView che calcola da solo l'offset: KeyboardAvoidingView confronta la
 * tastiera (coordinate dello schermo) con il proprio layout (relativo al genitore), quindi
 * serve la distanza del genitore dal bordo superiore dello schermo (header, barra di stato).
 * Misurandola si evita un valore fisso che cambia con dispositivo, header e Dynamic Type.
 */
export function KeyboardAvoider({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);
  const [offset, setOffset] = useState(0);

  // Il KeyboardAvoidingView sta a y=0 dentro questo contenitore: l'offset è la sua posizione
  // nella finestra.
  const onLayout = () => {
    ref.current?.measureInWindow((_x, windowY) => {
      const next = Math.max(0, Math.round(windowY));
      setOffset((cur) => (cur === next ? cur : next));
    });
  };

  if (Platform.OS !== 'ios') return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <View ref={ref} style={{ flex: 1 }} onLayout={onLayout}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={offset}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}
