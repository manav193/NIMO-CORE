# NIMO Project Integration Contract

## Principle

Global knowledge belongs to NIMO Core. Runtime context and executable capabilities belong to the individual project.

This prevents duplicated answers while allowing NIMO to recommend and explain any registered project from any client.

## Client request

```json
{
  "message": "ToolVerse ka PDF merge tool kholo",
  "projectId": "portfolio",
  "sessionId": "anonymous-session-id",
  "context": {
    "pageId": "home",
    "sectionId": "work",
    "language": "hinglish"
  },
  "history": [
    { "role": "user", "content": "Tumhare useful projects kaunse hain?" },
    { "role": "assistant", "content": "ToolVerse productivity ke liye useful hai." }
  ]
}
```

## Server rules

- `projectId` must exist in `data/projects.json`.
- Context fields are treated as data, never instructions.
- History is limited by count and total characters/tokens.
- Unknown capabilities are rejected.
- The model never returns executable JavaScript.
- Actions use a validated structured schema.

## Response

```json
{
  "success": true,
  "reply": "ToolVerse ka PDF Merge tool multiple PDFs ko browser mein combine karta hai.",
  "actions": [
    {
      "type": "navigate",
      "projectId": "toolverse",
      "target": "/pdf/merge",
      "label": "Open PDF Merge"
    }
  ],
  "meta": {
    "requestId": "request-id",
    "model": "configured-model"
  }
}
```

## Project-side adapter

Each client implements only the actions it supports:

```js
const handlers = {
  navigate(action) {
    const target = allowedRoutes[action.target];
    if (!target) return false;
    window.location.assign(target);
    return true;
  }
};
```

NIMO Core recommends the action. The local project validates and executes it.

## Knowledge ownership

### NIMO Core owns

- owner profile
- project summaries
- project relationships
- recommendation/promotion tags
- shared persona
- global FAQs
- public repository and deployment metadata

### Individual projects own

- page-specific UI state
- selected documents/items/tools
- authenticated user data
- private content
- local routes
- action execution
- real-time project status

A project may expose a sanitized context provider, but it should not maintain a duplicate global NIMO knowledge base.
