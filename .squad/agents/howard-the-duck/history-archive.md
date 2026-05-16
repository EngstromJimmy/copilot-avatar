# Howard the Duck — History Archive

Older session work documented here. See `history.md` for current focus and recent activity.

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

## 2026-05-16T20:58:38Z — Live Avatar Visibility Pass + Orchestration Completion

**Status:** ✅ Completed
**Session Type:** Background badge/card rendering verification

**Work Completed:**
- Conducted live read-only avatar badge and card rendering verification
- Verified UI elements render correctly with proper identity dedupe
- Confirmed role labels and agent names display correctly during concurrent work
- Validated card retirement logic on background task completion

**Outcome:** Avatar badge and card styling stable for Squad integration.

**Key Validations:**
- Badge rendering with live activity text (`Reading main.mjs + main.js`)
- Card deduplication prevents duplicate same-identity cards
- Role labels display correctly alongside model metadata
- Live badge content updates properly during active work

**Decision Records Approved:**
- Live overlap visibility check required for future sign-offs
- No active-gap retire for sub-agent cards
- Visibility bias reset to show agents immediately on `subagent.started`
- Delay stale retirement until turn end (not post-tool)

**Next:** Sub-agent visibility gates ready for production deployment.

## 2026-05-16T20:58:38Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

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
