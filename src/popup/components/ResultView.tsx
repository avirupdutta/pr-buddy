import { useState, useEffect, useRef } from "react";
import {
  IconCopy,
  IconRefresh,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import { useGeneratorStore } from "@/stores/generator-store";
import { updatePRDescription } from "@/services/chrome-messaging";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResultViewProps {
  currentUrl: string;
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
  } = useGeneratorStore();

  const [isCopied, setIsCopied] = useState(false);
  const [isInserting, setIsInserting] = useState(false);

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

      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      const rafId = requestAnimationFrame(scroll);
      return () => cancelAnimationFrame(rafId);
    }
  }, [generatedDescription, isGenerating]);

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
        generatedTitle,
      );
      toast.success("PR updated!");
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
    try {
      await generate(currentUrl, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed");
    }
  };

  return (
    <div
      ref={mainRef}
      className="flex flex-col h-full bg-background overflow-hidden"
    >
      <ScrollArea classNames={{ root: "flex-1 min-h-0" }}>
        <div className="px-6 pt-4 space-y-4 pb-4">
          {(generateTitle || generatedTitle) && (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Title</Label>
              <Input
                value={generatedTitle}
                onChange={(e) => setGeneratedTitle(e.target.value)}
                className="font-medium"
                placeholder="PR Title"
              />
            </div>
          )}

          <Tabs defaultValue="preview" className="flex flex-col gap-2 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Description</Label>
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
              </div>
              <TabsList className="h-8">
                <TabsTrigger value="raw" className="text-xs">
                  Raw
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="raw" className="mt-0 flex-1">
              <Textarea
                ref={textareaRef}
                value={generatedDescription}
                onChange={(e) => setGeneratedDescription(e.target.value)}
                className="resize-none h-60 w-full text-sm font-mono scrollbar-thin"
                placeholder="Your generated description will appear here..."
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-0 flex-1">
              <div
                ref={previewRef}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs overflow-y-auto scrollbar-thin"
              >
                {generatedDescription ? (
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
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 bg-background border-t border-border/50 flex flex-col gap-4">
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

          <Button
            onClick={handleInsert}
            disabled={isInserting || isGenerating}
            className="flex-1 h-10 gap-2 text-xs font-medium rounded-lg border border-border shadow-lg"
          >
            {isInserting ? (
              <>
                <IconLoader2 className="w-5 h-5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <IconCheck className="w-5 h-5" />
                <span>Apply</span>
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          A.I can make mistakes, always review the generated content.
        </p>
      </div>
    </div>
  );
}
