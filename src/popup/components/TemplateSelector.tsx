import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGeneratorStore } from "@/stores/generator-store";
import type { TemplateType } from "@/types/chrome";

const TEMPLATES: { value: TemplateType; label: string }[] = [
  { value: "default", label: "Standard Pull Request" },
  { value: "bug", label: "Bug Fix Report" },
  { value: "feature", label: "Feature Implementation" },
  { value: "refactor", label: "Code Refactor" },
  { value: "hotfix", label: "Hotfix" },
];

export function TemplateSelector() {
  const { template, setTemplate } = useGeneratorStore();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">PR Template</Label>
      <Select
        value={template}
        onValueChange={(v) => setTemplate(v as TemplateType)}
      >
        <SelectTrigger className="h-12 text-sm">
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent>
          {TEMPLATES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
