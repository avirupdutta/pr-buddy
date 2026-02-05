import { useEffect, useRef } from "react";
import { IconSparkles, IconSettings } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useGeneratorStore } from "@/stores/generator-store";
import { useSettingsStore } from "@/stores/settings-store";
import TemplateSelector from "./TemplateSelector";
import { ToneSelector } from "./ToneSelector";
import { ContextInput } from "./ContextInput";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { openOptionsPage } from "@/services/chrome-messaging";
import ModelSelector from "./ModelSelector";
import { useAnalytics } from "@/services/analytics";

interface GeneratorViewProps {
  currentUrl: string;
}

export function GeneratorView({ currentUrl }: GeneratorViewProps) {
  const {
    generate,
    error,
    isGenerating,
    template,
    tone,
    context,
    generateTitle,
  } = useGeneratorStore();
  const settingsStore = useSettingsStore();
  const hasSelectedModel = !!settingsStore.getActiveModel();
  const { trackGenerateClicked, trackButtonClick } = useAnalytics();
  const activeModel = settingsStore.getActiveModel();
  const lastToastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) return;
    if (lastToastErrorRef.current === error) return;
    toast.error(error);
    lastToastErrorRef.current = error;
  }, [error]);

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

    // Track the generate click event
    trackGenerateClicked({
      url: currentUrl,
      has_context: context.length > 0,
      context_length: context.length,
      template_id: template,
      tone: tone,
      model_id: activeModel?.id || "unknown",
      model_provider: activeModel?.provider || "unknown",
      generate_title: generateTitle,
    });

    try {
      await generate(currentUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden px-0">
      <ScrollArea classNames={{ root: "flex-1 min-h-0" }}>
        <div className="px-6 pt-4 flex flex-col gap-6 pb-6">
          <div className="flex flex-col gap-6 flex-1">
            {/* Custom Instructions (merged with title instructions) */}
            <ContextInput />
          </div>

          {/* Template Selection */}
          <TemplateSelector placeholder="PR Template" size="xs" />

          {/* Tone Selector */}
          <ToneSelector />
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-6 py-4 bg-background border-t border-border/50 shrink-0 space-y-3">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !hasSelectedModel}
          className={`w-full h-10 gap-2 text-base font-bold rounded-lg shadow-lg transition-all duration-300`}
          size="lg"
          id="tour-generate"
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
            </>
          ) : (
            <>
              <IconSparkles className="w-5 h-5" />
              <span>Generate</span>
            </>
          )}
        </Button>
        <div className="flex items-center justify-between">
          <ModelSelector />
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    trackButtonClick("settings", { from_view: "generator" });
                    openOptionsPage();
                  }}
                  className="underline hover:text-foreground transition-colors cursor-pointer"
                >
                  <IconSettings className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
