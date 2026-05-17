# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- 2026-05-16T23:33:39.835+02:00 — Scribe UI name-loss repro analysis: Read-only probe of main.mjs, content/main.js, and content/style.css identified metadata loss seam in `syncKnownSubagents()`. When the function refreshes known sub-agents during context change or window rehydration, it calls `upsertSubagentState(state.agentId)` with only the agentId and no cached metadata, forcing `resolveSubagentState()` to recompute from scratch. The fallback chain in `buildSubagentPayload()` then collapses to raw agentId when display names aren't recovered: `displayName: cleanText(overrides.displayName ?? state.displayName) || cleanText(state.agentId)`. Result: agent "Scribe" loses its name and renders as "agent-xyz" in the UI. The seam is at `.github/extensions/copilot-avatar/main.mjs` lines ~440-450, where `freshState = upsertSubagentState(state.agentId)` should preserve or pass the original agent metadata from the cached state.
- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.
- 2026-05-16T15:42:38.842+02:00 — Name-mapping review: `.github/extensions/copilot-avatar/lib/squad-context.mjs` builds Squad lookup keys from roster/charted agent slugs like `howard-the-duck`, while failing runtime IDs are opaque handles like `agent-call_H`; adding `agentId` to the lookup does not bridge that mismatch, so `.github/extensions/copilot-avatar/main.mjs` still falls back to internal IDs.
- 2026-05-16T16:02:40.457+02:00 — Squad metadata does not override SDK event fields; Squad enriches cards only where Copilot leaves them generic.
- 2026-05-16T21:04:02.794+02:00 — Visibility rules: hidden agents stay hidden until real tool work starts. Intent/reasoning alone are not enough.
- 2026-05-16T21:23:20.636+02:00 — Duplicate identity collapse is critical; sub-agents without terminal events still need retirement logic.
- 2026-05-16T21:39:14.337+02:00 — Static probes alone are not enough; live DOM snapshots are required for visibility sign-offs.
- 2026-05-16T22:42:24.111+02:00 — Live overlap probes require immediate DOM snapshots during active work windows, not late polls after agents retire.

## Current Focus

Mic boom visibility regression testing and validation protocol. Fix pending from Shuri (Frontend Dev).

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
