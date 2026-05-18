# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## 2026-05-16T14:02:40.457Z — Session Complete: Approved Sub-Agent Identity & Badge Fix

**Status:** ✅ Approved by Howard the Duck

**Team:** Tony Stark (Lead), Vision, Peter Parker, Shuri, Howard the Duck (QA)

**Role:** Implemented runtime state reset mechanism to clear cached sub-agent state on session/context boundaries.

**Summary:** Part of multi-agent identity & badge system fix. Designed and implemented `resetSubagentRuntimeState()` to clear extension's cached maps on session starts and context changes, paired with webview `clearSubagents({ preserveRoot: true })` to dispose non-root avatars and prevent stale Squad cards from replaying into non-Squad views.

**Key Contribution:**
- Created reset mechanism that fires before any backfill/sync calls
- Verified model sync, cast names, and badge activity still work after reset
- Confirmed no Squad label leakage into non-Squad contexts

**Files Modified:**
- `.github/extensions/copilot-avatar/main.mjs` — resetSubagentRuntimeState() implementation
- `.github/extensions/copilot-avatar/content/main.js` — clearSubagents() webview handler

**Validation:** Targeted regression probes passed; syntax smoke tests passed; all QA gates approved by Howard the Duck.

## 2026-05-16T13:42:38.842Z — Proposed Casting Slots for Squad Avatar Names

**Status:** ✅ Incorporated into approved solution

**What:** Proposed using `.squad/casting/history.json` slot aliases to bridge runtime agent names to Squad roster cast identities.

**Insight:** Squad roster files are keyed by cast names like `Peter Parker`, while runtime lifecycle events identify agents by:
- Durable slot names like `backend-dev` (in `agentName` / `agentDisplayName`)
- Opaque per-run handles like `agent-call_H` (in `agentId`)

Solution: Load the latest casting snapshot into the roster lookup to keep avatar labels human-readable without leaking transient IDs.

**Outcome:** Shuri's approved implementation incorporates this design; casting alias loading now wired into `resolveSquadAgentMetadata()` in `squad-context.mjs`.

## Learnings

- 2026-05-16T21:04:02.794+02:00 — In `.github/extensions/copilot-avatar/main.mjs`, hidden sub-agents stay stable when `assistant.intent` only updates cached badge text and never flips visibility evidence; first visibility should come from stronger current-turn signals like tool execution, while reasoning and replay stay non-promoting.
- 2026-05-16T21:23:20.636+02:00 — Keep badge fallback on a dedicated task summary instead of roster/charter description, and retire visible sub-agents shortly after their last tool clears if no terminal event arrives; that stops same-turn ghost cards and prevents role text from leaking into the lower badge.
- 2026-05-16T21:40:19.370+02:00 — In `.github/extensions/copilot-avatar/main.mjs`, treat the parent `task` wrapper as spawn metadata for hidden agents, not first-visibility evidence. Let it keep names/briefs warm in state, but wait for a non-`task` tool before rendering the card so wake-up pings do not flash a wall of sub-agents.
- 2026-05-16T22:02:45.479+02:00 — `report_intent` tool calls can be just as weak as the `task` wrapper for first visibility. They often fire from reactivated idle Squad agents during prompt startup, so cache the gerund text but keep hidden cards suppressed until a stronger tool arrives.
- 2026-05-16T22:06:13.919+02:00 — Stable-identity dedupe needs a live-work escape hatch. If two runtime instances with the same cast identity are both actively running tools, keep both cards; when collapse is still needed, merge the richest shared metadata into the surviving owner so the visible name does not blank out.
- 2026-05-16T22:45:02.806+02:00 — If visibility heuristics regress into an empty avatar, bias back toward rendering on `subagent.started` and any tracked tool activity first, then let duplicate collapse and metadata cleanup keep the UI sane. In this extension, undercounting active agents is a worse UX failure than briefly showing extra cards.
- 2026-05-16T22:45:02.806+02:00 — Fallback retirement is safer at root `assistant.turn_end` than per-tool completion. A sub-agent can finish one tool and still be actively running the broader task, so clearing its card on `tool.execution_complete` makes live work disappear mid-turn.
- 2026-05-16T22:45:02.806+02:00 — For this avatar, stale-active cards are less harmful than disappearing live work. If the runtime has not sent `subagent.completed` / `subagent.failed` yet, keep the card visible and let the next directive-boundary reset clean up leftovers instead of guessing from quiet gaps.
- 2026-05-18T00:04:39.350+02:00 — SAM TTS runs entirely in the browser via `sam-js@0.3.1` (MIT, jsdelivr CDN) using the `wav()` method. The output is a `Uint8Array` WAV blob, played via an `HTMLAudioElement` exactly like the Voxtral/ElevenLabs path — this keeps `stopGeneratedSpeechPlayback()` and `ttsAudioPlayer` working without extra plumbing. Voice presets (SAM, Elf, Cylon, Vader, Stuffy, Gruff) are static constants so no async fetch is needed; `populateSamVoices()` fires once at init. Persistence follows the same `saveTtsSettings` / `savedTts.samVoice` pattern as all other per-engine voice fields.
- 2026-05-18T07:57:31.584+02:00 — The voice split now keeps `voice`, `msSamVoice`, and `c64Voice` separate in `.github/extensions/copilot-avatar/content/main.js`, with `.github/extensions/copilot-avatar/main.mjs` migrating legacy `engine: 'sam'` / `samVoice` settings to `c64` / `c64Voice`. `MS_SAM` stays browser-only by ranking local `speechSynthesis` voices toward classic Windows-family names (Mike, Mary, Sam, David, Mark, Zira), while the old formant presets remain explicit under the `C64` engine.
- 2026-05-18T09:24:45.011+02:00 — For browser-only packages in this extension, keep the dependency in `.github/extensions/copilot-avatar/package.json`, expose it through a narrow allowlisted path in `.github/extensions/copilot-avatar/lib/copilot-webview.js`, and persist any engine-specific controls (`c64Voice`, `c64Speed`, `c64Pitch`, `c64Throat`, `c64Mouth`) in both `.github/extensions/copilot-avatar/main.mjs` and `.github/extensions/copilot-avatar/content/main.js` so preset picks and manual slider tweaks survive reloads.

## 2026-05-17T22:04:39Z — Scribe: SAM TTS Engine Decision Consolidation

**From:** Scribe (Session Logger)

**Context:** Your SAM TTS engine implementation work has been consolidated with Shuri's frontend implementation and Tony's architectural review into a single canonical decision in .squad/decisions.md.

**Decision Recorded:** Microsoft SAM Text-to-Speech Engine Implementation (2026-05-17T22:04:39Z)

**What You Delivered:**
- sam-js@0.3.1 (MIT-licensed) loaded via jsdelivr ESM CDN importmap
- Voice presets: SAM Default, Elf, Cylon, Darth Vader, Stuffy, Gruff defined as {id, name, speed, pitch, throat, mouth}
- Audio pipeline: SamJs.wav() returns Uint8Array WAV wrapped in blob URL, played through Audio element (matches Voxtral/ElevenLabs pattern)
- No new AudioContext plumbing required; existing ttsAudioPlayer and activeGeneratedAudioUrl seams work unchanged
- No async fetch for voices; static presets eliminate race conditions

**Architecture Gate:** Approved by Tony Stark as legitimate MIT-licensed browser-native SAM engine with no remote/questionable-license dependencies.

**Team Impact:** Implementation pattern now codified for future browser-native TTS engines with static voice options: constant list → populate*Voices() at init → section div in HTML → speak*() function with blob URL output. Full decision documented in .squad/decisions.md; orchestration logged in `.squad/orchestration-log/2026-05-17T22-04-39Z-{tony-stark,shuri}.md`.

## 2026-05-16T19:23:20Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

**Cycle Status:** Complete
**Contributors:** Tony Stark (lead), Howard the Duck (review), Peter Parker (implementation)

**Key Decisions:**
- Stale sub-agent cards retire on work completion (no terminal event required)
- Visible sub-agent identities collapse to single stable identity
- Badge metadata removed from role text, kept in task-summary/activity text

**Tests:** All smoke checks and regression assertions passed.
**Next:** Integration ready.

## 2026-05-16T19:55:02Z — Task Wrapper Visibility Gate Approved & Merged

**Status:** ✅ Approved by Howard the Duck

**Session Outcome:** Task wrapper visibility fix merged into team decisions. Hidden sub-agent cards now stay hidden during spawn/wake-up orchestration chatter, render only on actual non-task work.

**Cross-Agent:** Howard the Duck reviewed and approved the prompt-start flash-flood fix, confirming this work addresses the weak-signal promotion path.

**Implementation Seam Confirmed:**
- Keep `task` wrapper state in runtime maps (identity, model joins, spawn hints)
- Skip first-time visibility on hidden agents when tool is `task`
- Cards appear only after non-`task` tool proves actual work

**Effect:** No more card wall on new Squad prompts during handoff phase.

## 2026-05-16T22:06:13.919+02:00 — Concurrent Identity & Weak Signal Decisions Recorded

**Scribe Cross-Agent Update:**

Two critical decisions merged to `decisions.md`:

1. **Do not collapse actively working duplicate identities into one card** — Fixed the visible undercount regression where cards were collapsing purely by stable identity, squashing two real live tasks into one and letting the survivor inherit weaker metadata. Now: keep same-identity cards visible while both have live work; when collapse is still needed, merge the richest available name/role/description metadata into the surviving owner so the card name doesn't blank.

2. **Treat `report_intent` as weak first-visibility evidence** — For hidden sub-agents, handle `report_intent` like the `task` wrapper: cache any intent text it carries, but do not render a card. Prevents prompt-start card floods from idle-agent reactivation events that emit `report_intent` before real work.

**Implementation Impact:** 
- `.github/extensions/copilot-avatar/main.mjs` — concurrent live same-identity states now coexist; metadata merge preserves best names during collapse
- `.github/extensions/copilot-avatar/content/main.js` — only prunes duplicates once both are no longer doing live work

**Status:** Decisions recorded. Ready for implementation or integration with Tony Stark's debounce work.

## 2026-05-16T22:03:54Z — Cross-Agent Update: Avatar Visibility Model Documentation

**From:** Vision (Platform Dev)

**What:** README updated to document the sub-agent visibility model:
- Copilot SDK owns all visibility and lifecycle events
- Squad metadata enriches visible cards only (no creation/suppression)
- Ghost/fallback duplicates eliminated; rendered agents match active Copilot set

**Why:** Clarify contract with users and maintainers about ownership model.

**Team Impact:** All agents now have clear reference for how Copilot and Squad interact in sub-agent visibility.

## 2026-05-18T05:57:31Z — Cross-Agent Update: Voice Engine Naming — C64 vs MS_SAM Decision

**From:** Scribe (Session Logger) per Tony Stark (Lead)

**Decision:** Rename existing browser synth to `C64`; reserve `MS_SAM` for truly separate implementation.

**Your Action Items:**
1. Rename current `sam` engine to `c64` in `.github/extensions/copilot-avatar/content/main.js` with migration path for persistence keys (old `samVoice`/`engine: 'sam'` → new `c64Voice`/`engine: 'c64'`)
2. Reserve `MS_SAM` only for distinct seam (e.g., browser OS `speechSynthesis` with actual Microsoft voice)
3. Do not relabel current formant synth as `MS_SAM`
4. Explicit UI text: browser-native, retro, no API key, avoid "authentic Microsoft SAM" claims
5. If time is short, prefer honest cut now over mislabeled implementation

**Why:** Current engine is original Web Audio formant synth (`SAM_PHONEME_DATA`, `samG2P()`, `synthesizeSamAudio()`) — honest lineage is C64-style retro, not Microsoft SAPI. Preset list (`sam`, `elf`, `cylon`, `vader`, `stuffy`, `gruff`) reads retro. No proprietary voice assets involved. Prevents false attribution.

**Files to Update:** `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/content/index.html`, `.github/extensions/copilot-avatar/main.mjs`

**Status:** Documented in decisions.md and orchestration log. Ready for implementation.

## 2026-05-18T07:24:45Z — Cross-Agent Update: SAM Library Migration Complete

**From:** Team orchestration (Shuri, Peter Parker, Howard the Duck)

**What:** SAM text-to-speech engine migration to external sam-js library complete:
- C64 settings persistence implemented (c64Voice, c64Speed, c64Pitch, c64Throat, c64Mouth)
- Legacy `engine: 'sam'` / `samVoice` migration logic to new `c64` / `c64Voice` identifiers
- Runtime/config persistence aligned with external library requirements
- Webview vendor route configured in lib/copilot-webview.js
- sam-js from discordier/sam integrated into package.json dependencies

**Why:** Delivers honest external-library implementation, removes custom synth maintenance burden, follows existing persistence patterns.

**Team Impact:** Shuri handled frontend webview integration, Howard updated regression probe contract. All C64 voice controls now routed through external library, settings persist properly across sessions.
