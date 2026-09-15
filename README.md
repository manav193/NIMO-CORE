# NIMO-CORE

Framework-free, zero-dependency, local-first intelligence and federation core for NIMO integrations.

NIMO-CORE owns persona, multilingual language detection, normalized knowledge, entity matching, follow-up context resolution, response construction, and structured actions. Hosts own DOM, browser navigation, audio, modals, remote AI credentials, and secrets.

---

## Architecture

```text
+-------------------------------------------------------------------------+
|                               Host Application                          |
|             (MY-PORTFOLIO / Arcade OS / ToolVerse / Custom Host)        |
+-------------------------------------------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|  Deterministic Engine |                       |   HTTP Local Server   |
|   (src/core/nimo-     |                       |    (src/server/       |
|       engine.js)      |                       |       server.js)      |
+-----------------------+                       +-----------------------+
| - Language Detection  |                       | - Port: 8787 (default)|
| - Entity Matching     |                       | - GET /api/health     |
| - Intent Routing      |                       | - POST /api/nimo/chat |
| - Context Resolution  |                       | - POST /v1/chat       |
| - Response Building   |                       | - In-Memory Rate Limit|
| - Unexecuted Actions  |                       | - Strict CORS         |
+-----------------------+                       | - Security Headers    |
            |                                   +-----------------------+
            +-----------------------+                       |
                                    |                       v
                                    |           +-----------------------+
                                    +---------> | Optional AI Fallback  |
                                                |   (OpenRouter Client) |
                                                +-----------------------+
                                                | - Model Failover      |
                                                | - Abort Timeout (10s) |
                                                | - Transient Retries   |
                                                | - Output Sanitization |
                                                +-----------------------+
```

### Architectural Principles
1. **Zero External Dependencies**: Pure ESM, runs natively in Node.js (>=18) and modern browser runtimes.
2. **Deterministic by Default**: `NimoEngine.respond()` is synchronous, deterministic, and returns unexecuted actions (`executed: false`).
3. **Strict Isolation**: Integrations or adapters never crash the core runtime.
4. **Security & Zero Leakage**: API keys, internal reasoning, and stack traces are never exposed in responses or logs.

---

## API Endpoints

The local HTTP server listens by default at `http://localhost:8787`.

### 1. Health Check
```http
GET /api/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "0.2.0",
  "runtime": "node",
  "uptime": 124,
  "timestamp": "2026-09-15T08:00:00.000Z"
}
```

### 2. Chat Query
```http
POST /api/nimo/chat
Content-Type: application/json
```
*(Compatibility alias: `POST /v1/chat`)*

**Request Payload:**
```json
{
  "message": "Who are you?",
  "history": [],
  "context": {
    "projectId": "nimo",
    "currentPage": "home",
    "language": "en"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "reply": "I am NIMO, a local-first project intelligence and navigation companion.",
  "model": "identity",
  "source": "core",
  "actions": [],
  "recommendations": [],
  "context": {
    "projectId": "nimo",
    "currentPage": "home",
    "currentSection": null,
    "lastIntent": "identity",
    "followUp": false
  }
}
```

---

## Local Development & Setup

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configuration parameters:
- `PORT`: HTTP port (default `8787`).
- `ALLOWED_ORIGINS`: Comma-separated CORS origins (default: localhost ports 8787, 3000, 5173, 5500).
- `RATE_LIMIT_PER_MINUTE`: Per-client rate limit threshold (default: `60`).
- `OPENROUTER_API_KEY`: Optional OpenRouter API key for remote AI fallback.
- `OPENROUTER_MODELS`: Comma-separated failover model list (default: `openrouter/free`).

For Cloudflare / Wrangler local development, `.dev.vars.example` is also provided.

### 2. Running Locally
```bash
# Start local API server on http://localhost:8787
npm run dev
```

---

## Testing & Quality Commands

```bash
# Run complete test suite (node --test)
npm test

# Check syntax and module imports across all JS files
npm run lint

# Run lint + test suite together
npm run check

# Run end-to-end local server smoke test
npm run smoke

# Sync generated browser modules to MY-PORTFOLIO
npm run sync:portfolio

# Sync event contract to ToolVerse
npm run sync:toolverse
```

---

## Project Structure

```text
.
├── .github/workflows/ci.yml       # Multi-version Node.js CI matrix
├── .env.example                   # Local server configuration template
├── .dev.vars.example              # Wrangler local secrets template
├── docs/                          # Architecture, federation, and schema docs
├── examples/                      # Arcade OS and ToolVerse reference integrations
├── schemas/                       # JSON Schema for module manifests
├── scripts/
│   ├── lint.mjs                   # Zero-dependency syntax validator
│   ├── smoke-test.mjs             # Automated server smoke test
│   ├── sync-portfolio.mjs         # Portfolio synchronizer
│   └── sync-toolverse.mjs         # ToolVerse synchronizer
├── shared/
│   ├── adaptive/                  # Adaptive session, UI, and idle controller
│   └── fabric/                    # Responsive canvas graphics fabric
├── src/
│   ├── adapters/                  # Arcade OS, ToolVerse, generic adapters
│   ├── adaptive/                  # Adaptive session schema and validation
│   ├── core/                      # NimoEngine, IntentRouter, EntityMatcher, etc.
│   ├── federation/                # Manifest schemas, module registry, events
│   ├── integrations/              # BrowserClient with isolated remote fallback
│   ├── knowledge/                 # Knowledge registry and sources
│   ├── server/                    # HTTP server (health, chat, rate limit, CORS)
│   ├── services/                  # OpenRouter client (failover, retries, timeout)
│   ├── utils/                     # Normalization, scoring, validation
│   └── index.js                   # Primary package entry point
└── tests/                         # Unit, security, API, and integration tests
```

---

## Security Model

- **Zero Secret Leakage**: API keys and internal errors are never exposed in public responses or logs.
- **Prototype Pollution Defense**: `assertPlainObject` enforces plain object prototypes and rejects `__proto__`, `constructor`, and `prototype` keys. `sanitizeObject` strips unsafe keys.
- **Strict CORS & Headers**: Rejects unauthorized origins, applies `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Bounded Inputs**: Enforces 64 KB HTTP body limit and 8 KB query bounds to prevent ReDoS and memory exhaustion.
- **Rate Limiting**: Sliding window rate limiting with automatic pruning and `Retry-After` headers.
- **Safe AI Output**: Strips reasoning blocks (`<think>...</think>`) and enforces schema validation before returning responses.

---

## License
MIT
