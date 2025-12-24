// Options Script
// Saves and loads settings.

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["githubToken", "openRouterKey"], (result) => {
    if (result.githubToken)
      document.getElementById("github-token").value = result.githubToken;
    if (result.openRouterKey)
      document.getElementById("openrouter-key").value = result.openRouterKey;
  });

  // Toggle visibility
  document.querySelectorAll(".material-symbols-outlined").forEach((icon) => {
    if (icon.textContent === "visibility_off") {
      icon.parentElement.addEventListener("click", (e) => {
        const input = icon
          .closest(".form-input-wrapper")
          .querySelector("input");
        if (input.type === "password") {
          input.type = "text";
          icon.textContent = "visibility";
        } else {
          input.type = "password";
          icon.textContent = "visibility_off";
        }
      });
    }
  });
});

const saveBtn = document.getElementById("save-settings");
if (saveBtn) {
  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const githubToken = document.getElementById("github-token").value;
    const openRouterKey = document.getElementById("openrouter-key").value;
    const statusMsg = document.getElementById("status-message");

    chrome.storage.local.set({ githubToken, openRouterKey }, () => {
      // Show success
      if (statusMsg) {
        statusMsg.classList.remove("hidden");
        statusMsg.classList.add("flex");
        setTimeout(() => {
          statusMsg.classList.add("hidden");
          statusMsg.classList.remove("flex");
        }, 3000);
      }
    });
  });
}
