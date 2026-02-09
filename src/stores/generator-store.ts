// Zustand store for PR description generator state
import { create } from "zustand";
import type { ToneType, PRDetails, GeneratorSettings, AIModel } from "@/types/chrome";
import { getStorage, setStorage } from "@/services/chrome-storage";
import { streamDescription } from "@/services/chrome-messaging";
import { analytics } from "@/services/analytics";
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

  // Track generation history for UI flow
  hasGeneratedOnce: boolean; // True after first successful generation
  hasRegenerated: boolean; // True after user clicks regenerate at least once

  // Abort controller for stopping generation
  abortController: AbortController | null;

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
  setHasRegenerated: (hasRegenerated: boolean) => void;
  clearError: () => void;
  generate: (url: string, isRegeneration?: boolean) => Promise<void>;
  stopGeneration: () => void;
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
  hasGeneratedOnce: false,
  hasRegenerated: false,
  abortController: null as AbortController | null,
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

  setHasRegenerated: (hasRegenerated: boolean) => {
    set({ hasRegenerated });
  },

  clearError: () => {
    set({ error: null });
  },

  generate: async (url, isRegeneration = false) => {
    // Track start time for analytics
    const startTime = Date.now();

    // Create abort controller for this generation
    const abortController = new AbortController();

    // Reset state and immediately switch to result view
    set({
      isGenerating: true,
      isRegenerating: isRegeneration,
      error: null,
      generatedDescription: "",
      generatedTitle: "",
      view: "result",
      abortController,
    });

    let disconnectStream: (() => void) | null = null;
    let selectedModel: AIModel | null = null;

    try {
      const { template, tone, context, includeTickets, generateTitle } = get();

      // Get the selected model from settings store
      const settingsStore = useSettingsStore.getState();
      const activeModel = settingsStore.getActiveModel();

      // Ensure we have a valid model with provider
      selectedModel = activeModel ?? null;
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
          provider: selectedModel.provider || "openrouter",
          supportsJsonSchema: selectedModel.supportsJsonSchema,
        },
      };

      // Streaming state
      let fullContent = "";
      const separator = "<<<SEPARATOR>>>";

      await new Promise<void>((resolve, reject) => {
        // Check if aborted before starting
        if (abortController.signal.aborted) {
          reject(new Error("Generation stopped by user"));
          return;
        }

        disconnectStream = streamDescription(
          url,
          settings,
          (chunk) => {
            // Check if aborted during streaming
            if (abortController.signal.aborted) {
              return;
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
                  set({ generatedDescription: fullContent.trim() });
                }
              }
            } else {
              // We have separator - this should only happen when generateTitle is true
              const beforeSeparator = fullContent.substring(0, separatorIndex);
              const titleMatch = beforeSeparator.match(/TITLE:\s*(.*)/s);
              if (titleMatch && generateTitle) {
                set({ generatedTitle: titleMatch[1].trim() });
              }

              const afterSeparator = fullContent.substring(
                separatorIndex + separator.length,
              );
              const desc = afterSeparator.replace(/^\s*DESCRIPTION:\s*/, "");
              set({ generatedDescription: desc });
            }
          },
          (data) => {
            if (abortController.signal.aborted) {
              return;
            }

            const completionDescription = data.description?.trim() || "";
            const streamedDescription = fullContent.trim();
            const selectedProvider = selectedModel?.provider || "unknown";
            const selectedModelId = selectedModel?.modelId || "unknown";

            // Guard: never treat an empty completion as success.
            // This happens when the background posts `complete` even though the provider errored.
            if (
              completionDescription.length === 0 &&
              streamedDescription.length === 0
            ) {
              reject(
                new Error(
                  `No response content from ${selectedProvider}/${selectedModelId}. This usually means the provider rejected the request (for example: 413/token limits). Try a smaller diff/context or switch model.`,
                ),
              );
              return;
            }

            set({
              isGenerating: false,
              isRegenerating: false,
              prDetails: data.prDetails,
              hasGeneratedOnce: true,
              abortController: null,
            });

            // Track successful generation
            const duration_ms = Date.now() - startTime;
            const { generatedDescription, generatedTitle, generateTitle, template, tone, context } = get();
            if (selectedModel) {
              analytics.trackGenerationCompleted({
                url,
                duration_ms,
                description_length: generatedDescription.length,
                title_length: generateTitle ? generatedTitle.length : undefined,
                model_id: selectedModel.id,
                model_provider: selectedModel.provider || "openrouter",
                template_id: template,
                tone,
                has_context: context.length > 0,
                was_regeneration: isRegeneration,
              });
            }

            resolve();
          },
          (error) => {
            if (abortController.signal.aborted) {
              return;
            }
            reject(new Error(error));
          },
        );

        // Listen for abort signal
        abortController.signal.addEventListener("abort", () => {
          if (disconnectStream) {
            disconnectStream();
          }
          reject(new Error("Generation stopped by user"));
        });
      });
    } catch (error) {
      // Don't show error if it was stopped by user
      if (
        error instanceof Error &&
        error.message === "Generation stopped by user"
      ) {
        // Mark as generated if there's partial content, so UI shows properly
        const { generatedDescription } = get();
        set({
          isGenerating: false,
          isRegenerating: false,
          abortController: null,
          hasGeneratedOnce: generatedDescription.length > 0,
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : "Generation failed";
        set({
          error: errorMessage,
          isGenerating: false,
          isRegenerating: false,
          abortController: null,
        });

        // Track generation failure
        const { template } = get();
        const stage = selectedModel ? "streaming" : "init";
        analytics.trackGenerationFailed({
          url,
          error_message: errorMessage,
          model_id: selectedModel?.id ?? "unknown",
          model_provider: selectedModel?.provider ?? "unknown",
          template_id: template,
          stage,
        });
      }
    }
  },

  stopGeneration: () => {
    const { abortController, isGenerating, generatedDescription } = get();
    if (isGenerating && abortController) {
      abortController.abort();
    }
    // Reset generation state and switch back to generator view
    set({
      isGenerating: false,
      isRegenerating: false,
      abortController: null,
      // Only clear content if nothing was generated, otherwise keep it
      generatedDescription:
        generatedDescription.length > 0 ? generatedDescription : "",
      generatedTitle:
        get().generatedTitle.length > 0 ? get().generatedTitle : "",
    });
  },

  reset: () => {
    // Abort any ongoing generation before resetting
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      generatedDescription: "",
      generatedTitle: "",
      prDetails: null,
      view: "generator",
      isGenerating: false,
      isRegenerating: false,
      error: null,
      abortController: null,
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
