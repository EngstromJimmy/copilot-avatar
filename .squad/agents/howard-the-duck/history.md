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

Probe suite hardened to 74/74 for Peter's confirmed full SAM formant implementation. All groups complete. Awaiting next test campaign.

## Recent Sessions

### 2026-05-18 — SAM TTS Regression Coverage Completion (COMPLETED)
- **Agent:** howard-the-duck-1
- **Status:** Delivered final regression test suite with 74/74 passing probes
- **Scope:** SAM browser-only/no-network constraints, persistence, sub-agent visibility, late-open replay, weak-hint selection
- **Commits:** f820751, 74404dd, 0f30416
- **Validation:** All regression vectors exercised; ready for integration

### 2026-05-18 — Peter's SAM Formant Implementation Pass — Probe Hardening (COMPLETED)
- **Task:** Harden Groups 3 and 13 for Peter's confirmed full formant synthesizer (removed seam-agnostic relaxations from Shuri's pass)
- **Group 3:** Added `synthesizeSamAudio`, `audioBufferToWavDataUrl`, `SAM_PHONEME_DATA` assertions; added SAM_VOICES schema check (pitch/formantShift/rate per entry)
- **Group 13:** Restored `OfflineAudioContext` assertion; made `samG2P` absence a hard failure (function confirmed present at 2820 chars, pure text transform)
- **Outcome:** 74/74 passing. Committed `0f30416`.
- **Key fact:** `samG2P` is 2820 chars, no fetch/XHR/WebSocket — pure deterministic G2P. `SAM_VOICES` schema: `{ id, name, pitch, formantShift, rate }` × 6.

### 2026-05-18 — SAM TTS + Sub-Agent Visibility Regression Probe (COMPLETED)
- **Task:** Write regression coverage for SAM TTS (feat/microsoft-sam-tts) and sub-agent visibility miss
- **Scope:** Full source audit of SAM TTS + sub-agent replay paths; wrote `probe-regression.mjs`
- **Outcome:** 49/49 probes green. Documented multi-root-turn sub-agent visibility miss as a known coordinator risk. SAM: custom Web Audio formant engine, no external deps, persistence ordering correct, all UI hooks wired.
- **Probe file:** `.github/extensions/copilot-avatar/probe-regression.mjs`

### 2026-05-17 — SAM Branch Handoff Verification
- **From:** Scribe (Session Logger)
- **Status:** Branch switch (eat/microsoft-sam-tts) verified clean and ready
- **Outcome:** Worktree clean; handoff to Jimmy Engstrom confirmed

### 2026-05-17T22:31:24 — Late-open Naming Session (COMPLETED)
- **Outcome:** Full Squadron integration restored; late-open naming implementation approved
- **Validated By:** Howard the Duck with source + live testing
- **Decisions Merged:** 16 inbox entries consolidating sub-agent contract decisions

### 2026-05-17T19:25:39 — Mic Capsule Geometry Fix (APPROVED)
- **Problem:** Capsule corrupted (0.0264, 0.0572) → corrected to (0.024, 0.052)
- **Validation:** Node syntax check passed; Squad gating and face-clearance offsets intact
- **Status:** Safe data corruption bug fix

---

For detailed archived context, see history-archive.md.
