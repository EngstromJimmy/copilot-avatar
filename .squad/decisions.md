## 2026-05-17

# Release v0.2.1 Commit Decision

**Decided by:** Tony Stark (Lead)  
**Date:** 2026-05-17T23:21:43  
**Requested by:** Jimmy Engstrom

## Summary
Created and pushed the v0.2.1 release commit containing user-facing avatar product fixes and the updated README.

## Scope Decision

### Included in Release Commit
Four files with product changes:
1. **README.md** — Updated with v0.2.1 release notes describing the fixes
2. **.github/extensions/copilot-avatar/content/main.js** — Avatar scene logic fixes (sub-agent name resolution, activity display, window behavior, voice persistence)
3. **.github/extensions/copilot-avatar/lib/squad-context.mjs** — Avatar squad integration fixes
4. **.github/extensions/copilot-avatar/main.mjs** — Avatar extension runtime fixes

### Excluded from Release Commit
All `.squad/` internal state and orchestration files:
- Agent history logs
- Health reports
- Orchestration logs
- Skill definitions and state
- Squad configuration and metadata

These were excluded because they are internal tooling/CI state, not user-facing product changes.

## Release Notes
The v0.2.1 release addresses:
- **Squad sub-agent names**: fixed name resolution and late-open/reload behavior so sub-agents always show correctly
- **Sub-agent activity detail**: fixed thinking/activity text display so cards show the actual work being done
- **Cleaner sub-agent scene**: removed stale lingering general-purpose cards from old idle agents
- **Voice persistence**: fixed voice selection to persist correctly across TTS engines, especially with ElevenLabs
- **Window behavior**: made always-on-top setting follow transparent window mode instead of forcing it on framed windows

## Commit Details
- **Commit hash:** `c152904dd97e337608df0b7a50fc8819dab8eb59`
- **Push result:** Successfully pushed main branch to origin/main
- **Files changed:** 4 files with 1057 insertions, 109 deletions

## Rationale
This release represents a complete feature set of avatar fixes that have been validated through Squad testing. Separating the product commit from internal state files keeps the repository history clean and makes release tracking clear.


# Branch Switch Decision - Tony Stark

**Date:** 2026-05-17T23:47:19.558+02:00  
**Task:** Switch repository to SAM implementation branch  
**Requested By:** Jimmy Engstrom  

## Finding

**SAM Implementation Branch Identified:** `feat/microsoft-sam-tts`

A single, clear match was found among all local and remote branches. This is the Microsoft SAM (Semantic Audio Model) implementation branch.

## Issue Encountered

**Cannot proceed with checkout due to conflicting changes:**

### Modified Files (2):
- `.squad/agents/howard-the-duck/history.md`
- `.squad/skills/avatar-regression-probes/SKILL.md`

### Untracked Files at Risk:
- `.copilot/skills/*` (multiple SKILL.md files)
- `.github/agents/` and `.github/workflows/` (CI/CD configuration)
- `.squad/` (squad infrastructure files including registry, charter, health reports)
- Root files: `.gitattributes`, `.gitignore`

These files exist on the SAM branch and would be overwritten by the checkout operation.

## Status

**Current Branch:** `main`  
**Target Branch:** `feat/microsoft-sam-tts`  
**Checkout Status:** ❌ Blocked

## Next Steps Required

To proceed, user must resolve conflicts by one of:

1. **Stash changes** (temporary): `git stash`
2. **Commit changes** (permanent): `git add . && git commit -m "message"`
3. **Clean untracked files**: `git clean -fd` (warning: destructive)

After resolving, retry: `git checkout feat/microsoft-sam-tts`

---

*Decision made to preserve all user changes per project policy.*

# Decision: Remove `waitingForRetire` cleanup from history replay

**Agent:** Vision (Platform Dev)  
**Date:** 2026-05-18  
**Status:** Implemented  

## Context

When the avatar window was opened while 3 Squad sub-agents were actively running, none of them appeared in the window.

## Root Cause

`hydrateSubagentRuntimeFromHistory()` in `main.mjs` ran a post-loop cleanup that deleted any sub-agent whose `waitingForRetire` flag was `true` and had no active tools. This flag is set by `tool.execution_complete` when a sub-agent's last in-flight tool finishes — exactly the state a running agent is in while its model is computing the next tool call. The history snapshot is indistinguishable from a cleanly-completed agent, so all three were deleted before replay.

## Decision

**Remove the post-loop `waitingForRetire` cleanup from `hydrateSubagentRuntimeFromHistory()`.**

Correctly-completed agents are removed by their `subagent.completed` / `subagent.failed` events, which are non-ephemeral (confirmed from SDK type: `ephemeral?: boolean` is optional, defaulting to persisted). The `waitingForRetire` fallback-retire mechanism belongs only in the live-runtime path where timer-based grace windows are possible.

## Secondary change

Forward `SubagentStartedData.model` (optional, present for auto-selected agents like rubber-duck) in both the live `subagent.started` handler and the history hydration case. Sub-agent cards now show their model immediately at start.

## File changed

`.github/extensions/copilot-avatar/main.mjs`

## 2026-05-18

# Microsoft SAM Text-to-Speech Engine Implementation

**Decided by:** Tony Stark (Lead) / Peter Parker (Implementation) / Shuri (Frontend)  
**Date:** 2026-05-18T00:04:39.350+02:00  
**Requested by:** Jimmy Engstrom  
**Branch:** feat/microsoft-sam-tts

## Summary

Microsoft SAM text-to-speech implemented as a fourth engine option, browser-native using `sam-js@0.3.1` (MIT license) via importmap CDN. Follows existing Voxtral/ElevenLabs audio pipeline: `wav()` → blob URL → HTMLAudioElement. Voice presets static (no server fetch). Persistence follows existing settings pattern.

## Architectural Decision

SAM support is browser-only generation in `content/main.js` using legitimately licensed packages only. No proxy through extension-side fetches. All synthesis, voice enumeration, preview, and playback entirely in webview layer. Treated as first-class engine with persisted fields like Web Speech / Voxtral / ElevenLabs.

## Engine Details

- **Library:** sam-js@0.3.1, MIT licensed
- **Loading:** jsdelivr ESM CDN via importmap
- **Generation:** `SamJs.wav()` returns Uint8Array WAV wrapped in blob URL
- **Audio pipeline:** Uses same `ttsAudioPlayer` / `activeGeneratedAudioUrl` seam as other engines
- **Voice presets:** Static SAM_VOICES constant (SAM Default, Elf, Cylon, Darth Vader, Stuffy, Gruff) defined as `{id, name, speed, pitch, throat, mouth}`
- **Persistence:** `samVoice` follows exact pattern of `voxtralVoice` / `elevenlabsVoice`; included in `saveTtsSettings()`, restored from `savedTts.samVoice`, present in DEFAULT_SETTINGS in main.mjs
- **No loading race:** Voices are static presets, so `populateSamVoices()` fires once at init without placeholder

## Files Changed

- `.github/extensions/copilot-avatar/content/index.html` — sam-js importmap, SAM option in engine select, #tts-sam-section div
- `.github/extensions/copilot-avatar/content/main.js` — full SAM engine wiring (SamJs import, SAM_VOICES, speakSam(), populateSamVoices(), samVoice state)
- `.github/extensions/copilot-avatar/main.mjs` — samVoice: 'sam' in DEFAULT_SETTINGS

## Pattern for Future Engines

Any pure-browser TTS engine with static voice options should follow: static constant list → populate*Voices() at init → section div in HTML → speak*() function with blob URL output.

---

# Sub-Agent Selection Hint Contract

**Decided by:** Tony Stark (Lead)  
**Date:** 2026-05-18T00:04:39.350+02:00  
**Requested by:** Jimmy Engstrom

## Decision

Treat Copilot SDK `subagent.selected` as weak, best-effort naming hint only. Never sole authority for visible sub-agent identity or card creation.

## Why

- SDK 0.1.32 `subagent.selected` provides only `agentName`, `agentDisplayName`, `tools` — no `toolCallId`, `parentToolCallId`, or runtime `agentId`
- Concurrent selections cannot be correlated deterministically
- `subagent.started` is first authoritative lifecycle event for visibility ownership

## Team Guidance

- Keep visibility ownership on `subagent.started`
- Keep `subagent.selected` as temporary hint for weak label improvement
- Prefer correlation order: spawn tool metadata → `subagent.started` names → Squad roster/casting → `subagent.selected` hint → raw runtime fallback
- If product needs guaranteed naming for concurrent starts, add correlation seam around parent spawn tool metadata; do not let `subagent.selected` mint cards

# Voice Engine Naming Decision: C64 vs MS_SAM

**Decided by:** Tony Stark (Lead)  
**Requested by:** Jimmy Engstrom  
**Date:** 2026-05-18T07:57:31.584+02:00  

## User Directive

Rename the Microsoft SAM engine to `MS_SAM`; if the current synthesized voice path is actually the C64-style implementation, keep it available but rename that engine to `C64`.

## Decision

Do **not** keep the current browser synthesizer under a Microsoft SAM-style label. The implementation in `.github/extensions/copilot-avatar/content/main.js` is an original Web Audio formant synth with a tiny rule-based grapheme-to-phoneme pass and hand-tuned retro presets; that is materially closer to a **C64 / Software Automatic Mouth-inspired** path than to the later Microsoft SAPI voice family.

### Rationale

- The current engine is built from `SAM_PHONEME_DATA`, `samG2P()`, and `synthesizeSamAudio()` — a lightweight formant/noise synthesizer, not a packaged Microsoft voice or SAPI runtime.
- The preset list (`sam`, `elf`, `cylon`, `vader`, `stuffy`, `gruff`) reads like retro character variants, not Microsoft voice identities.
- The referenced site markets "Microsoft SAM" aggressively, but its public page also points at the open `discordier/sam` lineage and separate Tetyys/SAPI4 offerings. That is marketing plus mixed backends, not evidence that our current browser path matches the original Microsoft voice.

### Action Items for Implementation (Peter)

1. **Rename honestly first.** Treat the current `sam` engine as `c64` in UI copy and code-facing identifiers where practical. If persistence keys must survive, add a migration from `samVoice`/`engine: 'sam'` to the new name instead of breaking saved settings.
2. **Reserve `MS_SAM` for a distinct path.** Only ship an `MS_SAM` option if it uses a clearly separate seam — for example, browser/OS `speechSynthesis` when a Microsoft SAM-like system voice is actually exposed. Do not relabel the current formant synth as `MS_SAM`.
3. **Do not promise Mike/Mary from this synth.** Mike/Mary/Bonzi-class voices are different assets and engines, not parameter presets on top of this formant table.
4. **Be explicit in UI text.** Current retro engine copy should say browser-native, retro, no API key, and avoid claims like "authentic Microsoft SAM" or "SAPI-compatible."
5. **If time is short, prefer the honest cut.** Shipping `C64` now is better than shipping a mislabeled fake `MS_SAM`.

### Technical Constraints

- **No proprietary voice assets.** We cannot copy Microsoft voice databases, DLLs, diphone tables, or extracted phoneme rules.
- **Browser-only synthesis is the hard limit.** A pure JS/Web Audio formant synth will not naturally land on Mike/Mary timbre; those voices depend on proprietary voice data and different synthesis pipelines.
- **`speechSynthesis` is opportunistic, not deterministic.** On some Windows setups the browser may expose Microsoft-installed voices, but availability, naming, and quality vary by OS/browser and are not portable.
- **Open replacement data is the real work.** A true browser-native `MS_SAM` approximation would need an openly licensed voice corpus and a different synthesis architecture, likely with a larger payload and more tuning.

# MS_SAM / C64 Validation Contract

**Date:** 2026-05-18T07:57:31.584+02:00  
**Agent:** Howard the Duck  
**Requested by:** Jimmy Engstrom

## Decision

Use `.github/extensions/copilot-avatar\probe-regression.mjs` as the acceptance gate for the speech-engine rename revision.

## Required Evidence

- Engine select exposes `MS_SAM` on `ms_sam` and keeps the legacy formant path on `c64`.
- No visible/runtime speech path still treats `sam` as the active engine id.
- `main.mjs` normalization and `content/main.js` restore logic both migrate legacy `engine: 'sam'` / `samVoice` into `c64` / `c64Voice`.
- `MS_SAM` stays browser-only and reference-driven: scored local browser voices (`scoreMsSamVoice`, `resolveMsSamVoice`) and no `samtts.com` or copied web assets.
- `C64` owns the retro formant synth (`C64_VOICES`, `speakC64`, `synthesizeSamAudio`).

## Why

This catches the two ugly regressions most likely to slip through review: a cosmetic rename that leaves stale `sam` state paths behind, and a mislabeled browser synth that still pretends to be Microsoft SAM instead of an honest C64-style path.

---

# C64 SAM dependency + persistence decision

- **Date:** 2026-05-18T09:24:45.011+02:00
- **Requested by:** Jimmy Engstrom
- **Author:** Peter Parker

## Decision

Use the upstream `sam-js` package from the `discordier/sam` project as the C64 speech engine dependency, and serve it into the avatar webview through a single allowlisted vendor route instead of keeping the custom in-file synthesizer.

## Why

- Keeps the runtime honest: the shipped C64 engine now uses the external SAM implementation directly.
- Avoids broad static-file exposure from the extension root; only the `sam-js` module is mounted for the webview.       
- Lets C64-specific settings persist alongside the rest of TTS state without overloading Web Speech fields.

## Persisted settings

- `c64Voice`
- `c64Speed`
- `c64Pitch`
- `c64Throat`
- `c64Mouth`

## Touched seams

- `.github/extensions/copilot-avatar/package.json`
- `.github/extensions/copilot-avatar/package-lock.json`
- `.github/extensions/copilot-avatar/lib/copilot-webview.js`
- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/content/index.html`

---

# Decision: Use the packaged sam-js webview seam for C64 speech

**Date:** 2026-05-18T09:24:45.011+02:00
**Requested by:** Jimmy Engstrom
**Agent:** Shuri

## Decision
Keep the C64 voice engine fully browser-side and use the existing packaged `sam-js` dependency served by `.github/extensions/copilot-avatar/lib/copilot-webview.js` at `/__vendor__/sam-js.mjs`.

Speech generation should go through `SamJs.wav()` in `.github/extensions/copilot-avatar/content/main.js`, then into a Blob URL and `Audio` element so it follows the same lightweight playback seam as the other generated-audio engines.       

## Why
This keeps the avatar extension self-contained, avoids introducing a CDN-only dependency when the extension already has a working vendor-module seam, and finally replaces the temporary hand-built formant synth with the real external library the user asked for.

It also preserves the UI work already done for C64 presets and sliders (`c64Voice`, `c64Speed`, `c64Pitch`, `c64Throat`, `c64Mouth`) instead of inventing a second settings model.

## Files
- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/lib/copilot-webview.js`
- `.github/extensions/copilot-avatar/package.json`
- `.github/extensions/copilot-avatar/main.mjs`

---

# Decision: Scope the SAM regression probe to the real library seam and visible UI contract

**Agent:** Howard the Duck  
**Date:** 2026-05-18T09:24:45.011+02:00  
**Requested by:** Jimmy Engstrom

## Decision
Update `.github/extensions/copilot-avatar\probe-regression.mjs` so it validates the new `discordier/sam` migration directly and scopes copy assertions to visible UI strings instead of raw migration identifiers.

## Why
- The previous probe could false-fail on internal migration code because `ms_sam` still appeared in normalization paths even when no visible UI claimed `MS_SAM`.
- The new product request is not a rename-only pass; QA now needs lightweight proof of the external `sam-js` seam plus persisted C64 controls for voice, mouth, pitch, and related parameters.

## Current Review Result
- The checked-in migration still looks incomplete for the requested feature.
- `content/main.js` still contains the in-file synth path (`SAM_PHONEME_DATA`, `samG2P()`, `synthesizeSamAudio()`), `package.json` still has no `sam-js` dependency/reference, and the C64 panel in `content/index.html` still exposes only a voice preset selector plus a test button.

## Follow-up
- **2026-05-18T09:24:45.011+02:00:** After Peter and Shuri landed the finished migration, the product implementation now satisfies the intended contract: `sam-js` is vendored through the webview, `speakC64()` routes through the external library, and the C64 panel persists voice plus speed, pitch, throat, and mouth.
- The only remaining issue was in QA scope: the regression probe had become too literal and false-failed on helper-wrapped `sam-js` usage plus a combined `initialC64Preset` restore path. I updated the probe to match the real contract without relaxing the substantive checks.

---

# Avatar Load Fix — Vision

**Date:** 2026-05-18T11:57:44.088+02:00  
**Agent:** Vision  
**Requested by:** Jimmy Engstrom

## Decision

Do not let optional avatar GLB loads gate `window.__copilotAvatarReady`.

## Why

The avatar page was booting far enough to create the canvas and controls, but it never declared itself ready because `content/main.js` awaited `model.glb` and `clippy.glb` before `initializeRootAvatar()` and the ready flag. In live repro, `model.glb` timed out while the rest of the page was healthy, so the extension kept treating the window as not loaded.

## Implementation

- Timebox `model.glb` and fall back to `createBaseAsset(null)` if it stalls.
- Set up the root avatar and mark the page ready from that fallback-capable path.
- Load `clippy.glb` after readiness in the background.
- Keep the default avatar visible until `clippyRoot` actually exists, so a slow Clippy asset does not produce a blank scene.

---

# Avatar Load Fix — Shuri

**Date:** 2026-05-18T11:57:44.088+02:00  
**Requested by:** Jimmy Engstrom  
**Agent:** Shuri

## Decision

Do not let the vendored `sam-js` C64 speech module participate in page boot as a static top-level import.

## Why

The SAM migration changed `content/main.js` from a self-contained page module into one that could fail before scene setup if `/__vendor__/sam-js.mjs` was unavailable for any reason. That is the wrong failure boundary: speech preview can fail locally, but the avatar canvas and `window.__copilotAvatarReady` handshake still need to come up so the product visibly loads.

## Implementation

- Move `sam-js` loading behind an async helper inside the C64 speech path.
- Cache the constructor after a successful load, but clear the cached promise on failure so later retries can recover.
- Keep the rest of the avatar startup path unchanged so the fix stays scoped to the SAM migration regression.

---

# Avatar Load Review — Howard the Duck

**Date:** 2026-05-18T11:57:44.088+02:00  
**Requested by:** Jimmy Engstrom  
**Agent:** Howard the Duck  
**Status:** Approved after repro pass

## What I checked

- `node --check` on `main.mjs`, `lib/squad-context.mjs`, `content/main.js`, and `probe-regression.mjs`
- `node probe-regression.mjs`
- Live avatar open/reload behavior through the project `copilot-avatar` extension

## Evidence

- Syntax stayed clean and the lightweight regression probe passed (`65 passed, 0 failed`).
- After `extensions_reload` and a full reopen, the live window reported `window.__copilotAvatarReady === true`, one rendered canvas, and working exported handlers (`setSquadContext`, `clearSubagents`, `addSubagent`, `setAgentActivity`).
- The only blank state I could catch was an immediate post-refresh snapshot during `reload:true`: no canvas yet, no exported handlers yet, and only static HTML controls visible. That is a timing snapshot, not a persistent boot failure.

## Review decision

I do **not** currently have evidence of a real load-blocking product regression in the checked-in avatar code. Current live build passes the repo's lightweight validation and loads after a proper extension reload + reopen, so I am not rejecting the implementation on QA grounds.

## Team guidance

When someone reports "avatar not loading," first distinguish **mid-reload blank frame** from **real boot failure**. The acceptance signal is page-ready plus rendered scene, not a single DOM sample taken during refresh.

---

# Background Agent Visibility — Vision

**Date:** 2026-05-18T13:02:05.771+02:00  
**Agent:** Vision  
**Status:** Implemented

## Decision

Stop clearing sub-agent runtime/UI state on root `assistant.turn_start`; instead reconcile visible sub-agents from `session.idle.data.backgroundTasks.agents` in both live runtime and late-open history replay.

## Why

Copilot background agents can remain alive across top-level turns. Using `assistant.turn_start` as a hard reset hid still-running Howard/Tony cards even though the platform task list still showed them as started/idle.

---

# Agent Visibility Review — Howard the Duck

**Date:** 2026-05-18T13:02:05.771+02:00  
**Agent:** Howard the Duck  
**Status:** Approved

## What Verified

The avatar UI was missing the first real visibility handoff, not a rendering primitive. Weak update-only traffic produced zero non-root cards in the live webview; sending `addSubagent()` immediately surfaced the expected Howard/Tony cards. Tightened `.github/extensions/copilot-avatar\probe-regression.mjs` so QA now guards the webview-side pending-state contract in addition to the existing `subagent.started` and late-open replay assertions.

## Evidence

Live avatar probe: after `clearSubagents({ preserveRoot: true })`, weak `setAgentActivity` / `setAgentIntent` / `setAgentThinking` calls left `overlayCount: 0`; adding `addSubagent()` for Howard and Tony raised the overlay count to 2 and both cards became visible after render settle. Source review matches that behavior: `main.mjs` now calls `addSubagent` directly from `subagent.started`, late-open replay clears + rehydrates before replay, and `content/main.js` queues weak updates until a render-authorizing payload arrives. `node probe-regression.mjs` now passes 79/79.

## Team Impact

If someone says "the agents ran but never appeared," the first question is whether the extension ever emitted `addSubagent` (or an equivalent strong-identity first render), not whether the webview can draw cards once it gets one.

---

# User Directive: Clippy-Only Feedback

**Date:** 2026-05-18T13:03:44.655+02:00  
**By:** Jimmy Engstrom (via Copilot)  
**Requested:** Intro/status feedback like "There is an update" or "We have hit a snag" should only be available when running Clippy, never Copilot.

---

# Clippy Feedback Gating Review — Howard the Duck

**Date:** 2026-05-18T13:03:44.655+02:00  
**Agent:** Howard the Duck  
**Status:** Rejected

## What Checked

Tightened `.github/extensions/copilot-avatar/probe-regression.mjs` so the lightweight QA gate now rejects any path where Copilot mode can still reach the Clippy-only intro/status summaries.

## Evidence

`content/main.js` keeps the "It looks like …" strings inside `summarizeForClippy()`, but `main.mjs` `assistant.turn_end` still calls `flushClippySummary` unconditionally after root messages. Running `node probe-regression.mjs` from `.github/extensions/copilot-avatar` now finishes 72 passed / 1 failed, with the failing assertion `Copilot mode cannot reach Clippy intro/status summaries`.

## Required Revision

Shuri should revise the implementation so Copilot mode cannot reach `flushClippySummary` — either guard the `main.mjs` call site by Clippy mode or make `flushClippySummary()` bail out when the avatar style is not `clippy`.

---

# Clippy-Only Feedback Implementation — Shuri

**Date:** 2026-05-18T13:03:44.655+02:00  
**Agent:** Shuri  
**Status:** In Progress

## Decision

Gate `speakClippySummary()` and `flushClippySummary()` behind `isClippyAvatar()` so intro/status wrappers like `There is an update` and `We hit a snag` never surface in Copilot mode.

## Rationale

The feedback lead-ins are persona-specific Clippy chrome; in Copilot mode they add duplicate, off-brand narration instead of the raw assistant response.

---

# Sub-agent Background Identity Mismatch — Howard Review 1

**Date:** 2026-05-18T13:02:05.771+02:00  
**Agent:** Howard the Duck  
**Status:** Rejected

## Finding

Reproduced Jimmy's mismatch: the runtime/background-task identity can say one thing while the avatar card keeps a stale alias and stale work copy. Vision's current revision still repairs visibility by background ids only; it does not bring background-task identity metadata onto the card or let fresher runtime labels beat cached spawn aliases.

## Evidence

Live avatar repro: after rendering one card as `Tony Stark`, sending a later runtime-style update with `agentName: 'Vision'` and a new description left the visible card unchanged (`Tony Stark … Verify avatar UI visibility`). Sending a strong `displayName: 'Vision'` finally changed the header, but the detail line still stayed on the old spawn summary. Source review matches the repro: `getBackgroundAgentsFromSessionIdle()` only keeps `agentId` + `description`, `bindPendingStartedSubagentsToBackgroundAgents()` binds visibility ids but no identity fields, `resolveSubagentDisplayFields()` ranks `spawnMetadata.displayName` ahead of `runtimeDisplayName` / `runtimeAgentName`, and `resolveSubagentTaskSummary()` iterates `[spawnMetadata?.description, runtimeDescription]`. The lightweight probe now fails on those seams.

## Required Revision

Peter Parker should revise this next. The fix needs one consistent source-of-truth path so background-task/runtime identity and description fields can actually update the visible card instead of leaving Tony/Howard-era spawn aliases stuck on screen.

---

# Sub-agent Visibility with Missing agentId — Howard Review 2

**Date:** 2026-05-18T13:02:05.771+02:00  
**Agent:** Howard the Duck  
**Status:** Rejected

## Finding

Reproduced Jimmy's "spawned again, still no visible change" report against the current workspace and tightened the lightweight QA probe to catch the hole. The avatar renderer is healthy, but Vision's revision only changed background-agent pruning; it still cannot materialize a missing Tony/Howard card when the runtime never delivered the original `addSubagent` render handoff.

## Evidence

Live avatar probe after reload: the window was ready and still showed `overlayCount: 0`. A weak-update repro (`setAgentIntent` / `setAgentThinking` for missing Tony/Howard ids) also left `afterWeak: 0`, while manual `addSubagent()` immediately raised the count to 2 and both cards became visible — the draw path works once it gets the first render payload. Source review matches the symptom: `tool.execution_start` for spawn tools only caches spawn metadata, `session.idle` only calls `reconcileLiveBackgroundSubagents(getBackgroundAgentIdsFromSessionIdle(event))`, and both background reconcile helpers loop existing state/maps and remove stale ids without iterating the incoming background ids to create missing cards. The hardened lightweight check (`node probe-regression.mjs`) now fails 81 passed / 2 failed on exactly that gap.

## Required Revision

Peter Parker should revise this next. The new implementation must prove that the background-agent fallback can surface a never-rendered Tony/Howard card (or restore an equivalent first-render handoff) rather than only preserving/removing cards that already existed.

---

# Background Identity Refresh — Peter Parker Revision Approved

**Date:** 2026-05-18T13:02:05.771+02:00  
**Agent:** Howard the Duck  
**Status:** Approved

## Finding

Peter's revision fixes the rejected sub-agent UI artifact. The avatar can now materialize cards from background-task snapshots, stale Tony-style spawn aliases no longer outrank fresher runtime/background identity, and runtime/background description text is promoted ahead of old spawn copy.

## Evidence

Source review shows three key repairs in `.github/extensions/copilot-avatar\main.mjs`: 
1. Provisional visible owners for `subagent.started` without `event.agentId`, then `bindPendingStartedSubagentsToBackgroundAgents()` + `reconcileLiveBackgroundSubagents()` / `reconcileHydratedBackgroundSubagents()` to materialize missing cards from background snapshots
2. Normalized background metadata caching (`normalizeBackgroundAgentMetadata`, `cacheBackgroundAgentMetadata`, `buildBackgroundSubagentPayload`) so runtime/background display name + task summary survive into card payloads
3. `resolvePreferredSquadAgentMetadata()` and runtime-first display/task-summary resolution so fresh Vision-style identity and description beat stale Tony-style spawn hints

The existing lightweight validation was updated to match the new contract and now passes: `node probe-regression.mjs` → 92 passed, 0 failed.

## Team Impact

Approved. In human terms: when the platform finally knows "this is Vision and here's what Vision is doing," the avatar now updates the card to Vision, uses the newer task text, and can even create the card if the UI never got the first render event.

---

# Clippy Feedback Gating Re-review — Approved

**Date:** 2026-05-18T13:03:44.655+02:00  
**Agent:** Howard the Duck  
**Status:** Approved

## Finding

Re-reviewed the current workspace for the Clippy-only feedback rule and confirmed the intro/status lead-ins are now blocked in Copilot mode while still available in Clippy mode.

## Evidence

`.github/extensions/copilot-avatar/main.mjs` now gates `assistant.turn_end` through `shouldUseClippySummaryFeedback()` before calling `flushClippySummary`, and `.github/extensions/copilot-avatar/content/main.js` now makes both `speakClippySummary()` and `flushClippySummary()` return early when `avatarStyle !== 'clippy'`. Running the existing lightweight validation (`node probe-regression.mjs` from `.github/extensions/copilot-avatar`) now finishes 81 passed / 0 failed, including the Clippy-only summary assertions.

---

# Vision — Clippy Feedback Gating Decision

**Date:** 2026-05-18T13:03:44.655+02:00  
**Agent:** Vision

## Decision

The intro/status wrapper phrases (`There is an update`, `We hit a snag`, `You're all set`) are a Clippy-only contract.

`.github/extensions/copilot-avatar/main.mjs` must only call `flushClippySummary()` when the active avatar style is `clippy`, and `.github/extensions/copilot-avatar/content/main.js` must clear any staged Clippy summary state whenever Copilot uses the raw speech path or the UI exits Clippy mode.

## Why

The regression lived at the extension ↔ webview seam: the webview already refused to speak wrapped summaries in Copilot mode, but the extension still unconditionally forwarded turn-end messages into the Clippy summary path.

Making the mode gate explicit on both sides removes hidden state, keeps Copilot on raw speech only, and makes future failures point to the correct seam immediately.

## Files

- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/probe-regression.mjs`

---

# Peter Parker — Background Identity Should Repair Visible Cards

**Date:** 2026-05-18T13:26:10.974+02:00  
**Agent:** Peter Parker  
**Status:** Proposed

## Decision

When `session.idle.data.backgroundTasks.agents` provides a stable runtime agent identity, the avatar should cache that richer snapshot (`agentId`, runtime name/display name, description/task summary) and use it to repair or materialize the visible card. Spawn-tool hints still bootstrap ambiguous starts, but they must stop outranking fresher background/runtime identity once the platform gives us a stable owner.

## Rationale

Jimmy's repro showed the runtime task list on `Vision` while the UI stayed on `Tony Stark`, which means stale spawn aliases were still winning after a better runtime identity existed. The fix in `.github/extensions/copilot-avatar/main.mjs` now lets strong runtime/background identity beat cached spawn labels, prefers fresh runtime descriptions for badge/task copy, and makes background reconciliation add missing cards instead of only pruning known ones.

## Impact

Late-open reloads and background-task carries should now converge on the same agent names/detail text the runtime exposes, instead of leaving old cast aliases stuck on screen.


### 2026-05-18T16:11:43.269+02:00: User directive
**By:** Jimmy Engstrom (via Copilot)
**What:** Prefer the simplest approach for Avatar sub-agent listing and naming; avoid more advanced plumbing than necessary.
**Why:** User request — captured for team memory

## Howard the Duck — Background snapshot retire guard

- **Date:** 2026-05-18T15:35:44.313+02:00
- **Status:** Approved after revision

### What I found

The disappearing-subtask bug was not just a first-open replay seam. Live cards could still get pruned by `scheduleFallbackSubagentRetire()` after the last tool finished, even when the latest background-task snapshot still said that agent was active.

### Decision

Keep a live set of the most recent background-task agent ids and make fallback retire bail out while an agent is still present in that snapshot. Keep the lightweight probe watching both seams: first-open live-state merge and the background-snapshot retire guard.

### Evidence

- `node probe-regression.mjs` passes with the new guard.
- Live avatar check: a running Howard card survived reload and remained visible across the post-reload wait instead of vanishing immediately.

## Howard the Duck — Rejection: fake `call_*` subtask leak

- **Date:** 2026-05-18T15:35:44.313+02:00
- **Status:** Rejected
- **Requested by:** Jimmy Engstrom

### Repro

Reload the avatar window while live agents are running. In the current workspace, the UI shows a fake non-root card such as `call_VB5glI2uDkZhB3dksc8UzY8D` with detail text `Using Copilot Avatar Show`, alongside the real Howard card.

Actual live background agents at the same moment are only the real agents (for example `vision-3` and `howard-the-duck-9`), so the `call_*` entry is not a genuine background subtask.

### Why this revision is rejected

Vision's current revision still leaks raw tool-call/runtime metadata into visible subagent state:

1. Root/meta tool suppression only exists on the **root** mirror path (`report_intent`, `copilot_avatar_*`), not on the **subagent** visibility path.
2. `tool.execution_start` still promotes any truthy `agentId` into `upsertLiveSubagentPayload(...)` and `setAgentActivity(...)` without filtering raw `call_*` ids or avatar-control tools.
3. The first-open/live snapshot merge replays `captureLiveSubagentRuntimeState()` wholesale, so once a fake `call_*` owner gets into live state it can survive reload and reappear.
4. The lightweight probe does not yet assert that raw `call_*` ids and `copilot_avatar_*` tools are excluded from visible subtask cards.

### Required next reviser

Per lockout rules, do **not** send this back to Vision. Hand the revision to **Peter Parker**.

### Required fix shape

- Filter raw tool-call ids / opaque `call_*` owners before they can become visible subagent cards.
- Exclude avatar-control/meta tools like `copilot_avatar_show` from non-root visible subtask state.
- Add probe coverage so fake `call_*` / avatar-tool cards fail the lightweight regression gate.

## Howard the Duck — Live `call_*` avatar leak confirmed

- **Date:** 2026-05-18T15:35:44.313+02:00
- **Status:** Rejected revision

### Live evidence used for review

The avatar DOM rendered a fake non-root card with:

- **Header:** `call_VB5glI2uDkZhB3dksc8UzY8D`
- **Badge:** `Idle`
- **Detail:** `Using Copilot Avatar Show`

This appeared alongside a real Howard the Duck card. The actual background task list did not contain any real agent matching that `call_*` entry, so the overlay was leaking raw tool-call metadata and avatar-control tool text into visible subtasks.

### Review result

Vision's revision still does **not** explicitly remove raw `call_*` ids or avatar control tool labels from visible subtask state:

- root-only suppression exists for `copilot_avatar_*`, but not for non-root visible-card state
- `tool.execution_start` still promotes truthy `agentId` values into subagent payload/state without rejecting opaque `call_*` ids
- live snapshot capture/replay still carries any leaked fake card back into the overlay
- the lightweight probe still lacks an assertion that fake `call_*` / avatar-control cards are forbidden

### Required next reviser

Per lockout rules, hand the fix to **Peter Parker**.

# Howard the Duck — SDK sub-agent acceptance bias

- **Date:** 2026-05-18T16:11:43.269+02:00
- **Status:** Proposed

## Decision

For the avatar simplification pass, QA should accept the design only if sub-agent visibility comes from one SDK-observable inventory seam and name resolution comes from one direct Squad lookup seam. If the implementation still needs description parsing, score-based pairing, or count/order fallback to decide who a card belongs to, treat that as unresolved risk rather than “smart” resilience.

## Why

The current extension passes a source-only regression probe, but that probe does not prove the runtime actually exposes a trustworthy current sub-agent list. The most failure-prone code is the logic that guesses identity from partial events and background text; that is exactly where disappearing cards and wrong names hide.

## Minimum QA contract

1. A live sub-agent that the SDK still reports as active remains visible until completion/failure or explicit disappearance from the chosen inventory seam.
2. In Squad mode, stable aliases resolve directly to cast names (`lead`, `backend-dev`, `tester` → Tony Stark, Peter Parker, Howard the Duck).
3. No card name depends on parsing free-form description text when a stable runtime/Squad identity exists.

# Peter Parker — Simpler subagent runtime proposal

- Date: 2026-05-18T16:11:43.269+02:00
- Decision: Prefer one canonical sub-agent state model keyed by visible owner (`agentId` when known, otherwise `pending:${toolCallId}`), plus minimal alias maps for runtime `agentId` and `toolCallId`, instead of maintaining separate live/hydrated state machines and multi-stage rebinding caches.
- Context: The current avatar runtime in `.github/extensions/copilot-avatar/main.mjs` can show the right agents, but it pays for that with duplicated live/history reducers, fuzzy pending-to-background matching, and several caches that can race each other. The SDK appears to provide current background agents indirectly through `session.idle.data.backgroundTasks.agents`, while Squad only provides metadata lookup once a stable identity key exists.
- Consequences:
  - A future refactor can collapse `toolAgentIdsByToolCallId`, `subagentSpawnMetadataByAgentId`, `backgroundAgentMetadataByAgentId`, and the hydrated-state clone/merge helpers into one reducer-backed card store.
  - `subagent.selected` can stay a weak, global hint or be removed from identity ownership entirely.
  - The riskiest seam to delete is the fallback positional bind in `bindPendingStartedSubagentsToBackgroundAgents()`, which can reassign the wrong visible owner when multiple pending cards exist.

# Sub-agent simplification baseline

- **Date:** 2026-05-18T16:11:43.269+02:00
- **Requested by:** Jimmy Engstrom
- **Author:** Tony Stark

## Decision

For the next avatar fix, keep Copilot runtime as the sole authority for **which** sub-agents are currently visible, and treat Squad as optional metadata enrichment for **how** those agents are labeled.

## What this means

1. `subagent.started` / `subagent.completed` / `subagent.failed` remain the primary lifecycle contract.
2. `session.idle.data.backgroundTasks.agents` stays as the only supported runtime snapshot for background agents during idle/reload seams.
3. `subagent.selected` is not authoritative identity. At most, it may remain a weak fallback hint.
4. Squad lookup should only upgrade display name / role / description when runtime or spawn data supplies a stable alias (`lead`, `tester`, `backend-dev`, cast name, etc.).

## Simplification target

Delete or collapse state that tries to invent a second ownership model above Copilot runtime. The minimum acceptable architecture is:

- one visible-card state map,
- one spawn/runtime correlation seam,
- one late-open replay path,
- one optional Squad enrichment lookup.

## Explicit non-goal

Do not chase undocumented background-agent payload fields as if they were a stable API. If a name is not available from authoritative runtime data or Squad metadata, degrade cleanly instead of adding more heuristic state.

# Tony Stark - Visibility Checkpoint

**Date:** 2026-05-18  
**Requestor:** Jimmy Engstrom  
**Context:** Verification of Tony Stark identity in avatar UI and background tasks

## Decision

Posted public check-in notification at 15:34 UTC+2 identifying as Tony Stark (Lead), followed by 45-second active wait to ensure simultaneous visibility of all three team agents on stage.

## Rationale

- **Avatar UI verification**: Notification posts to system and confirms Tony Stark identity in active session
- **Background task visibility**: Active 45-second window allows Squad background task monitor (Ralph) and session logger (Scribe) to record presence
- **Team sync point**: Three-agent simultaneity enables Jimmy to cross-verify identity across UI layer, notification system, and orchestration logs

## Outcome

✅ Check-in posted  
✅ 45-second visibility window maintained  
✅ No avatar window reload (per requirement)  
✅ Ready for team verification

## Next Steps

Await Jimmy's verification of Tony Stark presence in avatar UI and background logs.

# Vision — Catalog vs live sub-agents

- Date: 2026-05-18T16:11:43.269+02:00
- Decision: Treat Copilot custom-agent catalog APIs and live sub-agent visibility as two different contracts. Use Copilot runtime events/background snapshots for liveness; use Squad only to enrich labels once a stable alias exists.
- Context: The installed Copilot SDK exposes `session.rpc.agent.list()` and `session.rpc.agent.getCurrent()`, but those return selectable custom agents, not currently running sub-agent instances. The avatar’s current wrong-name / disappearing-card problems come from treating partial runtime signals, background descriptions, and Squad metadata as if they were one authoritative stream.
- Consequences:
  - A simplification pass should not build visibility off `agent.list()`. It may be used only as a catalog/fallback metadata source.
  - Squad should supply display names/roles/descriptions, but only after runtime or spawn metadata provides a stable key like `platform-dev`, `tester`, or `Vision`.
  - The current `.squad/roster.md`-before-`.squad/team.md` precedence should be corrected or explicitly tolerated, because it hides the real team roster and makes cast naming depend on `.squad/casting/*`.

# Vision — Live identity cache cleanup

- Date: 2026-05-18T14:50:29.679+02:00
- Decision: Late-open replay must restore live sub-agent runtime bookkeeping, and every stale/terminal sub-agent removal path must clear the full identity-correlation cache before removing the card.
- Context: The avatar could replay an older Tony card into the live window, but only rebuild visible payload/maps. Later `session.idle` reconciliation and fallback retire logic only consulted live runtime state, so replayed cards could survive even when Howard was the only actual running agent. Separately, stale removal paths were dropping cards without clearing alias/pending/spawn caches, which let fresh background snapshots or weak runtime labels reuse the old owner identity.
- Consequences:
  - `mergeHydratedSubagentRuntimeState()` now repopulates `liveSubagentStatesByAgentId` from hydrated active sub-agents.
  - `releaseSubagentIdentityState()` is the shared cleanup seam for background reconciliation, fallback retire, and terminal events.
  - Regression probes should assert both the live-state rehydrate contract and the alias-cache cleanup contract.

# Vision — Live sub-agent replay merge

- Date: 2026-05-18T14:50:29.679+02:00
- Decision: Reload/open/context resync must preserve the current live sub-agent snapshot and merge it over history before replaying avatar cards.
- Context: The avatar could show live Shuri/Tony/Howard cards, then later clear them during a reload or cwd refresh while the background task list still showed those agents as running. The problem was extension-side teardown: `syncVisibleWindowState()` and `refreshSessionContext()` were clearing cards/runtime state before replay, and history alone was not always fresh enough to reconstruct current-turn agents.
- Consequences:
  - `.github/extensions/copilot-avatar/main.mjs` now captures live sub-agent payload/tool/correlation state before any clear/reset and merges it back after history hydration.
  - Visible cwd refreshes now take the full wait-for-ready replay path instead of a clear-and-metadata-only sync.
  - Regression probes should assert both the live-snapshot capture/merge seam and the no-clear-on-cwd-refresh contract.

# Vision — Root first-open subtask sync

- Date: 2026-05-18T14:50:29.679+02:00
- Decision: First-open/reload root subtasks must replay from a merged snapshot: persisted history plus a live in-memory root runtime state captured from current-turn events.
- Context: Direct verification showed that relying on `session.getMessages()` alone can miss in-flight root tool/intent state during the current turn, so the avatar window can open with an idle root even though work is already active. The webview consumed replayed `setWorking` / `setAgentActivity` / `setSubtask` state correctly once injected, which isolated the bug to the extension-side snapshot source and replay contract.
- Consequences:
  - `.github/extensions/copilot-avatar/main.mjs` now tracks root working/tool/intent/subtask/model state live and merges it with history inside `syncRootRuntimeState()`.
  - Root replay suppresses avatar/meta tool names like `report_intent` and `copilot_avatar_*` so first-open state reflects real work, not extension plumbing.
  - Regression probes should cover both the merged root-state replay seam and the suppression of internal root tool noise.

# 2026-05-18

## Vision — Runtime authority cleanup

**Date:** 2026-05-18T16:32:01.320+02:00

### Decision

- Sub-agent visibility ownership stays with Copilot runtime events plus session.idle.data.backgroundTasks.agents.
- Provisional pending:{toolCallId}` cards may bind to background runtime ids only on exact stable identity overlap, or when the unmatched seam is an unambiguous 1:1 pair.
- Squad metadata enriches runtime cards only when stable Squad keys exist from runtime or spawn metadata; weak subagent.selected hints stay display-only.
- .squad/team.md is the preferred roster source when present, with .squad/roster.md merged as legacy fallback instead of replacing team metadata.

### Why

This removes hidden ownership guesses between pending starts and background snapshots, which was the main seam that could render the wrong agent under the wrong name. It also keeps non-Squad projects on runtime-first naming while still letting Squad projects add role/description data when the metadata join is stable.

## Howard the Duck — Squad-optional probe contract

**Recorded:** 2026-05-18T16:32:01.320+02:00

**Decision:** probe-regression.mjs must verify the sub-agent contract in both Squad and non-Squad contexts.

**Why:** The user risk is not just bad Squad enrichment. The real regressions are early disappearance, wrong visible names, and any hidden requirement that Squad metadata be present before Copilot-owned sub-agents stay visible.

**Implication:** Keep one positive loadSquadContext() probe at the repo root, one negative probe from an inactive parent cwd, and explicit assertions that visibility stays runtime/background-owned while Squad remains enrichment-only.

## User directive

**Recorded:** 2026-05-18T16:32:01.320+02:00

**By:** Jimmy Engstrom (via Copilot)

**What:** Make the subagent cleanup work for both Squad and non-Squad projects; cross-project behavior is important.

**Why:** User request — captured for team memory.



## 2026-05-27

---
date: 2026-05-27T10:06:21.718+02:00
author: Howard the Duck
---

# Decision: Classify current avatar failure modes before chasing runtime ghosts

## Context

Jimmy reported that both the project avatar extension and the installed user/runtime copy were failing. I reproduced the current seams against the repo copy, the installed user copy, the Copilot CLI extension registry, and the bundled SDK bootstrap path.

## Decision

- Treat the current **project** failure as **settings disablement / extension not loading**, not as an active repo code crash.
- Treat the current **user/runtime** failure as **stale installed code plus settings disablement**.
- Do **not** classify the current report as a webview-ready handshake failure; the failing user copy dies before the webview bootstrap can run.
- Peter Parker's `joinSession()` / `getEvents()` repo fix is good evidence for the project copy, but it does **not** fully address the installed user/runtime failure until the user copy is synced and both extensions are re-enabled.

## Why

- `C:\Users\JimmyEngstrom\.copilot\settings.json` currently lists both `project:copilot-avatar` and `user:copilot-avatar` under `extensions.disabledExtensions`, and after extension reload only `copilot-xray` was running.
- The repo copy passed the existing lightweight validation (`node --check` trio plus `node probe-regression.mjs`) at 143/143 and its `lib/copilot-webview.js` imported successfully under the CLI-bundled SDK bootstrap.
- The installed user copy is stale: `main.mjs` matches the repo, but `lib/copilot-webview.js` and `probe-regression.mjs` do not. The stale user `lib/copilot-webview.js` still imports `{ extension }` from `@github/copilot-sdk/extension` and calls `extension.createSession()`, which fails under the bundled CLI SDK with `The requested module '@github/copilot-sdk/extension' does not provide an export named 'extension'`.
- The installed user `probe-regression.mjs` also remains stale enough to call `git rev-parse --show-toplevel` from the extension directory and crash outside a git repo, so it cannot be trusted as a portable runtime smoke check.

---

---
date: 2026-05-27T10:06:21.718+02:00
author: Peter Parker
---

# Decision: Use joinSession/getEvents for avatar extension session wiring

## Context

Both the project extension and the installed user copy were failing against the current Copilot CLI SDK. Runtime logs showed startup crashes from importing `{ extension }` out of `@github/copilot-sdk/extension`, and the next shared failure path was `session.getMessages()` missing on the resumed session object.

## Decision

- Use `joinSession({ onPermissionRequest: approveAll, ... })` for the avatar extension session seam in both `main.mjs` and `lib/copilot-webview.js`
- Use `session.getEvents()` for history replay/hydration
- Keep the regression probe aligned with that contract so SDK drift gets caught before manual runtime testing

## Why

The currently shipped SDK under `C:\Users\JimmyEngstrom\.copilot\pkg\win32-x64\1.0.54\copilot-sdk` exports `joinSession()` from `extension.js` and documents `getEvents()` on `CopilotSession`. The prior `extension.createSession()` / `getMessages()` combination is stale and now breaks both activation and replay.

---

## Decision: Keep one avatar authority and treat disabled-state refresh as restart-bound

- **Date:** 2026-05-27T10:06:21.718+02:00
- **Agent:** Vision
- **Status:** Proposed

### What we found

1. The repo extension passed the existing lightweight validation, so the project source is not the current failure seam.
2. Installed user and AppData copies had drift in `extension.mjs` and `main.mjs`; the AppData copy also had stale `vscode-jsonrpc` metadata that broke `@github/copilot-sdk/extension` import.
3. After syncing installed files and restoring `user:copilot-avatar` workspace approval, `extensions_reload` still kept `user:copilot-avatar` in a disabled state.

### Decision

- Keep **project:copilot-avatar** disabled in settings so the workspace does not try to run two copies of the same avatar extension.
- Treat **user:copilot-avatar** as the intended authority once the Copilot runtime is restarted.
- Do not chase path-resolution or shared-content fixes here; the remaining live seam is runtime state refresh, not repo code.

### Required operator action

Restart the Copilot CLI/Desktop runtime so it re-reads the repaired settings, approvals, and synced user extension files.


