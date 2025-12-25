import { IconSparkles, IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useGeneratorStore } from "@/stores/generator-store";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  const { view, reset } = useGeneratorStore();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-background sticky top-0 z-10">
      <div className="flex items-center gap-3 text-foreground">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
          <IconSparkles className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold leading-tight">PR Buddy</h1>
      </div>

      <div className="flex items-center gap-2">
        {view === "result" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
          >
            <IconArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
