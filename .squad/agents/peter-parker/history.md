# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Current Work Status

Revised avatar sub-agent visibility and identity integration following QA feedback on background-task metadata flow and card materialization.

**Latest Focus:** Background identity refresh — runtime/background agent names and descriptions now outrank spawn-tool aliases, with card materialization from background-task snapshots.

---

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

## 2026-05-18T13:02:05.771+02:00 — Background Identity Refresh Revision — Approved

**From:** Howard the Duck review and approval

**What Delivered:** Revised Vision's rejected sub-agent UI artifact with three critical repairs in `.github/extensions/copilot-avatar/main.mjs`:
1. Provisional visible owners for `subagent.started` without `event.agentId`, then `bindPendingStartedSubagentsToBackgroundAgents()` + `reconcileLiveBackgroundSubagents()` / `reconcileHydratedBackgroundSubagents()` to materialize missing cards from background snapshots
2. Normalized background metadata caching (`normalizeBackgroundAgentMetadata`, `cacheBackgroundAgentMetadata`, `buildBackgroundSubagentPayload`) so runtime/background display name + task summary survive into card payloads
3. `resolvePreferredSquadAgentMetadata()` and runtime-first display/task-summary resolution so fresh Vision-style identity and description beat stale Tony-style spawn hints

**Evidence:** Source review approved; lightweight probe: `node probe-regression.mjs` → 92 passed, 0 failed

**Team Impact:** Approved. When the platform finally knows "this is Vision and here's what Vision is doing," the avatar now updates the card to Vision, uses the newer task text, and can even create the card if the UI never got the first render event.

## 2026-05-18T13:26:10.974+02:00 — Background Identity Should Repair Visible Cards — Proposed

**Status:** Proposed for next iteration

**What:** Cache richer background-task snapshots (`agentId`, runtime name/display name, description/task summary) and use them to repair or materialize visible cards. Spawn-tool hints still bootstrap ambiguous starts, but must stop outranking fresher background/runtime identity once the platform provides stable owner.

**Why:** Jimmy's repro showed runtime task list on `Vision` while UI stayed on `Tony Stark` — stale spawn aliases were still winning after better runtime identity existed.

**Impact:** Late-open reloads and background-task carries will converge on same agent names/detail text the runtime exposes, instead of leaving old cast aliases stuck on screen.

