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

## Learnings

- 2026-05-16T21:04:02.794+02:00 — In `.github/extensions/copilot-avatar/main.mjs`, hidden sub-agents stay stable when `assistant.intent` only updates cached badge text and never flips visibility evidence; first visibility should come from stronger current-turn signals like tool execution, while reasoning and replay stay non-promoting.
- 2026-05-16T21:23:20.636+02:00 — Keep badge fallback on a dedicated task summary instead of roster/charter description, and retire visible sub-agents shortly after their last tool clears if no terminal event arrives; that stops same-turn ghost cards and prevents role text from leaking into the lower badge.
- 2026-05-16T21:40:19.370+02:00 — In `.github/extensions/copilot-avatar/main.mjs`, treat the parent `task` wrapper as spawn metadata for hidden agents, not first-visibility evidence. Let it keep names/briefs warm in state, but wait for a non-`task` tool before rendering the card so wake-up pings do not flash a wall of sub-agents.

## 2026-05-16T19:23:20Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

**Cycle Status:** Complete
**Contributors:** Tony Stark (lead), Howard the Duck (review), Peter Parker (implementation)

**Key Decisions:**
- Stale sub-agent cards retire on work completion (no terminal event required)
- Visible sub-agent identities collapse to single stable identity
- Badge metadata removed from role text, kept in task-summary/activity text

**Tests:** All smoke checks and regression assertions passed.
**Next:** Integration ready.

## 2026-05-16T19:55:02Z — Task Wrapper Visibility Gate Approved & Merged

**Status:** ✅ Approved by Howard the Duck

**Session Outcome:** Task wrapper visibility fix merged into team decisions. Hidden sub-agent cards now stay hidden during spawn/wake-up orchestration chatter, render only on actual non-task work.

**Cross-Agent:** Howard the Duck reviewed and approved the prompt-start flash-flood fix, confirming this work addresses the weak-signal promotion path.

**Implementation Seam Confirmed:**
- Keep `task` wrapper state in runtime maps (identity, model joins, spawn hints)
- Skip first-time visibility on hidden agents when tool is `task`
- Cards appear only after non-`task` tool proves actual work

**Effect:** No more card wall on new Squad prompts during handoff phase.
