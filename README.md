# NIMO Core

NIMO Core is the standalone intelligence and integration layer for Manav Agarwal's public project ecosystem.

## Architecture

NIMO is no longer owned by a single portfolio codebase. The portfolio remains a visible native client, while NIMO Core owns the canonical public knowledge registry, secure provider access, validation, bounded conversation context, observability, and project integration contract.

### Central responsibilities

- NIMO identity, response policy, and public knowledge
- Cross-project discovery and relevant recommendations
- OpenRouter model routing and failover
- Strict message, history, language, page, and project validation
- Structured internal errors and safe public responses
- Request IDs, health checks, rate-limiter integration, and API contracts

### Project-local responsibilities

- Visible NIMO interface and product-native styling
- Current route, page, selected item, and runtime state
- Local navigation and allowlisted capability handlers
- Private or unpublished data, which must never enter NIMO Core

Private projects are excluded completely. NIMO does not index, acknowledge, summarize, or promote a project unless it is explicitly registered as public.

## Flow

```text
Portfolio / ToolVerse / SHIFT-ZERO / FATE-AI / future public clients
                              |
                     Native NIMO client
                              |
                         NIMO Core
            Validation | Knowledge | Memory | Routing
                              |
                         OpenRouter
```

## API

- `GET /api/health`
- `POST /api/nimo/chat` — backward-compatible portfolio endpoint
- `POST /v1/chat` — versioned endpoint

Accepted chat payload:

```json
{
  "message": "Tell me about ToolVerse",
  "context": {
    "projectId": "portfolio",
    "pageId": "project-nimo",
    "sectionId": "architecture",
    "language": "en"
  },
  "history": [
    { "role": "user", "content": "What is NIMO?" },
    { "role": "assistant", "content": "NIMO is..." }
  ]
}
```

History is validated and limited to the latest 10 turns. Arbitrary context strings never enter the system prompt.

## Local setup

```powershell
npm install
npx wrangler secret put OPENROUTER_API_KEY
npm test
npm run dev
```

Deploy only after tests and smoke checks pass:

```powershell
npm run deploy
```

## Implemented safeguards

- Fixed provider import boundaries through explicit route imports
- Canonical public project registry
- Private-project exclusion regression test
- Bounded multi-turn conversation history
- Project and route ID allowlisting
- Provider timeout and ordered model failover
- Generic browser-facing errors
- Structured internal provider logs
- Request IDs and no-store API responses
- Exact CORS allowlist
- Optional Cloudflare distributed rate-limiter binding
- In-memory limiter only as a local/development fallback
- Vitest validation and privacy regression tests

## Migration policy

The portfolio widget remains visible throughout migration. The old endpoint stays active until NIMO Core is deployed and passes health, chat, failover, CORS, and frontend smoke tests. Only then should the portfolio's backend URL be switched. This prevents a backend refactor from removing or breaking the visible assistant.
