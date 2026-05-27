# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Current Work Status

Revised avatar sub-agent visibility and identity integration following QA feedback on background-task metadata flow and card materialization.

**Latest Focus:** Simplify sub-agent runtime state model per team architecture review.

---

## 2026-05-18 — Team Decision: Simpler Subagent Runtime Model

**From:** Scribe (orchestration log 2026-05-18T14:11:43.269Z)  
**Coordinator:** Tony Stark (Lead)

### Your Task

**Proposal:** Simplify subagent runtime state into one canonical card model keyed by visible owner (`agentId` when known, otherwise `pending:${toolCallId}`).

**Target Architecture:**
- One visible-card state map (collapse current `toolAgentIdsByToolCallId`, `subagentSpawnMetadataByAgentId`, `backgroundAgentMetadataByAgentId`)
- Minimal alias maps for runtime `agentId` and `toolCallId` (replace multi-stage hydrated-state rebinding caches)
- One spawn/runtime correlation seam
- One late-open replay path
- One optional Squad enrichment lookup

**Benefits:**
- Eliminates duplicated live/history reducers and fuzzy pending-to-background matching
- Removes racing state maps and heuristic caches
- Clearer identity ownership seam

**Risky Seam to Delete:**
- Fallback positional bind in `bindPendingStartedSubagentsToBackgroundAgents()` — can reassign wrong visible owner when multiple pending cards exist.

**Status:** ✅ Proposal logged in decisions.md  
**Next:** Implementation review, coordinate with Vision for catalog/live distinction.

---

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

## Learnings

- 2026-05-18T16:11:43.269+02:00 — The Copilot SDK surface used here does not expose a direct "list subagents" call; the extension reconstructs current sub-agents from `session.getMessages()` and from `session.idle.data.backgroundTasks.agents` in `.github/extensions/copilot-avatar/main.mjs`.
- 2026-05-18T16:11:43.269+02:00 — Current sub-agent identity flow in `.github/extensions/copilot-avatar/main.mjs` is spread across visibility aliases (`subagentIdsByToolCallId`, `runtimeSubagentVisibilityIdsByAgentId`), runtime tool correlation (`toolAgentIdsByToolCallId`), spawn hints, weak selection hints, and background metadata caches.
- 2026-05-18T16:11:43.269+02:00 — Squad naming is metadata-only: `.github/extensions/copilot-avatar/lib/squad-context.mjs` loads roster/config/casting into `agentsByKey`, and `resolveSquadAgentMetadata()` can decorate a live sub-agent only after runtime or spawn data provides a stable lookup key.
- 2026-05-18T16:11:43.269+02:00 — Jimmy's current preference is simplicity over aggressive rebinding: the product goal is to show the real current sub-agents, then let Squad supply the human names when possible.
- 2026-05-27T09:34:17.883+02:00 — In `.github/extensions/copilot-avatar/extension.mjs`, the real activation seam must block on `await import("./main.mjs")`; fire-and-forget dynamic import can let the entry module resolve before `main.mjs` finishes `extension.createSession(...)`.
- 2026-05-27T09:34:17.883+02:00 — The SDK migration contract applies to both session paths here: `.github/extensions/copilot-avatar/main.mjs` and `.github/extensions/copilot-avatar/lib/copilot-webview.js` both need `extension.createSession({ onPermissionRequest: approveAll, ... })`.

## 2026-05-27T09:34:17.883+02:00 — Entrypoint/Bootstrap Revision & Approval

**Your Contribution:**
Revised extension by:
1. Awaiting main.mjs import in `extension.mjs` (blocking activation pattern)
2. Restoring `onPermissionRequest: approveAll` on bootstrap session in `lib/copilot-webview.js`
3. Extending `probe-regression.mjs` to exercise activation path with stubbed import

**Result:** Howard approved; 140/140 regression tests passing.

**Decision Authored:** Decision 3 — Keep avatar entrypoint activation blocking & mirror approveAll on bootstrap

**Impact:** Extension activation pattern restored to blocking semantics. Bootstrap and main session creation now share identical permission contract. Regression coverage now includes real entry module shape verification.
