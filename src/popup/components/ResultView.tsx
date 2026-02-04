import { useState, useEffect, useRef } from "react";
import {
  IconCopy,
  IconRefresh,
  IconLoader2,
  IconCheck,
  IconSettings,
  IconCode,
  IconEye,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SkeletonMarkdown } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { useGeneratorStore } from "@/stores/generator-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  updatePRDescription,
  openOptionsPage,
} from "@/services/chrome-messaging";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import ModelSelector from "./ModelSelector";
import TemplateSelector from "./TemplateSelector";
import FluentRecordStopFilled from "@/components/icons/FluentRecordStopFilled";
import { useAnalytics } from "@/services/analytics";

interface ResultViewProps {
  currentUrl: string;
}

// Shared footer component for ModelSelector + TemplateSelector + Settings to avoid duplication
function ModelSelectorFooter({
  disabled = false,
  onSettingsClick,
}: {
  disabled?: boolean;
  onSettingsClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <ModelSelector disabled={disabled} />
        <TemplateSelector
          placeholder=""
          disabled={disabled}
          size="xs"
          popoverSide="top"
          classNames={{
            trigger: "max-w-20",
          }}
        />
      </div>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSettingsClick || openOptionsPage}
              disabled={disabled}
              className="underline hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
  );
}

export function ResultView({ currentUrl }: ResultViewProps) {
  const {
    generatedDescription,
    setGeneratedDescription,
    generatedTitle,
    setGeneratedTitle,
    generateTitle,
    generate,
    isGenerating,
    isRegenerating,
    reset,
    hasRegenerated,
    setHasRegenerated,
    stopGeneration,
  } = useGeneratorStore();
  const settingsStore = useSettingsStore();
  const activeModel = settingsStore.getActiveModel();
  const {
    trackCopyClicked,
    trackApplyClicked,
    trackRegenerateClicked,
    trackGenerationStopped,
    trackButtonClick,
  } = useAnalytics();

  const [isCopied, setIsCopied] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [activeTab, setActiveTab] = useState<"raw" | "preview">("preview");

  // Switch to preview tab when generation starts
  useEffect(() => {
    if (isGenerating) {
      setActiveTab("preview");
    }
  }, [isGenerating]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom during generation
  useEffect(() => {
    if (isGenerating && generatedDescription) {
      const scroll = () => {
        // Scroll the raw textarea
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }

        // Scroll the preview container if it has internal scroll
        if (previewRef.current) {
          previewRef.current.scrollTop = previewRef.current.scrollHeight;
        }

        // Scroll the main container to the bottom to see more content and the footer
        if (mainRef.current) {
          mainRef.current.scrollTop = mainRef.current.scrollHeight;
        }

        // Also scroll the Radix ScrollArea viewport if we are inside one
        // This is crucial because the entire view might be inside a ScrollArea
        const viewport =
          mainRef.current?.closest("[data-radix-scroll-area-viewport]") ||
          mainRef.current?.querySelector("[data-radix-scroll-area-viewport]");
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      };

      // Use multiple requestAnimationFrame calls to ensure DOM has fully updated
      // This handles layout changes when title field toggles on/off
      const rafId1 = requestAnimationFrame(() => {
        const rafId2 = requestAnimationFrame(scroll);
        return () => cancelAnimationFrame(rafId2);
      });
      return () => cancelAnimationFrame(rafId1);
    }
  }, [generatedDescription, isGenerating, generateTitle]);

  useEffect(() => {
    if (!isGenerating && generatedDescription) {
      const trimmed = generatedDescription.trim();
      if (trimmed.startsWith("```markdown") && trimmed.endsWith("```")) {
        const cleaned = trimmed
          .replace(/^```markdown\s*/, "")
          .replace(/\s*```$/, "");
        setGeneratedDescription(cleaned);
      }
    }
  }, [generatedDescription, isGenerating, setGeneratedDescription]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedDescription);
      setIsCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);

      trackCopyClicked({
        description_length: generatedDescription.length,
        has_title: Boolean(generatedTitle),
        view_type: activeTab,
      });
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleInsert = async () => {
    if (!generatedDescription || !currentUrl) return;

    setIsInserting(true);
    try {
      await updatePRDescription(
        currentUrl,
        generatedDescription,
        generateTitle ? generatedTitle : undefined,
      );
      toast.success("PR updated!");

      trackApplyClicked({
        url: currentUrl,
        description_length: generatedDescription.length,
        has_title: Boolean(generatedTitle),
        model_id: activeModel?.id || "unknown",
        model_provider: activeModel?.provider || "unknown",
      });

      reset();
      setTimeout(() => window.close(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update PR");
    } finally {
      setIsInserting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!currentUrl) return;
    // Mark that user has clicked regenerate
    if (!hasRegenerated) {
      setHasRegenerated(true);
    }

    trackRegenerateClicked({
      url: currentUrl,
      model_id: activeModel?.id || "unknown",
      model_provider: activeModel?.provider || "unknown",
    });

    try {
      await generate(currentUrl, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed");
    }
  };

  // Show the generating footer (with disabled model selector and generating button)
  // whenever isGenerating is true - this applies to both first generation and regenerations
  const showGeneratingFooter = isGenerating; // Always show during any generation including streaming

  return (
    <div
      ref={mainRef}
      className="flex flex-col h-full bg-background overflow-hidden"
    >
      <ScrollArea classNames={{ root: "flex-1 min-h-0" }}>
        <div className="px-6 pt-4 space-y-4 pb-4">
          {generateTitle && (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Title</Label>
              <Input
                value={generatedTitle}
                onChange={(e) => setGeneratedTitle(e.target.value)}
                disabled={isGenerating}
                className="font-medium disabled:cursor-not-allowed"
                placeholder="PR Title"
              />
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "raw" | "preview")}
            className="flex flex-col h-full"
            id="tour-result"
          >
            <div className="sticky top-0 bg-background z-10 py-2 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          onClick={handleCopy}
                          disabled={isCopied || isGenerating}
                          className="h-8 w-8 p-0 rounded-sm"
                        >
                          {isCopied ? (
                            <IconCheck className="w-4 h-4" />
                          ) : (
                            <IconCopy className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">
                          {isCopied ? "Copied!" : "Copy to clipboard"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <TooltipProvider delayDuration={100}>
                  <TabsList className="h-8 bg-muted/50 border border-border/50 rounded-full p-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="raw"
                          className={`rounded-full px-3 py-1.5 ${
                            activeTab === "raw"
                              ? "bg-background text-foreground shadow-sm"
                              : ""
                          }`}
                        >
                          <IconCode className="w-4 h-4 text-foreground" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">Raw</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value="preview"
                          className={`rounded-full px-3 py-1.5 ${
                            activeTab === "preview"
                              ? "bg-background text-foreground shadow-sm"
                              : ""
                          }`}
                        >
                          <IconEye className="w-4 h-4 text-foreground" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">Preview</p>
                      </TooltipContent>
                    </Tooltip>
                  </TabsList>
                </TooltipProvider>
              </div>
            </div>

            <TabsContent value="raw" className="mt-0 flex-1">
              {isGenerating && !generatedDescription ? (
                <div className="h-60 w-full rounded-md border border-input bg-transparent px-3 py-4 text-xs overflow-y-auto scrollbar-thin border-t-0 rounded-t-none">
                  <SkeletonMarkdown />
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  value={generatedDescription}
                  onChange={(e) => setGeneratedDescription(e.target.value)}
                  disabled={isGenerating}
                  className="resize-none h-[280px] w-full text-sm font-mono scrollbar-thin rounded-t-none border border-t-0 border-secondary focus-visible:border-ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
                  placeholder="Your generated description will appear here..."
                />
              )}
            </TabsContent>

            <TabsContent value="preview" className="mt-0 flex-1">
              <div
                ref={previewRef}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs overflow-y-auto scrollbar-thin border-t-0 rounded-t-none min-h-[240px]"
              >
                {isGenerating && !generatedDescription ? (
                  <SkeletonMarkdown />
                ) : generatedDescription ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-xs">
                    <ReactMarkdown>{generatedDescription}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    Your generated description will appear here...
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground text-center mt-2">
            A.I can make mistakes, always review the generated content.
          </p>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 bg-background border-t border-border/50 flex flex-col gap-3">
        {/* During generation (first time or when no content yet), show GeneratorView-style footer */}
        {showGeneratingFooter ? (
          <div className="flex items-center gap-3">
            <Button
              disabled={true}
              className={`flex-1 h-10 gap-2 text-base font-bold rounded-lg shadow-lg transition-all duration-300`}
              size="lg"
            >
              <span
                className={`animate-in fade-in slide-in-from-bottom-1 duration-300 shimmer-metallic`}
                key="generating"
              >
                Generating...
              </span>
            </Button>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      trackGenerationStopped({
                        url: currentUrl,
                        model_id: activeModel?.id || "unknown",
                        partial_description_length: generatedDescription.length,
                        reason: "user_cancelled",
                      });
                      stopGeneration();
                    }}
                    className="h-10 w-10 flex items-center justify-center rounded-lg text-white hover:text-white/80 transition-colors shrink-0 cursor-pointer"
                    aria-label="Stop generation"
                  >
                    <FluentRecordStopFilled
                      width={20}
                      height={20}
                      className="fill-current"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">Stop generation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          /* After first generation completes, show ResultView footer with fade-in */
          <div className={`flex flex-col gap-4`}>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="flex-1 h-10 gap-2 text-xs font-medium rounded-lg border border-border"
              >
                {isRegenerating ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                    <span>Regenerating...</span>
                  </>
                ) : (
                  <>
                    <IconRefresh className="w-4 h-4" />
                    <span>Regenerate</span>
                  </>
                )}
              </Button>

              {((generatedDescription && (!generateTitle || generatedTitle)) ||
                isInserting) && (
                <Button
                  onClick={handleInsert}
                  disabled={isInserting || isGenerating}
                  className="flex-1 h-10 gap-2 text-xs font-medium rounded-lg border border-border shadow-lg"
                >
                  {isInserting ? (
                    <>
                      <IconLoader2 className="w-5 h-5 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <IconCheck className="w-5 h-5" />
                      <span>Apply</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
        <ModelSelectorFooter
          disabled={isGenerating}
          onSettingsClick={() => {
            trackButtonClick("settings", { from_view: "result" });
            openOptionsPage();
          }}
        />
      </div>
    </div>
  );
}
