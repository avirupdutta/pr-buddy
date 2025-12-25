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
} from "@/types/chrome";

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
      handleUpdatePR(request.url, request.description)
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
  // 1. Get Credentials
  const result = (await chrome.storage.local.get([
    "githubToken",
    "openRouterKey",
  ])) as { githubToken?: string; openRouterKey?: string };
  const { githubToken, openRouterKey } = result;

  if (!githubToken || !openRouterKey) {
    throw new Error("Missing API Keys. Please configure them in Settings.");
  }

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
  const description = await generateWithAI(
    diff,
    metadata,
    settings,
    openRouterKey
  );

  return { success: true, description, prDetails };
}

async function handleUpdatePR(
  url: string,
  description: string
): Promise<UpdateResponse> {
  // 1. Get GitHub Token
  const result = (await chrome.storage.local.get(["githubToken"])) as {
    githubToken?: string;
  };
  const { githubToken } = result;
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
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: description }),
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
  professional:
    "Professional, formal, and detailed. Use clear technical language.",
  casual: "Friendly and conversational, while still being informative.",
  concise: "Brief and to the point. Focus on key changes only.",
};

const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  default: `Structure the description with these sections:
## Describe your changes

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
- [x] I have made sure the PR does not have conflict
`,

  bug: `Structure the description with these sections:
## Bug Description
What was the bug?

## Root Cause
Why did this bug occur?

## Solution
How was it fixed?

## Testing
How the fix was verified.`,

  feature: `Structure the description with these sections:
## Feature Overview
What does this feature do?

## Implementation
How was it implemented?

## Usage
How to use this feature.

## Testing
How this was tested.`,

  refactor: `Structure the description with these sections:
## Refactor Overview
What was refactored and why?

## Changes
Key architectural or structural changes.

## Benefits
What improvements does this bring?

## Testing
How this was verified to not break existing functionality.`,

  hotfix: `Structure the description with these sections:
## Issue
What critical issue is being fixed?

## Fix
What was done to fix it?

## Impact
What systems/users are affected?

## Testing
Verification steps.`,
};

async function generateWithAI(
  diff: string,
  metadata: PRMetadata,
  settings: GeneratorSettings,
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are an expert software engineer assistant. Your task is to write a high-quality Pull Request description based on the provided code diffs and context.

Output Format: Markdown.

Writing Style: ${
    TONE_DESCRIPTIONS[settings.tone] || TONE_DESCRIPTIONS.professional
  }

${TEMPLATE_INSTRUCTIONS[settings.template] || TEMPLATE_INSTRUCTIONS.default}

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
        model: "xiaomi/mimo-v2-flash:free",
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
