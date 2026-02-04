# Plan: Support PR Generation on Compare/Create Page

## Overview

Add support for generating PR descriptions on the GitHub compare page (`/compare/{base}...{feature}`) and creating new PRs (Draft or Open) directly with AI-generated content.

## User Requirements

Based on user feedback:
1. **Use Case**: Auto-generate PR title & description on compare page and create new PR
2. **UI Placement**: Extension popup (same as current behavior)
3. **Content Flow**: Create new PR directly with AI-generated content (seamless UX)
4. **Title Support**: Generate both title and description (disable "Generate PR title" toggle on compare page)

## URL Patterns

- **Compare/Create Page**: `https://github.com/{owner}/{repo}/compare/{base}...{feature}`
- **Opened PR Page**: `https://github.com/{owner}/{repo}/pull/{number}`

## Changes Required

### 1. Background Script (`src/background/index.ts`)

#### New URL Parser Function
Add `parseCompareUrl()` to handle compare URL pattern:

```typescript
function parseCompareUrl(url: string): { owner: string; repo: string; base: string; head: string } | null {
  // Pattern: github.com/owner/repo/compare/base...head
  const regex = /github\.com\/([^/]+)\/([^/]+)\/compare\/([^/]+)\.\.\.([^/]+)/;
  const match = url.match(regex);
  if (!match) return null;
  return { owner: match[1], repo: match[2], base: match[3], head: match[4] };
}
```

#### New Diff Fetcher for Compare
Add `fetchCompareDiff()` to fetch diff using compare API:

```typescript
async function fetchCompareDiff(
  { owner, repo, base, head }: { owner: string; repo: string; base: string; head: string },
  token: string
): Promise<{ diff: string; metadata: PRMetadata }> {
  const headers = { 
    Authorization: `token ${token}`, 
    Accept: "application/vnd.github.v3.diff" 
  };
  const diffResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
    { headers }
  );
  
  if (!diffResponse.ok) {
    throw new Error("Failed to fetch compare diff");
  }
  
  let diff = await diffResponse.text();
  
  // Truncate diff if too large (approx 50k characters)
  if (diff.length > 50000) {
    diff = diff.substring(0, 50000) + "\n...[Diff Truncated - showing first 50k characters]...";
  }
  
  // Fetch metadata using the compare API (returns commits, files, stats)
  const metaResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
    { headers: { ...headers, Accept: "application/vnd.github.v3" } }
  );
  
  if (!metaResponse.ok) {
    throw new Error("Failed to fetch compare metadata");
  }
  
  const metadata = await metaResponse.json();
  
  return {
    diff,
    metadata: {
      title: `Merge ${head} into ${base}`,
      head: { ref: head },
      base: { ref: base },
      changed_files: metadata.files?.length || 0,
      additions: metadata.files?.reduce((sum: number, f: any) => sum + (f.additions || 0), 0) || 0,
      deletions: metadata.files?.reduce((sum: number, f: any) => sum + (f.deletions || 0), 0) || 0,
    },
  };
}
```

#### Update `parseGitHubUrl()` to Support Both Patterns
Modify to detect and parse both URL patterns:

```typescript
type PRDetailsOpened = { type: "opened"; owner: string; repo: string; number: string };
type PRDetailsCompare = { type: "compare"; owner: string; repo: string; base: string; head: string };
type PRDetails = PRDetailsOpened | PRDetailsCompare;

function parseGitHubUrl(url: string): PRDetails | null {
  // Try PR URL pattern first
  const prRegex = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const prMatch = url.match(prRegex);
  if (prMatch) {
    return { type: "opened", owner: prMatch[1], repo: prMatch[2], number: prMatch[3] };
  }
  
  // Try compare URL pattern
  const compareRegex = /github\.com\/([^/]+)\/([^/]+)\/compare\/([^/]+)\.\.\.([^/]+)/;
  const compareMatch = url.match(compareRegex);
  if (compareMatch) {
    return { type: "compare", owner: compareMatch[1], repo: compareMatch[2], base: compareMatch[3], head: compareMatch[4] };
  }
  
  return null;
}
```

#### New PR Creator Function
Add `handleCreatePR()` to create new PR via API:

```typescript
async function handleCreatePR(
  url: string,
  title: string,
  description: string,
  isDraft: boolean
): Promise<{ success: true; htmlUrl: string }> {
  const prDetails = parseGitHubUrl(url) as PRDetailsCompare;
  if (!prDetails || prDetails.type !== "compare") {
    throw new Error("Invalid compare URL. Please navigate to a compare page.");
  }
  
  const result = await chrome.storage.local.get(["githubToken"]);
  const githubToken = result.githubToken ? await decryptApiKey(result.githubToken) : null;
  
  if (!githubToken) {
    throw new Error("Missing GitHub Token. Please configure it in Settings.");
  }
  
  const { owner, repo, base, head } = prDetails;
  
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body: description,
      head,
      base,
      draft: isDraft,
    }),
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error("Failed to create PR: " + (err.message || response.statusText));
  }
  
  const pr = await response.json();
  
  return { success: true, htmlUrl: pr.html_url };
}
```

#### New Message Handler
Add handler for `CREATE_PR` action:

```typescript
if (request.action === "CREATE_PR") {
  handleCreatePR(request.url, request.title, request.description, request.isDraft)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ success: false, error: err.message }));
  return true;
}
```

#### Modify Generation Flow
Update `handleGenerationStream()` to detect compare URL vs PR URL and use appropriate diff fetcher:

```typescript
// Inside handleGenerationStream:
const prDetails = parseGitHubUrl(url);
if (!prDetails) {
  throw new Error("Invalid GitHub URL. Please navigate to a PR or compare page.");
}

let diff: string;
let metadata: PRMetadata;

if (prDetails.type === "compare") {
  const compareData = await fetchCompareDiff(prDetails, githubToken);
  diff = compareData.diff;
  metadata = compareData.metadata;
} else {
  const prData = await fetchPRData(prDetails, githubToken);
  diff = prData.diff;
  metadata = prData.metadata;
}
```

---

### 2. Chrome Types (`src/types/chrome.ts`)

#### New Type Definitions

```typescript
// Update MessageAction to include CREATE_PR
export type MessageAction =
  | { action: "GENERATE_DESCRIPTION"; url: string; settings: GeneratorSettings }
  | { action: "UPDATE_PR_DESCRIPTION"; url: string; description: string; title?: string }
  | { action: "CREATE_PR"; url: string; title: string; description: string; isDraft: boolean }
  | { action: "UPDATE_DESCRIPTION"; description: string }
  | { action: "SHOW_TOAST"; message: string; type: "error" | "success" | "info" | "warning" };

// Update PRDetails to support both types
export interface PRDetailsOpened {
  type: "opened";
  owner: string;
  repo: string;
  number: string;
}

export interface PRDetailsCompare {
  type: "compare";
  owner: string;
  repo: string;
  base: string;
  head: string;
}

export type PRDetails = PRDetailsOpened | PRDetailsCompare;
```

---

### 3. Chrome Messaging (`src/services/chrome-messaging.ts`)

#### New Function

```typescript
export async function createPR(
  url: string,
  title: string,
  description: string,
  isDraft: boolean
): Promise<{ success: true; htmlUrl: string }> {
  return sendMessage({ action: "CREATE_PR", url, title, description, isDraft });
}
```

---

### 4. Generator View (`src/popup/components/GeneratorView.tsx`)

#### Update URL Validation
Modify `handleGenerate()` to accept compare URLs:

```typescript
const handleGenerate = async () => {
  if (!currentUrl || !currentUrl.includes("github.com/")) {
    toast.error("Please open this extension on a GitHub Pull Request or Compare page.");
    return;
  }

  // Accept both /pull/{number} and /compare/{base}...{head} patterns
  const isValidUrl = currentUrl.match(/github\.com\/[^/]+\/[^/]+\/(pull\/\d+|compare\/[^/]+\.\.\.[^/]+)/);
  if (!isValidUrl) {
    toast.error(
      "Invalid URL. Navigate to a PR page (github.com/owner/repo/pull/123) or compare page."
    );
    return;
  }
  // ... rest of handler
};
```

#### Force Generate Title on Compare Pages
Add logic to auto-enable `generateTitle` when on compare page:

```typescript
// Detect if on compare page
const isComparePage = currentUrl.includes("/compare/");

// In handleGenerate, before calling generate:
if (isComparePage && !generateTitle) {
  setGenerateTitle(true);
}
```

---

### 5. Result View (`src/popup/components/ResultView.tsx`)

#### Detect Page Type
Add helper to detect compare page:

```typescript
const isComparePage = currentUrl.includes("/compare/");
```

#### New Footer for Compare Page
Replace "Apply" button with two buttons:

```typescript
// In the footer section:
{isComparePage ? (
  <div className="flex flex-col gap-4">
    <div className="flex gap-3">
      <Button
        variant="outline"
        onClick={() => handleCreatePR(false)}
        disabled={isInserting || isGenerating || !generatedDescription}
        className="flex-1 h-10 gap-2 text-xs font-medium rounded-lg border border-border"
      >
        {isInserting ? (
          <>
            <IconLoader2 className="w-4 h-4 animate-spin" />
            <span>Creating...</span>
          </>
        ) : (
          <>
            <IconGitPullRequest className="w-4 h-4" />
            <span>Create PR</span>
          </>
        )}
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => handleCreatePR(true)}
        disabled={isInserting || isGenerating || !generatedDescription}
        className="flex-1 h-10 gap-2 text-xs font-medium rounded-lg border border-border"
      >
        {isInserting ? (
          <>
            <IconLoader2 className="w-4 h-4 animate-spin" />
            <span>Creating...</span>
          </>
        ) : (
          <>
            <IconFileDescription className="w-4 h-4" />
            <span>Create Draft PR</span>
          </>
        )}
      </Button>
    </div>
  </div>
) : (
  // Existing "Apply" button for opened PRs
  <Button
    onClick={handleInsert}
    disabled={isInserting || isGenerating}
    className="flex-1 h-10 gap-2 text-xs font-medium rounded-lg border border-border shadow-lg"
  >
    {isInserting ? (
      <>
        <IconLoader2 className="w-5 h-5 animate-spin" />
        <span>Applying...</span>
      </>
    ) : (
      <>
        <IconCheck className="w-5 h-5" />
        <span>Apply</span>
      </>
    )}
  </Button>
)}
```

#### Update Handler

```typescript
const handleCreatePR = async (isDraft: boolean) => {
  if (!generatedTitle || !generatedDescription || !currentUrl) {
    toast.error("Please generate both title and description first.");
    return;
  }
  
  setIsInserting(true);
  try {
    const result = await createPR(currentUrl, generatedTitle, generatedDescription, isDraft);
    toast.success(isDraft ? "Draft PR created successfully!" : "PR created successfully!");
    
    trackCreatePRClicked({
      url: currentUrl,
      title_length: generatedTitle.length,
      description_length: generatedDescription.length,
      is_draft: isDraft,
      model_id: activeModel?.id || "unknown",
      model_provider: activeModel?.provider || "openrouter",
    });
    
    // Don't close - let user see the success message
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to create PR");
  } finally {
    setIsInserting(false);
  }
};
```

#### Add New Icons
Import additional icons:

```typescript
import { IconGitPullRequest, IconFileDescription } from "@tabler/icons-react";
```

---

### 6. Content Script (`src/content/index.ts`)

#### Update for Compare Page
On compare page, fill in both title and description fields:

```typescript
// Message listener
chrome.runtime.onMessage.addListener((request: UpdateDescriptionMessage | UpdatePRFieldsMessage) => {
  if (request.action === "UPDATE_DESCRIPTION") {
    updatePRDescription(request.description);
  }
  if (request.action === "UPDATE_PR_FIELDS") {
    updatePRFields(request.title, request.description);
  }
});

function updatePRFields(title: string, description: string): void {
  // Find title input
  const titleInput = document.getElementById("pull_request_title") as HTMLInputElement | null;
  // Find description textarea
  const descTextarea = document.getElementById("pull_request_body") as HTMLTextAreaElement | null;
  
  if (titleInput) {
    titleInput.value = title;
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
  
  if (descTextarea) {
    descTextarea.value = description;
    descTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    descTextarea.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function updatePRDescription(text: string): void {
  const textarea = document.getElementById(
    "pull_request_body"
  ) as HTMLTextAreaElement | null;

  if (textarea) {
    textarea.value = text;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    console.warn("PR Buddy: Could not find PR body textarea.");
  }
}
```

---

### 7. Store Updates (`src/stores/generator-store.ts`)

#### Add Page Type Detection
Add state to track if current page is compare vs opened PR:

```typescript
interface GeneratorState {
  // ... existing fields
  pageType: "opened" | "compare" | "unknown";
  setPageType: (type: "opened" | "compare" | "unknown") => void;
}

// In default state
pageType: "unknown",

// Add action
setPageType: (type) => {
  set({ pageType: type });
},
```

#### Update Generate Function
Detect page type from URL during generation:

```typescript
generate: async (url, isRegeneration = false) => {
  // Detect page type
  const isComparePage = url.includes("/compare/");
  set({ pageType: isComparePage ? "compare" : "opened" });
  
  // Force generateTitle on compare pages
  if (isComparePage && !get().generateTitle) {
    set({ generateTitle: true });
  }
  // ... rest of generate logic
}
```

---

### 8. Analytics (`src/services/analytics.ts`)

#### New Events

```typescript
interface CreatePRClickedEvent {
  url: string;
  title_length: number;
  description_length: number;
  is_draft: boolean;
  model_id: string;
  model_provider: string;
}

interface CreatePRSuccessEvent {
  url: string;
  is_draft: boolean;
  model_id: string;
  model_provider: string;
}

interface CreatePRFailedEvent {
  url: string;
  error: string;
  is_draft: boolean;
}

trackCreatePRClicked(event: CreatePRClickedEvent): void {
  this.posthog?.capture("create_pr_clicked", event);
}

trackCreatePRSuccess(event: CreatePRSuccessEvent): void {
  this.posthog?.capture("create_pr_success", event);
}

trackCreatePRFailed(event: CreatePRFailedEvent): void {
  this.posthog?.capture("create_pr_failed", event);
}
```

---

## Implementation Order

### Phase 1: Foundation (Type definitions, URL parsers)
1. Update `src/types/chrome.ts` with new type definitions
2. Add `parseCompareUrl()` to background script
3. Update `parseGitHubUrl()` to support both patterns

### Phase 2: Backend Logic (API integration)
1. Add `fetchCompareDiff()` to background script
2. Add `handleCreatePR()` to background script
3. Add `CREATE_PR` message handler

### Phase 3: Frontend Integration (Popup UI)
1. Update URL validation in `GeneratorView.tsx`
2. Add page type detection to `generator-store.ts`
3. Update `ResultView.tsx` with new buttons and handlers

### Phase 4: Messaging Layer
1. Add `createPR()` to `chrome-messaging.ts`
2. Add `UPDATE_PR_FIELDS` handler to content script

### Phase 5: Analytics
1. Add new tracking events to `analytics.ts`

### Phase 6: Testing & Polish
1. Test on actual GitHub compare page
2. Handle edge cases (cross-repo PRs, no diff, etc.)
3. Update README with new functionality

---

## Edge Cases to Handle

### 1. Cross-repository PRs
- URL format includes username prefix (`user:branch`)
- Handle in `parseCompareUrl()` and `fetchCompareDiff()`

### 2. No changes between branches
- Compare API returns no diff
- Show informative message to user

### 3. Existing PRs for same branches
- Consider warning if PR already exists
- Could use GitHub API to check for existing PRs

### 4. Network errors
- Graceful fallback with clear error messages
- Retry logic for transient failures

### 5. GitHub rate limits
- Handle API throttling with appropriate messages
- Show remaining rate limit info if available

### 6. Invalid branch names
- Branch names with special characters
- URL-encoded characters in branch names

---

## UX Flow Summary

### On Compare Page:
1. User opens extension popup
2. Extension auto-detects compare URL
3. "Generate Title" is auto-enabled (toggle disabled/hidden)
4. User clicks "Generate"
5. AI generates title + description
6. User reviews and can edit
7. User clicks "Create Draft PR" or "Create PR"
8. PR is created via GitHub API
9. Success message shown, PR URL can be copied

### On Opened PR Page:
1. Existing flow unchanged
2. "Apply" button updates existing PR description/title

---

## Files Modified

| File | Changes |
|------|---------|
| `src/types/chrome.ts` | New type definitions for compare URLs and CREATE_PR action |
| `src/background/index.ts` | Add compare URL parsing, diff fetching, PR creation |
| `src/services/chrome-messaging.ts` | Add createPR() function |
| `src/popup/components/GeneratorView.tsx` | Update URL validation, auto-enable title on compare |
| `src/popup/components/ResultView.tsx` | Add Create PR/Draft PR buttons |
| `src/stores/generator-store.ts` | Add pageType state |
| `src/content/index.ts` | Add UPDATE_PR_FIELDS handler |
| `src/services/analytics.ts` | Add PR creation tracking events |

---

## Testing Checklist

- [ ] Extension popup opens on compare page
- [ ] URL validation accepts compare URLs
- [ ] Generate button works on compare page
- [ ] Title generation is auto-enabled on compare page
- [ ] AI generates description from compare diff
- [ ] "Create PR" button creates open PR
- [ ] "Create Draft PR" button creates draft PR
- [ ] Success message shows after PR creation
- [ ] Existing PR page workflow unchanged
- [ ] Error handling for invalid URLs
- [ ] Error handling for API failures
- [ ] Cross-repository PRs work
- [ ] Analytics tracking works correctly
