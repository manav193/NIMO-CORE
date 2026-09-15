# Integration guide

## Host responsibilities

Create one or more adapters, pass them to `createNimoEngine`, and provide current-page context when calling `respond`. Render `text`, `recommendations`, and `actions`. Only the host may execute an action.

```js
const response = engine.respond(userInput, {
  currentPage: document.title,
  currentProjectId: page.dataset.projectId
});

for (const action of response.actions) {
  if (action.type === 'navigate') hostRouter.navigate(action.target);
  if (action.type === 'arcade-event') arcadeEvents.emit(action.event);
}
```

Remote AI is optional. `createBrowserClient({ engine, remoteFallback })` invokes it only after a deterministic fallback and leaves credentials/endpoints with the host.

## MY-PORTFOLIO compatibility

Run `npm run sync:portfolio` in NIMO-CORE after core changes. The generated `frontend/js/nimo-core` directory is browser-served during Playwright tests and bundled by the existing portfolio build. Do not edit generated files directly.

## ToolVerse

Generate a manifest matching the contract in `knowledge-schema.md`, create a ToolVerse adapter, and wire its structured actions into ToolVerse navigation in a later phase. Phase 1 does not alter ToolVerse UI.
