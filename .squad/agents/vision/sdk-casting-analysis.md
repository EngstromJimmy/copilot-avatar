# SDK Casting Integration Analysis

**Date:** 2026-05-17T20:33:05.422+02:00  
**Analyst:** Vision (Platform Dev)  
**Scope:** Extension cast identity data sourcing

## Question

Should `copilot-avatar` extension source cast identity from the Squad SDK rather than directly reading `.squad/casting/registry.json` and `.squad/casting/history.json`?

## Findings

### 1. What the Squad SDK Actually Exposes

The Squad SDK (`@bradygaster/squad-sdk@0.9.4`) exports a **casting module** with:

**Live APIs:**
- `CastingEngine` class — generates themed agent personas on-demand from a universe template
  - `castTeam(config: CastingConfig)` → generates fresh `CastMember[]` with name, role, personality, backstory
  - `getUniverses()` — returns `['usual-suspects' | 'oceans-eleven' | 'custom']`
  
- `CastingHistory` class — tracks casting decisions over time
  - `recordCast(team, config, timestamp?)` — records a casting decision
  - `getCastHistory()` — returns all casting records, oldest first
  - `getAgentHistory(agentName)` — query by agent name
  - `serializeHistory()` / `deserializeHistory()` — persist to JSON

**Legacy/Stub API:**
- `CastingRegistry` class — filesystem-backed wrapper (marked "stub")
  - Takes a `CastingRegistryConfig` with `castingDir` path
  - Methods: `load()`, `getByRole(role)`, `getAllEntries()`, `cast(role)`, `recast(universe)`
  - **Type signature indicates file-based fallback behavior, not active runtime.**

### 2. The Casting/Casting Registry Distinction

The SDK separates two concepts:

| Aspect | `CastingEngine` + `CastingHistory` | `CastingRegistry` (stub) |
|--------|-------------------------------------|-------------------------|
| **Purpose** | Live casting generation; records decisions | Filesystem directory wrapper (legacy) |
| **Ownership** | SDK runtime (in-memory) | File system (`.squad/casting/`) |
| **Data Held** | Generated `CastMember[]` + history log | Directory path config only |
| **Sealing Status** | Full typed APIs | Stub class (partial/incomplete) |
| **Best For** | Runtime universe generation | Fallback file lookup |

### 3. Does the SDK Provide the Cast-Name/Role Mapping?

**No, not in the way the extension currently needs.**

The SDK's `CastingEngine` **generates** cast assignments on-demand from universe templates, but it doesn't **retrieve persisted assignments** made in prior Squad sessions. The `CastingHistory` class tracks decisions but must be hydrated by the caller from an external source (e.g., `.squad/casting/history.json`).

The extension's use case is **different**: it needs to look up **which agent is currently cast to which role** (e.g., `lead` → `Tony Stark`, `tester` → `Howard the Duck`). This mapping lives in **`.squad/casting/history.json`'s `assignment_cast_snapshots`**, not in the live SDK.

### 4. Current Extension Architecture

The extension (`lib/squad-context.mjs`) currently:

1. **Loads `.squad/casting/registry.json`** (static metadata about agents)
2. **Loads `.squad/casting/history.json`** (persistent assignment snapshots)
3. **Calls `getLatestCastingSnapshot()`** to extract the most recent `agents` mapping (`lead` → `Tony Stark`, etc.)
4. **Enriches the roster lookup** (`agentsByKey` Map) with these slot-alias mappings
5. **Uses `resolveSquadAgentMetadata()`** to find display names and roles at runtime

This design works because:
- The assignment snapshot is already persisted as JSON
- The extension reads it at startup (once)
- Runtime agent events can look up their names from the enriched map

### 5. Why Reading `registry.json` Is Justified Today

**It is not a workaround—it is the correct source of truth.**

- **`registry.json`** stores the authoritative agent-to-name registry (created/updated by Squad coordinator)
- **`history.json`** stores assignment snapshots keyed by assignment ID with the slot mappings
- **The SDK has no API** to retrieve "which agent is cast to which role right now" at runtime

The SDK's `CastingRegistry` stub class is designed to **read from this same directory structure**, not replace it. It would read the same files the extension currently reads, offering no reliability improvement.

### 6. SDK Reliability Concerns

The Squad SDK's casting module is **not in the extension's dependency chain** for cast resolution. Even if it were:

- **Stability:** The SDK version is pinned (`0.9.4`), but casting APIs are still marked as "PRD 11 + M3-2" (active development)
- **Availability:** The CastingRegistry stub is incomplete; it would require SDK development to become a reliable runtime lookup API
- **Contract:** There is no documented SDK API to retrieve "the current assignment snapshot" or "which role is currently assigned to which agent"

Adding an SDK dependency for a function the SDK doesn't provide creates an implicit coupling to future SDK work that may never happen.

### 7. Long-Term Reliability

**Best approach: Keep the current file-based design.**

Reasons:

1. **Explicit source of truth:** `.squad/casting/history.json` is the authoritative assignment snapshot; reading it directly is clear and testable
2. **Decoupled from SDK churn:** The assignment snapshots are managed by Squad orchestration, not by SDK APIs that may change
3. **Fault-isolated:** If the SDK has an issue, the extension's casting lookup stays working
4. **Minimal overhead:** The file read happens once at startup; no performance cost
5. **Transparent to SDK evolution:** When/if the SDK stabilizes a casting retrieval API, it can be adopted optionally as a performance or reliability improvement, not a necessity

## Recommendation

**No, the extension should NOT switch to SDK-based cast identity sourcing.**

**Why:**
- The Squad SDK does not currently expose a stable API to retrieve "which agent is cast to which role"
- The `CastingRegistry` stub class is incomplete and would read the same files anyway
- The current file-based design is explicit, testable, and decoupled from SDK volatility
- The assignment snapshots in `.squad/casting/history.json` are the true source of truth, and reading them directly is the most reliable approach

**If the SDK ever stabilizes a casting retrieval API**, the extension can adopt it as a refactor (no breaking changes needed), but there is no benefit to doing so today.

## Notes for the Team

- The current `loadCastingMetadata()` function is well-designed and should be kept as-is
- If future Squad orchestration changes how assignment snapshots are stored, the extension's file path can be updated independently
- No refactoring needed today; the seam between casting data and the extension is clear and working
