import { IconSparkles, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useGeneratorStore } from "@/stores/generator-store";
import { TemplateSelector } from "./TemplateSelector";
import { ToneSelector } from "./ToneSelector";
import { ContextInput } from "./ContextInput";
import { TicketToggle } from "./TicketToggle";
import { toast } from "sonner";
import { openOptionsPage } from "@/services/chrome-messaging";

interface GeneratorViewProps {
  currentUrl: string;
}

export function GeneratorView({ currentUrl }: GeneratorViewProps) {
  const { generate, isGenerating, error } = useGeneratorStore();

  const handleGenerate = async () => {
    if (!currentUrl || !currentUrl.includes("github.com/")) {
      toast.error("Please open this extension on a GitHub Pull Request page.");
      return;
    }

    if (!currentUrl.match(/github\.com\/[^/]+\/[^/]+\/pull\/\d+/)) {
      toast.error(
        "Invalid PR URL. Navigate to a PR page like: github.com/owner/repo/pull/123"
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
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
        {/* Template Selection */}
        <TemplateSelector />

        {/* Custom Context */}
        <ContextInput />

        {/* Tone Selector */}
        <ToneSelector />

        {/* Ticket Toggle */}
        <div className="pt-2 border-t border-border/50">
          <TicketToggle />
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 pt-2 bg-background border-t border-transparent">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full h-12 gap-2 text-base font-bold rounded-xl shadow-lg"
          size="lg"
        >
          {isGenerating ? (
            <>
              <IconLoader2 className="w-5 h-5 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <IconSparkles className="w-5 h-5" />
              <span>Generate Description</span>
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-3">
          Powered by PR-Buddy •{" "}
          <button
            onClick={openOptionsPage}
            className="underline hover:text-foreground transition-colors"
          >
            Settings
          </button>
        </p>
      </div>
    </>
  );
}
