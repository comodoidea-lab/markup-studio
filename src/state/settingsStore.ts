import { create } from "zustand";
import { useWorkersAI } from "../ai/config";
import type { AIProvider, AISettings } from "./types";

const STORAGE_KEY = "markup-ai-settings";
const SESSION_KEYS_KEY = "markup-ai-session-keys";

const DEFAULTS: AISettings = {
  provider: "anthropic",
  keys: { anthropic: "", openai: "", gemini: "" },
  models: {
    anthropic: "claude-sonnet-4-5",
    openai: "gpt-4o",
    gemini: "gemini-2.5-flash",
  },
};

interface StoredSettings extends AISettings {
  persistKeys: boolean;
}

function loadSettings(): StoredSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored) return { ...DEFAULTS, persistKeys: true };
    const persistKeys = stored.persistKeys !== false;
    let keys = { ...DEFAULTS.keys, ...stored.keys };
    if (!persistKeys) {
      const sessionKeys = JSON.parse(sessionStorage.getItem(SESSION_KEYS_KEY) || "null");
      keys = { ...DEFAULTS.keys, ...(sessionKeys || {}) };
    }
    return {
      provider: stored.provider ?? DEFAULTS.provider,
      keys,
      models: { ...DEFAULTS.models, ...stored.models },
      persistKeys,
    };
  } catch {
    return { ...DEFAULTS, persistKeys: true };
  }
}

interface SettingsState extends StoredSettings {
  settingsOpen: boolean;
  setProvider: (provider: AIProvider) => void;
  setKey: (provider: AIProvider, key: string) => void;
  setModel: (provider: AIProvider, model: string) => void;
  setPersistKeys: (persist: boolean) => void;
  openSettings: (open: boolean) => void;
  hasKey: () => boolean;
  /** Workers AI backend or BYOK API key is available. */
  canUseAI: () => boolean;
}

function persist(state: StoredSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      provider: state.provider,
      models: state.models,
      persistKeys: state.persistKeys,
      keys: state.persistKeys ? state.keys : { anthropic: "", openai: "", gemini: "" },
    }),
  );
  if (state.persistKeys) {
    sessionStorage.removeItem(SESSION_KEYS_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEYS_KEY, JSON.stringify(state.keys));
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadSettings(),
  settingsOpen: false,
  setProvider: (provider) => {
    set({ provider });
    persist(get());
  },
  setKey: (provider, key) => {
    set({ keys: { ...get().keys, [provider]: key } });
    persist(get());
  },
  setModel: (provider, model) => {
    set({ models: { ...get().models, [provider]: model } });
    persist(get());
  },
  setPersistKeys: (persistKeys) => {
    set({ persistKeys });
    persist(get());
  },
  openSettings: (settingsOpen) => set({ settingsOpen }),
  hasKey: () => Boolean(get().keys[get().provider]),
  canUseAI: () => useWorkersAI() || Boolean(get().keys[get().provider]),
}));
