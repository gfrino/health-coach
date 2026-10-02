import { DEVELOPER as D, LEGAL_UPDATED, type LegalDoc } from '../developer';

/** Legal documents (EN). Keep aligned with it.ts (the reference version). */
const contact = `${D.name}, ${D.street}, ${D.city}, ${D.country.en} · ${D.email}`;

export const en: Record<LegalDoc, string> = {
  terms: `# Terms and conditions

Last updated: ${LEGAL_UPDATED}

## 1. Who we are
The Healthas app is developed and distributed by ${contact} ("we"). By using the app you accept these terms.

## 2. What the app is
Healthas is a personal wellness coach: it reads the data you choose to share (Apple Health or Health Connect, profile, journal, documents), keeps it encrypted on your phone and gives you lifestyle, sleep, activity and nutrition advice with the help of artificial intelligence.

**Healthas is not a medical device and does not provide diagnoses, treatments or medical advice.** Please also read the **Legal disclaimer**.

## 3. Requirements
- You must be at least 16 years old.
- You are responsible for the accuracy of the data you enter and for using the app properly.

## 4. Artificial intelligence and third-party services
- By default the app uses your phone's AI (Apple Intelligence or Gemini Nano), which runs on the device.
- If you choose an online AI service (OpenAI, Anthropic, Google), the app contacts it directly from your phone with **your** access key. Your relationship with that service is governed by its terms; any costs are charged by that provider to your account. We are not responsible for the availability, costs or answers of third-party services.
- Keep your access key safe: it is stored encrypted on your phone and we never receive it.
- AI answers can be incomplete or wrong: always assess them critically.

## 5. Permitted use
You may use the app for personal purposes. You may not use it to provide healthcare services to others, circumvent its protections, decompile it beyond what the law allows, or use it unlawfully.

## 6. Intellectual property
The app, its code, design and content belong to ${D.name} or their respective owners. Third-party trademarks (e.g. Apple Health, OpenAI, Anthropic, Google, Withings) belong to their owners and are mentioned only to indicate compatibility.

## 7. Availability and changes
We may update, change or discontinue the app or individual features. Features marked "coming soon" are not guaranteed.

## 8. Liability
To the extent permitted by Swiss law, we exclude all liability for damages arising from the use of the app, AI answers or third-party services, except in cases of intent or gross negligence. Mandatory consumer rights remain unaffected.

## 9. Changes to these terms
We may change these terms; the current version is always available in the app. By continuing to use the app after a change, you accept the new terms.

## 10. Governing law and jurisdiction
Swiss law applies. Place of jurisdiction: Locarno, subject to mandatory consumer jurisdictions.

## Contact
${contact}
`,

  privacy: `# Privacy policy

Last updated: ${LEGAL_UPDATED}

## The principle
**Your health data stays on your phone.** Healthas has no server for health data: we do not receive it, see it or sell it. No advertising, no profiling, no analytics or tracking tools.

## Controller
${contact}. The Swiss Federal Act on Data Protection (FADP) applies and, for users in the EU/EEA, the GDPR.

## What data the app processes (on your phone)
- **Health data** you authorise from Apple Health or Health Connect (e.g. steps, sleep, heart rate, weight, workouts).
- **Profile**: name, age, height, goals, conditions, medications and allergies you enter.
- **Journal**: mood, energy, symptoms and notes (written by you or noted by the coach at your request).
- **Documents**: reports, lab results and photos you add or share with the app.
- **Conversations** with the coach.

They are stored in an **encrypted** database (SQLCipher, AES-256) on the device; the key is kept in the system's protected keychain and never leaves the phone. Automatic cloud backup of this data is disabled.

## When data leaves your phone
Only in the following cases, and always directly from your phone to the service you chose (never through us):

1. **Online AI** (OpenAI, Anthropic, Google), only if you turn it on: with each question the app sends your message, a summary of the relevant data (e.g. sleep and step averages) and any attachments. The provider processes them under its own privacy policy; its servers may be located outside Switzerland and the EU (e.g. in the USA). With OpenAI we ask for conversations not to be stored (\`store: false\`). With the **phone's AI** (the default) nothing leaves the device.
2. **Voice**: transcription happens on the phone when possible; otherwise Apple's or Google's speech service is used. In the **voice conversation with OpenAI**, audio is streamed to OpenAI in real time.
3. **Sharing and exporting** that you start (e.g. opening a document in another app).

## Permissions
Health, microphone, speech recognition, camera and photos are requested only when needed, and you can revoke them at any time in your phone's settings.

## Retention and deletion
Data stays as long as you keep it. You can delete individual items in the app; uninstalling the app deletes the encrypted database. Data held by AI providers is subject to their retention policies.

## Your rights
You have the right of access, rectification, erasure, restriction, portability and objection. Since the data is on your device, you can exercise most of these rights directly in the app. Questions: ${D.email}. You can also contact the Swiss Federal Data Protection and Information Commissioner (FDPIC) or the authority in your country.

## Children
The app is not intended for people under 16.

## Changes
We will update this policy if the way data is processed changes; the date at the top shows the latest revision.
`,

  disclaimer: `# Legal disclaimer

Last updated: ${LEGAL_UPDATED}

## Not medical advice
Healthas is a wellness and information app. **It is not a medical device** and does not replace doctors, pharmacists or other healthcare professionals. It does not diagnose, prescribe treatments, and must not be used to make treatment decisions.

## Medications and treatments
Do not start, stop or change medications, supplements or treatments based on the app's suggestions: always talk to your doctor.

## Emergencies
In an emergency call **144** (Switzerland) or **112** (Europe) immediately, or your doctor. Do not use the app for emergencies.

## Artificial intelligence
Suggestions are generated by AI models that can be wrong, incomplete or out of date. Assess them critically.

## Approaches and diets
Non-conventional approaches (e.g. Traditional Chinese Medicine, Ayurveda, naturopathy) and diets (e.g. ketogenic, Healthy Keto, lectin-free, carnivore) are offered as your personal choice and as a complement. Some claims by their authors are not supported by scientific evidence. If you have medical conditions, take medications, or are pregnant or breastfeeding, ask your doctor before changing your diet or starting a fast.

## Data
Measurements depend on the source devices and apps and may contain errors or gaps.

## Trademarks
Apple Health, Apple Intelligence, Health Connect, OpenAI, Anthropic, Google, Gemini, Withings and the other trademarks mentioned belong to their respective owners. Healthas is not affiliated with or endorsed by them.
`,

  impressum: `# Imprint

**${D.name}**
${D.street}
${D.city}
${D.country.en}

Owner: ${D.owner}

Email: ${D.email}
Phone: ${D.phone}
Website: ${D.website}

Business ID (UID): ${D.uid}
Commercial register: ${D.commercialRegister}

## Responsible for content
${D.owner}, address as above.

## Disclaimer
Although the app has been built with care, we do not guarantee that its content is accurate, complete or up to date. Links to third-party websites and services are beyond our control.
`,
};
