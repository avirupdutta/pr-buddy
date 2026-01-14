import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGeneratorStore } from "@/stores/generator-store";

export function ContextInput() {
  const { context, setContext, generateTitle, setGenerateTitle } =
    useGeneratorStore();

  return (
    <div className="flex flex-col gap-4">
      {/* Custom Instructions */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline">
          <Label className="text-sm font-medium">Custom Instructions</Label>
          <span className="text-xs text-muted-foreground">Optional</span>
        </div>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="- Use conventional commit format for title&#10;- Mention JIRA ticket PROJ-123&#10;- Keep title under 50 chars&#10;- Note breaking changes..."
          className="min-h-[100px] resize-y text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Instructions apply to both PR title and description.
        </p>
      </div>

      {/* Generate PR Title Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex flex-col gap-0.5">
          <Label className="text-sm font-medium">Generate PR Title</Label>
          <span className="text-xs text-muted-foreground">
            Auto-generate title based on changes
          </span>
        </div>
        <Switch
          checked={generateTitle}
          onCheckedChange={setGenerateTitle}
          className="data-[state=checked]:bg-primary"
        />
      </div>
    </div>
  );
}
