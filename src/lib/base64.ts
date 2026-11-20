/** Uint8Array → base64 (a blocchi, per non superare i limiti degli argomenti). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** base64 (anche con il prefisso "data:…;base64,") → Uint8Array. */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^,]*,/, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
