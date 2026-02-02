// Zustand store for API key settings
import { create } from "zustand";
import { getStorage, setStorage } from "@/services/chrome-storage";
import { encryptApiKey, decryptApiKey } from "@/services/encryption";
import type { PRTemplate, AIModel } from "@/types/chrome";
import modelMappings from "@/data/model-mappings.json";

// Default templates based on current hardcoded values
export const DEFAULT_TEMPLATES: PRTemplate[] = [
  {
    id: "default",
    title: "Default",
    structure: `## Describe your changes

## Clickup link

## PR Type

- [ ] Backend
- [ ] Frontend

## Checklist before requesting a review

- [x] I have self-reviewed my code.
- [x] All my code is following Codebuddy Coding Standards and Guidelines.
- [x] I have tested my code.
- [x] My PR title is meaningful and max 60 characters.
- [x] I have made sure only the changes in context of the feature are in this PR.
- [x] I have made sure I am not including any env secrets in this PR.
- [x] I have made sure the PR does not have conflict`,
  },
  {
    id: "bug",
    title: "Bug Fix Report",
    structure: `## Bug Description
What was the bug?

## Root Cause
Why did this bug occur?

## Solution
How was it fixed?

## Testing
How the fix was verified.`,
  },
  {
    id: "feature",
    title: "Feature Implementation",
    structure: `## Feature Overview
What does this feature do?

## Implementation
How was it implemented?

## Usage
How to use this feature.

## Testing
How this was tested.`,
  },
  {
    id: "refactor",
    title: "Code Refactor",
    structure: `## Refactor Overview
What was refactored and why?

## Changes
Key architectural or structural changes.

## Benefits
What improvements does this bring?

## Testing
How this was verified to not break existing functionality.`,
  },
  {
    id: "hotfix",
    title: "Hotfix",
    structure: `## Issue
What critical issue is being fixed?

## Fix
What was done to fix it?

## Impact
What systems/users are affected?

## Testing
Verification steps.`,
  },
];

export const DEFAULT_AI_MODELS: AIModel[] = [];

interface SettingsState {
  githubToken: string | null;
  openRouterKey: string | null;
  // New AI SDK provider keys
  openaiKey: string | null;
  anthropicKey: string | null;
  googleKey: string | null;
  groqKey: string | null;
  cerebrasKey: string | null;
  devMode: boolean;
  devPrUrl: string | null;
  theme: "dark" | "light" | "system";
  templates: PRTemplate[];
  aiModels: AIModel[];
  activePredefinedModelId: string | null; // Stores ID of active predefined model (not in aiModels)
  activePredefinedModelProvider: string | null; // Stores provider of active predefined model
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Settings Onboarding State
  settingsOnboardingCompleted: boolean;
  settingsOnboardingStarted: boolean;
  setSettingsOnboardingCompleted: (completed: boolean) => void;
  setSettingsOnboardingStarted: (started: boolean) => void;

  // Reset Functions
  resetAllOnboarding: () => void;
  resetSettingsOnboarding: () => void;

  // Actions
  load: () => Promise<void>;
  save: (settings: {
    githubToken?: string;
    openRouterKey?: string;
    openaiKey?: string;
    anthropicKey?: string;
    googleKey?: string;
    groqKey?: string;
    cerebrasKey?: string;
    devMode?: boolean;
    devPrUrl?: string;
    theme?: "dark" | "light" | "system";
  }) => Promise<void>;
  setTheme: (theme: "dark" | "light" | "system") => void;
  setGithubToken: (token: string) => void;
  setOpenRouterKey: (key: string) => void;
  setOpenAIKey: (key: string) => void;
  setAnthropicKey: (key: string) => void;
  setGoogleKey: (key: string) => void;
  setGroqKey: (key: string) => void;
  setCerebrasKey: (key: string) => void;
  setDevMode: (enabled: boolean) => void;
  setDevPrUrl: (url: string) => void;
  hasValidKeys: () => boolean;

  // Template CRUD actions
  addTemplate: (template: Omit<PRTemplate, "id">) => Promise<void>;
  updateTemplate: (
    id: string,
    updates: Partial<Omit<PRTemplate, "id">>,
  ) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Model CRUD actions
  addModel: (model: Omit<AIModel, "id" | "isActive">) => Promise<void>;
  updateModel: (
    id: string,
    updates: Partial<Omit<AIModel, "id" | "isActive">>,
  ) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  setActiveModel: (id: string, provider?: string) => Promise<void>;

  // Getters
  getActiveModel: () => AIModel | undefined;
  getTemplateById: (id: string) => PRTemplate | undefined;
  isPredefinedModel: (id: string) => boolean;
}

// Generate unique ID
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  githubToken: null,
  openRouterKey: null,
  openaiKey: null,
  anthropicKey: null,
  googleKey: null,
  groqKey: null,
  cerebrasKey: null,
  devMode: false,
  devPrUrl: null,
  theme: "system",
  templates: DEFAULT_TEMPLATES,
  aiModels: DEFAULT_AI_MODELS,
  activePredefinedModelId: null,
  activePredefinedModelProvider: null,
  isLoading: true,
  isSaving: false,
  error: null,

  // Onboarding State - Settings Tour
  settingsOnboardingCompleted: false,
  settingsOnboardingStarted: false,
  setSettingsOnboardingCompleted: (completed) => {
    set({ settingsOnboardingCompleted: completed });
    setStorage({ settingsOnboardingCompleted: completed });
  },
  setSettingsOnboardingStarted: (started) => {
    set({ settingsOnboardingStarted: started });
    setStorage({ settingsOnboardingStarted: started });
  },

  // Reset Functions
  resetAllOnboarding: () => {
    set({
      settingsOnboardingCompleted: false,
      settingsOnboardingStarted: false,
    });
    setStorage({
      settingsOnboardingCompleted: false,
      settingsOnboardingStarted: false,
    });
  },
  resetSettingsOnboarding: () => {
    set({
      settingsOnboardingCompleted: false,
      settingsOnboardingStarted: false,
    });
    setStorage({
      settingsOnboardingCompleted: false,
      settingsOnboardingStarted: false,
    });
  },

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getStorage([
        "githubToken",
        "openRouterKey",
        "openaiKey",
        "anthropicKey",
        "googleKey",
        "groqKey",
        "cerebrasKey",
        "devMode",
        "devPrUrl",
        "theme",
        "templates",
        "aiModels",
        "activePredefinedModelId",
        "activePredefinedModelProvider",
        "settingsOnboardingCompleted",
        "settingsOnboardingStarted",
      ]);

      // Decrypt API keys
      const decryptedGithubToken = result.githubToken
        ? await decryptApiKey(result.githubToken)
        : null;
      const decryptedOpenRouterKey = result.openRouterKey
        ? await decryptApiKey(result.openRouterKey)
        : null;
      const decryptedOpenAIKey = result.openaiKey
        ? await decryptApiKey(result.openaiKey)
        : null;
      const decryptedAnthropicKey = result.anthropicKey
        ? await decryptApiKey(result.anthropicKey)
        : null;
      const decryptedGoogleKey = result.googleKey
        ? await decryptApiKey(result.googleKey)
        : null;
      const decryptedGroqKey = result.groqKey
        ? await decryptApiKey(result.groqKey)
        : null;
      const decryptedCerebrasKey = result.cerebrasKey
        ? await decryptApiKey(result.cerebrasKey)
        : null;

      set({
        githubToken: decryptedGithubToken,
        openRouterKey: decryptedOpenRouterKey,
        openaiKey: decryptedOpenAIKey,
        anthropicKey: decryptedAnthropicKey,
        googleKey: decryptedGoogleKey,
        groqKey: decryptedGroqKey,
        cerebrasKey: decryptedCerebrasKey,
        devMode: result.devMode || false,
        devPrUrl: result.devPrUrl || null,
        theme: result.theme || "system",
        templates:
          result.templates && result.templates.length > 0
            ? result.templates
            : DEFAULT_TEMPLATES,
        aiModels:
          result.aiModels && result.aiModels.length > 0
            ? result.aiModels
            : DEFAULT_AI_MODELS,
        activePredefinedModelId: result.activePredefinedModelId || null,
        activePredefinedModelProvider:
          result.activePredefinedModelProvider || null,
        // Onboarding state
        settingsOnboardingCompleted: result.settingsOnboardingCompleted || false,
        settingsOnboardingStarted: result.settingsOnboardingStarted || false,
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

      // Encrypt API keys before storing
      if (settings.githubToken !== undefined) {
        updates.githubToken = await encryptApiKey(settings.githubToken);
      }
      if (settings.openRouterKey !== undefined) {
        updates.openRouterKey = await encryptApiKey(settings.openRouterKey);
      }
      if (settings.openaiKey !== undefined) {
        updates.openaiKey = await encryptApiKey(settings.openaiKey);
      }
      if (settings.anthropicKey !== undefined) {
        updates.anthropicKey = await encryptApiKey(settings.anthropicKey);
      }
      if (settings.googleKey !== undefined) {
        updates.googleKey = await encryptApiKey(settings.googleKey);
      }
      if (settings.groqKey !== undefined) {
        updates.groqKey = await encryptApiKey(settings.groqKey);
      }
      if (settings.cerebrasKey !== undefined) {
        updates.cerebrasKey = await encryptApiKey(settings.cerebrasKey);
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
  setOpenAIKey: (key) => set({ openaiKey: key }),
  setAnthropicKey: (key) => set({ anthropicKey: key }),
  setGoogleKey: (key) => set({ googleKey: key }),
  setGroqKey: (key) => set({ groqKey: key }),
  setCerebrasKey: (key) => set({ cerebrasKey: key }),
  setDevMode: (enabled) => set({ devMode: enabled }),
  setDevPrUrl: (url) => set({ devPrUrl: url }),
  setTheme: (theme) => {
    set({ theme });
    get().save({ theme });
  },

  hasValidKeys: () => {
    const {
      githubToken,
      openRouterKey,
      openaiKey,
      anthropicKey,
      googleKey,
      groqKey,
      cerebrasKey,
    } = get();
    return Boolean(
      githubToken &&
        (openRouterKey ||
          openaiKey ||
          anthropicKey ||
          googleKey ||
          groqKey ||
          cerebrasKey),
    );
  },

  // Template CRUD
  addTemplate: async (template) => {
    const newTemplate: PRTemplate = {
      id: generateId(),
      ...template,
    };
    const templates = [...get().templates, newTemplate];
    set({ templates });
    await setStorage({ templates });
  },

  updateTemplate: async (id, updates) => {
    const templates = get().templates.map((t) =>
      t.id === id ? { ...t, ...updates } : t,
    );
    set({ templates });
    await setStorage({ templates });
  },

  deleteTemplate: async (id) => {
    const templates = get().templates.filter((t) => t.id !== id);
    if (templates.length === 0) {
      throw new Error("Cannot delete the last template");
    }
    set({ templates });
    await setStorage({ templates });
  },

  // Model CRUD
  addModel: async (model) => {
    const newModel: AIModel = {
      id: generateId(),
      ...model,
      provider: model.provider || "openrouter", // Default to OpenRouter for backward compatibility
      isActive: false, // New models are not active by default
    };
    const aiModels = [...get().aiModels, newModel];
    set({ aiModels });
    await setStorage({ aiModels });
  },

  updateModel: async (id, updates) => {
    const aiModels = get().aiModels.map((m) =>
      m.id === id
        ? {
            ...m,
            ...updates,
            provider: updates.provider || m.provider || "openrouter",
          }
        : m,
    );
    set({ aiModels });
    await setStorage({ aiModels });
  },

  deleteModel: async (id) => {
    const currentModels = get().aiModels;
    const modelToDelete = currentModels.find((m) => m.id === id);

    if (currentModels.length <= 1) {
      throw new Error("Cannot delete the last model");
    }

    let aiModels = currentModels.filter((m) => m.id !== id);

    // If we're deleting the active model, make the first remaining one active
    if (modelToDelete?.isActive && aiModels.length > 0) {
      aiModels = aiModels.map((m, index) =>
        index === 0 ? { ...m, isActive: true } : m,
      );
    }

    set({ aiModels });
    await setStorage({ aiModels });
  },

  setActiveModel: async (id, provider) => {
    const currentModels = get().aiModels;

    // Check if the model exists in current aiModels (custom models)
    // For custom models, we match by both ID and provider to support duplicates
    const modelExists = currentModels.some(
      (m) => m.id === id && (!provider || m.provider === provider),
    );

    if (!modelExists) {
      // This is a predefined model from model-mappings.json
      // Don't add it to aiModels, just store its ID and provider
      // and set all custom models to inactive
      const aiModels = currentModels.map((m) => ({ ...m, isActive: false }));
      set({
        aiModels,
        activePredefinedModelId: id,
        activePredefinedModelProvider: provider || null,
      });
      await setStorage({
        aiModels,
        activePredefinedModelId: id,
        activePredefinedModelProvider: provider,
      });
    } else {
      // Model exists in custom models, set it as active and clear predefined model ID
      // Match by both ID and provider to handle duplicate IDs with different providers
      const aiModels = currentModels.map((m) => ({
        ...m,
        isActive: m.id === id && (!provider || m.provider === provider),
      }));
      set({
        aiModels,
        activePredefinedModelId: null,
        activePredefinedModelProvider: null,
      });
      await setStorage({
        aiModels,
        activePredefinedModelId: undefined,
        activePredefinedModelProvider: undefined,
      });
    }
  },

  // Getters
  getActiveModel: () => {
    const state = get();
    const customActiveModel = state.aiModels.find((m) => m.isActive);

    if (customActiveModel) {
      return customActiveModel;
    }

    // If no custom model is active, check if there's an activePredefinedModelId
    // and look it up in the predefined models
    const activePredefinedId = state.activePredefinedModelId;
    const activePredefinedProvider = state.activePredefinedModelProvider;

    if (activePredefinedId) {
      // Use the imported model mappings to get the predefined model details
      // If we have a stored provider, prioritize that provider's models
      const providers = Object.entries(modelMappings.providers);

      // Sort providers to prioritize the stored provider if available
      const sortedProviders = activePredefinedProvider
        ? providers.sort(([a], [b]) => {
            if (a === activePredefinedProvider) return -1;
            if (b === activePredefinedProvider) return 1;
            return 0;
          })
        : providers;

      for (const [providerId, providerData] of sortedProviders) {
        const foundModel = (
          providerData as {
            name: string;
            models: Array<{ id: string; name: string; modelId: string }>;
          }
        ).models.find((m) => m.id === activePredefinedId);
        if (foundModel) {
          return {
            id: foundModel.id,
            name: foundModel.name,
            modelId: foundModel.modelId,
            provider: providerId,
            isActive: true,
          };
        }
      }
    }

    // If no active model found, return the first default model
    if (state.aiModels.length > 0) {
      return state.aiModels[0];
    }

    return undefined;
  },

  // Check if a model ID is a predefined model
  isPredefinedModel: (id: string) => {
    for (const providerData of Object.values(modelMappings.providers)) {
      const foundModel = (
        providerData as {
          name: string;
          models: Array<{ id: string; name: string; modelId: string }>;
        }
      ).models.find((m) => m.id === id);
      if (foundModel) {
        return true;
      }
    }
    return false;
  },

  getTemplateById: (id) => {
    return get().templates.find((t) => t.id === id);
  },
}));
