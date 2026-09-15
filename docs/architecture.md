# Architecture

NIMO is split into three boundaries:

1. **Core intelligence** — pure ES modules for language detection, normalization, matching, intent routing, context, and response/action construction.
2. **Knowledge adapters** — translate host-owned Arcade OS, ToolVerse, or generic project data into one validated registry schema.
3. **Host integrations** — render UI, execute navigation or Arcade events, call optional remote services, and manage browser-specific state.

The core never reads the DOM, writes `window.location`, executes an action, plays sound, opens a modal, or calls a remote model. `NimoEngine.respond()` is synchronous and deterministic and returns `executed: false`.

MY-PORTFOLIO Phase 1 retains its proven legacy intent/UI module. A generated browser copy of this package is registered as a compatibility fallback and exposed for progressive migration. Existing portfolio intents run first, protecting Arcade secrets, navigation, mobile behavior, guardrails, and backend fallback.
