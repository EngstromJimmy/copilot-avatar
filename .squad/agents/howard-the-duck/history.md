# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.
- 2026-05-16T15:42:38.842+02:00 — Name-mapping review: `.github/extensions/copilot-avatar/lib/squad-context.mjs` builds Squad lookup keys from roster/charted agent slugs like `howard-the-duck`, while failing runtime IDs are opaque handles like `agent-call_H`; adding `agentId` to the lookup does not bridge that mismatch, so `.github/extensions/copilot-avatar/main.mjs` still falls back to internal IDs. `.github/extensions/copilot-avatar/package.json` has no build/test scripts, so validation for this pass was limited to syntax smoke checks plus a targeted runtime lookup repro.
- 2026-05-16T16:02:40.457+02:00 — QA probe: `.github/extensions/copilot-avatar/lib/squad-context.mjs` currently resolves cast names like `Howard the Duck` but not slot aliases like `tester` or `backend-dev`, and this repo has no `squad.config.*` to add those aliases. In `.github/extensions/copilot-avatar/main.mjs`, a placeholder `agentDisplayName` such as `General Purpose Agent` still outranks Squad metadata, so cast-name badges can stay generic. In `.github/extensions/copilot-avatar/content/main.js`, sub-agent model badges are fed by `assistant.usage` / `session.model_change` → `setAgentModel`, while badge text prefers recent intent over generic activity text.
- 2026-05-16T16:02:40.457+02:00 — Review gate: the new alias/model/activity work is mostly wired, but `.github/extensions/copilot-avatar/main.mjs` still never clears `subagentStateById`. Because `refreshSessionContext()` and the avatar open handlers always call `syncKnownSubagents()`, stale Squad identities like `Howard the Duck` can be replayed into later non-Squad or post-context-change views.
- 2026-05-16T16:02:40.457+02:00 — Approval rerun: `loadSquadContext()` now resolves casting aliases like `lead`, `backend-dev`, and `tester` to `Tony Stark`, `Peter Parker`, and `Howard the Duck`, while `main.mjs` resets all sub-agent runtime maps on session/context boundaries and `content/main.js` clears non-root avatars plus pending model badges. Validation for this pass used `node --check` on the three touched extension files and a targeted Node regression probe covering stale-state reset, non-Squad inactivity, Squad alias resolution, model sync hooks, and live badge activity preference.

## 2026-05-16T14:02:40.457Z — Session Complete: Approved Sub-Agent Identity & Badge Fix

**Status:** ✅ Approved and merged

**Team:** Tony Stark (Lead), Vision, Peter Parker, Shuri, Howard the Duck (QA)

**Role:** Quality gate review, approval, and validation.

**Summary:** Led QA gate for multi-agent identity & badge system fix. Rejected initial batch due to stale sub-agent state replay risk. Validated Peter Parker's revision addressing session/context reset boundaries. Approved final implementation after comprehensive regression probes.

**Key Contributions:**
- Defined QA gate requiring cast names in Squad, generic fallback in non-Squad, model badge sync, badge activity tracking
- Identified stale-state replay regression before merge
- Ran syntax smoke tests and targeted regression probes post-revision
- Verified no Squad label leakage after context changes
- Approved final merged state for production

**QA Gates (All Passed):**
✓ Squad aliases resolve to cast names (Tony Stark, Peter Parker, Howard the Duck)
✓ Per-subagent model updates fire correctly
✓ Badge text tracks live activity (intent → tool → role → activity)
✓ Non-Squad sessions stay generic without label leakage
✓ Old Squad cards don't replay into non-Squad views
✓ No syntax errors across all modified files
✓ Targeted regression probes covered stale-state boundaries, model sync, badge activity

## 2026-05-16T13:42:38.842Z — Approved Shuri's Sub-Agent Name-Mapping Fix

**Status:** ✅ Approved

**What:** Shuri's revision centralizes sub-agent display metadata resolution in `main.mjs` using trim-aware fallback:
1. `agentDisplayName` from event (trimmed, blanks treated missing)
2. `displayName` from Squad roster (via stable `agentName` / `agentDisplayName` fields)
3. `agentName` from event (trimmed)
4. Raw `agentId` (emergency fallback only)

**Validation:**
- Ran `node --check` on `main.mjs` and `lib/squad-context.mjs`
- Targeted smoke tests verified fallback order, shared resolver usage, no agentId roster joins
- Confirmed casting alias wiring: `tester` slot resolves to `howard-the-duck` in roster

**Key insight:** Squad roster joins must stay on stable identity fields, not runtime instance IDs. This fix ensures that even with malformed or non-Squad events, the display name resolves safely.
