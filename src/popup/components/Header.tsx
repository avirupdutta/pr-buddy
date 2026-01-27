import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useGeneratorStore } from "@/stores/generator-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@iconify/react";

import packageJson from "../../../package.json";

export function Header() {
  const { view, reset } = useGeneratorStore();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-background sticky top-0 z-10">
      <div className="flex items-center gap-3 text-foreground">
        <Icon icon="streamline-plump:ai-edit-robot-solid" className="w-5 h-5" />
        {/* <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary">
        </div> */}
        <h1 className="text-md font-bold leading-tight">PR Buddy</h1>
        <p className="text-center text-xs text-muted-foreground">
          v{packageJson.version}
        </p>
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
