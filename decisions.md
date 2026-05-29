# Squad Decisions Log

## 2026-05-16 — Sub-agent name mapping for avatar display

### Context
Sub-agent display names in the copilot-avatar extension were using opaque runtime `agentId` values like `agent-call_H` instead of human-readable Squad cast names. This broke the visual avatar roster because:
- Squad roster files are keyed by stable cast names like `howard-the-duck`
- Runtime lifecycle events arrive with instance-specific handles like `agent-call_H` and `agent-call_D`
- The existing lookup path had no bridge from transient IDs to stable roster identities

### Vision's Initial Approach (REJECTED)
Proposed adding `agentId` to the Squadron metadata lookup directly. Analysis showed this insufficient:
- `agentId` is a per-instance handle, not a stable roster key
- Direct `agentId` lookups still failed for opaque internal IDs (e.g., `agent-call_H` → `howard-the-duck` mapping missing)
- Worst-case fallback still resolved to the same opaque ID users were complaining about

**Rejected by:** Howard the Duck, Tony Stark  
**Why:** Does not solve the root issue; relies on unstable instance identifiers for roster joins.

### Approved Solution (Shuri, confirmed by Howard the Duck + Tony Stark)

**Core insight:** Use stable `agentName` / `agentDisplayName` fields for Squad metadata lookups, with `agentId` only as final UI fallback.

**Implementation details:**
1. **Centralized resolver in `main.mjs`:** `resolveSubagentDisplayData(event)` handles `subagent.started`, `subagent.completed`, and `subagent.failed` with a single trim-aware fallback chain
2. **Fallback order (enforced):**
   - `agentDisplayName` from event (trimmed, blanks treated as missing)
   - `displayName` from Squad roster (via `agentName` / `agentDisplayName` → `resolveSquadAgentMetadata()`)
   - `agentName` from event (trimmed)
   - Raw `agentId` (final emergency label only)
3. **Squad casting bridge:** `.squad/casting/history.json` slot aliases (e.g., `tester` → `Howard the Duck`) wired into roster lookup to connect runtime names to cast identities
4. **Validation run:** `node --check` on `main.mjs` and `lib/squad-context.mjs`; targeted smoke tests verified fallback order, shared resolver usage, no agentId roster joins, and actual slot alias wiring

**Approved by:**
- Howard the Duck (2026-05-16T15:42:38.842+02:00)
- Tony Stark (2026-05-16T15:42:38.842+02:00)

**Affected artifacts:**
- `.github/extensions/copilot-avatar/main.mjs` — `resolveSubagentDisplayData()`, lifecycle event handlers
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` — casting alias loading, roster join logic

## 2026-05-29 — Vision: Repository Sync from origin/main

**Status:** ✅ COMPLETED

**Task:** Pull latest changes from origin/main into C:\Code\CopilotAvatar

**Sync Actions:**
1. Stashed working directory changes (modified .squad/agents/scribe/history.md, untracked health reports)
2. Executed `git pull origin main` → Already up to date
3. Restored working directory state successfully

**Final State:** Repository synced; local main is 1 commit ahead of origin/main (Scribe merge decisions inbox and session logging).

## 2026-05-29 — Deepgram TTS Supplier Contract

**Status:** Proposed  
**Date:** 2026-05-29T17:44:38.614+02:00

**Decision:** Keep each avatar TTS supplier explicit at every seam instead of introducing a generic provider abstraction. Reuse shared UI only for common controls, but require a distinct engine id, persisted settings keys, preview branch, speech request function, and probe assertions for each supplier.

**Rationale:** Keeps failures pointed at the right boundary (settings, UI, persistence, network request). Prevents hidden fallthrough to Web Speech when a supplier-specific branch is missed during future additions.

**Affected Files:**
- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/index.html`
- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/probe-regression.mjs`
