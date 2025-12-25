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
 * In-memory storage for development
 */
const devStorage: Record<string, unknown> = {
  // Pre-populate with dev settings so the popup works
  githubToken: "dev-token-placeholder",
  openRouterKey: "dev-openrouter-placeholder",
  devMode: true,
  devPrUrl: "https://github.com/example/repo/pull/1",
};

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
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      Object.entries(items).forEach(([key, value]) => {
        changes[key] = { oldValue: devStorage[key], newValue: value };
        devStorage[key] = value;
      });
      // Notify listeners
      storageListeners.forEach((listener) => listener(changes));
      if (callback) setTimeout(callback, 10);
    },
    remove: (keys: string | string[], callback?: () => void) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => delete devStorage[key]);
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
 * Mock Chrome runtime API for development
 */
export const mockRuntime = {
  sendMessage: (_message: unknown, callback?: (response: unknown) => void) => {
    // Return mock response for development
    if (callback) {
      setTimeout(
        () =>
          callback({
            success: true,
            description:
              "## Mock PR Description\n\nThis is a mock description generated for development purposes.\n\n### Changes\n- Feature 1\n- Feature 2\n\n### Testing\n- Tested locally",
          }),
        500
      );
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
