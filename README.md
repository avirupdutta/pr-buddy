# PR Buddy

A Chrome extension that uses AI to generate professional PR descriptions and titles from GitHub pull request diffs. Save time writing documentation and focus on what matters - your code.

> **⚠️ Note:** This extension currently works only on raised PRs (not on the PR creation page).

## ✨ Features

- 🤖 **AI-Powered Generation** - Generate PR descriptions and titles using OpenRouter's AI models
- 📝 **Customizable Templates** - Choose from built-in templates (Default, Bug Fix, Feature) or create your own
- 🎨 **Multiple Tones** - Select from Professional, Casual, Concise, or Auto-detected tone
- 🏷️ **Smart Titles** - Optionally generate PR titles based on your custom instructions
- 🎫 **Ticket Integration** - Automatically include ticket references in your PRs
- 🌙 **Dark Mode Support** - Fully themed interface with light/dark mode
- 🔒 **Secure Storage** - API keys are encrypted and stored locally in Chrome
- ⚡ **Fast & Lightweight** - Built with React 19 and Vite for optimal performance

## 📷 Screenshots

<p align="center">
  <img src="screenshots/main.png" width="32%" alt="Main View">
  <img src="screenshots/ai-generated-pr.png" width="32%" alt="AI Generated PR">
  <img src="screenshots/settings.png" width="32%" alt="Settings View">
</p>

## 📋 Requirements

To use this extension, you will need:

### 1. GitHub Personal Access Token (PAT)
Required to fetch PR details and diffs from GitHub.

**How to create:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (full control of private repositories)
4. Copy the generated token

### 2. OpenRouter API Key
Required to generate descriptions using AI models.

**How to get:**
1. Visit [openrouter.ai](https://openrouter.ai)
2. Sign up or log in to your account
3. Go to Settings → API Keys
4. Create a new API key
5. Copy the key

Both keys can be configured in the extension's settings page (click the gear icon in the popup).

## 🚀 Quickstart

### Prerequisites

- Node.js `v20+` (LTS recommended)
- pnpm (`npm install -g pnpm`)

### Build & Install

```bash
# Clone the repository
git clone https://github.com/avirupdutta/pr-buddy.git
cd pr-buddy

# Install dependencies
pnpm install

# Build the extension
pnpm build
```

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist` folder from this project

The extension icon should now appear in your toolbar!

### First Time Setup

1. Click the PR Buddy icon in your Chrome toolbar
2. Click the gear icon to open Settings
3. Enter your GitHub PAT and OpenRouter API Key
4. (Optional) Customize templates, AI models, and preferences
5. Navigate to any GitHub PR page and start generating!

## 🔄 Steps to upgrade (manually)

1. Go to the [GitHub releases page](https://github.com/avirupdutta/pr-buddy/releases) for this repository.
2. Download the latest `dist.zip` file from the releases section.
3. Extract the contents of the zip file.
4. Replace the existing contents of your `dist` folder with the extracted files.
5. Open Chrome and navigate to `chrome://extensions`.
6. Find the PR Buddy extension and click the reload button (circular arrow icon).

## 🐛 Troubleshooting

### Extension not working on GitHub PR pages
- Ensure you're on a raised PR page (URL format: `https://github.com/{owner}/{repo}/pull/{number}`)
- Check that your GitHub PAT has the `repo` scope
- Verify your OpenRouter API key is valid and has available credits

### "Failed to fetch PR details" error
- Check your GitHub PAT is correctly entered in settings
- Ensure the PAT hasn't expired
- Verify you have access to the repository

### "Failed to generate description" error
- Check your OpenRouter API key is correctly entered in settings
- Verify your OpenRouter account has available credits
- Try selecting a different AI model in settings

### Changes not reflecting
- Reload the extension from `chrome://extensions`
- Hard refresh the GitHub page (Ctrl+Shift+R / Cmd+Shift+R)

## 🛠️ Development Setup

```bash
# Install dependencies
pnpm install

# Start dev server with hot reload
pnpm dev
```

Load the extension in Chrome (same steps as above, but select the `dist-dev` folder while dev server is running).

**Important:** Use `dist-dev` folder for development and `dist` folder for production builds. Running `pnpm dev` outputs to `dist-dev`, while `pnpm build` outputs to `dist`.

### Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite + CRXJS (Chrome Extension plugin)
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **State Management:** Zustand
- **AI Integration:** OpenRouter API
- **Icons:** Tabler Icons

### Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite + CRXJS (Chrome Extension plugin)
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **State Management:** Zustand
- **AI Integration:** OpenRouter API
- **Icons:** Tabler Icons

### Available Scripts

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | Start development server with hot reload |
| `pnpm build`       | Build for production                     |
| `pnpm lint`        | Run ESLint                               |
| `pnpm preview`     | Preview production build                 |
| `pnpm changeset`   | Create a changeset for versioning        |
| `pnpm version`     | Bump version based on changesets         |
| `pnpm release`     | Publish release                          |

### Project Structure

```
src/
├── background/        # Service worker for Chrome extension
├── components/        # Shared React components (UI)
├── content/          # Content script for GitHub page injection
├── lib/              # Utility functions
├── options/          # Settings page React app
├── popup/            # Extension popup React app
├── services/         # Chrome API services (storage, messaging, encryption)
├── stores/           # Zustand state management
└── types/            # TypeScript type definitions
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Apache 2.0 - see [LICENSE](./LICENSE)

## 🙏 Acknowledgments

- Built with [shadcn/ui](https://ui.shadcn.com/) components
- Icons by [Tabler Icons](https://tabler-icons.io/)
- AI powered by [OpenRouter](https://openrouter.ai/)
