import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGeneratorStore } from "@/stores/generator-store";
import { useAnalytics } from "@/services/analytics";

export function ContextInput() {
  const { context, setContext, generateTitle, setGenerateTitle } =
    useGeneratorStore();
  const { trackButtonClick } = useAnalytics();

  const handleToggleGenerateTitle = (checked: boolean) => {
    trackButtonClick("generate_title_toggle", { enabled: checked });
    setGenerateTitle(checked);
  };

  return (
    <div className="flex flex-col gap-4" id="tour-context">
      {/* Generate PR Title Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Label className="text-sm font-medium">Generate Title</Label>
          <span className="text-xs text-muted-foreground">
            Auto-generate title based on changes
          </span>
        </div>
        <Switch
          checked={generateTitle}
          onCheckedChange={handleToggleGenerateTitle}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Custom Instructions */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label className="text-sm font-medium">Custom Instructions</Label>
          <span className="text-xs text-muted-foreground">Optional</span>
        </div>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Example:&#10;- Use conventional commit format for title&#10;- Clickup Task ID: PROJ-123&#10;- Keep title under 50 chars"
          className="min-h-[100px] resize-y text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Instructions apply to both PR title and description
        </p>
      </div>
    </div>
  );
}
