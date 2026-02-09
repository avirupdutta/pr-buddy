// Toast notification utilities for background script to popup communication
import { getChromeAPI } from "./dev-mock";

/**
 * Send a toast notification message (for background script to popup)
 */
export function sendToastNotification(
  message: string,
  type: "error" | "success" | "info" | "warning" = "error"
): void {
  try {
    const chromeAPI = getChromeAPI();
    chromeAPI.runtime.sendMessage({
      action: "SHOW_TOAST",
      message,
      type,
    });
  } catch {
    // Ignore if popup is not open
    console.log("Toast notification failed (popup likely closed):", message);
  }
}