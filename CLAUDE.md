# Health Coach — development rules

These rules apply to anyone working on the project, human or AI. Also read `AGENTS.md` (Expo/EAS rules). **Add new rules here as they are agreed.**

## Every change to the code

1. **Bump the version** in `app.config.ts` (`version`) and `package.json` (`version`), keeping them identical. Use semver:
   - patch (`1.1.0 → 1.1.1`): fixes, text and small UI changes;
   - minor (`1.1.0 → 1.2.0`): new features;
   - major: only for the store release decided with the owner.
   The iOS build number and Android versionCode are managed by EAS (`autoIncrement`): don't touch them.
2. **Run the checks before declaring it done:** `npx tsc --noEmit`, `npx expo lint`, `npx jest`. All must pass. New logic needs tests (Jest with the `node:sqlite` adapter in `src/test/nodeSqliteDb.ts` for DB code).
3. **Commit and push to GitHub** (`origin main`, repo `gfrino/health-coach`) at the end of every completed change, with a descriptive message in Italian. Never commit `Untitled.af` / `Untitled.af~lock~` (owner's files).
4. **Say whether a new build is needed:**
   - only JavaScript/TypeScript changed → it reaches the phone via Metro reload or an OTA update (`npx eas-cli@latest update --channel development`);
   - native changes (new native library, config plugin, permissions, share extension, entitlements) → new EAS build: `npx eas-cli@latest build --profile development --platform ios`.
5. **Summarize for the owner** what changed and what to test on the phone, in the language they wrote in (usually Italian).

## Product principles (non-negotiable)

- **Privacy first.** Health data stays on the device (SQLCipher DB, key in SecureStore). There is no backend for health data: our servers must never receive it. AI calls go directly from the phone to the provider the user chose. Send only the minimum needed: aggregates, not raw series. OpenAI uses `store: false`.
- **Super simple onboarding for non-technical users.** The default AI needs no account and no key: Apple Intelligence / Gemini Nano on the device, and later Apple Private Cloud Compute. Cloud providers with an API key are an "advanced" option. Never ask end users for extra technical steps (API verification, developer settings…): handle provider quirks silently in the app.
- **Integrations:** OAuth or file import only. Never ask for third-party usernames or passwords.
- **Medical safety:** the coach never diagnoses and never tells users to change medications. The fixed rules in `src/coach/prompts.ts` (`SAFETY_RULES`) always apply. Non-conventional approaches and diets are presented as the user's choice, without stating unproven claims as facts.
- **Legal texts follow the data flows:** whenever data starts leaving the phone in a new way (new provider, backend, push, analytics…), update the privacy policy in `src/legal/content/*.ts` (4 languages) and `LEGAL_UPDATED` in `src/legal/developer.ts` in the same change. Developer/company data lives only in `src/legal/developer.ts`. The legal texts are drafts to be reviewed by a lawyer before store submission.
- **No invented data:** the prompt always says which data is missing. Numbers shown to the model are computed by the app (`src/coach/insights.ts`).

## Code conventions

- Expo SDK 57, React Native 0.86, TypeScript strict, Expo Router (routes in root `app/`; non-route code in `src/`).
- Continuous Native Generation: never edit `ios/` or `android/` (they are git-ignored). Configure native behaviour in `app.config.ts` and config plugins (`plugins/`).
- Install packages with `npx expo install <package>`. Check the versioned Expo docs before using an Expo API (see `AGENTS.md`).
- Comments in Italian, matching the existing code. System prompt texts for the AI are in English; the coach replies in the user's language.
- **i18n:** every UI string goes in `src/i18n/locales/{it,en,de,fr}.json`, with all four languages at parity (a test enforces this). No hard-coded UI text.
- DB schema changes go in a new migration (`src/db/migrations/00N_*.ts`). Never modify a released migration.
- AI providers implement the common `AIProvider` contract (`src/ai/types.ts`). The OpenAI adapter uses the Responses API (`/v1/responses`).
- New diet options need a full guide in `src/coach/diets.ts` plus labels in all four languages.

## Local development

- Metro: `npx expo start --dev-client --port 8082` (8081 is taken by Docker; the owner may use 8083). Don't run Metro with `CI=true`: reloads and logs are disabled.
- Local iOS builds: prefix with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (CocoaPods). The iOS 27 SDK needs `plugins/withIosSceneLifecycle.js` (remove it with SDK 58).
- **iOS permission texts:** never set a `*Permission: false` option on a plugin if another feature uses that permission, because it removes the key for everyone. Apple rejects uploads with a missing purpose string (e.g. `NSHealthUpdateUsageDescription` is required even though the app only reads). Before a store build, verify with `APP_VARIANT=production npx expo prebuild --platform ios --clean --no-install`, then delete `ios/`.
- Bundle id `ch.ticinoweb.healthcoach` (`.dev` / `.preview` variants via `APP_VARIANT`). EAS project `@ticinoweb/health-coach`.
- Never type passwords, API keys or 2FA codes on the owner's behalf: the owner enters them.
