// Background Service Worker - TypeScript Migration
// Handles API calls to GitHub and OpenRouter

import type {
  MessageAction,
  MessageResponse,
  GeneratorSettings,
  PRDetails,
  PRMetadata,
  GenerateResponse,
  UpdateResponse,
  PRTemplate,
  AIModel,
} from "@/types/chrome";

import { decryptApiKey } from "@/services/encryption";
import { getDecryptedAPIKeys } from "@/services/api-keys";
import { DEFAULT_AI_MODELS, DEFAULT_TEMPLATES } from "@/stores/settings-store";
import { sendToastNotification } from "@/services/notifications";
import { aiServiceAdapter } from "@/services/ai-service-adapter";
import { createAISDKService } from "@/services/ai-sdk-service";
import modelMappings from "@/data/model-mappings.json";

// Get structured output setting from storage
async function getUseStructuredOutput(): Promise<boolean> {
  const result = await chrome.storage.local.get(['useStructuredOutput']);
  // Default to true for new installations
  return result.useStructuredOutput !== false;
}

// Helper function to find a predefined model by ID
function findPredefinedModel(id: string): AIModel | null {
  for (const [providerId, providerData] of Object.entries(modelMappings.providers)) {
    const foundModel = providerData.models.find((m) => m.id === id);
    if (foundModel) {
      return {
        id: foundModel.id,
        name: foundModel.name,
        modelId: foundModel.modelId,
        provider: providerId,
        isActive: true,
      };
    }
  }
  return null;
}

// Helper function to infer provider from modelId
function inferProviderFromModelId(modelId: string): string {
  if (modelId.includes("openai/") || modelId.startsWith("gpt-")) {
    return "openai";
  }
  if (modelId.includes("anthropic/") || modelId.startsWith("claude-")) {
    return "anthropic";
  }
  if (modelId.includes("google/") || modelId.startsWith("gemini-")) {
    return "google";
  }
  if (modelId.includes("groq/") || (modelId.startsWith("llama") && modelId.includes("versatile"))) {
    return "groq";
  }
  if (modelId.includes("cerebras/")) {
    return "cerebras";
  }
  // Default to openrouter for models with provider prefix or unknown format
  if (modelId.includes("/")) {
    return modelId.split("/")[0];
  }
  return "openrouter";
}

// Helper functions for AI service adapter integration

// Listen for long-lived connections (streaming)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "GENERATE_DESCRIPTION_STREAM") return;

  port.onMessage.addListener(
    async (msg: { url: string; settings: GeneratorSettings }) => {
      try {
        await handleGenerationStream(msg.url, msg.settings, port);
      } catch (err) {
        port.postMessage({
          type: "error",
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }
    },
  );
});

// Message listener (one-off messages)
chrome.runtime.onMessage.addListener(
  (
    request: MessageAction,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<unknown>) => void,
  ) => {
    if (request.action === "GENERATE_DESCRIPTION") {
      handleGeneration(request.url, request.settings)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Async response
    }

    if (request.action === "UPDATE_PR_DESCRIPTION") {
      handleUpdatePR(request.url, request.description, request.title)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Async response
    }

    return false;
  },
);

async function handleGenerationStream(
  url: string,
  settings: GeneratorSettings,
  port: chrome.runtime.Port,
): Promise<void> {
  // 1. Get Credentials and Templates
  const result = (await chrome.storage.local.get([
    "githubToken",
    "openRouterKey",
    "cerebrasKey",
    "openaiKey",
    "anthropicKey",
    "googleKey",
    "groqKey",
    "templates",
    "aiModels",
  ])) as {
    githubToken?: string;
    openRouterKey?: string;
    cerebrasKey?: string;
    openaiKey?: string;
    anthropicKey?: string;
    googleKey?: string;
    groqKey?: string;
    templates?: PRTemplate[];
    aiModels?: AIModel[];
  };

  // Decrypt API keys
  const githubToken = result.githubToken
    ? await decryptApiKey(result.githubToken)
    : null;
  const openRouterKey = result.openRouterKey
    ? await decryptApiKey(result.openRouterKey)
    : null;
  const cerebrasKey = result.cerebrasKey
    ? await decryptApiKey(result.cerebrasKey)
    : null;

  const templates =
    result.templates && result.templates.length > 0
      ? result.templates
      : DEFAULT_TEMPLATES;
  const aiModels =
    result.aiModels && result.aiModels.length > 0
      ? result.aiModels
      : DEFAULT_AI_MODELS;

  if (!githubToken || (!openRouterKey && !cerebrasKey)) {
    throw new Error("Missing API Keys. Please configure them in Settings.");
  }

  // Get selected model from settings or fallback to active model
  let selectedModel: AIModel;
  const selectedModelFromSettings = settings.selectedModel;
  if (selectedModelFromSettings && selectedModelFromSettings.id) {
    // First, try to find the model in the custom aiModels list
    const foundModel = aiModels.find(
      (m) => m.id === selectedModelFromSettings.id,
    );
    if (foundModel) {
      selectedModel = foundModel;
    } else {
      // If not found in custom models, check predefined models
      const predefinedModel = findPredefinedModel(selectedModelFromSettings.id);
      if (predefinedModel) {
        selectedModel = predefinedModel;
      } else {
        // Last resort: try to construct a model from the settings data
        // This handles cases where the model ID might not be in predefined list
        // but we have the modelId and provider from the generator store
        if (selectedModelFromSettings.modelId && selectedModelFromSettings.provider) {
          selectedModel = {
            id: selectedModelFromSettings.id,
            name: selectedModelFromSettings.id, // Use ID as name fallback
            modelId: selectedModelFromSettings.modelId,
            provider: selectedModelFromSettings.provider,
            isActive: true,
          };
        } else {
          throw new Error(
            `Selected model not found: ${selectedModelFromSettings.id}`,
          );
        }
      }
    }
  } else {
    // Fallback to active model (backward compatibility)
    // First check custom models for an active one
    const activeCustomModel = aiModels.find((m) => m.isActive);
    if (activeCustomModel) {
      selectedModel = activeCustomModel;
    } else {
      // If no custom model is active, check for active predefined model
      const storageResult = await chrome.storage.local.get(['activePredefinedModelId']);
      const activePredefinedId = storageResult.activePredefinedModelId as string | undefined;
      if (activePredefinedId) {
        const predefinedModel = findPredefinedModel(activePredefinedId);
        if (predefinedModel) {
          selectedModel = predefinedModel;
        } else {
          selectedModel = aiModels[0];
        }
      } else {
        selectedModel = aiModels[0];
      }
    }
  }

  // Validate that the selected model has a provider
  if (!selectedModel.provider) {
    // Try to infer provider from modelId or use openrouter as default
    selectedModel = {
      ...selectedModel,
      provider: inferProviderFromModelId(selectedModel.modelId),
    };
  }

  // Find selected template
  const selectedTemplate =
    templates.find((t) => t.id === settings.templateId) || templates[0];

  // 2. Parse GitHub URL
  const prDetails = parseGitHubUrl(url);
  if (!prDetails) {
    throw new Error(
      "Invalid GitHub PR URL. Please navigate to a PR page like: github.com/owner/repo/pull/123",
    );
  }

  // 3. Fetch PR Data
  const { diff, metadata } = await fetchPRData(prDetails, githubToken);

  // 4. Generate with AI (streaming) using the AI service adapter
  const useStructuredOutput = await getUseStructuredOutput();
  if (useStructuredOutput) {
    await generateWithAIStructuredStreaming(
      diff,
      metadata,
      settings,
      selectedTemplate,
      selectedModel,
      port,
    );
  } else {
    await generateWithAIStreaming(
      diff,
      metadata,
      settings,
      selectedTemplate,
      selectedModel,
      port,
    );
  }

  // Note: generateWithAIStream handles sending the 'complete' message
}

async function handleGeneration(
  url: string,
  settings: GeneratorSettings,
): Promise<GenerateResponse> {
  // 1. Get Credentials, Templates, and Models
  const result = (await chrome.storage.local.get([
    "githubToken",
    "openRouterKey",
    "cerebrasKey",
    "openaiKey",
    "anthropicKey",
    "googleKey",
    "groqKey",
    "templates",
    "aiModels",
  ])) as {
    githubToken?: string;
    openRouterKey?: string;
    cerebrasKey?: string;
    openaiKey?: string;
    anthropicKey?: string;
    googleKey?: string;
    groqKey?: string;
    templates?: PRTemplate[];
    aiModels?: AIModel[];
  };

  // Decrypt API keys
  const githubToken = result.githubToken
    ? await decryptApiKey(result.githubToken)
    : null;
  const openRouterKey = result.openRouterKey
    ? await decryptApiKey(result.openRouterKey)
    : null;
  const cerebrasKey = result.cerebrasKey
    ? await decryptApiKey(result.cerebrasKey)
    : null;

  const templates =
    result.templates && result.templates.length > 0
      ? result.templates
      : DEFAULT_TEMPLATES;
  const aiModels =
    result.aiModels && result.aiModels.length > 0
      ? result.aiModels
      : DEFAULT_AI_MODELS;

  if (!githubToken || !openRouterKey) {
    throw new Error("Missing API Keys. Please configure them in Settings.");
  }

  // Find active model
  const activeModel = aiModels.find((m) => m.isActive) || aiModels[0];

  // Get the provider for the selected model
  const provider = activeModel.provider || "openrouter";

  // Decrypt additional API keys
  const openaiKey = result.openaiKey
    ? await decryptApiKey(result.openaiKey)
    : null;
  const anthropicKey = result.anthropicKey
    ? await decryptApiKey(result.anthropicKey)
    : null;
  const googleKey = result.googleKey
    ? await decryptApiKey(result.googleKey)
    : null;
  const groqKey = result.groqKey ? await decryptApiKey(result.groqKey) : null;

  // Get the correct API key for the provider
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

  // 2. Parse GitHub URL
  const prDetails = parseGitHubUrl(url);
  if (!prDetails) {
    throw new Error(
      "Invalid GitHub PR URL. Please navigate to a PR page like: github.com/owner/repo/pull/123",
    );
  }

  // 3. Fetch PR Data
  const { diff, metadata } = await fetchPRData(prDetails, githubToken);

  // 4. Generate with AI (single API call with structured output)
  const useStructuredOutput = await getUseStructuredOutput();
  let aiResult: { title: string; description: string };
  if (useStructuredOutput) {
    aiResult = await generateWithAIStructured(
      diff,
      metadata,
      settings,
      selectedTemplate,
      activeModel,
    );
  } else {
    aiResult = await generateWithAI(
      diff,
      metadata,
      settings,
      selectedTemplate,
      activeModel.modelId,
      providerApiKey,
    );
  }

  return {
    success: true,
    description: aiResult.description,
    title: settings.generateTitle ? aiResult.title : undefined,
    prDetails,
  };
}

async function handleUpdatePR(
  url: string,
  description: string,
  title?: string,
): Promise<UpdateResponse> {
  // 1. Get GitHub Token
  const result = (await chrome.storage.local.get(["githubToken"])) as {
    githubToken?: string;
  };

  // Decrypt API key
  const githubToken = result.githubToken
    ? await decryptApiKey(result.githubToken)
    : null;

  if (!githubToken) {
    throw new Error("Missing GitHub Token. Please configure it in Settings.");
  }

  // 2. Parse GitHub URL
  const prDetails = parseGitHubUrl(url);
  if (!prDetails) {
    throw new Error("Invalid GitHub PR URL.");
  }

  // 3. Update PR via GitHub API
  const { owner, repo, number } = prDetails;
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
    throw new Error(
      "Failed to update PR: " + (err.message || response.statusText),
    );
  }

  return { success: true };
}

function parseGitHubUrl(url: string): PRDetails | null {
  // https://github.com/owner/repo/pull/123
  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

async function fetchPRData(
  { owner, repo, number }: PRDetails,
  token: string,
): Promise<{ diff: string; metadata: PRMetadata }> {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  // Fetch Metadata
  const metaRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers },
  );

  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(
      "Failed to fetch PR metadata: " + (err.message || metaRes.statusText),
    );
  }

  const metadata = (await metaRes.json()) as PRMetadata;

  // Fetch Diff
  const diffHeaders = { ...headers, Accept: "application/vnd.github.v3.diff" };
  const diffRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers: diffHeaders },
  );

  if (!diffRes.ok) {
    throw new Error("Failed to fetch PR diff");
  }

  let diff = await diffRes.text();

  // Truncate diff if too large (approx 50k characters to be safe)
  if (diff.length > 50000) {
    diff =
      diff.substring(0, 50000) +
      "\n...[Diff Truncated - showing first 50k characters]...";
  }

  return { diff, metadata };
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  auto: "Balanced and objective.",
  professional:
    "Professional, formal, and detailed. Use clear technical language.",
  casual: "Friendly and conversational, while still being informative.",
  concise: "Brief and to the point. Focus on key changes only.",
};

// Response structure for AI generation
interface AIGenerationResult {
  title: string;
  description: string;
}

// Separate prompt construction to be reused if needed, but for now modified for streaming
function buildStreamingSystemPrompt(
  template: PRTemplate,
  toneDescription: string,
  context: string,
  generateTitle: boolean,
): string {
  const titleSection = generateTitle ? `IMPORTANT: You must stream the response in this EXACT format:
TITLE: <Your concise title here>
<<<SEPARATOR>>>
DESCRIPTION: <Your markdown description here>

TITLE GUIDELINES:
- Use the imperative mood
- Max 60 chars
- Focus on main change

DESCRIPTION GUIDELINES:` : `IMPORTANT: You must stream the response in this EXACT format:
DESCRIPTION: <Your markdown description here>

GUIDELINES:`;

  return `You are an expert software engineer assistant. Your task is to generate a Pull Request ${generateTitle ? 'title and description' : 'description'}.

${titleSection}
- Writing Style: ${toneDescription}
- Use this structure:
${template.structure}
- Be specific, reference files.
- No diffs.

${
  context
    ? `USER INSTRUCTIONS:
${context}`
    : ""
}`;
}

async function generateWithAIStreaming(
  diff: string,
  metadata: PRMetadata,
  settings: GeneratorSettings,
  template: PRTemplate,
  model: AIModel,
  port: chrome.runtime.Port,
): Promise<void> {
  const toneDescription =
    TONE_DESCRIPTIONS[settings.tone] || TONE_DESCRIPTIONS.professional;

  const systemPrompt = buildStreamingSystemPrompt(
    template,
    toneDescription,
    settings.context,
    settings.generateTitle ?? false,
  );

  const userPrompt = `
Current PR Title: ${metadata.title}
Branch: ${metadata.head.ref} -> ${metadata.base.ref}
${
  settings.includeTickets
    ? `
Ticket Detection: Look for ticket IDs in "${metadata.head.ref}" and include them.`
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

  // Use the AI service adapter for multi-provider support
  try {
    const stream = aiServiceAdapter.generateTextStream({
      model,
      systemPrompt,
      userPrompt,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === "error" && chunk.error) {
        throw new Error(chunk.error);
      }
      if (chunk.type === "chunk" && chunk.content) {
        port.postMessage({ type: "chunk", content: chunk.content });
      }
      if (chunk.type === "complete") {
        port.postMessage({
          type: "complete",
          data: chunk.data || {
            success: true,
            description: "",
            title: "",
            prDetails: {
              owner: metadata.base.ref.split(":")[0] || "unknown",
              repo: "unknown",
              number: "0",
            },
          },
        });
      }
    }
  } catch (error) {
    console.error("Error in generateWithAIStreaming", error);

    // Send toast notification for errors
    if (error instanceof Error) {
      sendToastNotification(`AI Generation Error: ${error.message}`, "error");
    }

    throw error;
  }
}

async function generateWithAI(
  diff: string,
  metadata: PRMetadata,
  settings: GeneratorSettings,
  template: PRTemplate,
  modelId: string,
  apiKey: string,
): Promise<AIGenerationResult> {
  const toneDescription =
    TONE_DESCRIPTIONS[settings.tone] || TONE_DESCRIPTIONS.professional;

  const shouldGenerateTitle = settings.generateTitle ?? false;
  const jsonFormat = shouldGenerateTitle ? `{
  "title": "A concise PR title",
  "description": "The full PR description in Markdown format"
}` : `{
  "description": "The full PR description in Markdown format"
}`;

  const titleGuidelines = shouldGenerateTitle ? `TITLE GUIDELINES:
- Use the imperative mood (e.g., "Add feature" not "Added feature")
- Max 60 characters is ideal, but up to 80 is acceptable
- Focus on the main change
- No quotes or markdown formatting

DESCRIPTION GUIDELINES:` : "GUIDELINES:";

  const systemPrompt = `You are an expert software engineer assistant. Your task is to generate a Pull Request ${shouldGenerateTitle ? 'title and description' : 'description'} based on the provided code diffs and context.

You MUST respond with valid JSON in this exact format:
${jsonFormat}

${titleGuidelines}
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
    ? `USER INSTRUCTIONS (apply to ${shouldGenerateTitle ? 'both title and description' : 'description'}):\n${settings.context}`
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

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/pr-buddy-extension",
        "X-Title": "PR Buddy",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json();
    const errorMessage = err.error?.message || response.statusText;

    // Send specific toast notification for OpenRouter API failure
    sendToastNotification(`OpenRouter API Error: ${errorMessage}`, "error");

    throw new Error("AI Generation failed: " + errorMessage);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    const parsed = JSON.parse(content);
    const shouldGenerateTitle = settings.generateTitle ?? false;
    return {
      title: shouldGenerateTitle ? (parsed.title || "").replace(/^"|"$/g, "").replace(/^`|`$/g, "") : "",
      description: parsed.description || "",
    };
  } catch {
    // Fallback: if JSON parsing fails, treat content as description
    return {
      title: "",
      description: content,
    };
  }
}

async function generateWithAIStructuredStreaming(
  diff: string,
  metadata: PRMetadata,
  settings: GeneratorSettings,
  template: PRTemplate,
  model: AIModel,
  port: chrome.runtime.Port,
): Promise<void> {
  const toneDescription =
    TONE_DESCRIPTIONS[settings.tone] || TONE_DESCRIPTIONS.professional;

  const systemPrompt = `You are an expert software engineer assistant. Your task is to generate a Pull Request ${settings.generateTitle ? 'title and description' : 'description'} based on the provided code diff and context.

${settings.generateTitle ? 
  'You must generate both a title and description.' : 
  'You must generate a description.'
}

WRITING STYLE: ${toneDescription}

TEMPLATE STRUCTURE TO FOLLOW:
${template.structure}

GUIDELINES:
- Be specific about what changed
- Reference file names when relevant
- Keep it readable and scannable
- Don't include the diff in your response
- Don't make up information not present in the diff
${settings.context ? 
  `USER INSTRUCTIONS (apply to ${settings.generateTitle ? 'both title and description' : 'description'}):\n${settings.context}` : 
  ""
}`;

  const userPrompt = `
Current PR Title: ${metadata.title}
Branch: ${metadata.head.ref} -> ${metadata.base.ref}
${settings.includeTickets ? 
  `\nTicket Detection: Look for ticket IDs (like JIRA IDs) in the branch name "${metadata.head.ref}" and include them.` : 
  ""
}

File Changes Summary:
- ${metadata.changed_files || "N/A"} files changed
- +${metadata.additions || 0} additions, -${metadata.deletions || 0} deletions

Diff:
\`\`\`diff
${diff}
\`\`\`

Generate the ${settings.generateTitle ? 'title and description' : 'description'} now.`;

  try {
    // Get API keys for AI SDK service
    const decryptedKeys = await getDecryptedAPIKeys();
    const aiService = createAISDKService(decryptedKeys);
    const stream = aiService.generateStructuredTextStream({
      model,
      systemPrompt,
      userPrompt,
      stream: true,
    });

let lastSentContent = "";
    
    for await (const event of stream) {
      if (event.type === "error") {
        port.postMessage({ type: "error", error: event.error });
        throw new Error(event.error);
      }
      
      if (event.type === "partial" && event.data) {
        // Convert structured output to existing format
        // Only include the separator if we have both title and description
        const hasTitle = !!event.data.title;
        const hasDescription = !!event.data.description;
        
        let content = "";
        if (hasTitle) {
          content += `TITLE: ${event.data.title}`;
        }
        if (hasTitle && hasDescription) {
          content += "\n\n<<<SEPARATOR>>>\n\nDESCRIPTION: " + event.data.description;
        } else if (hasDescription) {
          content += event.data.description;
        }

        // Only send if content is new and not empty
        if (content && content !== lastSentContent) {
          const newContent = content.replace(lastSentContent, "");
          if (newContent) {
            port.postMessage({ type: "chunk", content: newContent });
          }
          lastSentContent = content;
        }
      }
      
      if (event.type === "complete") {
        port.postMessage({
          type: "complete",
          data: {
            success: true,
            description: "",
            title: "",
            prDetails: {
              owner: metadata.base.ref.split(":")[0] || "unknown",
              repo: "unknown",
              number: "0",
            },
          },
        });
      }
    }
  } catch (error) {
    console.error("Error in generateWithAIStructuredStreaming", error);

    // Send toast notification for errors
    if (error instanceof Error) {
      sendToastNotification(`AI Generation Error: ${error.message}`, "error");
    }

    throw error;
  }
}

async function generateWithAIStructured(
  diff: string,
  metadata: PRMetadata,
  settings: GeneratorSettings,
  template: PRTemplate,
  model: AIModel,
): Promise<{ title: string; description: string }> {
  const toneDescription =
    TONE_DESCRIPTIONS[settings.tone] || TONE_DESCRIPTIONS.professional;

  const systemPrompt = `You are an expert software engineer assistant. Your task is to generate a Pull Request ${settings.generateTitle ? 'title and description' : 'description'} based on the provided code diff and context.

${settings.generateTitle ? 
  'You must generate both a title and description.' : 
  'You must generate a description.'
}

WRITING STYLE: ${toneDescription}

TEMPLATE STRUCTURE TO FOLLOW:
${template.structure}

GUIDELINES:
- Be specific about what changed
- Reference file names when relevant
- Keep it readable and scannable
- Don't include the diff in your response
- Don't make up information not present in the diff
${settings.context ? 
  `USER INSTRUCTIONS (apply to ${settings.generateTitle ? 'both title and description' : 'description'}):\n${settings.context}` : 
  ""
}`;

  const userPrompt = `
Current PR Title: ${metadata.title}
Branch: ${metadata.head.ref} -> ${metadata.base.ref}
${settings.includeTickets ? 
  `\nTicket Detection: Look for ticket IDs (like JIRA IDs) in the branch name "${metadata.head.ref}" and include them.` : 
  ""
}

File Changes Summary:
- ${metadata.changed_files || "N/A"} files changed
- +${metadata.additions || 0} additions, -${metadata.deletions || 0} deletions

Diff:
\`\`\`diff
${diff}
\`\`\`

Generate the ${settings.generateTitle ? 'title and description' : 'description'} now.`;

  try {
    // Get API keys for AI SDK service
    const decryptedKeys = await getDecryptedAPIKeys();
    const aiService = createAISDKService(decryptedKeys);
    const result = await aiService.generateStructuredText({
      model,
      systemPrompt,
      userPrompt,
      stream: false,
    });

    if (result.success) {
      return {
        title: result.data.title || "",
        description: result.data.description,
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Error in generateWithAIStructured", error);
    throw error;
  }
}
