// Zustand store for PR description generator state
import { create } from "zustand";
import type { ToneType, PRDetails, GeneratorSettings } from "@/types/chrome";
import { getStorage, setStorage } from "@/services/chrome-storage";
import { streamDescription } from "@/services/chrome-messaging";
import { useSettingsStore } from "./settings-store";

type ViewType = "generator" | "result";

interface GeneratorState {
  // Form state
  template: string; // Now stores template ID instead of TemplateType
  tone: ToneType;
  context: string; // Combined instructions for title and description
  includeTickets: boolean;
  generateTitle: boolean;

  // Result state
  generatedDescription: string;
  generatedTitle: string;
  prDetails: PRDetails | null;

  // UI state
  view: ViewType;
  isGenerating: boolean;
  isRegenerating: boolean;
  isUpdating: boolean;
  error: string | null;

  // Actions
  setTemplate: (template: string) => void;
  setTone: (tone: ToneType) => void;
  setContext: (context: string) => void;
  setGenerateTitle: (enabled: boolean) => void;
  toggleTickets: () => void;
  setGeneratedDescription: (description: string) => void;
  setGeneratedTitle: (title: string) => void;
  setView: (view: ViewType) => void;
  setIsRegenerating: (regenerating: boolean) => void;
  generate: (url: string, isRegeneration?: boolean) => Promise<void>;
  reset: () => void;
  loadPreferences: () => Promise<void>;
}

const DEFAULT_STATE = {
  template: "default", // Default template ID
  tone: "auto" as ToneType,
  context: "",
  includeTickets: false,
  generateTitle: false,
  generatedDescription: "",
  generatedTitle: "",
  prDetails: null,
  view: "generator" as ViewType,
  isGenerating: false,
  isRegenerating: false,
  isUpdating: false,
  error: null,
};

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  ...DEFAULT_STATE,

  setTemplate: (template) => {
    set({ template });
    setStorage({ prTemplate: template });
  },

  setTone: (tone) => {
    set({ tone });
    setStorage({ descriptionTone: tone });
  },

  setContext: (context) => {
    set({ context });
    setStorage({ customContext: context });
  },

  setGenerateTitle: (enabled) => {
    set({ generateTitle: enabled });
    setStorage({ generateTitle: enabled });
  },

  toggleTickets: () => {
    const newValue = !get().includeTickets;
    set({ includeTickets: newValue });
    setStorage({ includeTickets: newValue });
  },

  setGeneratedDescription: (description) => {
    set({ generatedDescription: description });
  },

  setGeneratedTitle: (title) => {
    set({ generatedTitle: title });
  },

  setView: (view) => {
    set({ view });
  },

  setIsRegenerating: (isRegenerating) => {
    set({ isRegenerating });
  },

  generate: async (url, isRegeneration = false) => {
    // Reset state but keep focus on generator view until streaming starts
    set({
      isGenerating: true,
      isRegenerating: isRegeneration,
      error: null,
      generatedDescription: "",
      generatedTitle: "",
    });

    try {
      const { template, tone, context, includeTickets, generateTitle } = get();
      
      // Get the selected model from settings store
      const settingsStore = useSettingsStore.getState();
      const activeModel = settingsStore.getActiveModel();
      
      // Ensure we have a valid model with provider
      let selectedModel = activeModel;
      if (!selectedModel) {
        // Fallback to first default model if no active model found
        const { DEFAULT_AI_MODELS } = await import("@/stores/settings-store");
        selectedModel = DEFAULT_AI_MODELS[0];
      }
      
      const settings: GeneratorSettings = {
        templateId: template,
        tone,
        context,
        includeTickets,
        generateTitle,
        selectedModel: {
          id: selectedModel.id,
          modelId: selectedModel.modelId,
          provider: selectedModel.provider || 'openrouter',
        },
      };

      // Streaming state
      let fullContent = "";
      const separator = "<<<SEPARATOR>>>";
      let hasSwitchedToResult = false;

      await new Promise<void>((resolve, reject) => {
        streamDescription(
          url,
          settings,
          (chunk) => {
            // Switch to result view on first chunk
            if (!hasSwitchedToResult) {
              set({ view: "result" });
              hasSwitchedToResult = true;
            }

            fullContent += chunk;

            // Basic parsing - consider generateTitle setting
            const separatorIndex = fullContent.indexOf(separator);

            if (separatorIndex === -1) {
              // Still in title section or only description
              const titleMatch = fullContent.match(/TITLE:\s*(.*)/s);
              if (titleMatch && generateTitle) {
                 set({ generatedTitle: titleMatch[1].trim() });
              } else {
                // No title found or title generation disabled, this is description-only response
                const descMatch = fullContent.match(/DESCRIPTION:\s*(.*)/s);
                if (descMatch) {
                  set({ generatedDescription: descMatch[1].trim() });
                } else {
                  // If no DESCRIPTION: prefix found, treat entire content as description
                  // This handles cases where AI streams description without the prefix
                  // or when title generation is disabled and there's no separator
                  set({ generatedDescription: fullContent.trim() });
                }
              }
            } else {
              // We have separator - this should only happen when generateTitle is true
              // 1. Update Title (final)
              const beforeSeparator = fullContent.substring(0, separatorIndex);
              const titleMatch = beforeSeparator.match(/TITLE:\s*(.*)/s);
              if (titleMatch && generateTitle) {
                 set({ generatedTitle: titleMatch[1].trim() });
              }

              // 2. Update Description
              const afterSeparator = fullContent.substring(separatorIndex + separator.length);
              const desc = afterSeparator.replace(/^\s*DESCRIPTION:\s*/, "");
              set({ generatedDescription: desc });
            }
          },
          (data) => {
            set({ isGenerating: false, isRegenerating: false, prDetails: data.prDetails });
            resolve();
          },
          (error) => {
            reject(new Error(error));
          }
        );
      });

    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Generation failed",
        isGenerating: false,
        isRegenerating: false,
      });
    }
  },

  reset: () => {
    set({
      generatedDescription: "",
      generatedTitle: "",
      prDetails: null,
      view: "generator",
      isGenerating: false,
      isRegenerating: false,
      error: null,
    });
  },

  loadPreferences: async () => {
    try {
      const prefs = await getStorage([
        "prTemplate",
        "customContext",
        "includeTickets",
        "descriptionTone",
        "generateTitle",
      ]);

      set({
        template: prefs.prTemplate || "default",
        context: prefs.customContext || "",
        includeTickets: prefs.includeTickets || false,
        tone: prefs.descriptionTone || "auto",
        generateTitle: prefs.generateTitle ?? true,
      });
    } catch (error) {
      console.error("Failed to load preferences:", error);
      // Fallback defaults
      set({
        generateTitle: true,
      });
    }
  },
}));
