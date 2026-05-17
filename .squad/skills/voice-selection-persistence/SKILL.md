---
name: "voice-selection-persistence"
description: "Protect persisted voice selections when async voice lists reload or the active TTS engine changes."
domain: "testing, extension-ui"
confidence: "high"
source: "earned"
---

## Context
Use this when CopilotAvatar changes touch speech settings, per-engine voice pickers, or any async refresh of selectable voices. The failure mode is sneaky: persistence code can look correct while a loading placeholder quietly overwrites the saved selection before the real options arrive.

## Patterns
- Persist each engine's voice selection independently and include all of them in every save payload.
- During async voice-list refresh, never blank the in-memory saved selection just to render a loading or empty placeholder.
- Make the async list renderer accept an explicit "preserve selection" path for placeholder states, so loading/error UI can change without mutating persisted voice state.
- On engine switch, avoid saving state after a destructive placeholder refresh; preserve the prior voice until the refreshed list confirms whether it is still valid.
- If the saved voice is missing from the refreshed list, fall back explicitly after validation and persist only that deliberate fallback.
- Validate two weird paths every time: reload/reopen with the engine already set to the async provider, and engine switching into that provider from a different engine.
- Add a minimal repro for the placeholder phase itself; if the saved value survives only after the fetch completes, the bug is still alive.

## Examples
- `.github/extensions/copilot-avatar/main.mjs` merges new settings over the existing `.tts-settings.json` payload, so per-engine voice fields can persist together.
- `.github/extensions/copilot-avatar/content/main.js` can expose `populateElevenLabsVoices(voices, { placeholder, preserveSelection })` so `Loading ElevenLabs voices...` does not overwrite `elevenlabsVoice`.
- `.github/extensions/copilot-avatar/content/main.js` should not let `populateElevenLabsVoices([], { placeholder: 'Loading...' })` clear `elevenlabsVoice` before the fetched list arrives.
- `.github/extensions/copilot-avatar/content/main.js` engine-change handling should preserve `voice`, `voxtralVoice`, and `elevenlabsVoice` while only changing `engine`.
- A lightweight regression probe can extract the real `populateElevenLabsVoices` function into a fake-select harness and assert that `voice-b` survives the `Loading...` placeholder phase before the real ElevenLabs list restores the matching option.

## Anti-Patterns
- Clearing a saved voice as part of a loading placeholder.
- Saving immediately after switching engines when the new engine's async options have already blanked the selection.
- Treating "first option in the refreshed list" as a valid persisted fallback without first proving the saved voice is gone.
- Signing off on persistence based only on the save function while ignoring async UI repopulation code.
