# Plan: Support PR Creation Page

This plan outlines the steps required to enable the PR Buddy extension to work on the GitHub PR creation page (comparison page).

## 1. Type Definitions (`src/types/chrome.ts`)
- Update `PRDetails` to accommodate branch-based comparisons:
  ```typescript
  export interface PRDetails {
    owner: string;
    repo: string;
    number?: string; // Optional for raised PRs
    base?: string;   // Required for comparison pages
    head?: string;   // Required for comparison pages
  }
  ```
- Update `UpdateDescriptionMessage` to include an optional `title`:
  ```typescript
  export type UpdateDescriptionMessage = {
    action: "UPDATE_DESCRIPTION";
    description: string;
    title?: string;
  };
  ```

## 2. Content Script Enhancement (`src/content/index.ts`)
- Update the message listener to handle both `title` and `description`.
- Implement logic to find and update the title input field (e.g., `document.getElementById('pull_request_title')`).
- Ensure it continues to support `pull_request_body`.

## 3. Background Script Updates (`src/background/index.ts`)
- **URL Parsing**: Update `parseGitHubUrl` to handle both `/pull/123` and `/compare/base...head` formats.
- **Data Fetching**: 
  - Update `fetchPRData` to branch logic based on whether it has a PR number or base/head branches.
  - For comparison pages, use the GitHub Compare API: `GET /repos/{owner}/{repo}/compare/{base}...{head}`.
  - Map the comparison API response to the `PRMetadata` structure (handling `files`, `additions`, `deletions`, etc.).
- **Update Logic**: Modify `handleUpdatePR` to check for the existence of a PR number. If missing, it should fallback to sending a message to the content script of the active tab.

## 4. Popup UI Adjustments
- **URL Validation (`src/popup/components/GeneratorView.tsx`)**:
  - Update the regex to allow URLs matching `github.com/owner/repo/compare/base...head`.
- **Result Handling (`src/popup/components/ResultView.tsx`)**:
  - Ensure the "Auto-Insert" button works correctly even when no PR number is available by relying on the content script message.

## 5. Verification
- Test with an existing PR.
- Test with the PR creation page (`/compare/...`).
- Verify that both Title and Description are correctly populated in both scenarios.
