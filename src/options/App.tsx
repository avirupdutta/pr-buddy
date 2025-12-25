import { useEffect, useState } from "react";
import {
  IconPuzzle,
  IconKey,
  IconRobot,
  IconDeviceFloppy,
  IconCheck,
  IconExternalLink,
  IconCode,
  IconArrowLeft,
  IconTemplate,
  IconCpu,
  IconPlus,
  IconPencil,
  IconTrash,
  IconCircleCheck,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsStore } from "@/stores/settings-store";
import { ApiKeyInput } from "./components/ApiKeyInput";
import { toast } from "sonner";
import { isDev } from "@/services/is-dev";
import { isExtensionContext } from "@/services/dev-mock";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { Textarea } from "@/components/ui/textarea";
import type { PRTemplate, AIModel } from "@/types/chrome";

// ============================================
// Template Editor Component
// ============================================
interface TemplateEditorProps {
  template?: PRTemplate;
  onSave: (data: { title: string; structure: string }) => void;
  onCancel: () => void;
}

function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [title, setTitle] = useState(template?.title || "");
  const [structure, setStructure] = useState(template?.structure || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !structure.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    onSave({ title: title.trim(), structure: structure.trim() });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-title">Template Title</Label>
        <Input
          id="template-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Bug Fix Report"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-structure">Template Structure</Label>
        <Textarea
          id="template-structure"
          value={structure}
          onChange={(e) => setStructure(e.target.value)}
          placeholder="Enter template structure with markdown..."
          className="min-h-[200px] font-mono text-sm"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <IconX className="w-4 h-4 mr-1" />
          Cancel
        </Button>
        <Button type="submit">
          <IconCheck className="w-4 h-4 mr-1" />
          {template ? "Update" : "Add"} Template
        </Button>
      </div>
    </form>
  );
}

// ============================================
// Model Editor Component
// ============================================
interface ModelEditorProps {
  model?: AIModel;
  onSave: (data: { name: string; modelId: string }) => void;
  onCancel: () => void;
}

function ModelEditor({ model, onSave, onCancel }: ModelEditorProps) {
  const [name, setName] = useState(model?.name || "");
  const [modelId, setModelId] = useState(model?.modelId || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !modelId.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    onSave({ name: name.trim(), modelId: modelId.trim() });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="model-name">Model Name</Label>
        <Input
          id="model-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., GPT-4 Turbo"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="model-id">Model ID</Label>
        <Input
          id="model-id"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="e.g., openai/gpt-4-turbo"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Enter the OpenRouter model ID (e.g., openai/gpt-4-turbo,
          anthropic/claude-3-opus)
        </p>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <IconX className="w-4 h-4 mr-1" />
          Cancel
        </Button>
        <Button type="submit">
          <IconCheck className="w-4 h-4 mr-1" />
          {model ? "Update" : "Add"} Model
        </Button>
      </div>
    </form>
  );
}

// ============================================
// Templates Tab Component
// ============================================
function TemplatesTab() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } =
    useSettingsStore();
  const [editingTemplate, setEditingTemplate] = useState<PRTemplate | null>(
    null
  );
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (data: { title: string; structure: string }) => {
    try {
      await addTemplate(data);
      toast.success("Template added successfully");
      setIsAdding(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add template"
      );
    }
  };

  const handleUpdate = async (data: { title: string; structure: string }) => {
    if (!editingTemplate) return;
    try {
      await updateTemplate(editingTemplate.id, data);
      toast.success("Template updated successfully");
      setEditingTemplate(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update template"
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      toast.success("Template deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete template"
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">PR Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage your PR description templates
          </p>
        </div>
        {!isAdding && !editingTemplate && (
          <Button
            size="sm"
            onClick={() => {
              setIsAdding(true);
              setEditingTemplate(null);
            }}
          >
            <IconPlus className="w-4 h-4 mr-1" />
            Add Template
          </Button>
        )}
      </div>

      {isAdding && (
        <TemplateEditor
          onSave={handleAdd}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleUpdate}
          onCancel={() => setEditingTemplate(null)}
        />
      )}

      <div className="flex flex-col gap-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{template.title}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {template.structure.substring(0, 80)}...
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditingTemplate(template);
                  setIsAdding(false);
                }}
              >
                <IconPencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(template.id)}
                disabled={templates.length <= 1}
                title={
                  templates.length <= 1
                    ? "Cannot delete the last template"
                    : "Delete template"
                }
              >
                <IconTrash className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// AI Models Tab Component
// ============================================
function AIModelsTab() {
  const { aiModels, addModel, updateModel, deleteModel, setActiveModel } =
    useSettingsStore();
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (data: { name: string; modelId: string }) => {
    try {
      await addModel(data);
      toast.success("Model added successfully");
      setIsAdding(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add model"
      );
    }
  };

  const handleUpdate = async (data: { name: string; modelId: string }) => {
    if (!editingModel) return;
    try {
      await updateModel(editingModel.id, data);
      toast.success("Model updated successfully");
      setEditingModel(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update model"
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id);
      toast.success("Model deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete model"
      );
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      await setActiveModel(id);
      toast.success("Active model updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to set active model"
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">AI Models</h3>
          <p className="text-sm text-muted-foreground">
            Manage AI models for generating descriptions
          </p>
        </div>
        {!isAdding && !editingModel && (
          <Button
            size="sm"
            onClick={() => {
              setIsAdding(true);
              setEditingModel(null);
            }}
          >
            <IconPlus className="w-4 h-4 mr-1" />
            Add Model
          </Button>
        )}
      </div>

      {isAdding && (
        <ModelEditor onSave={handleAdd} onCancel={() => setIsAdding(false)} />
      )}

      {editingModel && (
        <ModelEditor
          model={editingModel}
          onSave={handleUpdate}
          onCancel={() => setEditingModel(null)}
        />
      )}

      <div className="flex flex-col gap-2">
        {aiModels.map((model) => (
          <div
            key={model.id}
            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
              model.isActive
                ? "bg-primary/10 border-primary/50"
                : "bg-card hover:bg-accent/50"
            }`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{model.name}</span>
                {model.isActive && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {model.modelId}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!model.isActive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:text-primary"
                  onClick={() => handleSetActive(model.id)}
                  title="Set as active model"
                >
                  <IconCircleCheck className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditingModel(model);
                  setIsAdding(false);
                }}
              >
                <IconPencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(model.id)}
                disabled={aiModels.length <= 1}
                title={
                  aiModels.length <= 1
                    ? "Cannot delete the last model"
                    : "Delete model"
                }
              >
                <IconTrash className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Settings Form Component
// ============================================
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

  // Calculate grid columns based on available tabs
  // We use explicit class names so Tailwind can detect them
  const gridCols = isDev ? "grid-cols-4" : "grid-cols-3";

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className={`grid w-full ${gridCols}`}>
          <TabsTrigger value="general" className="gap-2">
            <IconPuzzle className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <IconTemplate className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="ai-models" className="gap-2">
            <IconCpu className="w-4 h-4" />
            AI Models
          </TabsTrigger>
          {isDev && (
            <TabsTrigger value="developer" className="gap-2">
              <IconCode className="w-4 h-4" />
              Developer
            </TabsTrigger>
          )}
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

          <Separator />

          {/* Theme Selection */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Appearance
            </Label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Choose your preferred theme for the extension.
              </span>
              <ThemeToggle variant="full" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="ai-models" className="mt-4">
          <AIModelsTab />
        </TabsContent>

        {isDev && (
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
        )}
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

// ============================================
// Main Options App Component
// ============================================
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
            {/* Back button for dev mode */}
            {!isExtensionContext() && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit -ml-2 gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("dev-navigate", { detail: { path: "/" } })
                  );
                }}
              >
                <IconArrowLeft className="w-4 h-4" />
                Back to Popup
              </Button>
            )}
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
