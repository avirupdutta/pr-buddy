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
import type React from "react";
import { cn } from "@/lib/utils";

interface TemplateSelectorProps {
  placeholder?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  popoverSide?: "top" | "right" | "bottom" | "left";
  classNames?: {
    root?: string;
    trigger?: string;
    content?: string;
    item?: string;
  };
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  placeholder = "Template",
  size = "sm",
  disabled = false,
  popoverSide = "bottom",
  classNames,
}) => {
  const { template, setTemplate } = useGeneratorStore();
  const { templates } = useSettingsStore();
  const { trackTemplateSelected } = useAnalytics();

  // Default template IDs that come built-in
  const defaultTemplateIds = [
    "default",
    "bug",
    "feature",
    "refactor",
    "hotfix",
  ];

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
    <div
      className={cn("flex flex-col gap-2", classNames?.root)}
      id="tour-template"
    >
      {placeholder && (
        <Label className="text-sm font-medium">{placeholder}</Label>
      )}
      <Select
        value={template}
        onValueChange={handleTemplateChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "text-sm h-12 w-full cursor-pointer",
            size === "xs" && "text-xs",
            size === "sm" && "text-sm",
            size === "md" && "text-base",
            size === "lg" && "text-lg",
            size === "xl" && "text-xl",
            classNames?.trigger,
          )}
        >
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side={popoverSide}
          className={cn(classNames?.content)}
        >
          {templates.map((t) => (
            <SelectItem
              key={t.id}
              value={t.id}
              className={cn(classNames?.item)}
            >
              {t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TemplateSelector;
