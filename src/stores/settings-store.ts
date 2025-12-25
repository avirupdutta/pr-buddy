// Zustand store for API key settings
import { create } from "zustand";
import { getStorage, setStorage } from "@/services/chrome-storage";

interface SettingsState {
  githubToken: string | null;
  openRouterKey: string | null;
  devMode: boolean;
  devPrUrl: string | null;
  theme: "dark" | "light" | "system";
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  load: () => Promise<void>;
  save: (settings: {
    githubToken?: string;
    openRouterKey?: string;
    devMode?: boolean;
    devPrUrl?: string;
    theme?: "dark" | "light" | "system";
  }) => Promise<void>;
  setTheme: (theme: "dark" | "light" | "system") => void;
  setGithubToken: (token: string) => void;
  setOpenRouterKey: (key: string) => void;
  setDevMode: (enabled: boolean) => void;
  setDevPrUrl: (url: string) => void;
  hasValidKeys: () => boolean;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  githubToken: null,
  openRouterKey: null,
  devMode: false,
  devPrUrl: null,
  theme: "system",
  isLoading: true,
  isSaving: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getStorage([
        "githubToken",
        "openRouterKey",
        "devMode",
        "devPrUrl",
        "theme",
      ]);
      set({
        githubToken: result.githubToken || null,
        openRouterKey: result.openRouterKey || null,
        devMode: result.devMode || false,
        devPrUrl: result.devPrUrl || null,
        theme: result.theme || "system",
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to load settings",
        isLoading: false,
      });
    }
  },

  save: async (settings) => {
    set({ isSaving: true, error: null });
    try {
      const updates: Record<string, string | boolean | undefined> = {};
      if (settings.githubToken !== undefined) {
        updates.githubToken = settings.githubToken;
      }
      if (settings.openRouterKey !== undefined) {
        updates.openRouterKey = settings.openRouterKey;
      }
      if (settings.devMode !== undefined) {
        updates.devMode = settings.devMode;
      }
      if (settings.devPrUrl !== undefined) {
        updates.devPrUrl = settings.devPrUrl;
      }
      if (settings.theme !== undefined) {
        updates.theme = settings.theme;
      }

      await setStorage(updates);
      set({
        ...settings,
        isSaving: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to save settings",
        isSaving: false,
      });
    }
  },

  setGithubToken: (token) => set({ githubToken: token }),
  setOpenRouterKey: (key) => set({ openRouterKey: key }),
  setDevMode: (enabled) => set({ devMode: enabled }),
  setDevPrUrl: (url) => set({ devPrUrl: url }),
  setTheme: (theme) => {
    set({ theme });
    get().save({ theme });
  },

  hasValidKeys: () => {
    const { githubToken, openRouterKey } = get();
    return Boolean(githubToken && openRouterKey);
  },
}));
