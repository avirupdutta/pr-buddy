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

// Default templates (fallback if none in storage)
const DEFAULT_TEMPLATES: PRTemplate[] = [
  {
    id: "default",
    title: "Default",
    structure: `## Describe your changes

## Clickup link

## PR Type

- [ ] Backend
- [ ] Frontend

## Checklist before requesting a review

- [x] I have self-reviewed my code.
- [x] All my code is following Codebuddy Coding Standards and Guidelines.
- [x] I have tested my code.
- [x] My PR title is meaningful and max 60 characters.
- [x] I have made sure only the changes in context of the feature are in this PR.
- [x] I have made sure I am not including any env secrets in this PR.
- [x] I have made sure the PR does not have conflict`,
  },
  {
    id: "bug",
    title: "Bug Fix Report",
    structure: `## Bug Description
What was the bug?

## Root Cause
Why did this bug occur?

## Solution
How was it fixed?

## Testing
How the fix was verified.`,
  },
  {
    id: "feature",
    title: "Feature Implementation",
    structure: `## Feature Overview
What does this feature do?

## Implementation
How was it implemented?

## Usage
How to use this feature.

## Testing
How this was tested.`,
  },
  {
    id: "refactor",
    title: "Code Refactor",
    structure: `## Refactor Overview
What was refactored and why?

## Changes
Key architectural or structural changes.

## Benefits
What improvements does this bring?

## Testing
How this was verified to not break existing functionality.`,
  },
  {
    id: "hotfix",
    title: "Hotfix",
    structure: `## Issue
What critical issue is being fixed?

## Fix
What was done to fix it?

## Impact
What systems/users are affected?

## Testing
Verification steps.`,
  },
];

// Default AI model (fallback if none in storage)
const DEFAULT_AI_MODELS: AIModel[] = [
  {
    id: "mimo-v2-flash",
    name: "Xiaomi MiMo v2 Flash (Free)",
    modelId: "xiaomi/mimo-v2-flash:free",
    isActive: true,
  },
];

// Message listener
chrome.runtime.onMessage.addListener(
  (
    request: MessageAction,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<unknown>) => void
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
  }
);

async function handleGeneration(
  url: string,
  settings: GeneratorSettings
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
      "Invalid GitHub PR URL. Please navigate to a PR page like: github.com/owner/repo/pull/123"
    );
  }

  // 3. Fetch PR Data
  const { diff, metadata } = await fetchPRData(prDetails, githubToken);

  // 4. Generate Description
  const descriptionPromise = generateWithAI(
    diff,
    metadata,
    settings,
    selectedTemplate,
    activeModel.modelId,
    openRouterKey
  );

  let titlePromise: Promise<string> | undefined;
  if (settings.generateTitle) {
    titlePromise = generateTitleWithAI(
      diff,
      metadata,
      settings.titleContext,
      activeModel.modelId,
      openRouterKey
    );
  }

  const [description, title] = await Promise.all([
    descriptionPromise,
    titlePromise || Promise.resolve(undefined),
  ]);

  return { success: true, description, title, prDetails };
}

async function handleUpdatePR(
  url: string,
  description: string,
  title?: string
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
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(
      "Failed to update PR: " + (err.message || response.statusText)
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
  token: string
): Promise<{ diff: string; metadata: PRMetadata }> {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  // Fetch Metadata
  const metaRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(
      "Failed to fetch PR metadata: " + (err.message || metaRes.statusText)
    );
  }

  const metadata = (await metaRes.json()) as PRMetadata;

  // Fetch Diff
  const diffHeaders = { ...headers, Accept: "application/vnd.github.v3.diff" };
  const diffRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers: diffHeaders }
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

async function generateWithAI(
  diff: string,
  metadata: PRMetadata,
  settings: GeneratorSettings,
  template: PRTemplate,
  modelId: string,
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are an expert software engineer assistant. Your task is to write a high-quality Pull Request description based on the provided code diffs and context.

Output Format: Markdown.

Writing Style: ${
    TONE_DESCRIPTIONS[settings.tone] || TONE_DESCRIPTIONS.professional
  }

Structure the description following this template format:
${template.structure}

Important guidelines:
- Be specific about what changed
- Reference file names when relevant
- Keep it readable and scannable
- Don't include the diff in your response
- Don't make up information not present in the diff`;

  const userPrompt = `
PR Title: ${metadata.title}
Branch: ${metadata.head.ref} -> ${metadata.base.ref}
${
  settings.context ? `\nAdditional Context from User:\n${settings.context}` : ""
}
${
  settings.includeTickets
    ? `\nTicket Detection: Look for ticket IDs (like JIRA IDs) in the branch name "${metadata.head.ref}" and include them in the description.`
    : ""
}

File Changes Summary:
- ${metadata.changed_files || "N/A"} files changed
- +${metadata.additions || 0} additions, -${metadata.deletions || 0} deletions

Diff:
\`\`\`diff
${diff}
\`\`\`

Please generate the PR description now based on the above information.`;

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
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(
      "AI Generation failed: " + (err.error?.message || response.statusText)
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function generateTitleWithAI(
  diff: string,
  metadata: PRMetadata,
  context: string | undefined,
  modelId: string,
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are an expert software engineer. Generate a concise, meaningful Pull Request title based on the provided changes.
Output only the title text, nothing else. No quotes, no markdown.

Guidelines:
- If provided, strictly follow the user's context/instructions.
- Use the imperative mood (e.g., "Add feature" not "Added feature").
- Max 60 characters is ideal, but up to 80 is acceptable.
- Focus on the main change.`;

  const userPrompt = `
Current Title: ${metadata.title}
Branch: ${metadata.head.ref}
${context ? `\nUser Instructions:\n${context}` : ""}

Diff Summary:
- ${metadata.changed_files || "N/A"} files changed
- +${metadata.additions || 0} / -${metadata.deletions || 0} lines

Diff Snippet:
\`\`\`diff
${diff.substring(0, 10000)}
\`\`\`

Generate the PR title now.`;

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
      }),
    }
  );

  if (!response.ok) {
    console.warn("Title generation failed, returning empty string");
    return "";
  }

  const data = await response.json();
  let title = data.choices[0].message.content?.trim() || "";
  // Cleanup potential quotes or markdown
  title = title.replace(/^"|"$/g, "").replace(/^`|`$/g, "");
  return title;
}
