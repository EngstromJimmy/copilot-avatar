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
- 2026-05-16T21:04:02.794+02:00 — QA verdict on Tony's visibility revision: blocking bare `assistant.reasoning` and replay-only rehydration is the right direction, but hidden agents still promote from intent-only traffic. In `.github/extensions/copilot-avatar/main.mjs`, `assistant.intent` marks `hasCurrentTurnWork` for any non-generic intent, so common launch-time summaries like `Exploring codebase` or `Creating parser tests` can still make freshly spawned or reactivated stale agents flood the list before any tool activity lands.
- 2026-05-16T21:23:20.636+02:00 — Duplicate-identity review: the cross-directive reset path is no longer the main leak. The remaining flood comes from sub-agents that never emit `subagent.completed` / `subagent.failed`; `.github/extensions/copilot-avatar/main.mjs` handles `tool.execution_complete` by clearing activity only, while `.github/extensions/copilot-avatar/content/main.js` keeps avatars keyed by runtime `agentId` with no cast-identity dedupe, so later runtime instances can leave dual `Tony Stark` cards visible in the same directive. Validation used `node --check` on `main.mjs` and `content/main.js` plus a targeted static probe for terminal transitions, runtime-id keying, and missing identity collapse.
- 2026-05-16T21:23:20.636+02:00 — Follow-up reviewer read on role text relapse: duplicate `Tony Stark` cards and role-ish badge text are cousins, not twins. The shared enabler is the same stale visible card surviving after `tool.execution_complete` clears activity without retiring the agent, but the lower badge line specifically falls back through `getAvatarBadgeText()` to `avatar.description`, and `.github/extensions/copilot-avatar/lib/squad-context.mjs` builds that description role-first from charter metadata. So fixing stale-card survival should cut the symptom rate, but a complete polish pass also needs badge fallback/preference cleanup.
- 2026-05-16T21:40:19.370+02:00 — Prompt-start flash review: the old flood path was weak-signal promotion, not CSS voodoo. In `.github/extensions/copilot-avatar/main.mjs`, hidden cards now stay gated because only tool start/progress set `hasCurrentTurnWork`; `assistant.intent` and `assistant.reasoning` only update cards that are already visible, `assistant.turn_start` clears runtime state before `refreshVisibleSquadContext()` can replay anything, and `tool.execution_complete` schedules stale-card retirement for agents that never send terminal events. Syntax smoke checks plus static source probes passed, so Peter's current fix set looks sufficient for the start-of-prompt flicker described here.
- 2026-05-16T21:39:14.337+02:00 — Live read-only avatar probe across `.github/extensions/copilot-avatar/main.mjs`, `content/main.js`, and `content/style.css` passed `node --check` plus targeted source assertions for reset, stale-retire, badge fallback, pending-model, and two-line badge layout. The real avatar window still settled with duplicate `Howard the Duck` cards and one blank idle card visible, so static/source probes are not enough to clear ghost-card regressions without a live DOM poll.

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

## 2026-05-16T17:28:38.428+02:00 — Orchestration Log: Runtime Naming Bug Revision & Final Approval

**Status:** ✅ Completed and Approved

**Role:** QA Lead and Technical Review

**What:** Rejected initial sub-agent identity design, identified root cause as runtime event-bridge naming gap (not a reload issue), assigned Tony Stark for revision, then re-validated and approved final implementation.

**Critique of Initial Design:**
- Initial batch achieved Squad name resolution at the design level but missed a critical runtime seam
- The `agentId` lookup was too broad and risked accepting opaque handles like `agent-call_H` as valid Squad roster keys
- This could cause placeholder SDK labels to outrank actual cast names in scenarios with multiple events or late-opening avatar windows

**Revision Direction & Validation:**
- Assigned Tony Stark to implement guarded agentId fallback: accept only stable-looking aliases (e.g., `tony-stark`, `tester`, `lead`) and reject opaque identifiers
- Extended `squad-context.mjs` to perform roster lookups through both explicit `agentName` / `agentDisplayName` fields AND stable casting-slot aliases
- Validated Peter Parker's prior stale-state reset work (session/context boundaries, non-root avatar clearing) now works seamlessly with Tony's runtime name resolution
- Re-ran full QA gate: Squad aliases resolve correctly, non-Squad sessions stay generic, badge activity tracked live, no label leakage after context changes

**Final Validation (All Passed):**
✓ Runtime agentId lookup uses guarded pattern (stable aliases only, no opaque IDs)
✓ Squad casting-slot aliases resolve to correct human names
✓ Non-Squad sessions show generic labels without Squad metadata pollution
✓ Stale Squad cards do not replay into later contexts
✓ Badge text prioritizes live activity + resolved Squad names
✓ Model updates sync correctly even with event-order races
✓ Syntax clean; targeted regression probes cover all seams

**Integration Notes:**
- This revision depended critically on Peter Parker's stale-state reset work
- The guarded alias lookup design prevents future regressions if more opaque runtime IDs appear in SDK events
- Shuri's badge-activity system is fully compatible with this naming scheme

## 2026-05-16T19:23:20Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

**Cycle Status:** Complete
**Contributors:** Tony Stark (lead), Howard the Duck (review), Peter Parker (implementation)

**Key Decisions:**
- Stale sub-agent cards retire on work completion (no terminal event required)
- Visible sub-agent identities collapse to single stable identity
- Badge metadata removed from role text, kept in task-summary/activity text

**Tests:** All smoke checks and regression assertions passed.
**Next:** Integration ready.

## 2026-05-16T19:55:02Z — Flash-Flood Fix Approval & Cross-Agent Decisions Merged

**Status:** ✅ Approved — no further action on weak-signal path

**Session Work:** Reviewed Peter Parker's visibility gate fix and confirmed it addresses the prompt-start sub-agent flood.

**Finding:** The previous weak-signal promotion path (via `assistant.intent` / `assistant.reasoning` on stale agents) is now properly gated. Hidden cards stay hidden until tool execution proves real work.

**Verdict:** If UI still flickers post-merge, next investigation should target real tool-start bursts or animation/layout polish, not visibility logic.

**Note:** Future sub-agent visibility sign-offs require live avatar-window poll in addition to static source checks; regression probes alone are not sufficient.
