// Background Script
// Handles API calls to GitHub and OpenRouter.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GENERATE_DESCRIPTION") {
    handleGeneration(request)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Async response
  }
});

async function handleGeneration(request) {
  const { url, settings } = request;

  // 1. Get Credentials
  const { githubToken, openRouterKey } = await chrome.storage.local.get([
    "githubToken",
    "openRouterKey",
  ]);
  if (!githubToken || !openRouterKey) {
    throw new Error("Missing API Keys. Please configure them in Settings.");
  }

  // 2. Parse GitHub URL
  const prDetails = parseGitHubUrl(url);
  if (!prDetails) {
    throw new Error("Invalid GitHub PR URL.");
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

  // 5. Update content if auto-update is on
  if (settings.autoUpdate && request.tabId) {
    chrome.tabs.sendMessage(request.tabId, {
      action: "UPDATE_DESCRIPTION",
      description: description,
    });
  }

  return { success: true, description };
}

function parseGitHubUrl(url) {
  // https://github.com/owner/repo/pull/123
  const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

async function fetchPRData({ owner, repo, number }, token) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  // Fetch Metadata
  const metaRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers }
  );
  if (!metaRes.ok)
    throw new Error("Failed to fetch PR metadata: " + metaRes.statusText);
  const metadata = await metaRes.json();

  // Fetch Diff
  const diffHeaders = { ...headers, Accept: "application/vnd.github.v3.diff" };
  const diffRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers: diffHeaders }
  );
  if (!diffRes.ok) throw new Error("Failed to fetch PR diff");
  let diff = await diffRes.text();

  // Truncate diff if too large (approx 50k characters to be safe for now)
  if (diff.length > 50000) {
    diff = diff.substring(0, 50000) + "\n...[Diff Truncated]...";
  }

  return { diff, metadata };
}

async function generateWithAI(diff, metadata, settings, apiKey) {
  const systemPrompt = `You are an expert software engineer assistant. Your task is to write a high-quality Pull Request description based on the provided code diffs and context.
    
    Output Format: Markdown.
    
    Templates:
    - Default: Standard summary, changes, testing.
    - Bug: Focus on the bug fix, root cause, and solution.
    - Feature: Focus on new capabilities and usage.
    - Refactor: Focus on architectural changes and benefits.
    
    Selected Template: ${settings.template}
    Tone: Professional, Clear, Concise.
    `;

  const userPrompt = `
    PR Title: ${metadata.title}
    User Context: ${settings.context || "None"}
    Tickets to Include: ${
      settings.includeTickets
        ? "Auto-detect from branch name: " + metadata.head.ref
        : "None"
    }

    Diff:
    \`\`\`diff
    ${diff}
    \`\`\`

    Please generate the description now.
    `;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Start-Of-Change: Added HTTP-Referer and X-Title for OpenRouter rankings
        "HTTP-Referer": "https://github.com/CodeBuddy-Extension",
        "X-Title": "PR Buddy",
        // End-Of-Change
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001", // Using Gemini Flash as requested/implied availability
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
