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

