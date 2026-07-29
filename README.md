# NIMO Core

NIMO Core is the standalone intelligence and integration layer for Manav Agarwal's public project ecosystem.

**Current production version:** `1.1.0`

## Responsibilities

- Canonical public project knowledge
- Deterministic technology and project comparisons
- Bounded multi-turn conversation context
- OpenRouter model routing and ordered failover
- Reasoning-leak and truncated-response protection
- Strict input, context, history, and origin validation
- Short-lived response caching for stateless queries
- Request IDs, telemetry, health checks, and safe public errors
- Optional Cloudflare distributed rate limiting

Private and excluded projects are not indexed, acknowledged, summarized, or promoted.

## Request flow

```text
Portfolio or future public client
              |
         Native NIMO UI
              |
          NIMO Core
 Validation | Knowledge | Deterministic facts | Cache
              |
     Controlled provider failover
```

## Production endpoint

```text
https://nimo-core.manav-nimo.workers.dev
```

## API

- `GET /api/health`
- `POST /api/nimo/chat`
- `POST /v1/chat`

Example payload:

```json
{
  "message": "Compare ToolVerse and SHIFT-ZERO",
  "context": {
    "projectId": "portfolio",
    "pageId": "home",
    "sectionId": "work",
    "language": "en"
  },
  "history": []
}
```

History is validated and bounded to the latest supported turns. Arbitrary client context is never inserted into the system prompt without validation.

## Local development

```bash
git clone https://github.com/manav193/NIMO-CORE.git
cd NIMO-CORE
npm install
npm run lint
npm test
npm run dev
```

Configure the provider key as a Cloudflare secret:

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

Deploy only after lint, tests, and smoke checks pass:

```bash
npm run deploy
```

## v1.1 features

- Deterministic technology ownership answers
- Deterministic named-project comparisons
- Versioned response-cache namespace
- Chat source and latency telemetry
- Provider success/failure telemetry
- Reasoning-output exclusion and leak detection
- Incomplete-response rejection and failover

## Security notes

- Provider credentials never enter browser-delivered code.
- CORS uses an explicit origin allowlist.
- Browser-facing errors do not expose provider details.
- Request history, message size, language, page, and project values are validated.
- In-memory rate limiting is only a local fallback; distributed rate limiting is preferred in production.

## Integration

The visible portfolio client is maintained in [MY-PORTFOLIO](https://github.com/manav193/MY-PORTFOLIO).

## Release

The first stable production release is tagged `v1.0.0`; the current main branch contains the v1.1 production improvements documented above.
