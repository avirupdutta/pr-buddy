import type { Tour } from "nextstepjs";

export const settingsTourSteps: Tour[] = [
  {
    tour: "settingsOnboarding",
    steps: [
      {
        icon: "🔑",
        title: "Welcome to PR Buddy Setup",
        content: "Before you can generate PR descriptions, you need to configure two API keys. Let's set them up!",
        selector: "#settings-tab-general",
        side: "right",
        showSkip: false,
        showControls: true,
      },
      {
        icon: "🐙",
        title: "GitHub Token",
        content: "Enter your GitHub Personal Access Token here. This allows PR Buddy to read your repositories and apply PR descriptions. Click 'Generate Token' for help.",
        selector: "#settings-github-token",
        side: "right",
        showControls: true,
      },
      {
        icon: "🤖",
        title: "OpenRouter Key",
        content: "Enter your OpenRouter API key here. This powers the AI that generates your PR descriptions. OpenRouter gives you access to multiple AI models.",
        selector: "#settings-openrouter-key",
        side: "right",
        showControls: true,
      },
      {
        icon: "💾",
        title: "Save Your Keys",
        content: "Click the Save button to store your API keys securely. Once saved, you can start using PR Buddy!",
        selector: "#settings-save-btn",
        side: "top",
        showSkip: false,
        showControls: true,
      },
      {
        icon: "🎉",
        title: "You're Ready!",
        content: "Your API keys are saved and you're all set to start generating PR descriptions. Click Finish to start using PR Buddy!",
        selector: "#settings-save-btn",
        side: "top",
        showSkip: false,
        showControls: true,
      },
    ],
  },
];
