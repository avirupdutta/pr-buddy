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
import { useAnalytics } from "@/services/analytics";
import type { TemplateSelectedProperties } from "@/data/constants";

export function TemplateSelector() {
  const { template, setTemplate } = useGeneratorStore();
  const { templates } = useSettingsStore();
  const { trackTemplateSelected } = useAnalytics();

  // Default template IDs that come built-in
  const defaultTemplateIds = ["default", "bug", "feature", "refactor", "hotfix"];

  const handleTemplateChange = (templateId: string) => {
    setTemplate(templateId);
    
    // Find the selected template to get its title
    const selectedTemplate = templates.find((t) => t.id === templateId);
    
    if (selectedTemplate) {
      const properties: TemplateSelectedProperties = {
        template_id: templateId,
        template_title: selectedTemplate.title,
        is_custom_template: !defaultTemplateIds.includes(templateId),
      };
      
      trackTemplateSelected(properties);
    }
  };

  return (
    <div className="flex flex-col gap-2" id="tour-template">
      <Label className="text-sm font-medium">PR Template</Label>
      <Select value={template} onValueChange={handleTemplateChange}>
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
