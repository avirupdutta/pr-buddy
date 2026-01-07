import { IconSparkles, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useGeneratorStore } from "@/stores/generator-store";
import { TemplateSelector } from "./TemplateSelector";
import { ToneSelector } from "./ToneSelector";
import { ContextInput } from "./ContextInput";
import { TitleOptions } from "./TitleOptions";
import { toast } from "sonner";
import { openOptionsPage } from "@/services/chrome-messaging";
import packageJson from "../../../package.json";
import { useState, useEffect } from "react";

const LOADING_LABELS = [
  "👓 Reading your diffs...",
  "🧠 Thinking for you...",
  "🤖 Translating to human...",
  "🌪️ Summarizing the chaos...",
  "🕶️ Making you look pro...",
  "🏷️ Killing generic titles...",
  "👔 Impressing the boss...",
  "✨ Crafting perfect PR...",
  "⛏️ Digging for context...",
  "💡 Explaining your genius...",
];

interface GeneratorViewProps {
  currentUrl: string;
}

export function GeneratorView({ currentUrl }: GeneratorViewProps) {
  const { generate, isGenerating, error } = useGeneratorStore();
  const [loadingLabel, setLoadingLabel] = useState("Generating...");

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;

    if (isGenerating) {
      // Set initial random label immediately but async to avoid linter warning
      timeout = setTimeout(() => {
        setLoadingLabel(
          LOADING_LABELS[Math.floor(Math.random() * LOADING_LABELS.length)]
        );
      }, 0);

      interval = setInterval(() => {
        setLoadingLabel((prev) => {
          const currentIndex = LOADING_LABELS.indexOf(prev);
          const nextIndex = (currentIndex + 1) % LOADING_LABELS.length;
          return LOADING_LABELS[nextIndex];
        });
      }, 3000);
    } else {
      // Reset label async to avoid linter warning
      timeout = setTimeout(() => {
        setLoadingLabel("Generating...");
      }, 0);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isGenerating]);

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
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6 justify-between">
        <div className="flex flex-col gap-6">
          {/* Template Selection */}
          <TemplateSelector />

          {/* Title Generation Options */}
          <TitleOptions />

          {/* Custom Context */}
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
      </div>

      {/* Footer */}
      <div className="p-6 pt-2 bg-background border-t border-transparent">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full h-12 gap-2 text-base font-bold rounded-xl shadow-lg transition-all duration-300"
          size="lg"
        >
          {isGenerating ? (
            <>
              <span
                className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                key={loadingLabel}
              >
                {loadingLabel}
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
    </>
  );
}
