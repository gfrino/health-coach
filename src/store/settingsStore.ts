import { create } from 'zustand';

import {
  getDefaultSettings,
  ONBOARDING_FLOW_VERSION,
  type AppSettings,
} from '@/config/settingsSchema';
import { getDb, settingsRepository } from '@/db';
import { initI18n } from '@/i18n';

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: (region?: string | null) => Promise<void>;
  /** Aggiornamento ottimistico: UI subito, poi persistenza nel DB cifrato (rollback in caso di errore). */
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: getDefaultSettings(),
  hydrated: false,

  hydrate: async (region) => {
    const db = await getDb();
    let settings = await settingsRepository.loadSettings(db, region);
    // Onboarding completato con una versione precedente del flusso: riprende dai passi nuovi.
    if (settings.onboardingCompleted && settings.onboardingFlowVersion < ONBOARDING_FLOW_VERSION) {
      const patch = {
        onboardingCompleted: false,
        onboardingStep: settings.medicalDisclaimerAcceptedAt ? 1 : 0,
      } satisfies Partial<AppSettings>;
      await settingsRepository.saveSettings(db, patch);
      settings = { ...settings, ...patch };
    }
    await initI18n(settings.language);
    set({ settings, hydrated: true });
  },

  update: async (patch) => {
    const previous = get().settings;
    set({ settings: { ...previous, ...patch } });
    try {
      const db = await getDb();
      await settingsRepository.saveSettings(db, patch);
      if (patch.language) await initI18n(patch.language);
    } catch (e) {
      set({ settings: previous });
      throw e;
    }
  },
}));
