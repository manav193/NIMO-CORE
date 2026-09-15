# Project federation

Project federation is a deterministic composition layer. It does not fetch manifests, execute navigation, dispatch browser events, or persist state. A host imports local manifest and knowledge data, registers it, and decides what to do with results.

## Registration

```js
const federation = createProjectFederation();
federation.registerModule(manifest, knowledgeSource);
```

Registration validates both documents before exposure. Duplicate module IDs, source IDs, and project IDs are rejected. Unregistering a module also removes the knowledge source registered with it.

The API exposes `registerModule()`, `unregisterModule()`, `getModule()`, `getModules()`, `findByCapability()`, `findByKeyword()`, `search()`, and `getRelatedModules()`.

Search scores manifest identity, descriptions, keywords, capabilities, and registered knowledge. Results are module-first and retain their strongest knowledge matches, so a tool query returns ToolVerse while preserving the matched tool metadata.

The `nimo-project-event` protocol version `1.0.0` supports lifecycle events including `projectOpened`, `toolExecuted`, `moduleLoaded`, `projectClosed`, `searchPerformed`, `systemBootStarted`, `nimoCoreOnline`, `moduleRegistryReady`, `toolVerseRegistered`, `repairEventStarted`, `repairEventCompleted`, and `systemBootCompleted`. Events are immutable records; hosts decide whether to dispatch them.

`createSystemStatus()` provides a concise `nimo-system-status` record for UI live regions. Boot event order is: `systemBootStarted`, `nimoCoreOnline`, `moduleRegistryReady`, optional module registration events, then `systemBootCompleted`. Repair order is `repairEventStarted` followed by `repairEventCompleted`. Optional `audioCue` events carry intent only and never play sound.

`createModuleNavigationAction()` returns an unexecuted `module-navigation` action. Routes live in manifests, and hosts interpret targets such as `host:arcade-os`.

Adding a project requires one manifest, one knowledge source, and one registration call. No core change is required.
