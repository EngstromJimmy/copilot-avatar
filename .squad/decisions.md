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

