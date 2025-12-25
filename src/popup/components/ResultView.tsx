import { useState, useEffect } from "react";
import {
  IconCopy,
  IconUpload,
  IconRefresh,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import { useGeneratorStore } from "@/stores/generator-store";
import { updatePRDescription } from "@/services/chrome-messaging";
import { toast } from "sonner";

interface ResultViewProps {
  currentUrl: string;
}

export function ResultView({ currentUrl }: ResultViewProps) {
  const {
    generatedDescription,
    setGeneratedDescription,
    generate,
    isGenerating,
    reset,
  } = useGeneratorStore();

  const [isCopied, setIsCopied] = useState(false);
  const [isInserting, setIsInserting] = useState(false);

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
      await updatePRDescription(currentUrl, generatedDescription);
      toast.success("PR description updated!");
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
      await generate(currentUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed");
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        <Tabs defaultValue="preview" className="flex flex-col gap-2 h-full">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Description</Label>
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
              value={generatedDescription}
              onChange={(e) => setGeneratedDescription(e.target.value)}
              className="resize-none h-80 w-full text-sm font-mono"
              placeholder="Your generated description will appear here..."
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-0 flex-1">
            <div className="h-80 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm overflow-y-auto">
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
        <p className="text-xs text-muted-foreground text-center">
          Review the generated description above. You can copy it or auto-insert
          it into the PR.
        </p>
      </div>

      {/* Footer */}
      <div className="p-6 pt-2 bg-background border-t border-transparent flex flex-col gap-3">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={isCopied}
            className="flex-1 h-8 gap-2 text-xs font-semibold rounded-sm"
          >
            {isCopied ? (
              <>
                <IconCheck className="w-5 h-5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <IconCopy className="w-5 h-5" />
                <span>Copy</span>
              </>
            )}
          </Button>

          <Button
            onClick={handleInsert}
            disabled={isInserting}
            className="flex-1 h-8 gap-2 text-xs font-semibold rounded-sm shadow-lg"
          >
            {isInserting ? (
              <>
                <IconLoader2 className="w-5 h-5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <IconUpload className="w-5 h-5" />
                <span>Auto-Insert</span>
              </>
            )}
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={handleRegenerate}
          disabled={isGenerating}
          className="w-full h-10 gap-2 text-sm font-medium rounded-lg border border-border"
        >
          {isGenerating ? (
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
      </div>
    </>
  );
}
