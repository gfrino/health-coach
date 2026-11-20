import { Redirect } from 'expo-router';

/** Vecchio indirizzo del profilo: ora è la prima voce del menu laterale (/profile). */
export default function OldProfileRoute() {
  return <Redirect href="/profile" />;
}
