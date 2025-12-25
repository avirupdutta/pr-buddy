import { useEffect, useState } from "react";
import {
  IconPuzzle,
  IconKey,
  IconRobot,
  IconDeviceFloppy,
  IconCheck,
  IconExternalLink,
  IconCode,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsStore } from "@/stores/settings-store";
import { ApiKeyInput } from "./components/ApiKeyInput";
import { toast } from "sonner";

// Separate component for the settings form - this mounts only after loading completes,
// so useState initializers naturally receive the correct values from the store
interface SettingsFormProps {
  initialGithubToken: string;
  initialOpenRouterKey: string;
  initialDevMode: boolean;
  initialDevPrUrl: string;
  isSaving: boolean;
  onSave: (settings: {
    githubToken: string;
    openRouterKey: string;
    devMode: boolean;
    devPrUrl: string;
  }) => Promise<void>;
}

function SettingsForm({
  initialGithubToken,
  initialOpenRouterKey,
  initialDevMode,
  initialDevPrUrl,
  isSaving,
  onSave,
}: SettingsFormProps) {
  const [localGithubToken, setLocalGithubToken] = useState(initialGithubToken);
  const [localOpenRouterKey, setLocalOpenRouterKey] =
    useState(initialOpenRouterKey);
  const [localDevMode, setLocalDevMode] = useState(initialDevMode);
  const [localDevPrUrl, setLocalDevPrUrl] = useState(initialDevPrUrl);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    await onSave({
      githubToken: localGithubToken,
      openRouterKey: localOpenRouterKey,
      devMode: localDevMode,
      devPrUrl: localDevPrUrl,
    });

    setShowSuccess(true);
    toast.success("Settings saved successfully!");
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general" className="gap-2">
            <IconPuzzle className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="developer" className="gap-2">
            <IconCode className="w-4 h-4" />
            Developer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex flex-col gap-6 mt-4">
          {/* GitHub Token */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                GitHub Personal Access Token
              </Label>
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
              >
                Generate Token
                <IconExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
            <ApiKeyInput
              value={localGithubToken}
              onChange={setLocalGithubToken}
              placeholder="ghp_************************************"
              icon={<IconKey className="w-5 h-5" />}
            />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-primary">ℹ</span>
              Required scope:{" "}
              <code className="font-mono rounded bg-muted px-1 py-0.5">
                repo
              </code>{" "}
              to read repository context.
            </p>
          </div>

          <Separator />

          {/* OpenRouter Key */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                OpenRouter API Key
              </Label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
              >
                Get Key
                <IconExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
            <ApiKeyInput
              value={localOpenRouterKey}
              onChange={setLocalOpenRouterKey}
              placeholder="sk-or-************************************"
              icon={<IconRobot className="w-5 h-5" />}
            />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-primary">ℹ</span>
              Required to generate the text descriptions via LLM.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="developer" className="flex flex-col gap-6 mt-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dev-mode" className="font-medium">
                Developer Mode
              </Label>
              <span className="text-xs text-muted-foreground">
                Enable testing with a sample PR URL instead of the active tab.
              </span>
            </div>
            <Switch
              id="dev-mode"
              checked={localDevMode}
              onCheckedChange={setLocalDevMode}
            />
          </div>

          {localDevMode && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Sample PR URL
              </Label>
              <Input
                value={localDevPrUrl}
                onChange={(e) => setLocalDevPrUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/123"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter a full GitHub pull request URL to test against.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="pt-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full gap-2 shadow-lg"
          size="lg"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              Saving...
            </>
          ) : showSuccess ? (
            <>
              <IconCheck className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <IconDeviceFloppy className="w-5 h-5" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function OptionsApp() {
  const {
    githubToken,
    openRouterKey,
    devMode,
    devPrUrl,
    isLoading,
    isSaving,
    load,
    save,
  } = useSettingsStore();

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10 flex justify-center overflow-hidden">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[640px] flex flex-col gap-8">
          {/* Header */}
          <header className="flex flex-col gap-4 text-center sm:text-left animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <IconPuzzle className="w-7 h-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Extension Settings
              </h1>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-xl">
              Configure your API keys to enable AI-generated PR descriptions.
              Your keys are stored locally in your browser.
            </p>
          </header>

          {/* Settings Card */}
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <CardContent className="pt-6 flex flex-col gap-6">
              <SettingsForm
                initialGithubToken={githubToken || ""}
                initialOpenRouterKey={openRouterKey || ""}
                initialDevMode={devMode || false}
                initialDevPrUrl={devPrUrl || ""}
                isSaving={isSaving}
                onSave={save}
              />
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">
              Documentation
            </a>
            <span>•</span>
            <a href="#" className="hover:text-primary transition-colors">
              Support
            </a>
            <span>•</span>
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
