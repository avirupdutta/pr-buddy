// Zustand store for PR description generator state
import { create } from "zustand";
import type { ToneType, PRDetails, GeneratorSettings } from "@/types/chrome";
import { getStorage, setStorage } from "@/services/chrome-storage";
import { generateDescription as generateDescriptionApi } from "@/services/chrome-messaging";

type ViewType = "generator" | "result";

interface GeneratorState {
  // Form state
  template: string; // Now stores template ID instead of TemplateType
  tone: ToneType;
  context: string;
  includeTickets: boolean;

  // Result state
  generatedDescription: string;
  prDetails: PRDetails | null;

  // UI state
  view: ViewType;
  isGenerating: boolean;
  isUpdating: boolean;
  error: string | null;

  // Actions
  setTemplate: (template: string) => void;
  setTone: (tone: ToneType) => void;
  setContext: (context: string) => void;
  toggleTickets: () => void;
  setGeneratedDescription: (description: string) => void;
  setView: (view: ViewType) => void;
  generate: (url: string) => Promise<void>;
  reset: () => void;
  loadPreferences: () => Promise<void>;
}

const DEFAULT_STATE = {
  template: "default", // Default template ID
  tone: "professional" as ToneType,
  context: "",
  includeTickets: false,
  generatedDescription: "",
  prDetails: null,
  view: "generator" as ViewType,
  isGenerating: false,
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

  toggleTickets: () => {
    const newValue = !get().includeTickets;
    set({ includeTickets: newValue });
    setStorage({ includeTickets: newValue });
  },

  setGeneratedDescription: (description) => {
    set({ generatedDescription: description });
  },

  setView: (view) => {
    set({ view });
  },

  generate: async (url) => {
    set({ isGenerating: true, error: null });

    try {
      const { template, tone, context, includeTickets } = get();
      const settings: GeneratorSettings = {
        templateId: template,
        tone,
        context,
        includeTickets,
      };

      const response = await generateDescriptionApi(url, settings);

      set({
        generatedDescription: response.description,
        prDetails: response.prDetails,
        view: "result",
        isGenerating: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Generation failed",
        isGenerating: false,
      });
    }
  },

  reset: () => {
    set({
      generatedDescription: "",
      prDetails: null,
      view: "generator",
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
      ]);

      set({
        template: prefs.prTemplate || "default",
        context: prefs.customContext || "",
        includeTickets: prefs.includeTickets || false,
        tone: prefs.descriptionTone || "professional",
      });
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  },
}));
