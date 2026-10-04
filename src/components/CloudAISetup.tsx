import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AIError, providerMessage, toAIError, type AIErrorCode } from '@/ai/errors';
import { getApiKey, maskKey, saveApiKey } from '@/ai/keyStore';
import { extractKey, getProvider, PROVIDERS } from '@/ai/registry';
import type { ModelInfo } from '@/ai/types';
import { CLOUD_AI_PROVIDERS, type CloudAIProviderId } from '@/config/settingsSchema';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';
import { GlowBorder } from './GlowBorder';
import { Card } from './Card';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';
import { OptionGroup } from './OptionGroup';
import { TextField } from './TextField';

const MAX_MODELS_SHOWN = 12;
const TEST_TIMEOUT_MS = 15_000;
/** Errori della prova finale che non indicano una chiave sbagliata. */
const SOFT_TEST_ERRORS = new Set<AIErrorCode>(['network', 'server', 'rate_limited', 'unknown']);

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; what: 'models' | 'test' }
  | { kind: 'ok' }
  | { kind: 'error'; code: AIErrorCode; detail: string | null };

/** Servizi AI online (BYOK): provider → guida → chiave → modello → test. */
export function CloudAISetup({
  onConnectedChange,
}: {
  onConnectedChange?: (connected: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const ai = useSettingsStore((s) => s.settings.ai);
  const update = useSettingsStore((s) => s.update);

  const [provider, setProvider] = useState<CloudAIProviderId>(
    ai.provider && ai.provider !== 'device' ? ai.provider : 'gemini',
  );
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState<string | null>(ai.provider === provider ? ai.model : null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const info = PROVIDERS[provider];
  const connected = ai.provider === provider && !!ai.model && !!savedKey && status.kind !== 'error';

  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  // Carica l'eventuale chiave già salvata per il provider selezionato.
  useEffect(() => {
    let active = true;
    getApiKey(provider)
      .then((k) => active && setSavedKey(k))
      .catch(() => active && setSavedKey(null));
    return () => {
      active = false;
    };
  }, [provider]);

  const selectProvider = (id: CloudAIProviderId) => {
    if (id === provider) return;
    setProvider(id);
    setSavedKey(null);
    setModels([]);
    setKeyInput('');
    setStatus({ kind: 'idle' });
    setModel(ai.provider === id ? ai.model : null);
  };

  const activeKey = keyInput.trim() || savedKey || '';
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const verify = async (chosenModel?: string, keyOverride?: string) => {
    const key = keyOverride ?? activeKey;
    if (!key) return;
    const adapter = getProvider(provider);
    try {
      let target = chosenModel ?? model;
      if (!chosenModel) {
        setStatus({ kind: 'working', what: 'models' });
        const list = await adapter.listModels(key);
        if (!list.length) throw new AIError('model_not_found');
        setModels(list);
        if (!target || !list.some((m) => m.id === target)) target = adapter.pickDefaultModel(list);
      }
      if (!target) throw new AIError('model_not_found');
      setModel(target);
      setStatus({ kind: 'working', what: 'test' });
      // La chiave è già confermata dall'elenco dei modelli: la prova di risposta non deve bloccare.
      // Con limite di tempo; problemi di rete o lentezza del modello non impediscono il collegamento.
      try {
        await Promise.race([
          adapter.testConnection(key, target),
          new Promise((_, reject) =>
            setTimeout(() => reject(new AIError('network', 'timeout')), TEST_TIMEOUT_MS),
          ),
        ]);
      } catch (e) {
        const code = toAIError(e).code;
        if (!SOFT_TEST_ERRORS.has(code)) throw e;
      }
      await saveApiKey(provider, key);
      setSavedKey(key.trim());
      setKeyInput('');
      await update({ ai: { provider, model: target } });
      setStatus({ kind: 'ok' });
    } catch (e) {
      const err = toAIError(e);
      setStatus({ kind: 'error', code: err.code, detail: providerMessage(err) });
    }
  };

  const busy = status.kind === 'working';

  /**
   * Legge il codice dagli appunti: dopo "Copy" sulla pagina del provider basta tornare nell'app.
   * `auto`: tentativo silenzioso al ritorno dal browser (nessun messaggio se non c'è un codice).
   */
  const pasteFromClipboard = async (auto: boolean) => {
    setPasteNotice(null);
    let text: string | null = null;
    try {
      text = (await Clipboard.hasStringAsync()) ? await Clipboard.getStringAsync() : null;
    } catch {
      text = null;
    }
    const key = extractKey(provider, text);
    if (!key) {
      // Chiave già inserita (e appunti già svuotati dall'app): nessun avviso che confonde.
      if (!auto && !activeKey) setPasteNotice(t('ai.pasteNothing', { provider: info.name }));
      return;
    }
    setKeyInput(key);
    setPasteNotice(t('ai.pasted'));
    // Il codice non resta negli appunti, dove altre app potrebbero leggerlo.
    await Clipboard.setStringAsync('').catch(() => undefined);
    await verify(undefined, key);
  };

  const openKeysPage = async () => {
    await WebBrowser.openBrowserAsync(info.keysUrl);
    // Il browser integrato si è chiuso: se l'utente ha copiato il codice, lo inseriamo noi.
    await pasteFromClipboard(true);
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <ChipGroup
        label={t('ai.chooseProvider')}
        value={provider}
        onChange={selectProvider}
        options={CLOUD_AI_PROVIDERS.map((id) => ({
          value: id,
          label: PROVIDERS[id].name,
          description: t(`ai.providers.${id}`),
          leading: <BrandLogo id={id} size={36} />,
        }))}
      />

      <Card tone="soft">
        <AppText variant="headline">{t('ai.guideTitle', { provider: info.name })}</AppText>
        {Array.from({ length: info.guideSteps }, (_, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText variant="callout" style={{ fontWeight: '700', minWidth: 18 }}>
              {i + 1}.
            </AppText>
            <AppText variant="callout" style={{ flex: 1 }}>
              {t(`ai.guides.${provider}.${i + 1}` as 'ai.guides.anthropic.1')}
            </AppText>
          </View>
        ))}
        {/* Primo passo: luce che gira intorno al pulsante finché non c'è un codice. */}
        <GlowBorder active={!activeKey}>
          <Button
            // "OpenAI (ChatGPT)" → "OpenAI": il nome sulla pagina delle chiavi.
            label={t('ai.openKeysPage', { provider: info.name.replace(/\s*\(.*\)$/, '') })}
            // Primo passo: ben visibile finché non c'è un codice.
            variant={activeKey ? 'secondary' : 'primary'}
            onPress={openKeysPage}
            accessibilityHint={info.keysUrl}
          />
        </GlowBorder>
        <AppText variant="caption" tone="textMuted">
          {t('ai.billingNote')}
        </AppText>
      </Card>

      <TextField
        label={t('ai.apiKey')}
        value={keyInput}
        onChangeText={(v) => {
          setKeyInput(v);
          if (status.kind === 'error') setStatus({ kind: 'idle' });
        }}
        placeholder={savedKey ? maskKey(savedKey) : info.keyHint}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        hint={savedKey ? t('ai.keySavedHint') : t('ai.keyHint')}
        error={
          status.kind === 'error'
            ? [
                t(`ai.errors.${status.code}`),
                // Messaggio originale del provider: aiuta a capire il problema (anche da uno screenshot).
                status.detail ? t('ai.errorDetail', { detail: status.detail }) : null,
              ]
                .filter(Boolean)
                .join('\n')
            : null
        }
      />

      <Button
        label={t('ai.paste')}
        variant="secondary"
        onPress={() => pasteFromClipboard(false)}
        disabled={busy}
      />
      {pasteNotice ? (
        <AppText variant="caption" tone="textMuted" accessibilityLiveRegion="polite">
          {pasteNotice}
        </AppText>
      ) : null}

      <Button
        label={models.length ? t('ai.retest') : t('ai.verify')}
        onPress={() => verify()}
        disabled={!activeKey || busy}
        loading={busy}
      />
      {busy ? (
        <AppText variant="caption" tone="textMuted" align="center" accessibilityLiveRegion="polite">
          {status.what === 'models' ? t('ai.loadingModels') : t('ai.testing')}
        </AppText>
      ) : null}

      {status.kind === 'ok' || connected ? (
        <View
          style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}
          accessibilityLiveRegion="polite"
        >
          <Icon name="checkCircle" color={colors.success} />
          <AppText tone="success" style={{ flex: 1 }}>
            {t('ai.connected', { provider: info.name, model: model ?? '' })}
          </AppText>
        </View>
      ) : null}

      {models.length > 0 && model ? (
        <OptionGroup
          label={t('ai.model')}
          value={model}
          onChange={(m) => verify(m)}
          options={[
            ...models.filter((m) => m.id === model),
            ...models.filter((m) => m.id !== model).slice(0, MAX_MODELS_SHOWN - 1),
          ].map((m) => ({ value: m.id, label: m.displayName }))}
        />
      ) : null}
    </View>
  );
}
