# NIMO-CORE Security Boundary

NIMO-CORE is the protected AI infrastructure layer for the NIMO ecosystem.

## Non-negotiable boundaries

- Runtime code must not expose filesystem, shell, deployment, or arbitrary code-execution controls.
- Provider credentials such as OPENROUTER_API_KEY must remain server-side secrets and must never be committed to source control, returned in API responses, or logged.
- Agent/client applications consume NIMO-CORE through its documented API contract; they do not receive provider credentials.
- Changes to runtime, provider routing, deployment configuration, authentication/CORS, and security controls require owner review.
- Production changes must pass repository CI checks before deployment.
- No runtime feature may silently grant itself additional privileges.

## Protected paths

- src/
- wrangler.jsonc
- .github/workflows/
- SECURITY.md

## Secret handling

OPENROUTER_API_KEY is expected to be supplied as a Cloudflare Worker Secret. GitHub Actions must not replace or print this secret.

## Incident response

If a secret is suspected to be exposed, rotate it at the provider immediately and review Worker logs and Git history. Never paste a live secret into an issue, commit, chat, or log.
