# NIMO Ecosystem Architecture & Governance

## 1. Multi-Tier Layer Division

The NIMO ecosystem maintains a clean separation of concerns across tiers:

```
Prompt-Aii / NIMO-WEB / NIMO Assistant (Producers)
                      │
                      │ [Sanitized feedback & telemetry]
                      ▼
        NIMO-CORE (Orchestration & Learning)
                      │
                      │ [Structured evaluation proposals]
                      ▼
  NIMO-KNOWLEDGE (Governed Knowledge & Schemas)
                      │
                      │ [Strict Human/System Review Gate]
                      ▼
   Approved / Active Knowledge Catalog
                      │
                      │ [Governed runtime retrieval]
                      ▼
      NIMO-CORE Runtime Decision Engine
```

### Layer Roles:
1. **NIMO-CORE (Intelligence & Orchestration Layer)**:
   - Owns persona, multilingual language detection, normalized knowledge registry, entity matching, follow-up context resolution, and deterministic response construction.
   - Hosts `LearningStore` and `EvaluationEngine` to analyze observation patterns and generate reviewable `ImprovementProposal` records without autonomous self-modification.
   - Consumes approved knowledge via `GovernedKnowledgeClient`.

2. **NIMO-KNOWLEDGE (Governed Knowledge Layer)**:
   - Authoritative, version-controlled source of truth for JSON schemas, catalog indexes, and validated knowledge assets.
   - Houses the evaluation gate and approval lifecycle: items progress through `draft` → `evaluated` → `approved` / `active`.

3. **Prompt-Aii & Client Projects (Knowledge & Feedback Producers)**:
   - Prompt engineering lab and client applications.
   - Emit sanitized execution outcomes and user feedback signals (e.g., rating, target, strategy) to NIMO-CORE.
   - Do not directly modify core knowledge.

4. **Google Drive (Planned Future Bulk Storage Layer)**:
   - Reserved as a future cold storage and bulk object layer for high-volume raw telemetry, audio streams, visual UI traces, and large benchmark datasets.
   - **Important**: No live Google Drive integration exists in this phase. NIMO-CORE never reads unverified raw data from Google Drive directly.

---

## 2. Strict Runtime Approval Boundary

Only **`APPROVED`** or **`ACTIVE`** knowledge may be consumed by the NIMO-CORE runtime.

### Permitted Statuses:
- `approved`: Validated, peer-reviewed, and verified knowledge.
- `active`: Current production active guidance.

### Strictly Barred from Runtime Retrieval:
- `proposed`: Generated proposals awaiting evaluation.
- `draft`: In-progress drafts.
- `evaluated`: Benchmark results pending formal sign-off.
- `rejected`: Proposals that failed validation.
- `archived`: Deprecated or rolled back entries.

If an unapproved entry is requested, `GovernedKnowledgeClient` fails closed safely, returning `{ success: false, reason: 'ENTRY_NOT_APPROVED' }`.

---

## 3. Provenance Preservation

Every knowledge asset retrieved by `GovernedKnowledgeClient` preserves full provenance:
- `knowledgeId`: Unique entry ID.
- `version`: Monotonically increasing version.
- `sourceProject`: Originating project (e.g., `prompt-aii`, `nimo-core`).
- `status`: Lifecycle status (`approved` or `active`).
- `approvedBy`: Reviewer or committee consensus hash.
- `evidence`: Backlinks to benchmark runs or evaluation IDs.
- `catalogVersion` and `path`: Catalog release alignment.

---

## 4. Fault Isolation & Secret Safety

- **Safe Fallback**: If NIMO-KNOWLEDGE is unavailable or returns an error, NIMO-CORE continues operating deterministically using local knowledge sources without crashing.
- **No Hallucinated Knowledge**: The client never fabricates knowledge when resolution fails.
- **Zero Secrets**: Diagnostic logs automatically redact API keys, tokens, credentials, and Authorization headers.
