// Mock Chrome APIs for development in browser context
// This file provides fallbacks when chrome.* APIs are not available

import { DEFAULT_AI_MODELS, DEFAULT_TEMPLATES } from "@/stores/settings-store";
import type {
  PRTemplate,
  AIModel,
  GeneratorSettings,
  StreamMessage,
  MessageAction,
  GenerateResponse,
} from "@/types/chrome";
import { decryptApiKey } from "./encryption";
import { sendToastNotification } from "./notifications";
import { createAISDKService, type AIRequestParams } from "./ai-sdk-service";

/**
 * Check if we're running in a Chrome extension context
 */
export function isExtensionContext(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

/**
 * LocalStorage-backed storage for development (persists across refreshes)
 */
const DEV_STORAGE_KEY = "pr-buddy-dev-storage";

function getDevStorage(): Record<string, unknown> {
  try {
    const stored = localStorage.getItem(DEV_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setDevStorage(data: Record<string, unknown>): void {
  try {
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Mock storage change listeners
 */
const storageListeners: Array<
  (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => void
> = [];

/**
 * Mock Chrome storage API for development
 */
export const mockStorage = {
  local: {
    get: (
      keys: string | string[],
      callback: (result: Record<string, unknown>) => void,
    ) => {
      const devStorage = getDevStorage();
      const keyArray = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      keyArray.forEach((key) => {
        if (key in devStorage) {
          result[key] = devStorage[key];
        }
      });
      setTimeout(() => callback(result), 10);
    },
    set: (items: Record<string, unknown>, callback?: () => void) => {
      const devStorage = getDevStorage();
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      Object.entries(items).forEach(([key, value]) => {
        changes[key] = { oldValue: devStorage[key], newValue: value };
        devStorage[key] = value;
      });
      // Persist to localStorage
      setDevStorage(devStorage);
      // Notify listeners
      storageListeners.forEach((listener) => listener(changes));
      if (callback) setTimeout(callback, 10);
    },
    remove: (keys: string | string[], callback?: () => void) => {
      const devStorage = getDevStorage();
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => delete devStorage[key]);
      // Persist to localStorage
      setDevStorage(devStorage);
      if (callback) setTimeout(callback, 10);
    },
  },
  onChanged: {
    addListener: (
      listener: (
        changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
        areaName: string,
      ) => void,
    ) => {
      const wrappedListener = (
        changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
      ) => listener(changes, "local");
      storageListeners.push(wrappedListener);
    },
    removeListener: (
      listener: (
        changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
        areaName: string,
      ) => void,
    ) => {
      const index = storageListeners.findIndex((l) => l === listener);
      if (index > -1) storageListeners.splice(index, 1);
    },
  },
};

/**
 * Mock Chrome tabs API for development
 */
export const mockTabs = {
  query: (
    _queryInfo: { active?: boolean; currentWindow?: boolean },
    callback: (tabs: Array<{ url?: string; id?: number }>) => void,
  ) => {
    // Return a mock GitHub PR URL for development
    setTimeout(
      () =>
        callback([
          {
            url: "https://github.com/example/repo/pull/1",
            id: 1,
          },
        ]),
      10,
    );
  },
};

/**
 * Mock Port interface
 */
interface MockPort {
  name: string;
  onMessage: {
    addListener: (callback: (msg: StreamMessage) => void) => void;
    removeListener: (callback: (msg: StreamMessage) => void) => void;
  };
  onDisconnect: {
    addListener: (callback: () => void) => void;
    removeListener: (callback: () => void) => void;
  };
  postMessage: (msg: { url: string; settings: GeneratorSettings }) => void;
  disconnect: () => void;
}

/**
 * Mock Chrome runtime API for development - uses real API calls
 */
export const mockRuntime = {
  sendMessage: (message: unknown, callback?: (response: unknown) => void) => {
    // Actually make real API calls in dev mode using stored credentials
    const msg = message as MessageAction;

    if (msg.action === "GENERATE_DESCRIPTION" && callback) {
      handleDevGeneration(msg.url, msg.settings)
        .then((result) => callback(result))
        .catch((err) => callback({ success: false, error: err.message }));
    } else if (msg.action === "UPDATE_PR_DESCRIPTION" && callback) {
      handleDevUpdatePR(msg.url, msg.description, msg.title)
        .then((result) => callback(result))
        .catch((err) => callback({ success: false, error: err.message }));
    } else if (callback) {
      callback({ success: false, error: "Unknown action" });
    }
  },
  connect: (connectInfo?: { name?: string }): MockPort => {
    const listeners: ((msg: StreamMessage) => void)[] = [];
    const disconnectListeners: (() => void)[] = [];

    const port: MockPort = {
      name: connectInfo?.name || "",
      onMessage: {
        addListener: (cb) => listeners.push(cb),
        removeListener: (cb) => {
          const idx = listeners.indexOf(cb);
          if (idx !== -1) listeners.splice(idx, 1);
        },
      },
      onDisconnect: {
        addListener: (cb) => disconnectListeners.push(cb),
        removeListener: (cb) => {
          const idx = disconnectListeners.indexOf(cb);
          if (idx !== -1) disconnectListeners.splice(idx, 1);
        },
      },
      postMessage: async (msg: {
        url: string;
        settings: GeneratorSettings;
      }) => {
        // Handle streaming request
        if (connectInfo?.name === "GENERATE_DESCRIPTION_STREAM") {
          try {
            await handleDevGenerationStream(
              msg.url,
              msg.settings,
              (responseMsg) => {
                listeners.forEach((cb) => cb(responseMsg));
              },
            );
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : "Unknown error";

            // Send toast notification for OpenRouter API errors
            if (
              errorMessage.includes("OpenRouter") ||
              errorMessage.includes("API")
            ) {
              sendToastNotification(
                `OpenRouter API Error: ${errorMessage}`,
                "error",
              );
            }

            listeners.forEach((cb) =>
              cb({
                type: "error",
                error: errorMessage,
              }),
            );
          }
        }
      },
      disconnect: () => {
        disconnectListeners.forEach((cb) => cb());
      },
    };

    return port;
  },
  openOptionsPage: () => {
    // In dev mode, dispatch a custom event that React Router listens for
    window.dispatchEvent(
      new CustomEvent("dev-navigate", { detail: { path: "/options" } }),
    );
  },
  getURL: (path: string) => `/${path}`,
  lastError: null as { message: string } | null,
};

// Dev mode API handlers (mirrors background script logic)
async function handleDevGenerationStream(
  url: string,
  settings: GeneratorSettings,
  postMessage: (msg: StreamMessage) => void,
): Promise<void> {
  const devStorage = getDevStorage();
  const encryptedGithubToken = devStorage.githubToken as string;
  const encryptedOpenRouterKey = devStorage.openRouterKey as string;
  const encryptedOpenaiKey = devStorage.openaiKey as string;
  const encryptedAnthropicKey = devStorage.anthropicKey as string;
  const encryptedGoogleKey = devStorage.googleKey as string;
  const encryptedGroqKey = devStorage.groqKey as string;
  const encryptedCerebrasKey = devStorage.cerebrasKey as string;

  // Decrypt API keys
  const githubToken = encryptedGithubToken
    ? await decryptApiKey(encryptedGithubToken)
    : null;
  const openRouterKey = encryptedOpenRouterKey
    ? await decryptApiKey(encryptedOpenRouterKey)
    : null;
  const openaiKey = encryptedOpenaiKey
    ? await decryptApiKey(encryptedOpenaiKey)
    : null;
  const anthropicKey = encryptedAnthropicKey
    ? await decryptApiKey(encryptedAnthropicKey)
    : null;
  const googleKey = encryptedGoogleKey
    ? await decryptApiKey(encryptedGoogleKey)
    : null;
  const groqKey = encryptedGroqKey
  const cerebrasKey = encryptedCerebrasKey
    ? await decryptApiKey(encryptedCerebrasKey)
    : null;

  const templates = (devStorage.templates as PRTemplate[]) || DEFAULT_TEMPLATES;
  const aiModels = (devStorage.aiModels as AIModel[]) || DEFAULT_AI_MODELS;

  if (!githubToken) {
    throw new Error("Missing GitHub Token. Please configure it in Settings.");
  }

  // Get selected model from settings or fallback to active model
  let selectedModel: AIModel;
  const selectedModelFromSettings = settings.selectedModel;
  if (selectedModelFromSettings && selectedModelFromSettings.id) {
    // Find the model in our model list to ensure it's valid
    const foundModel = aiModels.find(
      (m) => m.id === selectedModelFromSettings.id,
    );
    if (!foundModel) {
      throw new Error(
        `Selected model not found: ${selectedModelFromSettings.id}`,
      );
    }
    selectedModel = foundModel;
  } else {
    // Fallback to active model (backward compatibility)
    selectedModel = aiModels.find((m) => m.isActive) || aiModels[0];
  }

  // Get the provider for the selected model
  const provider = selectedModel.provider || "openrouter";

  // Check if the required API key is available for the provider
  const getProviderApiKey = (): string | null => {
    switch (provider) {
      case "openai":
        return openaiKey;
      case "anthropic":
        return anthropicKey;
      case "google":
        return googleKey;
      case "groq":
        return groqKey;
      case "cerebras":
        return cerebrasKey;
      case "openrouter":
      default:
        return openRouterKey;
    }
  };

  const providerApiKey = getProviderApiKey();
  if (!providerApiKey) {
    throw new Error(
      `Missing API key for ${provider} provider. Please configure it in Settings.`,
    );
  }

  // Find selected template
  const selectedTemplate =
    templates.find((t) => t.id === settings.templateId) || templates[0];

  // Parse GitHub URL
  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error("Invalid GitHub PR URL.");
  }
  const [, owner, repo, number] = match;

  // Fetch PR data (reusing same logic)
  const headers = {
    Authorization: `token ${githubToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  const metaRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers },
  );
  if (!metaRes.ok) {
    throw new Error("Failed to fetch PR metadata");
  }
  const metadata = await metaRes.json();

  const diffRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers: { ...headers, Accept: "application/vnd.github.v3.diff" } },
  );
  if (!diffRes.ok) throw new Error("Failed to fetch PR diff");

  let diff = await diffRes.text();
  if (diff.length > 50000) {
    diff = diff.substring(0, 50000) + "\n...[Diff Truncated]...";
  }

  // Generate with AI Streaming using AI SDK
  const toneDescription =
    TONE_DESCRIPTIONS[settings.tone || "professional"] ||
    TONE_DESCRIPTIONS.professional;

  const systemPrompt = `You are an expert software engineer assistant. Your task is to generate a Pull Request title and description.

IMPORTANT: You must stream the response in this EXACT format:
TITLE: <Your concise title here>
<<<SEPARATOR>>>
DESCRIPTION: <Your markdown description here>

TITLE GUIDELINES:
- Use the imperative mood
- Max 60 chars
- Focus on main change

DESCRIPTION GUIDELINES:
- Writing Style: ${toneDescription}
- Use this structure:
${selectedTemplate.structure}
- Be specific, reference files.
- No diffs.

${
  settings.context
    ? `USER INSTRUCTIONS:
${settings.context}`
    : ""
}`;

  const userPrompt = `
Current PR Title: ${metadata.title}
Branch: ${metadata.head.ref} -> ${metadata.base.ref}
${
  settings.includeTickets
    ? `\nTicket Detection: Look for ticket IDs in "${metadata.head.ref}" and include them.`
    : ""
}

File Changes Summary:
- ${metadata.changed_files || "N/A"} files changed
- +${metadata.additions || 0} additions, -${metadata.deletions || 0} deletions

Diff:
\`\`\`diff
${diff}
\`\`\`

Generate the TITLE and DESCRIPTION now in the requested format.`;

  // Create AI SDK service instance
  const aiService = createAISDKService({
    openaiKey: openaiKey || "",
    anthropicKey: anthropicKey || "",
    googleKey: googleKey || "",
    groqKey: groqKey || "",
    cerebrasKey: cerebrasKey || "",
    openRouterKey: openRouterKey || "",
  });

  const requestParams: AIRequestParams = {
    model: selectedModel,
    systemPrompt,
    userPrompt,
    stream: true,
  };

  // Stream the response using AI SDK
  let accumulatedContent = "";
  for await (const chunk of aiService.generateTextStream(requestParams)) {
    if (chunk.error) {
      throw new Error(chunk.error);
    }

    if (chunk.description) {
      // Calculate delta (new content since last chunk)
      const delta = chunk.description.slice(accumulatedContent.length);
      accumulatedContent = chunk.description;

      if (delta) {
        postMessage({ type: "chunk", content: delta });
      }
    }
  }

  postMessage({
    type: "complete",
    data: {
      success: true,
      description: "",
      title: "",
      prDetails: {
        owner: owner,
        repo: repo,
        number: String(number),
      },
    },
  });
}

async function handleDevGeneration(
  url: string,
  settings: unknown,
): Promise<GenerateResponse> {
  const devStorage = getDevStorage();
  const encryptedGithubToken = devStorage.githubToken as string;
  const encryptedOpenRouterKey = devStorage.openRouterKey as string;
  const encryptedOpenaiKey = devStorage.openaiKey as string;
  const encryptedCerebrasKey = devStorage.cerebrasKey as string;
  const encryptedAnthropicKey = devStorage.anthropicKey as string;
  const encryptedGoogleKey = devStorage.googleKey as string;
  const encryptedGroqKey = devStorage.groqKey as string;

  // Decrypt API keys
  const githubToken = encryptedGithubToken
    ? await decryptApiKey(encryptedGithubToken)
    : null;
  const openRouterKey = encryptedOpenRouterKey
    ? await decryptApiKey(encryptedOpenRouterKey)
    : null;
  const openaiKey = encryptedOpenaiKey
    ? await decryptApiKey(encryptedOpenaiKey)
    : null;
  const anthropicKey = encryptedAnthropicKey
    ? await decryptApiKey(encryptedAnthropicKey)
    : null;
  const googleKey = encryptedGoogleKey
    ? await decryptApiKey(encryptedGoogleKey)
    : null;
  const groqKey = encryptedGroqKey
    ? await decryptApiKey(encryptedGroqKey)
    : null;
  const cerebrasKey = encryptedCerebrasKey
    ? await decryptApiKey(encryptedCerebrasKey)
    : null;

  // Get templates and models from storage or use defaults
  const templates = (devStorage.templates as PRTemplate[]) || DEFAULT_TEMPLATES;
  const aiModels = (devStorage.aiModels as AIModel[]) || DEFAULT_AI_MODELS;

  if (!githubToken) {
    throw new Error("Missing GitHub Token. Please configure it in Settings.");
  }

  // Parse settings
  const s = (settings as Partial<GeneratorSettings>) || {};

  // Get selected model from settings or fallback to active model
  let selectedModel: AIModel;
  const selectedModelFromSettings = s.selectedModel;
  if (selectedModelFromSettings && selectedModelFromSettings.id) {
    // Find the model in our model list to ensure it's valid
    const foundModel = aiModels.find(
      (m) => m.id === selectedModelFromSettings.id,
    );
    if (!foundModel) {
      throw new Error(
        `Selected model not found: ${selectedModelFromSettings.id}`,
      );
    }
    selectedModel = foundModel;
  } else {
    // Fallback to active model (backward compatibility)
    selectedModel = aiModels.find((m) => m.isActive) || aiModels[0];
  }

  // Get the provider for the selected model
  const provider = selectedModel.provider || "openrouter";

  // Check if the required API key is available for the provider
  const getProviderApiKey = (): string | null => {
    switch (provider) {
      case "openai":
        return openaiKey;
      case "anthropic":
        return anthropicKey;
      case "google":
        return googleKey;
      case "groq":
        return groqKey;
      case "cerebras":
        return cerebrasKey;
      case "openrouter":
      default:
        return openRouterKey;
    }
  };

  const providerApiKey = getProviderApiKey();
  if (!providerApiKey) {
    throw new Error(
      `Missing API key for ${provider} provider. Please configure it in Settings.`,
    );
  }

  // Find selected template
  const selectedTemplate =
    templates.find((t) => t.id === s.templateId) || templates[0];

  // Parse GitHub URL
  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error("Invalid GitHub PR URL.");
  }
  const [, owner, repo, number] = match;
  const prDetails = { owner, repo, number };

  // Fetch PR data
  const headers = {
    Authorization: `token ${githubToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  const metaRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers },
  );
  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(
      "Failed to fetch PR: " + (err.message || metaRes.statusText),
    );
  }
  const metadata = await metaRes.json();

  // Fetch diff
  const diffRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers: { ...headers, Accept: "application/vnd.github.v3.diff" } },
  );
  if (!diffRes.ok) throw new Error("Failed to fetch PR diff");

  let diff = await diffRes.text();
  if (diff.length > 50000) {
    diff = diff.substring(0, 50000) + "\n...[Diff Truncated]...";
  }

  // Generate with AI using AI SDK
  const aiResult = await generateWithAISDK(
    diff,
    metadata,
    s,
    selectedTemplate,
    selectedModel,
    {
      openaiKey: openaiKey || "",
      anthropicKey: anthropicKey || "",
      googleKey: googleKey || "",
      groqKey: groqKey || "",
      cerebrasKey: cerebrasKey || "",
      openRouterKey: openRouterKey || "",
    },
  );

  return {
    success: true,
    description: aiResult.description,
    title: s.generateTitle ? aiResult.title : undefined,
    prDetails,
  };
}

async function handleDevUpdatePR(
  url: string,
  description: string,
  title?: string,
): Promise<{ success: boolean }> {
  const devStorage = getDevStorage();
  const encryptedGithubToken = devStorage.githubToken as string;

  // Decrypt API key
  const githubToken = encryptedGithubToken
    ? await decryptApiKey(encryptedGithubToken)
    : null;

  if (!githubToken) throw new Error("Missing GitHub Token.");

  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  if (!match) throw new Error("Invalid GitHub PR URL.");
  const [, owner, repo, number] = match;

  const body: { body: string; title?: string } = { body: description };
  if (title) {
    body.title = title;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const err = await response.json();
    const errorMessage = err.error?.message || response.statusText;

    // Send specific toast notification for OpenRouter API failure
    sendToastNotification(`OpenRouter API Error: ${errorMessage}`, "error");

    throw new Error("AI Generation failed: " + errorMessage);
  }
  return { success: true };
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  auto: "Balanced and objective.",
  professional: "Professional, formal, and detailed.",
  casual: "Friendly and conversational.",
  concise: "Brief and to the point.",
};

// Response structure for AI generation
interface AIGenerationResult {
  title: string;
  description: string;
}

async function generateWithAISDK(
  diff: string,
  metadata: {
    title: string;
    head: { ref: string };
    base: { ref: string };
    changed_files?: number;
    additions?: number;
    deletions?: number;
  },
  settings: Partial<GeneratorSettings>,
  template: PRTemplate,
  model: AIModel,
  apiKeys: {
    openaiKey: string;
    anthropicKey: string;
    googleKey: string;
    groqKey: string;
    cerebrasKey: string;
    openRouterKey: string;
  },
): Promise<AIGenerationResult> {
  const toneDescription =
    TONE_DESCRIPTIONS[settings.tone || "professional"] ||
    TONE_DESCRIPTIONS.professional;

  const systemPrompt = `You are an expert software engineer assistant. Your task is to generate a Pull Request title and description based on the provided code diffs and context.

You MUST respond with valid JSON in this exact format:
{
  "title": "A concise PR title",
  "description": "The full PR description in Markdown format"
}

TITLE GUIDELINES:
- Use the imperative mood (e.g., "Add feature" not "Added feature")
- Max 60 characters is ideal, but up to 80 is acceptable
- Focus on the main change
- No quotes or markdown formatting

DESCRIPTION GUIDELINES:
- Writing Style: ${toneDescription}
- Use this template structure:
${template.structure}
- Be specific about what changed
- Reference file names when relevant
- Keep it readable and scannable
- Don't include the diff in your response
- Don't make up information not present in the diff

${
  settings.context
    ? `USER INSTRUCTIONS (apply to both title and description):\n${settings.context}`
    : ""
}`;

  const userPrompt = `
Current PR Title: ${metadata.title}
Branch: ${metadata.head.ref} -> ${metadata.base.ref}
${
  settings.includeTickets
    ? `\nTicket Detection: Look for ticket IDs (like JIRA IDs) in the branch name "${metadata.head.ref}" and include them.`
    : ""
}

File Changes Summary:
- ${metadata.changed_files || "N/A"} files changed
- +${metadata.additions || 0} additions, -${metadata.deletions || 0} deletions

Diff:
\`\`\`diff
${diff}
\`\`\`

Generate the JSON response with title and description now.`;

  // Create AI SDK service instance
  const aiService = createAISDKService(apiKeys);

  const requestParams: AIRequestParams = {
    model,
    systemPrompt,
    userPrompt,
    stream: false,
  };

  try {
    const result = await aiService.generateText(requestParams);

    if (!result.success || !result.description) {
      throw new Error("AI generation failed");
    }

    // Parse the response to extract title and description
    // The AI SDK service returns text in TITLE: / DESCRIPTION: format
    const text = result.description;
    const titleMatch = text.match(/TITLE:\s*(.+?)(?=\n\nDESCRIPTION:|$)/s);
    const descriptionMatch = text.match(/DESCRIPTION:\s*(.+?)$/s);

    if (titleMatch && descriptionMatch) {
      return {
        title: titleMatch[1].trim(),
        description: descriptionMatch[1].trim(),
      };
    }

    // Fallback: try to parse as JSON
    try {
      const parsed = JSON.parse(text);
      return {
        title: (parsed.title || "").replace(/^"|"$/g, "").replace(/^`|`$/g, ""),
        description: parsed.description || text,
      };
    } catch {
      // If all parsing fails, return the raw text as description
      return {
        title: "",
        description: text,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    sendToastNotification(`AI SDK Error: ${errorMessage}`, "error");
    throw new Error("AI Generation failed: " + errorMessage);
  }
}

/**
 * Get Chrome API or mock based on context
 */
export function getChromeAPI() {
  if (isExtensionContext()) {
    return chrome;
  }

  // Return mock APIs for development
  return {
    storage: mockStorage,
    tabs: mockTabs,
    runtime: mockRuntime,
  } as unknown as typeof chrome;
}
