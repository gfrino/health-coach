import { Redirect } from 'expo-router';

/** Vecchio indirizzo della scelta dell'AI: ora è una voce del menu laterale (/ai). */
export default function OldAIRoute() {
  return <Redirect href="/ai" />;
}
