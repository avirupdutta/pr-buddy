// Zustand store for API key settings
import { create } from "zustand";
import { getStorage, setStorage } from "@/services/chrome-storage";
import { encryptApiKey, decryptApiKey } from "@/services/encryption";
import type { PRTemplate, AIModel } from "@/types/chrome";

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

// Default AI model
export const DEFAULT_AI_MODELS: AIModel[] = [
  {
    id: "devstral-2512",
    name: "Mistral: Devstral 2 2512 (Free)",
    modelId: "mistralai/devstral-2512:free",
    isActive: true,
  },
  {
    id: "mimo-v2-flash",
    name: "Xiaomi MiMo v2 Flash (Free)",
    modelId: "xiaomi/mimo-v2-flash:free",
    isActive: false,
  },
];

interface SettingsState {
  githubToken: string | null;
  openRouterKey: string | null;
  devMode: boolean;
  devPrUrl: string | null;
  theme: "dark" | "light" | "system";
  templates: PRTemplate[];
  aiModels: AIModel[];
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

  // Template CRUD actions
  addTemplate: (template: Omit<PRTemplate, "id">) => Promise<void>;
  updateTemplate: (
    id: string,
    updates: Partial<Omit<PRTemplate, "id">>
  ) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Model CRUD actions
  addModel: (model: Omit<AIModel, "id" | "isActive">) => Promise<void>;
  updateModel: (
    id: string,
    updates: Partial<Omit<AIModel, "id" | "isActive">>
  ) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  setActiveModel: (id: string) => Promise<void>;

  // Getters
  getActiveModel: () => AIModel | undefined;
  getTemplateById: (id: string) => PRTemplate | undefined;
}

// Generate unique ID
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  githubToken: null,
  openRouterKey: null,
  devMode: false,
  devPrUrl: null,
  theme: "system",
  templates: DEFAULT_TEMPLATES,
  aiModels: DEFAULT_AI_MODELS,
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
        "templates",
        "aiModels",
      ]);

      // Decrypt API keys
      const decryptedGithubToken = result.githubToken
        ? await decryptApiKey(result.githubToken)
        : null;
      const decryptedOpenRouterKey = result.openRouterKey
        ? await decryptApiKey(result.openRouterKey)
        : null;

      set({
        githubToken: decryptedGithubToken,
        openRouterKey: decryptedOpenRouterKey,
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
      t.id === id ? { ...t, ...updates } : t
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
      isActive: false, // New models are not active by default
    };
    const aiModels = [...get().aiModels, newModel];
    set({ aiModels });
    await setStorage({ aiModels });
  },

  updateModel: async (id, updates) => {
    const aiModels = get().aiModels.map((m) =>
      m.id === id ? { ...m, ...updates } : m
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
        index === 0 ? { ...m, isActive: true } : m
      );
    }

    set({ aiModels });
    await setStorage({ aiModels });
  },

  setActiveModel: async (id) => {
    const aiModels = get().aiModels.map((m) => ({
      ...m,
      isActive: m.id === id,
    }));
    set({ aiModels });
    await setStorage({ aiModels });
  },

  // Getters
  getActiveModel: () => {
    return get().aiModels.find((m) => m.isActive);
  },

  getTemplateById: (id) => {
    return get().templates.find((t) => t.id === id);
  },
}));
