import {
  IconBriefcase,
  IconCoffee,
  IconBolt,
  IconArrowsShuffle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useGeneratorStore } from "@/stores/generator-store";
import type { ToneType } from "@/types/chrome";
import { cn } from "@/lib/utils";

const TONES: { value: ToneType; label: string; icon: React.ReactNode }[] = [
  {
    value: "auto",
    label: "Auto",
    icon: <IconArrowsShuffle className="w-4 h-4" />,
  },
  {
    value: "professional",
    label: "Professional",
    icon: <IconBriefcase className="w-4 h-4" />,
  },
  {
    value: "casual",
    label: "Casual",
    icon: <IconCoffee className="w-4 h-4" />,
  },
  {
    value: "concise",
    label: "Concise",
    icon: <IconBolt className="w-4 h-4" />,
  },
];

export function ToneSelector() {
  const { tone, setTone } = useGeneratorStore();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Description Tone</Label>
      <div className="flex flex-wrap gap-2">
        {TONES.map((t) => (
          <Button
            key={t.value}
            variant="outline"
            size="sm"
            onClick={() => setTone(t.value)}
            className={cn(
              "h-8 gap-2 transition-all",
              tone === t.value
                ? "bg-primary/20 border-primary/50 text-foreground"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            <span className="text-xs font-medium">{t.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
