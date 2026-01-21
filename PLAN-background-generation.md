# Plan: Background PR Generation & Auto-Update

## Objective
Implement a "Fire and Forget" workflow where the user can trigger PR generation, close the extension popup, and have the browser extension complete the generation in the background and automatically update the PR fields on the active tab.

## Architecture & Workflow

1.  **Popup UI**: Adds a toggle for "Background Auto-update".
2.  **Popup Logic**: When enabled, the popup gathers initial context (diffs, inputs) and sends a message to the **Background Script**, then immediately frees the UI.
3.  **Background Script**: Handles the expensive LLM generation task. It holds the `tabId` of the original request.
4.  **Content Script**: Listens for a completion message from the Background Script and updates the DOM (Title/Description fields) on the target page.

## Detailed Implementation Steps

### 1. Shared Logic Refactoring
Currently, generation logic might be inside the React components. We need to move the actual API call logic to a shared service that the Background Script can run (since the Background Script cannot use React hooks).

*   **Action**: Create/Update `src/services/ai-service.ts` (or similar).
*   **Goal**: Ensure `generatePrDescription` and `generatePrTitle` functions are pure TypeScript functions taking `apiKey`, `model`, `context` as arguments, not depending on UI state directly.

### 2. Message Type Definitions
Define the contract between Popup, Background, and Content scripts.

*   **File**: `src/types/chrome.ts`
*   **Additions**:
    ```typescript
    export type BackgroundGenerationPayload = {
        type: 'START_BG_GENERATION';
        payload: {
            apiKey: string;
            provider: string; // openai, anthropic, etc.
            model: string;
            diff: string;
            context: string;
            tone: string;
            template: string;
            tabId: number;
            generateTitle: boolean;
        }
    };

    export type UpdatePRPayload = {
        type: 'UPDATE_PR_FIELDS';
        payload: {
            title?: string;
            description: string;
        }
    };
    ```

### 3. Store Updates
Persist the user's choice so they don't have to toggle it every time.

*   **File**: `src/stores/settings-store.ts`
*   **Change**: Add `autoUpdateInBackground: boolean` (default `false`) and a setter action.

### 4. UI Implementation (Popup)
*   **File**: `src/popup/components/GeneratorView.tsx`
*   **Changes**:
    1.  Import `Switch` from `components/ui/switch`.
    2.  Bind Switch to `settingsStore.autoUpdateInBackground`.
    3.  Modify the "Generate" button `onClick`:
        *   **If Toggle ON**:
            *   Collect all current state (Context, Template, etc.).
            *   Get current Tab ID.
            *   Send `START_BG_GENERATION` message to Runtime.
            *   Show a toast: "Generation started in background. You can close this popup."
        *   **If Toggle OFF**: Keep existing foreground logic.

### 5. Background Script Implementation
The service worker needs to listen, execute, and respond.

*   **File**: `src/background/index.ts`
*   **Logic**:
    1.  `chrome.runtime.onMessage.addListener` for `START_BG_GENERATION`.
    2.  Extract payload.
    3.  Call the shared generation service (Step 1).
    4.  Await results.
    5.  Call `chrome.tabs.sendMessage(tabId, { type: 'UPDATE_PR_FIELDS', ... })`.
    6.  (Optional) `chrome.notifications.create` to alert user if the tab was closed or on error.

### 6. Content Script Implementation
The content script acts as the hands that type into the website.

*   **File**: `src/content/index.ts`
*   **Logic**:
    1.  `chrome.runtime.onMessage.addListener` for `UPDATE_PR_FIELDS`.
    2.  Detect platform (GitHub, Azure, Bitbucket, GitLab) – *Assuming existing logic for this exists or needs to be added*.
    3.  Select DOM elements (e.g., `#pull_request_title`, `#pull_request_body`).
    4.  Insert text.
    5.  **Critical**: Dispatch `new Event('input', { bubbles: true })` so React/Vue on the host site detects the change.

## Verification Plan
1.  Navigate to a GitHub Pull Request page.
2.  Open extension, set API key.
3.  Enable "Background Auto-update".
4.  Click Generate.
5.  **Close the extension popup immediately.**
6.  Wait for generation time (approx 5-15s).
7.  Observe the PR Title and Description fields populating automatically without user intervention.
