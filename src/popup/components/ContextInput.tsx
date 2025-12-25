import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useGeneratorStore } from "@/stores/generator-store";

export function ContextInput() {
  const { context, setContext } = useGeneratorStore();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <Label className="text-sm font-medium">Custom Instructions</Label>
        <span className="text-xs text-muted-foreground">Optional</span>
      </div>
      <Textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="- Mention JIRA ticket PROJ-123&#10;- Explain the changes in auth-service&#10;- Note breaking changes..."
        className="min-h-[100px] resize-y text-sm"
      />
    </div>
  );
}
