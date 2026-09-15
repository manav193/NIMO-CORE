# Cloudflare Workers Deployment Guide

This guide details how to deploy and configure NIMO-CORE on Cloudflare Workers.

---

## 1. Architecture Overview

NIMO-CORE provides a dedicated Cloudflare Worker entrypoint at `src/worker.js`.

- **Web Standards Only**: Zero reliance on Node-only modules (`node:http`, `fs`, `path`, `process`). Runs on the V8 Workers runtime.
- **Deterministic Core**: Resolves project knowledge, navigation actions, and multi-language queries locally at the edge with zero external network overhead.
- **Resilient AI Fallback**: Seamlessly falls back to OpenRouter models when queries are outside deterministic knowledge, with automatic multi-model failover.
- **Production Guardrails**: Strict CORS validation, 64 KB payload size limits, safe JSON parsing, security headers, and rate limiting.
- **Dual Runtime**: The local Node.js server (`src/server/server.js`, `npm run dev`) remains completely intact for local development.

---

## 2. API Endpoints

### `GET /`
- **Browser request (`Accept: text/html`)**: Renders the interactive NIMO-CORE Developer Portal with live query console.
- **API request (`Accept: application/json`)**: Returns JSON metadata:
  ```json
  {
    "name": "@nimo/core",
    "status": "ok",
    "version": "0.2.0",
    "runtime": "cloudflare-worker",
    "endpoints": {
      "health": "/api/health",
      "chat": "/api/nimo/chat",
      "chat_alias": "/v1/chat"
    }
  }
  ```

### `GET /api/health`
Edge health and readiness check:
```json
{
  "status": "ok",
  "version": "0.2.0",
  "runtime": "cloudflare-worker",
  "timestamp": "2026-09-15T12:00:00.000Z"
}
```

### `POST /api/nimo/chat` & `POST /v1/chat`
Main chat and compatibility endpoints.
- **Payload**:
  ```json
  {
    "message": "Who are you?",
    "context": {}
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "reply": "I am NIMO, an interactive assistant...",
    "model": "identity",
    "source": "core",
    "actions": [],
    "recommendations": [],
    "context": {}
  }
  ```

---

## 3. Configuration & Secrets

### Non-Sensitive Variables (`wrangler.jsonc`)
Configured under the `"vars"` block in `wrangler.jsonc`:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `https://manavagarwal.me,http://localhost:8787` |
| `PUBLIC_APP_URL` | Canonical client application URL | `https://manavagarwal.me` |
| `OPENROUTER_MODELS` | Prioritized model list for AI failover | `google/gemini-2.5-flash,meta-llama/llama-3.3-70b-instruct` |
| `PROVIDER_TIMEOUT_MS` | AI provider request timeout in ms | `7500` |

### Secrets
Sensitive tokens must **never** be placed in `wrangler.jsonc` or source control. Upload secrets using Wrangler CLI:

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

---

## 4. Local Worker Development

To test the Cloudflare Worker locally using Wrangler's Miniflare runtime:

1. Copy `.dev.vars.example` to `.dev.vars`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Start the local Worker simulator:
   ```bash
   npx wrangler dev
   ```

To run the Node.js development server instead:
```bash
npm run dev
```

---

## 5. Rate Limiting

- **Cloudflare Native Binding**: If a Cloudflare Rate Limiting binding is configured in `wrangler.jsonc` as `env.RATE_LIMITER`, `src/worker.js` automatically invokes `env.RATE_LIMITER.limit({ key: clientIp })`.
- **Isolate Fallback**: If no rate limiting binding is present, `src/worker.js` falls back to an in-memory bounded `RateLimiter` to protect individual isolates from rapid abuse.

---

## 6. Build Verification & Deployment

### Dry Run (Compile & Validate Bundle)
Verify that bundling succeeds with zero warnings:
```bash
npx wrangler deploy --dry-run
```

### Deploy to Cloudflare Workers
Deploy to production:
```bash
npx wrangler deploy
```
