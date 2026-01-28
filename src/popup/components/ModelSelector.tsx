import { useSettingsStore } from "@/stores/settings-store";
import { SearchableModelSelector } from "@/components/ui/searchable-model-selector";

const ModelSelector = () => {
  const { aiModels, getActiveModel, setActiveModel } = useSettingsStore();
  const activeModel = getActiveModel();

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
      />
    </div>
  );
};

export default ModelSelector;
