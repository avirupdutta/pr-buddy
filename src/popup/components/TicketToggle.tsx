import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useGeneratorStore } from "@/stores/generator-store";

export function TicketToggle() {
  const { includeTickets, toggleTickets } = useGeneratorStore();

  return (
    <div className="flex items-center gap-4 py-2 justify-between">
      <div className="flex flex-col">
        <Label
          className="text-sm font-medium cursor-pointer"
          htmlFor="ticket-toggle"
        >
          Include ticket links
        </Label>
        <span className="text-xs text-muted-foreground">
          Auto-link JIRA/Linear IDs from branch name
        </span>
      </div>
      <Switch
        id="ticket-toggle"
        checked={includeTickets}
        onCheckedChange={toggleTickets}
      />
    </div>
  );
}
