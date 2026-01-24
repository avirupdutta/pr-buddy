// Chrome messaging utilities with type safety
import type {
  MessageAction,
  MessageResponse,
  GenerateResponse,
  UpdateResponse,
  GeneratorSettings,
} from "@/types/chrome";
import { getChromeAPI } from "./dev-mock";

// Get Chrome API (real or mock depending on context)
const chromeAPI = getChromeAPI();

/**
 * Send a message to the background script and wait for response
 */
export async function sendMessage<T>(message: MessageAction): Promise<T> {
  return new Promise((resolve, reject) => {
    chromeAPI.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      if (chromeAPI.runtime.lastError) {
        reject(new Error(chromeAPI.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error("No response from background script"));
        return;
      }

      if (response.success) {
        resolve(response as T);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Generate PR description via background script
 */
export async function generateDescription(
  url: string,
  settings: GeneratorSettings
): Promise<GenerateResponse> {
  return sendMessage<GenerateResponse>({
    action: "GENERATE_DESCRIPTION",
    url,
    settings,
  });
}

/**
 * Generate PR description via background script (Streamed)
 */
export function streamDescription(
  url: string,
  settings: GeneratorSettings,
  onChunk: (content: string) => void,
  onComplete: (data: GenerateResponse) => void,
  onError: (error: string) => void
): () => void {
  const port = chromeAPI.runtime.connect({
    name: "GENERATE_DESCRIPTION_STREAM",
  });

   port.onMessage.addListener((msg: {type: 'chunk' | 'complete' | 'error', content?: string, data?: GenerateResponse, error?: string}) => {
    if (msg.type === "chunk" && msg.content) {
      onChunk(msg.content);
    } else if (msg.type === "complete" && msg.data) {
      onComplete(msg.data);
    } else if (msg.type === "error") {
      onError(msg.error || "Unknown error");
    }
  });

  port.onDisconnect.addListener(() => {
    if (chromeAPI.runtime.lastError) {
      onError(chromeAPI.runtime.lastError.message || "Connection disconnected");
    }
  });

  // Send initial request
  port.postMessage({ url, settings });

  // Return disconnect function
  return () => {
    try {
      port.disconnect();
    } catch {
      // Ignore if already disconnected
    }
  };
}

/**
 * Update PR description via GitHub API (background script)
 */
export async function updatePRDescription(
  url: string,
  description: string,
  title?: string
): Promise<UpdateResponse> {
  return sendMessage<UpdateResponse>({
    action: "UPDATE_PR_DESCRIPTION",
    url,
    description,
    title,
  });
}

/**
 * Get the current active tab URL
 */
export async function getCurrentTabUrl(): Promise<{
  url: string;
  tabId: number;
} | null> {
  return new Promise((resolve) => {
    chromeAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url && tabs[0]?.id) {
        resolve({ url: tabs[0].url, tabId: tabs[0].id });
      } else {
        resolve(null);
      }
    });
  });
}

// Re-export sendToastNotification from notifications module
export { sendToastNotification } from "./notifications";

/**
 * Open the options page
 */
export function openOptionsPage(): void {
  if (chromeAPI.runtime.openOptionsPage) {
    chromeAPI.runtime.openOptionsPage();
  } else {
    window.open(chromeAPI.runtime.getURL("src/options/index.html"));
  }
}
