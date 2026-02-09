---
"pr-buddy": minor
---

feat: Background service worker for AI-powered PR generation

Implemented background service worker to handle GitHub and AI API interactions:
- Streaming PR description generation from GitHub PR context
- Message passing between popup and background script
- Support for generating both title and description
- GitHub API integration for fetching PR information
- Error handling and streaming response management
- Chrome extension message API integration