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

