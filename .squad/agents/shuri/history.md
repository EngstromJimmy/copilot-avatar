# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Current Focus

Avatar 3D rendering and Squad-specific visual flair.

## 2026-05-16T19:23:20Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

**Cycle Status:** Complete
**Contributors:** Tony Stark (lead), Howard the Duck (review), Peter Parker (implementation)

**Key Decisions:**
- Stale sub-agent cards retire on work completion (no terminal event required)
- Visible sub-agent identities collapse to single stable identity
- Badge metadata removed from role text, kept in task-summary/activity text

**Tests:** All smoke checks and regression assertions passed.
**Next:** Integration ready.

## 2026-05-16T22:03:54Z — Cross-Agent Update: Avatar Visibility Model Documentation

**From:** Vision (Platform Dev)

**What:** README updated to document the sub-agent visibility model:
- Copilot SDK owns all visibility and lifecycle events
- Squad metadata enriches visible cards only (no creation/suppression)
- Ghost/fallback duplicates eliminated; rendered agents match active Copilot set

**Why:** Clarify contract with users and maintainers about ownership model.

**Team Impact:** All agents now have clear reference for how Copilot and Squad interact in sub-agent visibility.

## Learnings

- 2026-05-17T19:45:16.556+02:00 — Mic boom regression: visibility controlled by `squadRootMicActive` flag, set only via `window.setSquadContext()` from extension. Root avatar created at webview init (line 5334) before Squad context sync arrives, leaving boom hidden. Extension calls `syncSquadContext()` during session startup but webview not yet open (checked at evalWebview line 161), so call returns early. Fix: ensure `syncSquadContext()` runs after webview is ready and avatar initialized, or add sync to `assistant.turn_start` handler to refresh context each turn.
- Mic boom 3D geometry and lifecycle pattern: created in `createSquadMicBoom()` (lines 731-778), added to root avatar only (line 2381), visibility set by `squadRootMicActive` boolean via `updateRootSquadMicBoom()` (line 2310). Squad-gating means boom is hidden until `window.setSquadContext({active: true})` is called from extension.
- 2026-05-17T19:54:11.015+02:00 — Root-only webview chrome needs a latched-state replay path. For the mic fix, `.github/extensions/copilot-avatar/content/main.js` now reapplies `updateRootSquadMicBoom()` inside `initializeRootAvatar()`, and `.github/extensions/copilot-avatar/main.mjs` refreshes `syncSquadContext()` on root `assistant.turn_start` so a pre-open or pre-avatar Squad signal still lands once the webview is live.
- 2026-05-17T20:00:51.651+02:00 — Final mic failure path: `.github/extensions/copilot-avatar/main.mjs` was already polling `window.__copilotAvatarReady`, but `.github/extensions/copilot-avatar/content/main.js` never set that flag, so `syncSquadContext()` skipped the first show/reopen replay and the root mic stayed hidden despite an active Squad context. Safe fix: set the ready flag after page boot, keep mic visibility on the existing `setSquadContext()` → `updateRootSquadMicBoom()` seam, and expose `window.__copilotAvatarState.rootMicVisible` for live regression probes.
- 2026-05-17T20:10:26.460+02:00 — Generic Copilot labels like `General Purpose Agent` must be filtered in `.github/extensions/copilot-avatar/main.mjs` before payloads hit the webview. `content/main.js` already treats those labels as low-confidence, but it still needs richer upstream data, so `.github/extensions/copilot-avatar/lib/squad-context.mjs` now loads `.squad/casting/history.json` slot aliases (`lead`, `tester`, etc.) and the extension prefers cast metadata/roles over generic runtime labels.
- 2026-05-17T20:43:07.849+02:00 — Renderer-side label fallback is still healthy in `.github/extensions/copilot-avatar/content/main.js`: `resolveAvatarDisplayName()` rejects placeholder labels like `General Purpose Agent`, agent-id echoes, and default `agent-xxxxxx` fallbacks when a stronger name exists. The live regression seam is upstream payload construction in the committed `.github/extensions/copilot-avatar/main.mjs`, where `subagent.started` / `.completed` / `.failed` still let SDK `agentDisplayName` outrank Squad/cast names before the webview sees the payload.
- 2026-05-17T20:58:16.671+02:00 — Sub-agent card clarity depends on splitting identity from activity. `.github/extensions/copilot-avatar/content/main.js` now renders an inline `.agent-role` pill beside `.agent-name`, keeps `.agent-badge` as the short state label, and uses `.agent-detail` for live work detail. The runtime seam to preserve is `.github/extensions/copilot-avatar/main.mjs` forwarding `detailText` / `taskSummary`; if future tool events can supply richer copy, the exact field to add is `activityLabel` on `setAgentActivity()`.
- 2026-05-17T21:17:25.313+02:00 — Root idle overlay copy is safest to suppress in the webview, not by deleting Squad context upstream. `.github/extensions/copilot-avatar/content/main.js` now keeps `window.setSquadContext({ active })` for root-only Squad chrome like the mic, but ignores idle `statusText` / `detailText` and filters generic root labels such as `task`, `agent`, and `runSubagent` in `setSubtask()`, `setAgentIntent()`, and `setAgentActivity()`. Live probe: injected `Squad ready` + `task` stayed hidden while a normal intent still rendered in `#root-model-badge-text`.
- 2026-05-17T22:14:30.766+02:00 — ElevenLabs voice persistence lives entirely in the webview-side async option loader. `.github/extensions/copilot-avatar/main.mjs` already persists `elevenlabsVoice` in `.tts-settings.json`; the actual regression was `.github/extensions/copilot-avatar/content/main.js` clearing the in-memory selection while rendering `Loading ElevenLabs voices...`, which forced reopen/engine-switch flows to fall back to the first returned voice unless the loader preserved the previous selection through the placeholder state.
- 2026-05-17T22:23:53.926+02:00 — Sub-agent detail cards should treat upstream `taskSummary` as a persistent `workDescription`, separate from Copilot intent chatter. `.github/extensions/copilot-avatar/main.mjs` now forwards `workDescription` explicitly, and `.github/extensions/copilot-avatar/content/main.js` keeps the lower detail line pinned to that work text for non-root avatars while filtering Clippy-style summary phrases like `It looks like you're all set`.
- 2026-05-17T22:23:53.926+02:00 — Late-open sub-agent cards should not materialize from update-only signals unless the payload already carries a strong identity. `.github/extensions/copilot-avatar/content/main.js` now queues non-root activity/intent/thinking updates until `addSubagent` or another identity-bearing payload arrives, then replays the queued state; it also tracks `displayNameSource` so a later resolved name can outrank an earlier fallback label.


## 2026-05-17 — Scribe Session Wrap-up

**Cross-Agent Note from Scribe:** Your mic regression analysis has been merged into .squad/decisions.md. Decision entry captures the full timing mechanism, risk/scope assessment, and implementation options. Vision's parallel identity regression investigation (extension-layer label precedence) is also documented in decisions for team alignment.

**Decision ID:** "Mic boom visibility blocked by timing gap in Squad context sync" — available for future reference and implementation.

**Session Artifact:** Session log written to .squad/log/2026-05-17T17-45-16Z-squad-investigation-wrap.md summarizing both investigations.

## Cross-Agent Update: Howard the Duck (Tester)

**Date:** 2026-05-17T19:54:11.015+02:00  
**From:** Scribe  
**Context:** Howard prepared validation protocol for your mic visibility fix

**What Howard Created:**
- Manual repro checklist: .squad/tests/mic-boom-visibility-manual-repro.md
- 4-probe validation suite: .squad/tests/mic-boom-validation-probes.md
- Documented 2 failure modes to watch:
  1. Mic stays invisible after Squad context sync
  2. Mic disappears on window reopen

**For You:** Your scope (replay during root-avatar init + sync on turn_start) must handle both modes. Howard flagged Squad identity regression risk — if your sync breaks metadata lookup, escalate to Vision.

---

## 2026-05-17T20:00:51Z — Scribe Completion: Mic State Handoff Fix Orchestration

**From:** Scribe (Session Logger)

**Context:** Vision and Shuri's parallel work on mic state handoff bug converged on the same solution. Scribe has consolidated findings and recorded outcomes.

**What Scribe Did:**
1. Merged inbox decisions from both agents into .squad/decisions.md
2. Recorded orchestration logs for Vision and Shuri (standard form)
3. Consolidated web-ready-gate decision (2026-05-17T20:00:51.651+02:00)
4. Created session log documenting the full resolution path

**Outcome:** Your webview-ready handshake (page sets `__copilotAvatarReady` flag) gates Squad context replay. Extension waits for that signal before calling `setSquadContext()`. Combined with mic boom replay in root-avatar init, this ensures first-paint visibility. Full coordination trail now in `.squad/orchestration-log/2026-05-17T18-00-51Z-{vision,shuri}.md`.

**Team Visibility:** Session log in `.squad/log/2026-05-17T18-00-51Z-mic-state-handoff.md` summarizes both agents' findings for the broader team.

---

## 2026-05-17T20:10:26Z — Scribe: Cast Identity Resolution Cross-Agent Sync

**From:** Scribe (Session Logger)

**Context:** Vision and Shuri completed investigation into generic agent label regression. Scope expanded beyond mic boom to cover sub-agent cast name resolution seam failures.

**What Scribe Did:**
1. Merged inbox decisions (Howard identity verification, Shuri cast label precedence, Vision spawn metadata binding)
2. Created orchestration logs: `.squad/orchestration-log/2026-05-17T18-10-26-{vision,shuri}.md`
3. Session log: `.squad/log/2026-05-17T18-10-26-cast-identity.md`

**Your Key Finding:** Generic Copilot labels like `General Purpose Agent` must be filtered in extension BEFORE webview receives them. Low-confidence detection in `content/main.js` is good defense but insufficient without upstream filtering. Solution: bring `GENERIC_AGENT_LABELS` and `isLowConfidenceLabel()` into `main.mjs`; prefer Squad displayName/role over generic labels before payload construction.

**Files to Update:**
- `.github/extensions/copilot-avatar/main.mjs` (filter + Squad preference on `subagent.started`, `.completed`, `.failed`)
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` (load `.squad/casting/history.json` for slot alias resolution)

## Team Update: Label Regression Investigation (2026-05-17)

**From Scribe:** Renderer is clean; content/main.js still correctly demotes placeholder labels. The regression source is upstream in main.mjs where the label construction vent.data?.agentDisplayName ?? squadAgent?.displayName allows SDK placeholders to outrank Squad identity before payload reaches the page.

**Next:** Extension-side fix exists; awaiting merge/commit coordination.

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