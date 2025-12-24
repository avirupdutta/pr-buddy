// Popup Script
// Handles user interactions in the popup.

// State
let currentUrl = "";
let currentTabId = null;
let selectedTone = "professional";

const ELEMENTS = {
  // Views
  generatorView: document.getElementById("generator-view"),
  resultView: document.getElementById("result-view"),
  generatorFooter: document.getElementById("generator-footer"),
  resultFooter: document.getElementById("result-footer"),
  backBtn: document.getElementById("back-btn"),

  // Inputs
  templateSelect: document.getElementById("template-select"),
  customContext: document.getElementById("custom-context"),
  includeTicketsToggle: document.getElementById("include-tickets-toggle"),
  toneSelector: document.getElementById("tone-selector"),
  generatedDescription: document.getElementById("generated-description"),

  // Buttons
  generateBtn: document.getElementById("generate-btn"),
  copyBtn: document.getElementById("copy-btn"),
  insertBtn: document.getElementById("insert-btn"),
  regenerateBtn: document.getElementById("regenerate-btn"),
  openSettingsBtn: document.getElementById("open-settings"),
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Check for API Keys first
  chrome.storage.local.get(["githubToken", "openRouterKey"], (result) => {
    if (!result.githubToken || !result.openRouterKey) {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL("options/index.html"));
      }
      window.close();
      return;
    }

    // Load user preferences if keys exist
    chrome.storage.local.get(
      ["prTemplate", "customContext", "includeTickets", "descriptionTone"],
      (prefs) => {
        if (prefs.prTemplate && ELEMENTS.templateSelect) {
          ELEMENTS.templateSelect.value = prefs.prTemplate;
        }
        if (prefs.customContext && ELEMENTS.customContext) {
          ELEMENTS.customContext.value = prefs.customContext;
        }
        if (
          prefs.includeTickets !== undefined &&
          ELEMENTS.includeTicketsToggle
        ) {
          ELEMENTS.includeTicketsToggle.checked = prefs.includeTickets;
          updateToggleUI(ELEMENTS.includeTicketsToggle);
        }
        if (prefs.descriptionTone) {
          selectedTone = prefs.descriptionTone;
          updateToneUI();
        }
      }
    );

    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        currentUrl = tabs[0].url;
        currentTabId = tabs[0].id;
      }
    });
  });
});

// Toggle UI Helper
function updateToggleUI(checkbox) {
  const handle = checkbox.parentElement.querySelector(".toggle-handle");
  if (checkbox.checked) {
    handle.style.transform = "translateX(20px)";
    checkbox.parentElement.classList.remove("bg-surface-dark");
    checkbox.parentElement.classList.add("bg-primary");
    checkbox.parentElement.style.backgroundColor = ""; // Clear inline style if present
  } else {
    handle.style.transform = "translateX(0)";
    checkbox.parentElement.classList.remove("bg-primary");
    checkbox.parentElement.classList.add("bg-surface-dark");
    checkbox.parentElement.style.backgroundColor = ""; // Clear inline style
  }
}

// Tone Selection UI
function updateToneUI() {
  const buttons = ELEMENTS.toneSelector?.querySelectorAll(".tone-btn");
  buttons?.forEach((btn) => {
    const tone = btn.dataset.tone;
    const icon = btn.querySelector(".material-symbols-outlined");
    const text = btn.querySelector("span:last-child");

    if (tone === selectedTone) {
      btn.classList.remove("bg-surface-dark", "border-border-dark");
      btn.classList.add("bg-[#135bec]/20", "border-[#135bec]/50");
      icon.classList.remove("text-text-secondary");
      icon.classList.add("text-primary");
      text.classList.remove("text-text-secondary");
      text.classList.add("text-white");
    } else {
      btn.classList.add("bg-surface-dark", "border-border-dark");
      btn.classList.remove("bg-[#135bec]/20", "border-[#135bec]/50");
      icon.classList.add("text-text-secondary");
      icon.classList.remove("text-primary");
      text.classList.add("text-text-secondary");
      text.classList.remove("text-white");
    }
  });
}

// View Switching
function showResultView() {
  ELEMENTS.generatorView?.classList.add("hidden");
  ELEMENTS.resultView?.classList.remove("hidden");
  ELEMENTS.generatorFooter?.classList.add("hidden");
  ELEMENTS.resultFooter?.classList.remove("hidden");
  ELEMENTS.backBtn?.classList.remove("hidden");
}

function showGeneratorView() {
  ELEMENTS.generatorView?.classList.remove("hidden");
  ELEMENTS.resultView?.classList.add("hidden");
  ELEMENTS.generatorFooter?.classList.remove("hidden");
  ELEMENTS.resultFooter?.classList.add("hidden");
  ELEMENTS.backBtn?.classList.add("hidden");
}

// Event Listeners

// Save state on change
ELEMENTS.templateSelect?.addEventListener("change", (e) => {
  chrome.storage.local.set({ prTemplate: e.target.value });
});

ELEMENTS.customContext?.addEventListener("input", (e) => {
  chrome.storage.local.set({ customContext: e.target.value });
});

ELEMENTS.includeTicketsToggle?.addEventListener("change", (e) => {
  chrome.storage.local.set({ includeTickets: e.target.checked });
  updateToggleUI(e.target);
});

// Tone buttons
ELEMENTS.toneSelector?.addEventListener("click", (e) => {
  const btn = e.target.closest(".tone-btn");
  if (btn) {
    selectedTone = btn.dataset.tone;
    chrome.storage.local.set({ descriptionTone: selectedTone });
    updateToneUI();
  }
});

// Back button
ELEMENTS.backBtn?.addEventListener("click", () => {
  showGeneratorView();
});

// Generate button
ELEMENTS.generateBtn?.addEventListener("click", () => {
  generateDescription();
});

// Regenerate button
ELEMENTS.regenerateBtn?.addEventListener("click", () => {
  generateDescription();
});

// Copy button
ELEMENTS.copyBtn?.addEventListener("click", () => {
  const description = ELEMENTS.generatedDescription?.value;
  if (description) {
    navigator.clipboard.writeText(description).then(() => {
      const btn = ELEMENTS.copyBtn;
      const originalHTML = btn.innerHTML;
      btn.innerHTML =
        '<span class="material-symbols-outlined">check</span><span>Copied!</span>';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 2000);
    });
  }
});

// Insert button
ELEMENTS.insertBtn?.addEventListener("click", () => {
  const description = ELEMENTS.generatedDescription?.value;
  if (!description) return;

  const btn = ELEMENTS.insertBtn;
  const originalHTML = btn.innerHTML;
  btn.innerHTML =
    '<span class="material-symbols-outlined animate-spin">refresh</span><span>Updating...</span>';
  btn.disabled = true;

  chrome.runtime.sendMessage(
    {
      action: "UPDATE_PR_DESCRIPTION",
      url: currentUrl,
      description: description,
    },
    (response) => {
      btn.disabled = false;
      if (response && response.success) {
        btn.innerHTML =
          '<span class="material-symbols-outlined">check</span><span>Updated!</span>';
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        btn.innerHTML = originalHTML;
        alert("Failed to update PR: " + (response?.error || "Unknown error"));
      }
    }
  );
});

// Open settings
ELEMENTS.openSettingsBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options/index.html"));
  }
});

// Generate Description Function
function generateDescription() {
  if (!currentUrl || !currentUrl.includes("github.com/")) {
    alert("Please open this extension on a GitHub Pull Request page.");
    return;
  }

  const btn = ELEMENTS.generateBtn || ELEMENTS.regenerateBtn;
  const originalHTML = btn.innerHTML;
  btn.innerHTML =
    '<span class="material-symbols-outlined animate-spin">refresh</span><span>Generating...</span>';
  btn.disabled = true;

  const settings = {
    template: ELEMENTS.templateSelect?.value || "default",
    context: ELEMENTS.customContext?.value || "",
    tone: selectedTone,
    includeTickets: ELEMENTS.includeTicketsToggle?.checked || false,
  };

  chrome.runtime.sendMessage(
    {
      action: "GENERATE_DESCRIPTION",
      tabId: currentTabId,
      url: currentUrl,
      settings: settings,
    },
    (response) => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;

      if (response && response.success) {
        ELEMENTS.generatedDescription.value = response.description;
        showResultView();
      } else {
        alert("Generation failed: " + (response?.error || "Unknown error"));
      }
    }
  );
}
