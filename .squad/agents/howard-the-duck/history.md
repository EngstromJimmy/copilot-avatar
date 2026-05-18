# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Role

Howard the Duck — QA & Validation specialist for the CopilotAvatar extension.

## Key Learnings (Summary)

- **Mic Boom Visibility:** Root Squad mic created only for root avatar; visibility toggled by squadRootMicActive variable set via window.setSquadContext(). Capsule geometry parameters (0.024, 0.052) are critical; corruption in WIP merge (0.0264, 0.0572) breaks visual design.
- **Stale Subagent Replay Risk:** Late-open replay requires clearing both backend caches and UI before hydration; critical seam at main.mjs session.getMessages() and content/main.js clearSubagents().
- **Voice Persistence:** TTS settings merge via .tts-settings.json in main.mjs, but populateElevenLabsVoices() must preserve previous voice through async placeholders to avoid blanking saved selection.
- **Sub-agent Naming:** Squad metadata must bypass top-level UI gating for sub-agent identity lookup; casting-slot aliases resolve to human names (e.g., lead → Tony Stark).
- **Duplicate Identity Collapse:** Hidden agents stay hidden until real tool work starts; intent/reasoning alone insufficient for visibility.
- **Late-Open Avatar Review:** Two-part validation: (1) source probe of cached metadata/toolCallId maps in main.mjs, (2) live DOM probe queuing update calls before ddSubagent to confirm proper state upgrade.

## Key Learnings (cont.)

- **SAM Engine Is Custom Formant Synthesis:** The SAM TTS engine in content/main.js is a fully browser-native Web Audio API formant synthesizer (`synthesizeSamAudio`, `SAM_PHONEME_DATA`, `samG2P`) — no external sam-js or CDN dependency. The SAM_VOICES presets (sam/elf/cylon/vader/stuffy/gruff) drive pitch/formantShift/rate.
- **SAM Persistence Ordering:** `savedTts.samVoice` is restored before `populateSamVoices()` is called; `populateSamVoices()` reads the module-level `samVoice` var and marks the matching `<option>` selected, so a saved non-default voice survives init.
- **Three-Sub-Agent Visibility Miss:** The `assistant.turn_start` guard (`!event.agentId`) is correctly present in `hydrateSubagentRuntimeFromHistory`. However, if the root agent's second turn fires AFTER `subagent.started × N` (coordinator multi-step loop), those N sub-agents are wiped from `activeSubagentsByAgentId` in the replay, making them invisible in a late-open window. This is the probable root cause of the historical "three invisible agents" incident.

## Current Focus

QA validation for avatar sub-agent visibility and identity refresh in background-task handling. Recent approval cycle closed on Peter Parker's three-part fix: provisional visibility owners, background metadata caching, and runtime-first identity resolution.

## Learnings from 2026-05-18 Identity Refresh Cycle

For detailed session logs from early SAM and probe work, see history-archive.md.

---

## Key QA Learnings and Decisions

- **2026-05-18T07:57:31.584+02:00 — MS_SAM/C64 validation contract:** `.github/extensions/copilot-avatar\probe-regression.mjs` is now the lightweight acceptance gate for the browser speech split. The honest contract is `ms_sam` for the browser voice-scoring path in `content/main.js`, `c64` for the existing formant synth (`C64_VOICES`, `speakC64`, `synthesizeSamAudio`), and legacy `engine: 'sam'` / `samVoice` must migrate to `c64` / `c64Voice` through both `main.mjs` normalization and the webview load path.
- **2026-05-18T07:57:31.584+02:00 — Anti-relabel evidence for MS_SAM:** A credible `MS_SAM` pass in this repo means `speakMsSam()` stays on the browser voice seam (`speakWebSpeech` + `scoreMsSamVoice`/`resolveMsSamVoice`) and never touches `synthesizeSamAudio`, `SAM_PHONEME_DATA`, or `C64_VOICES`. If those retro-formant symbols leak into the `MS_SAM` branch, treat it as a mislabeled `C64` regression and reject it.
- **2026-05-18T09:24:45.011+02:00 — discordier/sam migration seam:** For the new C64/SAM work, the lightweight gate must look for a real `sam-js` / `discordier/sam` seam in `.github/extensions/copilot-avatar\package.json`, `content\index.html`, or `content\main.js`, and reject any build that still ships `SAM_PHONEME_DATA`, `samG2P()`, or `synthesizeSamAudio()` from the in-file formant synth.
- **2026-05-18T09:24:45.011+02:00 — C64 settings regression pattern:** The C64 panel in `.github/extensions/copilot-avatar\content\index.html` is part of the product contract now: voice alone is not enough. QA should expect persisted `c64Voice` plus mouth/pitch/throat/speed-style controls in `main.mjs`, `content\main.js`, and the regression probe, and UI-copy assertions should target visible labels instead of raw migration ids.
- **2026-05-18T09:24:45.011+02:00 — SAM probe false-positive guard:** For the finished `sam-js` migration, the regression probe should key off removed helpers (`SAM_PHONEME_DATA`, `samG2P()`, `synthesizeSamAudio()`) rather than legacy character names like `cylon`/`vader`, because those can remain as honest presets. It should also accept helper-wrapped vendor usage (`buildC64SamInstance()` + `sam.wav(...)`) and combined restore bootstraps (`initialC64Preset`) instead of requiring inline `if/else` assignment blocks.
- **2026-05-18T11:57:44.088+02:00 — Avatar load triage seam:** An immediate post-`reload:true` snapshot can look dead (`canvasCount: 0`, no exported `window.setSquadContext`/`clearSubagents`, only static HTML controls) even when the avatar is just mid-reload. For a real load verdict in this repo, reload extensions, reopen the window, and require `window.__copilotAvatarReady === true` plus one live canvas and the exported window handlers before calling it broken.
- **2026-05-18T13:03:44.655+02:00 — Clippy intro gating seam:** The “It looks like …” preambles belong to `content\main.js` `summarizeForClippy()` / `flushClippySummary()`, but root-turn completion in `.github/extensions/copilot-avatar\main.mjs` is still unsafe unless that path is explicitly guarded for `avatarStyle === 'clippy'`. QA now treats any unconditional `assistant.turn_end` → `flushClippySummary` path as a Copilot regression, and `.github/extensions/copilot-avatar\probe-regression.mjs` carries the lightweight source assertion for it.
- **2026-05-18T13:02:05.771+02:00 — UI visibility repro seam:** In `content\main.js`, weak non-root updates (`setAgentActivity` / `setAgentIntent` / `setAgentThinking` without strong identity) intentionally queue and render nothing; the card appears only once `addSubagent()` or another strong-identity payload reaches `ensureAvatar()`. QA now treats zero visible `.subagent-label` cards after weak updates as expected webview behavior and requires extension-side evidence that `main.mjs` replays `addSubagent` for active agents. The lightweight gate in `.github/extensions/copilot-avatar\probe-regression.mjs` now asserts both sides of that contract.
- **2026-05-18T13:03:44.655+02:00 — Approved Clippy-only summary gate:** The safe contract is now double-guarded: `main.mjs` uses `shouldUseClippySummaryFeedback()` so `assistant.turn_end` only calls `flushClippySummary` in Clippy mode, and `content\main.js` makes both `speakClippySummary()` and `flushClippySummary()` bail out when `!isClippyAvatar()`. For QA in this repo, that is enough evidence that Copilot mode cannot surface the Clippy lead-ins while Clippy still can.
- **2026-05-18T13:02:05.771+02:00 — Background reconciliation false-positive:** A `session.idle` fix is not enough if it only loops existing sub-agent state and prunes stale ids. In this repo, explicit Tony/Howard spawns can still produce zero visible cards because `tool.execution_start` for spawn tools only caches metadata, weak page updates stay queued, and neither `reconcileLiveBackgroundSubagents()` nor `reconcileHydratedBackgroundSubagents()` materializes a missing card. QA now rejects any “background-agent visibility” fix whose probe never checks that the background path can surface unseen agents, not just keep or remove ones already rendered.
- **2026-05-18T13:02:05.771+02:00 — Background identity mismatch seam:** When a card already exists, stale spawn metadata can outrank fresher runtime/background-task identity. In `.github/extensions/copilot-avatar\main.mjs`, `resolveSubagentDisplayFields()` still prefers `spawnMetadata.displayName` over `runtimeDisplayName`/`runtimeAgentName`, and `resolveSubagentTaskSummary()` still prefers `spawnMetadata.description` over `runtimeDescription`; paired with `.github/extensions/copilot-avatar\content\main.js` keeping the old strong `displayName`, a background-task “Vision” can stay rendered as Tony Stark with stale task copy.
- **2026-05-18T13:02:05.771+02:00 — Approved background identity refresh seam:** Peter’s fix closes the Tony→Vision mismatch by caching normalized background-task metadata (`agentId`, display name, task summary/description), materializing missing cards from that cache, and routing Squad lookup through `resolvePreferredSquadAgentMetadata()` so strong runtime/background identity is tried before stale spawn aliases. The lightweight gate now needs to assert the provisional-visibility path plus this runtime-first Squad wrapper; with those checks updated, `.github/extensions/copilot-avatar\probe-regression.mjs` passes 92/92.

## 2026-05-18T07:24:45Z — Cross-Agent Update: SAM Library Migration Complete

**From:** Team orchestration (Shuri, Peter Parker, Howard the Duck)

**What:** SAM text-to-speech engine migration to external sam-js library complete:
- Updated regression probe to validate new `discordier/sam` migration directly
- Scoped UI copy assertions to visible UI strings instead of raw migration identifiers
- Fixed probe false-positives caused by helper-wrapped `sam-js` usage
- Validated external library seam, C64 control persistence, MS_SAM/C64 separation
- Updated `.github/extensions/copilot-avatar/probe-regression.mjs` for new validation contract

**Why:** Ensures QA scope matches implementation reality; prevents false failures on reasonable external-library patterns.

**Team Impact:** Shuri handled frontend webview integration, Peter updated runtime settings. All C64 voice controls properly persisted and validated through external library seam.

## 2026-05-18T11:57:44.088+02:00 — Avatar Load Resilience Fix (Decision Merged)

Team orchestration recorded three related decisions in `decisions.md`:
1. **Vision:** Optional avatar GLB loads must not gate `window.__copilotAvatarReady`; timebox load and fall back to base asset.
2. **Shuri:** Lazy-load sam-js vendor module inside C64 speech path so boot failures don't block avatar canvas.
3. **Howard the Duck:** Approved implementation on QA grounds after repro + regression probe pass (65 passed, 0 failed).

**Cross-agent impact:** The QA trap is now documented: mid-reload snapshots can falsely report load failure. The real acceptance signal is `window.__copilotAvatarReady === true` plus rendered scene and exported handlers, not a single DOM sample during refresh. All three fixes demonstrate the pattern: timebox optional assets, set ready from fallback, load non-critical models in background.

**Team Impact:** The QA trap is now documented: mid-reload snapshots can falsely report load failure. The real acceptance signal is `window.__copilotAvatarReady === true` plus rendered scene and exported handlers, not a single DOM sample during refresh. All three fixes demonstrate the pattern: timebox optional assets, set ready from fallback, load non-critical models in background.

**Files affected:** `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/lib/copilot-webview.js`

## 2026-05-18T13:03:44.655+02:00 — Clippy Feedback Gating Review: Rejection & Escalation

**Status:** ❌ REJECTED (72 passed / 1 failed)

Tested Clippy-only feedback gating implementation and found Copilot mode can still reach intro/status summaries:
- `content/main.js` keeps "It looks like …" strings inside `summarizeForClippy()`
- But `main.mjs` `assistant.turn_end` still calls `flushClippySummary` unconditionally after root messages
- Failing assertion: `Copilot mode cannot reach Clippy intro/status summaries`

**Required revision:** Implementation must guard the `main.mjs` call site by Clippy mode OR make `flushClippySummary()` bail out when avatar style is not `clippy`.

**Escalation:** Clippy-only feedback revision escalated to frontend/runtime specialist — Shuri is locked out for this revision cycle. QA gate (`node probe-regression.mjs`) now enforces 73 assertions across Clippy routing, C64 persistence, and sub-agent visibility contracts.

## 2026-05-18T13:26:10.974+02:00 — Session Close: Sub-agent UI Identity & Visibility Fix Approved

**Status:** ✅ APPROVED

**Final Review Summary:**
- Vision's initial background-visibility proposal: REJECTED (incomplete identity metadata flow + card materialization gaps)
- Background-task identity mismatch complaint: REPRODUCED (stale Tony/Howard spawn aliases blocking fresh Vision identity from appearing on cards)
- Peter Parker's revision: APPROVED (three-part fix: provisional visibility + normalized background metadata + runtime-first Squad resolution)
- Clippy feedback gating re-review: APPROVED (double-guarded gates in both `main.mjs` and `content/main.js` confirmed working)

**Validation Evidence:**
- Background identity refresh: `node probe-regression.mjs` → 92 passed, 0 failed
- Clippy gating: `node probe-regression.mjs` → 81 passed, 0 failed
- Live repro: cards now materialize from background-task snapshots; runtime/background identity now overrides stale spawn aliases

**Decisions merged to `decisions.md`:**
- Sub-agent Background Identity Mismatch (rejected, but identified seam)
- Sub-agent Visibility with Missing agentId (rejected, but identified seam)
- Background Identity Refresh — Peter Parker Revision (approved)
- Clippy Feedback Gating Re-review (approved)
- Vision — Clippy Feedback Gating Decision (approved)
- Peter Parker — Background Identity Should Repair Visible Cards (proposed for next iteration)

**Team Impact:** Squad coordination across Vision, Peter Parker, and Howard the Duck successfully diagnosed and fixed avatar UI convergence bugs. Spawn-alias stale state no longer blocks fresh runtime identity. Background-task snapshots can now materialize missing cards. QA contract updated to validate both identity precedence and card materialization seams.

**Next QA Focus:** Monitor for regressions in:
- Background-task identity updates repainting stale spawn-alias cards
- Missing background-task agents materializing from `session.idle` snapshots
- Clippy mode properly gating intro/status feedback lead-ins in both extension and webview layers
