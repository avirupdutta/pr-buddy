import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settings-store";

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
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ModelSelector;
