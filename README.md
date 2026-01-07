# PR Buddy

A Chrome extension that helps generate PR descriptions using AI.

> **⚠️ Note:** This extension currently works only on raised PRs.

## 📷 Screenshots

<p align="center">
  <img src="screenshots/main.png" width="32%" alt="Main View">
  <img src="screenshots/ai-generated-pr.png" width="32%" alt="AI Generated PR">
  <img src="screenshots/settings.png" width="32%" alt="Settings View">
</p>

## 🚀 Quickstart

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

### Build & Install

```bash
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

## 🛠️ Development Setup

```bash
# Install dependencies
pnpm install

# Start dev server with hot reload
pnpm dev
```

Load the extension in Chrome (same steps as above, but select the `dist` folder while dev server is running).

### Available Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Start development server |
| `pnpm build`   | Build for production     |
| `pnpm lint`    | Run ESLint               |
| `pnpm preview` | Preview production build |

## 📄 License

Apache 2.0 - see [LICENSE](./LICENSE)
