// Mock Chrome APIs for development in browser context
// This file provides fallbacks when chrome.* APIs are not available

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
      callback: (result: Record<string, unknown>) => void
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
        areaName: string
      ) => void
    ) => {
      const wrappedListener = (
        changes: Record<string, { oldValue?: unknown; newValue?: unknown }>
      ) => listener(changes, "local");
      storageListeners.push(wrappedListener);
    },
    removeListener: (
      listener: (
        changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
        areaName: string
      ) => void
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
    callback: (tabs: Array<{ url?: string; id?: number }>) => void
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
      10
    );
  },
};

/**
 * Mock Chrome runtime API for development - uses real API calls
 */
export const mockRuntime = {
  sendMessage: (message: unknown, callback?: (response: unknown) => void) => {
    // Actually make real API calls in dev mode using stored credentials
    const msg = message as {
      action: string;
      url?: string;
      settings?: unknown;
      description?: string;
    };

    if (msg.action === "GENERATE_DESCRIPTION" && callback) {
      handleDevGeneration(msg.url || "", msg.settings)
        .then((result) => callback(result))
        .catch((err) => callback({ success: false, error: err.message }));
    } else if (msg.action === "UPDATE_PR_DESCRIPTION" && callback) {
      handleDevUpdatePR(msg.url || "", msg.description || "")
        .then((result) => callback(result))
        .catch((err) => callback({ success: false, error: err.message }));
    } else if (callback) {
      callback({ success: false, error: "Unknown action" });
    }
  },
  openOptionsPage: () => {
    // In dev mode, dispatch a custom event that React Router listens for
    window.dispatchEvent(
      new CustomEvent("dev-navigate", { detail: { path: "/options" } })
    );
  },
  getURL: (path: string) => `/${path}`,
  lastError: null as { message: string } | null,
};

// Dev mode API handlers (mirrors background script logic)
async function handleDevGeneration(
  url: string,
  settings: unknown
): Promise<unknown> {
  const devStorage = getDevStorage();
  const githubToken = devStorage.githubToken as string;
  const openRouterKey = devStorage.openRouterKey as string;

  if (!githubToken || !openRouterKey) {
    throw new Error("Missing API Keys. Please configure them in Settings.");
  }

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
    { headers }
  );
  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(
      "Failed to fetch PR: " + (err.message || metaRes.statusText)
    );
  }
  const metadata = await metaRes.json();

  // Fetch diff
  const diffRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    { headers: { ...headers, Accept: "application/vnd.github.v3.diff" } }
  );
  if (!diffRes.ok) throw new Error("Failed to fetch PR diff");

  let diff = await diffRes.text();
  if (diff.length > 50000) {
    diff = diff.substring(0, 50000) + "\n...[Diff Truncated]...";
  }

  // Generate with AI
  const s =
    (settings as {
      template?: string;
      tone?: string;
      context?: string;
      includeTickets?: boolean;
    }) || {};
  const description = await generateWithOpenRouter(
    diff,
    metadata,
    s,
    openRouterKey
  );

  return { success: true, description, prDetails };
}

async function handleDevUpdatePR(
  url: string,
  description: string
): Promise<unknown> {
  const devStorage = getDevStorage();
  const githubToken = devStorage.githubToken as string;
  if (!githubToken) throw new Error("Missing GitHub Token.");

  const regex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = url.match(regex);
  if (!match) throw new Error("Invalid GitHub PR URL.");
  const [, owner, repo, number] = match;

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

async function generateWithOpenRouter(
  diff: string,
  metadata: {
    title: string;
    head: { ref: string };
    base: { ref: string };
    changed_files?: number;
    additions?: number;
    deletions?: number;
  },
  settings: {
    template?: string;
    tone?: string;
    context?: string;
    includeTickets?: boolean;
  },
  apiKey: string
): Promise<string> {
  const tones: Record<string, string> = {
    professional: "Professional, formal, and detailed.",
    casual: "Friendly and conversational.",
    concise: "Brief and to the point.",
  };

  const systemPrompt = `You are an expert software engineer. Write a PR description in Markdown.
Style: ${tones[settings.tone || "professional"] || tones.professional}
Include: Summary, Changes, Testing sections.`;

  const userPrompt = `PR Title: ${metadata.title}
Branch: ${metadata.head.ref} -> ${metadata.base.ref}
${settings.context ? `\nContext: ${settings.context}` : ""}
${
  settings.includeTickets
    ? `\nLook for ticket IDs in branch "${metadata.head.ref}"`
    : ""
}
Files: ${metadata.changed_files || "N/A"} changed, +${
    metadata.additions || 0
  }/-${metadata.deletions || 0}

Diff:
\`\`\`diff
${diff}
\`\`\``;

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
