import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useTranslation } from 'react-i18next';

import { Markdown, Screen } from '@/components';
import { resolveLanguage, deviceLanguageCodes } from '@/i18n';
import { LEGAL_DOCS, legalDocument, type LegalDoc } from '@/legal';
import { useSettingsStore } from '@/store/settingsStore';

/** Termini, privacy, avvertenze e impressum: testi inclusi nell'app, leggibili anche offline. */
export default function LegalScreen() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const language = useSettingsStore((s) =>
    resolveLanguage(s.settings.language, deviceLanguageCodes()),
  );
  const which: LegalDoc = (LEGAL_DOCS as readonly string[]).includes(doc)
    ? (doc as LegalDoc)
    : 'terms';
  // Il titolo è già nell'header: il documento parte dal primo paragrafo.
  const body = legalDocument(which, language).replace(/^# .*\n+/, '');
  return (
    <>
      <Stack.Screen options={{ title: t(`legal.${which}`) }} />
      <Screen>
        <Markdown>{body}</Markdown>
      </Screen>
    </>
  );
}
