import { useSettingsStore } from "@/stores/settings-store";
import { useGeneratorStore } from "@/stores/generator-store";
import { SearchableModelSelector } from "@/components/ui/searchable-model-selector";
import type { AIProviderType } from "@/services/ai-provider-registry";
import { useAnalytics } from "@/services/analytics";

interface ModelSelectorProps {
  disabled?: boolean;
}

const ModelSelector = ({ disabled = false }: ModelSelectorProps) => {
  const {
    aiModels,
    getActiveModel,
    setActiveModel,
    openRouterKey,
    openaiKey,
    anthropicKey,
    googleKey,
    groqKey,
    cerebrasKey,
  } = useSettingsStore();
  const { clearError } = useGeneratorStore();
  const activeModel = getActiveModel();
  const { trackModelSelected, trackButtonClick } = useAnalytics();

  // Map of provider API key status
  const providerKeyStatus: Record<AIProviderType, boolean> = {
    openrouter: Boolean(openRouterKey),
    openai: Boolean(openaiKey),
    anthropic: Boolean(anthropicKey),
    google: Boolean(googleKey),
    groq: Boolean(groqKey),
    cerebras: Boolean(cerebrasKey),
  };

  const isCustomModel = (id: string) => {
    return aiModels.some((model) => model.id === id);
  };

  const handleModelChange = (id: string, provider?: string) => {
    // Clear any previous error when switching models
    clearError();
    setActiveModel(id, provider);
    
    const isCustom = isCustomModel(id);
    const hasKey = provider ? providerKeyStatus[provider as AIProviderType] : false;
    
    trackModelSelected({
      model_id: id,
      model_name: activeModel?.name || id,
      model_provider: provider || activeModel?.provider || "unknown",
      is_custom_model: isCustom,
      has_api_key: hasKey,
    });
  };

  const handleSelectorOpen = () => {
    trackButtonClick("model_selector_opened");
  };

  const handleSelectorClose = () => {
    trackButtonClick("model_selector_closed");
  };

  return (
    <div className="flex flex-col gap-2" id="tour-model">
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
        onOpen={handleSelectorOpen}
        onClose={handleSelectorClose}
      />
    </div>
  );
};

export default ModelSelector;
