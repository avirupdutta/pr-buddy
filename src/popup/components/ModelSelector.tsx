import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const ModelSelector = () => {
  const [model, setModel] = useState<string>("");
  const models = [
    { id: "gpt-4o", title: "GPT-4o" },
    { id: "gpt-4o-mini", title: "GPT-4o Mini" },
    { id: "gpt-4o-2024-08-06", title: "GPT-4o 2024-08-06" },
    { id: "gpt-4o-2024-08-06", title: "GPT-4o 2024-08-06" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <Select value={model} onValueChange={(v) => setModel(v)}>
        <SelectTrigger className="h-12 text-sm w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent position="popper">
          {models.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ModelSelector;
