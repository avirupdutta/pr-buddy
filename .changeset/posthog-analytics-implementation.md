---
"pr-buddy": minor
---

feat: Implement comprehensive PostHog analytics tracking across the extension

Added a complete analytics solution to track user behavior and application performance:

**Analytics Service (`src/services/analytics.ts`)**
- Created reusable analytics service with singleton pattern
- Provides typed tracking methods for all major events
- Includes `useAnalytics()` React hook for component integration
- Handles initialization, tracking, and event batching

**Events Constants (`src/data/constants.ts`)**
- Added 40+ event types covering:
  - Popup/page lifecycle events
  - Button clicks (Generate, Regenerate, Copy, Apply, Settings, etc.)
  - Settings operations (saved, tab changes, API keys, theme, dev mode)
  - Template CRUD (selected, added, updated, deleted)
  - Model operations (selected, added, updated, deleted, set active)
  - Generation lifecycle (started, completed, failed, stopped)
  - User inputs (tone selection, context, title generation toggle)
  - Onboarding (tours, steps, completions)
  - Error tracking

**Components Updated with Tracking**
- **Popup Components**: Header, GeneratorView, ResultView, ModelSelector, TemplateSelector, ToneSelector, ContextInput
- **Options Page**: Settings tabs, template/model CRUD operations, onboarding tours
- **Stores**: Generation lifecycle tracking in generator-store

**Key Features**
- Type-safe event tracking with TypeScript interfaces
- Rich contextual data (URLs, model details, content lengths, duration metrics)
- Privacy-conscious implementation (no session recording, localStorage persistence)
- Extensible architecture for future event additions
- Reusable constants for event naming consistency

This implementation enables comprehensive user behavior analysis and performance monitoring across the PR Buddy extension.
