# NIMO Core

NIMO Core is the standalone intelligence and integration layer for Manav Agarwal's project ecosystem.

## Architecture decision

NIMO is no longer owned by a single portfolio codebase. The portfolio remains a visible client of NIMO, while NIMO Core becomes the canonical backend, knowledge registry, conversation engine, and project integration layer.

### What stays centralized

- NIMO identity, persona, safety rules, and response policy
- Global project catalogue and cross-project recommendations
- Shared owner/profile knowledge
- Conversation sessions and bounded multi-turn history
- OpenRouter/provider routing and failover
- Tool/action validation
- Rate limiting, abuse protection, observability, and API contracts

### What remains inside each project

- Current page, route, selected item, and runtime state
- Project-specific actions and capability handlers
- Local navigation implementation
- Sensitive project data that should not be copied into a public central registry

Each project integrates through a small NIMO client/adapter and sends a trusted `projectId` plus validated context. NIMO Core can therefore answer questions about every registered project and promote relevant projects from any client.

## Target flow

```text
Portfolio / ToolVerse / SELFYY / SHIFT-ZERO / FATE-AI
                         |
                    NIMO Client
                         |
                     NIMO Core
       Project Registry | Memory | Tool Router
                         |
             OpenRouter / future providers
```

## Initial API

- `GET /api/health`
- `GET /api/projects`
- `POST /api/nimo/chat`

Planned:

- `POST /api/sessions`
- `GET /api/projects/:projectId`
- `POST /api/tools/:toolId/execute`

## Migration policy

The portfolio NIMO widget must remain visible during migration. The existing portfolio implementation will only be removed after the standalone API and client adapter are deployed and verified. Migration will be done through an adapter-compatible endpoint so the UI does not disappear or require a full rewrite.

## Immediate engineering priorities

1. Fix the missing `queryOpenRouter` import from the old backend.
2. Replace hardcoded duplicate knowledge with canonical JSON manifests.
3. Add validated multi-turn history.
4. Reject arbitrary project/context values through registry allowlists.
5. Replace in-memory rate limiting with a distributed Cloudflare-compatible limiter.
6. Add generic client errors and structured internal logs.
7. Add automated tests, linting, CI, and provider failover tests.
8. Add session/anonymous abuse controls before exposing costly provider routes.

## Status

Repository initialized. The existing portfolio remains the active NIMO client until the standalone service reaches migration readiness.
