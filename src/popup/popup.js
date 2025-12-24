// Popup Script
// Handles user interactions in the popup.

const ELEMENTS = {
  templateSelect: document.getElementById("template-select"),
  customContext: document.getElementById("custom-context"),
  autoUpdateToggle: document.getElementById("auto-update-toggle"),
  includeTicketsToggle: document.getElementById("include-tickets-toggle"),
  generateBtn: document.getElementById("generate-btn"),
  toneButtons: document.querySelectorAll(".group.flex.h-8"), // Determine selector better
};

// Load saved state
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    [
      "prTemplate",
      "customContext",
      "autoUpdate",
      "includeTickets",
      "descriptionTone",
    ],
    (result) => {
      if (result.prTemplate) ELEMENTS.templateSelect.value = result.prTemplate;
      if (result.customContext)
        ELEMENTS.customContext.value = result.customContext;
      if (result.autoUpdate !== undefined)
        ELEMENTS.autoUpdateToggle.checked = result.autoUpdate;
      if (result.includeTickets !== undefined)
        ELEMENTS.includeTicketsToggle.checked = result.includeTickets;
      // Tone selection logic would go here (add active class to buttons)
    }
  );
});

// Save state on change
if (ELEMENTS.templateSelect)
  ELEMENTS.templateSelect.addEventListener("change", (e) =>
    chrome.storage.local.set({ prTemplate: e.target.value })
  );
if (ELEMENTS.customContext)
  ELEMENTS.customContext.addEventListener("input", (e) =>
    chrome.storage.local.set({ customContext: e.target.value })
  );
if (ELEMENTS.autoUpdateToggle)
  ELEMENTS.autoUpdateToggle.addEventListener("change", (e) =>
    chrome.storage.local.set({ autoUpdate: e.target.checked })
  );
if (ELEMENTS.includeTicketsToggle)
  ELEMENTS.includeTicketsToggle.addEventListener("change", (e) =>
    chrome.storage.local.set({ includeTickets: e.target.checked })
  );

const generateBtn = document.getElementById("generate-btn");
if (generateBtn) {
  generateBtn.addEventListener("click", () => {
    const btn = generateBtn;
    const originalText = btn.innerHTML;

    // Set loading state
    btn.innerHTML =
      '<span class="material-symbols-outlined animate-spin">refresh</span> Generating...';
    btn.disabled = true;

    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url.includes("github.com")) {
        alert("Please use this on a GitHub PR page.");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
      }

      // Send message to background to start generation
      chrome.runtime.sendMessage(
        {
          action: "GENERATE_DESCRIPTION",
          tabId: currentTab.id,
          url: currentTab.url,
          settings: {
            template: ELEMENTS.templateSelect
              ? ELEMENTS.templateSelect.value
              : "default",
            context: ELEMENTS.customContext ? ELEMENTS.customContext.value : "",
            autoUpdate: ELEMENTS.autoUpdateToggle
              ? ELEMENTS.autoUpdateToggle.checked
              : true,
            includeTickets: ELEMENTS.includeTicketsToggle
              ? ELEMENTS.includeTicketsToggle.checked
              : false,
          },
        },
        (response) => {
          // Handle response
          btn.innerHTML = originalText;
          btn.disabled = false;

          if (response && response.success) {
            window.close(); // Close popup on success
          } else {
            alert("Generation failed: " + (response?.error || "Unknown error"));
          }
        }
      );
    });
  });
}

const openSettingsBtn = document.getElementById("open-settings");
if (openSettingsBtn) {
  openSettingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/index.html"));
    }
  });
}
