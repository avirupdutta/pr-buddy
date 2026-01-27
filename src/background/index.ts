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
import { DEFAULT_AI_MODELS, DEFAULT_TEMPLATES } from "@/stores/settings-store";
import { sendToastNotification } from "@/services/notifications";
import { aiServiceAdapter } from "@/services/ai-service-adapter";

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
    "templates",
    "aiModels",
  ])) as {
    githubToken?: string;
    openRouterKey?: string;
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
  await generateWithAIStreaming(
    diff,
    metadata,
    settings,
    selectedTemplate,
    selectedModel,
    port,
  );

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
    "templates",
    "aiModels",
  ])) as {
    githubToken?: string;
    openRouterKey?: string;
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
  const aiResult = await generateWithAI(
    diff,
    metadata,
    settings,
    selectedTemplate,
    activeModel.modelId,
    openRouterKey,
  );

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
): string {
  return `You are an expert software engineer assistant. Your task is to generate a Pull Request title and description.

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
    return {
      title: (parsed.title || "").replace(/^"|"$/g, "").replace(/^`|`$/g, ""),
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
