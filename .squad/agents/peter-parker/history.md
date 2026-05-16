# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## 2026-05-16T14:02:40.457Z — Session Complete: Approved Sub-Agent Identity & Badge Fix

**Status:** ✅ Approved by Howard the Duck

**Team:** Tony Stark (Lead), Vision, Peter Parker, Shuri, Howard the Duck (QA)

**Role:** Implemented runtime state reset mechanism to clear cached sub-agent state on session/context boundaries.

**Summary:** Part of multi-agent identity & badge system fix. Designed and implemented `resetSubagentRuntimeState()` to clear extension's cached maps on session starts and context changes, paired with webview `clearSubagents({ preserveRoot: true })` to dispose non-root avatars and prevent stale Squad cards from replaying into non-Squad views.

**Key Contribution:**
- Created reset mechanism that fires before any backfill/sync calls
- Verified model sync, cast names, and badge activity still work after reset
- Confirmed no Squad label leakage into non-Squad contexts

**Files Modified:**
- `.github/extensions/copilot-avatar/main.mjs` — resetSubagentRuntimeState() implementation
- `.github/extensions/copilot-avatar/content/main.js` — clearSubagents() webview handler

**Validation:** Targeted regression probes passed; syntax smoke tests passed; all QA gates approved by Howard the Duck.

## 2026-05-16T13:42:38.842Z — Proposed Casting Slots for Squad Avatar Names

**Status:** ✅ Incorporated into approved solution

**What:** Proposed using `.squad/casting/history.json` slot aliases to bridge runtime agent names to Squad roster cast identities.

**Insight:** Squad roster files are keyed by cast names like `Peter Parker`, while runtime lifecycle events identify agents by:
- Durable slot names like `backend-dev` (in `agentName` / `agentDisplayName`)
- Opaque per-run handles like `agent-call_H` (in `agentId`)

Solution: Load the latest casting snapshot into the roster lookup to keep avatar labels human-readable without leaking transient IDs.

**Outcome:** Shuri's approved implementation incorporates this design; casting alias loading now wired into `resolveSquadAgentMetadata()` in `squad-context.mjs`.
