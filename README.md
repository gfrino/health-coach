# Health Coach

App mobile (iOS + Android) che legge i dati da Apple Health / Health Connect e li mette a disposizione di un coach AI personale (BYOK). **Tutti i dati di salute restano sul dispositivo**, in un database SQLite cifrato con SQLCipher.

Stack: Expo SDK 57 · React Native 0.86 · TypeScript strict · Expo Router · Zustand · Zod · i18next (it / en / de / fr).

## Requisiti

- Node 24+ (testato con 26)
- Account Expo + `npx eas-cli@latest login` per le build cloud
- Per le build locali: Xcode (con runtime del simulatore iOS) e/o Android Studio

> Non si usa Expo Go: l'app ha moduli nativi (HealthKit, Health Connect, SQLCipher). Serve una **development build**.

## Avvio

```bash
npm install
cp .env.example .env.local        # opzionale in locale
npx expo run:ios                  # build locale + simulatore (HealthKit funziona anche su simulatore)
npx expo run:android              # build locale + emulatore/dispositivo (API 26+)
```

Oppure con EAS:

```bash
npx eas-cli@latest init           # crea il progetto EAS e imposta EAS_PROJECT_ID
npm run build:dev:ios             # profilo "development" (dispositivo fisico)
npm run build:dev:android
npm start                         # Metro per la dev build installata
```

Profili in `eas.json`: `development`, `development-simulator`, `preview`, `production`. La variante (`APP_VARIANT`) cambia bundle id (`.dev`, `.preview`) e nome, così le build possono convivere sul telefono.

## Script

| Comando | Cosa fa |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (config Expo + Prettier) |
| `npm run format` | Prettier |
| `npm test` | Jest (migrazioni e repository girano su SQLite reale via `node:sqlite`) |
| `npm run doctor` | `expo-doctor` |

## Struttura

```
app/                Route Expo Router (onboarding, (tabs)/coach|today|journal|records|settings)
src/sources         Adapter delle sorgenti (interfaccia comune in types.ts)
src/integrations    Catalogo integrazioni (Fase 4)
src/ai              Adapter provider AI (interfaccia in types.ts, implementazioni in Fase 2)
src/coach           Contesto, memoria, prompt, sicurezza, soglie
src/db              Apertura DB cifrato, chiave, migrazioni versionate, repository
src/billing         Predisposto, disattivato da feature flag
src/notifications   Notifiche locali e background task (Fase 6)
src/components      Componenti UI accessibili e tematizzati
src/theme           Token, tema chiaro/scuro, verifica contrasto AA
src/i18n            i18next + traduzioni
src/config          Schema impostazioni, env, feature flag
backend/            Backend minimale per dati NON sanitari (Fase 8)
```

Le cartelle `ios/` e `android/` sono generate (CNG, `npx expo prebuild`) e non versionate: tutta la configurazione nativa sta in `app.config.ts` e nei config plugin.

## Sicurezza dei dati (Fase 1)

- Chiave del DB: 256 bit casuali generati sul dispositivo, salvati in SecureStore con `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (disponibile ai task in background, mai sincronizzata su iCloud o su altri dispositivi).
- DB aperto con `PRAGMA key` raw; se la chiave non corrisponde l'app mostra una schermata di recupero (riprova / azzera dati locali).
- Android: `allowBackup=false`. I referti (Fase 5) verranno salvati come BLOB dentro il DB cifrato, quindi nessun file in chiaro su disco.
- Impostazioni → Informazioni mostra la versione di SQLCipher attiva: se compare "NON cifrato" la build non è configurata correttamente.
