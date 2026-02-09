import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useGeneratorStore } from "@/stores/generator-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@iconify/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnalytics } from "@/services/analytics";

import packageJson from "../../../package.json";

export function Header() {
  const { view, reset } = useGeneratorStore();
  const { trackButtonClick } = useAnalytics();

  return (
    <header
      className="flex items-center justify-between border-b border-border px-6 py-4 bg-background sticky top-0 z-20"
      id="tour-header"
    >
      <div className="flex items-end gap-1.5 text-foreground">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Icon icon="mdi:robot-happy" className="w-6 h-6" />
            </TooltipTrigger>
            <TooltipContent>
              <p>PR Buddy - AI-powered PR descriptions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary">
        </div> */}
        <h1 className="text-lg font-bold leading-tight tracking-[-2px]">
          PR&nbsp;&nbsp;Buddy
        </h1>
        <p className="text-center text-xs text-muted-foreground ml-1">
          v{packageJson.version}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {view === "result" && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    trackButtonClick("go_back", { from_view: view });
                    reset();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IconArrowLeft className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Go back</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
