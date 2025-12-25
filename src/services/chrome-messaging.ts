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
 * Update PR description via GitHub API (background script)
 */
export async function updatePRDescription(
  url: string,
  description: string
): Promise<UpdateResponse> {
  return sendMessage<UpdateResponse>({
    action: "UPDATE_PR_DESCRIPTION",
    url,
    description,
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
