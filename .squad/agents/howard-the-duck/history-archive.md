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


---

## Archived on 2026-05-18T00:00:32.297Z

# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- 2026-05-17T22:55:21.159+02:00 — Stale-idle subagent review: sign-off needs both source and live proof. In `.github/extensions/copilot-avatar/main.mjs`, late-open replay is only safe if it clears non-root UI plus backend subagent caches before `session.getMessages()` hydration and prunes agents whose last real tool already finished. In `.github/extensions/copilot-avatar/content/main.js`, `clearSubagents({ preserveRoot: true })` must remove visible generic cards and wipe queued intent/activity/thinking so re-adding the same `agentId` comes back idle with blank detail instead of reviving stale state.
- 2026-05-17T22:31:24.735+02:00 — Late-open avatar review: the reliable regression proof is a two-part check. First source-probe `.github/extensions/copilot-avatar/main.mjs` for `session.getMessages()` hydration plus restored `toolCallId`/spawn-metadata maps; then live-probe `.github/extensions/copilot-avatar/content/main.js` by queueing `setAgentThinking` / `setAgentIntent` / `setAgentActivity` before `addSubagent` and confirming no placeholder card appears until a strong identity payload lands, at which point the card upgrades to the Squad name and keeps `workDescription` in the lower detail line while Copilot root-summary chatter stays suppressed.
- 2026-05-16T23:33:39.835+02:00 — Scribe UI name-loss repro analysis: Read-only probe of main.mjs, content/main.js, and content/style.css identified metadata loss seam in `syncKnownSubagents()`. When the function refreshes known sub-agents during context change or window rehydration, it calls `upsertSubagentState(state.agentId)` with only the agentId and no cached metadata, forcing `resolveSubagentState()` to recompute from scratch. The fallback chain in `buildSubagentPayload()` then collapses to raw agentId when display names aren't recovered: `displayName: cleanText(overrides.displayName ?? state.displayName) || cleanText(state.agentId)`. Result: agent "Scribe" loses its name and renders as "agent-xyz" in the UI. The seam is at `.github/extensions/copilot-avatar/main.mjs` lines ~440-450, where `freshState = upsertSubagentState(state.agentId)` should preserve or pass the original agent metadata from the cached state.
- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.
- 2026-05-16T15:42:38.842+02:00 — Name-mapping review: `.github/extensions/copilot-avatar/lib/squad-context.mjs` builds Squad lookup keys from roster/charted agent slugs like `howard-the-duck`, while failing runtime IDs are opaque handles like `agent-call_H`; adding `agentId` to the lookup does not bridge that mismatch, so `.github/extensions/copilot-avatar/main.mjs` still falls back to internal IDs.
- 2026-05-16T16:02:40.457+02:00 — Squad metadata does not override SDK event fields; Squad enriches cards only where Copilot leaves them generic.
- 2026-05-16T21:04:02.794+02:00 — Visibility rules: hidden agents stay hidden until real tool work starts. Intent/reasoning alone are not enough.
- 2026-05-16T21:23:20.636+02:00 — Duplicate identity collapse is critical; sub-agents without terminal events still need retirement logic.
- 2026-05-16T21:39:14.337+02:00 — Static probes alone are not enough; live DOM snapshots are required for visibility sign-offs.
- 2026-05-16T22:42:24.111+02:00 — Live overlap probes require immediate DOM snapshots during active work windows, not late polls after agents retire.
- 2026-05-17T22:14:30.766+02:00 — Voice persistence review: `.github/extensions/copilot-avatar/main.mjs` persists TTS state in `.github/extensions/copilot-avatar/.tts-settings.json` by merging incoming settings over the current file, but `.github/extensions/copilot-avatar/content/main.js` clears `elevenlabsVoice` during the loading placeholder path in `populateElevenLabsVoices()`. That means opening or switching to the ElevenLabs engine can save a blank voice before the async list returns, so future reviews need to probe async option-refresh paths, not just the final save call.
- 2026-05-17T22:14:30.766+02:00 — Voice persistence re-review: the fixed `populateElevenLabsVoices()` now snapshots `previousVoice`, preserves it through loading/error placeholders, and only falls back after the fetched voice list proves the saved voice is absent. Combined with `saveTtsSettings()` writing `voice`, `voxtralVoice`, and `elevenlabsVoice` together and `main.mjs` merge-saving over `.tts-settings.json`, reload/reopen and engine-switch reviews can be accepted from this seam.

## Current Focus

UI label regression analysis and branch merge verification.

## 2026-05-17T20:43:07.849+02:00 — UI Label Regression Hunting: "General Purpose Agent" showing instead of Squad cast names

**Context:** Jimmy flagged "The names in the UI still say General Purpose Agent. This worked earlier today."

**Investigation Method:**
- Traced git history for code changes since last known working state
- Identified divergent branches: feat/microsoft-sam-tts (commit 877d269) vs. main (HEAD 834a2ba)
- Examined working directory uncommitted changes

**Root Cause Found:**
The proper implementation exists on feat/microsoft-sam-tts branch (commit 877d269) but was NEVER MERGED to main. Main branch has the broken version. Additionally, WIP uncommitted changes in the working directory appear to be an attempt to fix main by cherry-picking the fix, but the work is incomplete.

**Broken Code Path (main HEAD 834a2ba):**
- File: `.github/extensions/copilot-avatar/main.mjs` lines ~655-670
- `subagent.started` handler calls `resolveSquadAgentMetadata` WITHOUT passing `agentId`, `spawnName`, or `spawnDisplayName`
- Missing helper functions: `GENERIC_AGENT_LABELS`, `isLowConfidenceAgentLabel()`, `pickPreferredAgentLabel()`, spawn metadata extraction
- Result: No Squad lookup succeeds; falls back to raw runtime name which is "general purpose agent"

**Correct Implementation (feat/microsoft-sam-tts 877d269):**
- Full `resolveSubagentDisplayData(event)` function with 3-tier lookup:
  1. Squad casting registry lookup (uses agentId, spawnName, spawnDisplayName)
  2. Tool spawn metadata enrichment (extracts cast name from task/agent arguments)
  3. Runtime fallback (cleans generic labels, humanizes agent names)
- Generic label detection prevents "general purpose" from winning
- Spawn metadata caching by toolCallId and agentId

**Key Evidence:**
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` line 599: `resolveSquadAgentMetadata()` CAN accept spawnName/spawnDisplayName but main code doesn't pass them
- Working directory diff shows 210+ new lines of proper helper functions not in committed HEAD
- Commits on feat branch are after v0.2.0 tag; never merged back to main

**Regression Window:** Tight — fix was written but never integrated. User experienced it after code merge/reset to main from feat branch.

**Outstanding Questions:**
1. Is feat/microsoft-sam-tts intended for merge or permanent isolation?
2. Who started the WIP changes in the working directory? Are they intentional?
3. Which branch state was "working earlier today"?

**Recommendation for Coordinator:** Clarify branch merge intent before I can validate a fix. Either merge feat/microsoft-sam-tts clean, or commit+test the WIP working directory changes.

## 2026-05-17T19:54:11.015+02:00 — Mic Boom Visibility Repro & Validation Probes

**Context:** Jimmy flagged "The mic is still not shown" — Squad root mic boom not rendering despite geometry existing.

**Investigation:** Traced root cause to the data-flow timing gap documented in decisions.md (2026-05-17T19:45:16.556+02:00):
- `initializeRootAvatar()` runs on page load and creates root avatar with `squadRootMicActive = false`
- `window.setSquadContext()` called from main.mjs only after webview is open
- If avatar is created before Squad context syncs, mic boom stays invisible

**Deliverables:**
1. Manual repro checklist (`.squad/tests/mic-boom-visibility-manual-repro.md`) — tight steps to reproduce the missing mic bug
2. Post-fix validation probes (`.squad/tests/mic-boom-validation-probes.md`) — minimal static + live checks to verify fix without regressing Squad identity
3. Two failure modes documented:
   - **Mode 1:** Mic boom stays invisible after Squad context sync (visibility gate not working)
   - **Mode 2:** Mic boom appears then disappears on window reopen (state not preserved across reopen)

**Key Assertions:**
- Mic boom created only for root avatar in `createAvatarInstance()` (line 2333)
- Visibility gate: `squadMicBoom.visible = squadRootMicActive` (line 2310 in `updateRootSquadMicBoom()`)
- TubeGeometry + CapsuleGeometry with dark graphite material (`0x1c1c1c`)
- Render order: 3 (boom), 4 (capsule)

**Regression Risk:** Fix timing interaction with Squad metadata lookup — must verify sub-agent names stay stable after mic boom visibility fix.

## Recent Work

### 2026-05-16T21:51:24Z — Team Update: Subagent Duplicate Card Seam

**From:** Scribe (Session Logger)

**Context:** Decision merged and orchestration logged following spawn manifest completion.

**Decision:** Subagent Duplicate Card Seam — Fixed (2026-05-16T23:51:24.513+02:00)
- Invoked dedup on card creation and identity update
- Added displayName fallback to guarantee identity keys
- Result: Exactly 2 visible cards maintained

**Team impact:** Vision's fallback-collapse work now has complement fix; full seam sealed.

## 2026-05-16T22:03:54Z — Cross-Agent Update: Avatar Visibility Model Documentation

**From:** Vision (Platform Dev)

**What:** README updated to document the sub-agent visibility model:
- Copilot SDK owns all visibility and lifecycle events
- Squad metadata enriches visible cards only (no creation/suppression)
- Ghost/fallback duplicates eliminated; rendered agents match active Copilot set

**Why:** Clarify contract with users and maintainers about ownership model.

**Team Impact:** All agents now have clear reference for how Copilot and Squad interact in sub-agent visibility.

## 2026-05-17T17:40:04.980Z — Cast Name Verification Session

**From:** Scribe (Session Logger)

**Context:** Squad spawn manifest recorded Howard the Duck (Tester) background agent for cast-name verification.

**Outcome:** Agent delivered exact cast name in tester check-in and highlighted current name-loss failure mode. Visibility system stable.

**Orchestration:** Full logs recorded in `.squad/orchestration-log/`

## Cross-Agent Update: Shuri (Frontend Dev)

**Date:** 2026-05-17T19:54:11.015+02:00  
**From:** Scribe  
**Context:** Shuri's implementation details for your validation protocol

**What Shuri Implemented:**
- Replay latched Squad mic state during root avatar initialization
- Refresh Squad context on root ssistant.turn_start
- Scope: content/main.js, main.mjs
- Approach keeps Squad mic boom driven by window.setSquadContext(payload.active)

**For You:** Your validation probes should confirm:
1. Mic visible immediately after root avatar init (not waiting for turn_start)
2. Mic state persists correctly on webview reopen
3. Squad identity lookup stays stable during sync calls
---

## 2026-05-17T18:39:13.982Z — Scribe Orchestration Session

**Type:** Agent spawn verification and memory consolidation

**Context:** Both Tony Stark and Howard the Duck spawned for live cast-name verification.

**Scribe Actions:**
- Pre-check: decisions.md 75.69 KB, inbox 0 files
- Archive check: No entries older than 7 days
- Decision inbox: Merged 0 files
- Orchestration logs: Created per-agent logs
- Session log: Created session summary
- Cross-agent history: Updated this entry

**Outcome:** Spawn manifest verified; both agents checked in with correct cast names and roles. All shared memory consolidated.


## Team Update: Label Regression Investigation (2026-05-17)

**From Scribe:** Regression window pinned. Broken version on main HEAD (834a2ba); proper fix on eat/microsoft-sam-tts branch (commit 877d269) and WIP working tree. Three sign-off blockers identified: (1) Branch merge strategy undecided; (2) WIP state unresolved; (3) End-to-end validation with live Copilot sub-agents needed.

**Coordination:** Awaiting merge strategy decision and WIP resolution before fix validation.

---


## 2026-05-17T22:31:24.735+02:00 — Late-open naming session complete

The avatar late-open naming session concluded with full Squadron integration restored:

- **Shuri:** Fixed sub-agent card detail precedence; queued updates until strong identity; resolved names replace placeholders
- **Vision:** Restored thinking/detail wiring; rebuilt identity/history replay for mid-run opens
- **Howard the Duck:** Validated bundle with source and live testing; approved late-open naming implementation

### Decisions merged

16 inbox entries consolidated into .squad/decisions.md:
- Sub-agent badge and detail line contracts
- Voice persistence seams across TTS engines
- Squad idle overlay cleanup
- Late-open card update sequencing
- Window behavior directives (framed vs transparent)

### Registry updates

All three agents' names resolve through casting aliases and Squad context:
- shuri → Shuri
- ision → Vision
- 	ester → Howard the Duck
## 2026-05-17T21:49:01.4252943Z - Branch Switch Session (Cross-Team Update)

Tony Stark attempted to switch to SAM implementation branch (eat/microsoft-sam-tts). Local modifications in your tracked files prevented the switch. No action required - Tony handled the analysis.

