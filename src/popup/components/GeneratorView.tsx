import { IconSparkles, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

import { useGeneratorStore } from "@/stores/generator-store";
import { TemplateSelector } from "./TemplateSelector";
import { ToneSelector } from "./ToneSelector";
import { ContextInput } from "./ContextInput";
import { toast } from "sonner";
import { openOptionsPage } from "@/services/chrome-messaging";
import packageJson from "../../../package.json";

interface GeneratorViewProps {
  currentUrl: string;
}

export function GeneratorView({ currentUrl }: GeneratorViewProps) {
  const { generate, error, isGenerating } = useGeneratorStore();
  const handleGenerate = async () => {
    if (!currentUrl || !currentUrl.includes("github.com/")) {
      toast.error("Please open this extension on a GitHub Pull Request page.");
      return;
    }

    if (!currentUrl.match(/github\.com\/[^/]+\/[^/]+\/pull\/\d+/)) {
      toast.error(
        "Invalid PR URL. Navigate to a PR page like: github.com/owner/repo/pull/123",
      );
      return;
    }

    try {
      await generate(currentUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
  };

  // Show error if any
  if (error) {
    toast.error(error);
  }

  return (
    <div className="px-6 pt-4 flex flex-col gap-6 min-h-full">
      <div className="flex flex-col gap-6 flex-1">
        {/* Template Selection */}
        <TemplateSelector />

        {/* Custom Instructions (merged with title instructions) */}
        <ContextInput />
      </div>

      {/* Tone Selector */}
      <ToneSelector />

      {/* ================= */}
      {/* Ticket Toggle - This is currently in progress. Will be introduced in a future release */}
      {/* <div className="pt-2 border-t border-border/50">
          <TicketToggle />
        </div> */}
      {/* ================= */}

      {/* Footer */}
      <div className="px-0 pt-2 bg-background border-t border-transparent sticky bottom-0 py-4">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full h-12 gap-2 text-base font-bold rounded-xl shadow-lg transition-all duration-300`}
          size="lg"
        >
          {isGenerating ? (
            <>
              <span
                className={`animate-in fade-in slide-in-from-bottom-1 duration-300${
                  isGenerating ? " shimmer-metallic" : ""
                }`}
                key="generating"
              >
                Generating...
              </span>
              <IconLoader2 className="w-5 h-5 animate-spin" />
            </>
          ) : (
            <>
              <IconSparkles className="w-5 h-5" />
              <span>Generate</span>
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-3">
          v{packageJson.version} • Powered by Codebuddy •{" "}
          <button
            onClick={openOptionsPage}
            className="underline hover:text-foreground transition-colors text-primary cursor-pointer"
          >
            Settings
          </button>
        </p>
      </div>
    </div>
  );
}
