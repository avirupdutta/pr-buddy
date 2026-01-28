import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settings-store";
import { ProviderLogo } from "@/components/provider-logos";
import type { AIProviderType } from "@/services/ai-provider-registry";

const ModelSelector = () => {
  const { aiModels, getActiveModel, setActiveModel } = useSettingsStore();
  const activeModel = getActiveModel();
  return (
    <div className="flex flex-col gap-2">
      <Select 
        value={activeModel?.id || ""} 
        onValueChange={(v) => setActiveModel(v)}
      >
        <SelectTrigger className="h-12 text-sm w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent position="popper">
          {aiModels.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center gap-2">
                <ProviderLogo provider={(model.provider || 'openrouter') as AIProviderType} size={16} />
                <span>{model.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ModelSelector;
