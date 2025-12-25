// Zustand store for API key settings
import { create } from "zustand";
import { getStorage, setStorage } from "@/services/chrome-storage";

interface SettingsState {
  githubToken: string | null;
  openRouterKey: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  load: () => Promise<void>;
  save: (settings: {
    githubToken?: string;
    openRouterKey?: string;
  }) => Promise<void>;
  setGithubToken: (token: string) => void;
  setOpenRouterKey: (key: string) => void;
  hasValidKeys: () => boolean;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  githubToken: null,
  openRouterKey: null,
  isLoading: true,
  isSaving: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getStorage(["githubToken", "openRouterKey"]);
      set({
        githubToken: result.githubToken || null,
        openRouterKey: result.openRouterKey || null,
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
      const updates: Record<string, string> = {};
      if (settings.githubToken !== undefined) {
        updates.githubToken = settings.githubToken;
      }
      if (settings.openRouterKey !== undefined) {
        updates.openRouterKey = settings.openRouterKey;
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

  hasValidKeys: () => {
    const { githubToken, openRouterKey } = get();
    return Boolean(githubToken && openRouterKey);
  },
}));
