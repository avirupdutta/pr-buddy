# Agent Guidelines

## Package Manager

**Prefer `pnpm` over `npm`** for all package operations.

```bash
# ✅ Do this
pnpm install
pnpm add <package>
pnpm dev

# ❌ Not this
npm install
npm add <package>
npm run dev
```

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite + CRXJS (Chrome Extension)
- **Styling**: Tailwind CSS v4
- **State**: Zustand
