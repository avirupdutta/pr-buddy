// Content Script - TypeScript Migration
// Interacts with the GitHub DOM to read/write PR descriptions

import type { UpdateDescriptionMessage } from "@/types/chrome";

// Message listener
chrome.runtime.onMessage.addListener((request: UpdateDescriptionMessage) => {
  if (request.action === "UPDATE_DESCRIPTION") {
    updatePRDescription(request.description);
  }
});

function updatePRDescription(text: string): void {
  // GitHub's PR body textarea
  const textarea = document.getElementById(
    "pull_request_body"
  ) as HTMLTextAreaElement | null;

  if (textarea) {
    textarea.value = text;

    // Trigger input event to ensure GitHub's JS picks up the change
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    console.warn("PR Buddy: Could not find PR body textarea.");

    // The textarea might not exist if user isn't in edit mode
    alert(
      "Could not find the description field. Please make sure you are in 'Edit' mode for the PR description."
    );
  }
}
