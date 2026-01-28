import { useSettingsStore } from "@/stores/settings-store";
import { SearchableModelSelector } from "@/components/ui/searchable-model-selector";
import type { AIProviderType } from "@/services/ai-provider-registry";

const ModelSelector = () => {
  const { aiModels, getActiveModel, setActiveModel, openRouterKey, openaiKey, anthropicKey, googleKey, groqKey, cerebrasKey } = useSettingsStore();
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

  return (
    <div className="flex flex-col gap-2">
      <SearchableModelSelector
        models={[]} // Predefined models are handled internally by the component
        customModels={aiModels}
        value={activeModel?.id || ""}
        activeProvider={activeModel?.provider}
        onValueChange={(id: string, provider?: string) => setActiveModel(id, provider)}
        placeholder="Select a model"
        className="w-full"
        popoverPosition="top"
        providerKeyStatus={providerKeyStatus}
      />
    </div>
  );
};

export default ModelSelector;
