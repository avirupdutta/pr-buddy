import { useSettingsStore } from "@/stores/settings-store";
import { SearchableModelSelector } from "@/components/ui/searchable-model-selector";
import { Label } from "@/components/ui/label";

const ModelSelector = () => {
  const { aiModels, getActiveModel, setActiveModel } = useSettingsStore();
  const activeModel = getActiveModel();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Model</Label>
      <SearchableModelSelector
        models={[]} // Predefined models are handled internally by the component
        customModels={aiModels}
        value={activeModel?.id || ""}
        onValueChange={(v) => setActiveModel(v)}
        placeholder="Select a model"
        className="w-full"
        popoverPosition="top"
      />
    </div>
  );
};

export default ModelSelector;
