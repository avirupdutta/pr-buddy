import { useSettingsStore } from "@/stores/settings-store";
import { useGeneratorStore } from "@/stores/generator-store";
import { SearchableModelSelector } from "@/components/ui/searchable-model-selector";
import type { AIProviderType } from "@/services/ai-provider-registry";

interface ModelSelectorProps {
  disabled?: boolean;
}

const ModelSelector = ({ disabled = false }: ModelSelectorProps) => {
  const { aiModels, getActiveModel, setActiveModel, openRouterKey, openaiKey, anthropicKey, googleKey, groqKey, cerebrasKey } = useSettingsStore();
  const { clearError } = useGeneratorStore();
  const activeModel = getActiveModel();

  // Map of provider API key status
  const providerKeyStatus: Record<AIProviderType, boolean> = {
    openrouter: Boolean(openRouterKey),
    openai: Boolean(openaiKey),
    anthropic: Boolean(anthropicKey),
    google: Boolean(googleKey),
    groq: Boolean(groqKey),
    cerebras: Boolean(cerebrasKey),
  };

  const handleModelChange = (id: string, provider?: string) => {
    // Clear any previous error when switching models
    clearError();
    setActiveModel(id, provider);
  };

  return (
    <div className="flex flex-col gap-2">
      <SearchableModelSelector
        models={[]} // Predefined models are handled internally by the component
        customModels={aiModels}
        value={activeModel?.id || ""}
        activeProvider={activeModel?.provider}
        onValueChange={handleModelChange}
        placeholder="Select a model"
        className="w-full"
        popoverPosition="top"
        providerKeyStatus={providerKeyStatus}
        disabled={disabled}
      />
    </div>
  );
};

export default ModelSelector;
