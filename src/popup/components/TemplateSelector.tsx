import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGeneratorStore } from "@/stores/generator-store";
import { useSettingsStore } from "@/stores/settings-store";

export function TemplateSelector() {
  const { template, setTemplate } = useGeneratorStore();
  const { templates } = useSettingsStore();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">PR Template</Label>
      <Select value={template} onValueChange={(v) => setTemplate(v)}>
        <SelectTrigger className="h-12 text-sm w-full">
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent position="popper">
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
