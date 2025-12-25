// Content Script
// Interacts with the GitHub DOM to read/write PR descriptions.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "UPDATE_DESCRIPTION") {
    updatePRDescription(request.description);
  }
});

function updatePRDescription(text) {
  // GitHub's PR body textarea
  const textarea = document.getElementById("pull_request_body");

  if (textarea) {
    textarea.value = text;

    // Trigger input event to ensure GitHub's JS picks up the change (essential for saving)
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    console.warn("PR Buddy: Cound not find PR body textarea.");
    // Fallback for new PR creation page or different layouts?
    // User mentioned "published" PRs, which usually effectively edit/view.
    // If "Edit" is not clicked, the textarea might not exist.
    // We might need to click "Edit" button if it exists?
    // But usually, if the user is asking to generate, they might be in the edit mode or just willing to overwrite.
    // Actually, if the user is just viewing the PR, we can't update it unless we click "Edit" on the comment body.

    // Let's try to find the "Edit" button for the top comment (PR description)
    // This is tricky because there are many edit buttons.
    // For now, let's assume the user is in "Edit" mode or creates a new PR.
    // If not, we might alert the user.
    alert(
      "Could not find the description field. Please make sure you are in 'Edit' mode for the PR description."
    );
  }
}
