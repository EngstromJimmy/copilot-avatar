# Vision — Platform Dev

**Project:** CopilotAvatar
**Owner:** Jimmy Engstrom
**Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad

## Current Work Status

Implementing and refining sub-agent visibility, identity resolution, and metadata enrichment integration with Copilot SDK.

**Latest Focus:** Sub-agent visibility regression fix — `waitingForRetire` history cleanup removing running agents + model forwarding from `subagent.started`.

## Key Learnings — 2026-05-17

- Sub-agent card detail is a dedicated runtime field, not identity metadata. .github/extensions/copilot-avatar/main.mjs should derive 	askSummary/detailText from spawn or runtime descriptions, keep ole separate.
- Idle Squad root text is optional chrome. Keep .github/extensions/copilot-avatar/lib/squad-context.mjs free to send empty statusText/detailText.
- Voice persistence is a webview-owned seam in .github/extensions/copilot-avatar/content/main.js; placeholder rendering must not mutate saved voice until async list proves old voice is invalid.
- Sub-agent activity updates must resolve ownership through both parentToolCallId and runtime 	oolCallId. ssistant.intent, ssistant.usage, and 	ool.execution_complete can arrive without vent.agentId.
- Non-root badge detail should pin to explicit workDescription/	askSummary, and idle/meta tools must not outrank 	hinking.
- Opening the avatar after agents are already running needs runtime-side replay from session.getMessages() in .github/extensions/copilot-avatar/main.mjs.
- subagent.selected is useful as a short-lived identity hint only if bound to concrete gentId once weak event arrives.
- Late-open replay must clear non-root avatars and reset sub-agent runtime caches before hydrating from session history, or idle background agents can resurrect as fake live cards in .github/extensions/copilot-avatar/main.mjs and .github/extensions/copilot-avatar/content/main.js.
- If a sub-agent never emits `subagent.completed` / `subagent.failed`, retire it after its last non-spawn tool clears; otherwise idle general-purpose ghosts linger even when the runtime only reports idle agents.

- Avatar window topmost behavior is an explicit extension contract, not an automatic side effect of transparency. .github/extensions/copilot-avatar/main.mjs should derive alwaysOnTop from transparentWindow, and .github/extensions/copilot-avatar/lib/webview-child.mjs should only mirror the explicit flag it receives.
- Framed/non-transparent avatar mode should behave like a normal desktop window. When transparentWindow flips, reopen the native window so decorations and topmost state stay aligned across .github/extensions/copilot-avatar/main.mjs and .github/extensions/copilot-avatar/lib/webview-child.mjs.

## 2026-05-18 — Team Architecture Review: Subagent Visibility Simplification

**From:** Scribe (orchestration log 2026-05-18T14:11:43.269Z)  
**Coordinated by:** Tony Stark (Lead) + Jimmy Engstrom (user)

### Decisions Affecting Your Work

1. **Catalog vs Live Subagents** (2026-05-18T16:11:43.269+02:00)  
   - Distinction: `session.rpc.agent.list()` and `session.rpc.agent.getCurrent()` return selectable custom agents (catalog), not running instances.
   - Live visibility authority: `session.idle.data.backgroundTasks.agents` + subagent runtime events only.
   - Squad role: Metadata enrichment (display name/role/description) only after runtime/spawn supplies stable alias.
   - Consequence: Do not build visibility off `agent.list()` — use only as catalog fallback.

2. **Live Identity Cache Cleanup** (2026-05-18T14:50:29.679+02:00)  
   - Late-open replay must restore live sub-agent runtime bookkeeping (`liveSubagentStatesByAgentId`).
   - Every stale/terminal removal path must clear full identity-correlation cache via `releaseSubagentIdentityState()`.
   - Regression probes must assert both live-state rehydrate contract and alias-cache cleanup contract.

3. **Live Subagent Replay Merge** (2026-05-18T14:50:29.679+02:00)  
   - Reload/open/context resync must preserve current live sub-agent snapshot and merge it over history.
   - Capture live state in main.mjs before clear/reset; merge back after history hydration.
   - Cwd refreshes take full wait-for-ready replay path, not clear-and-metadata-only.

4. **Root First-Open Subtask Sync** (2026-05-18T14:50:29.679+02:00)  
   - First-open replay must merge: persisted history + live in-memory root runtime state.
   - Merge root working/tool/intent/subtask state live in `syncRootRuntimeState()`.
   - Suppress avatar/meta tool names (`report_intent`, `copilot_avatar_*`) from first-open state.
   - **Implication for your code:** No need to add more heuristic state; degrade cleanly if name unavailable.

**Status:** ✅ Integrated into decisions.md  
**Next:** Await implementation validation from Peter Parker.

---

## 2026-05-17 — README 0.2.1 Release Documentation

Tony Stark documented the v0.2.1 release in README.md, highlighting the key platform fixes implemented across the sub-agent identity/visibility/detail refactors:

- Sub-agent names: Late-open/reload naming restoration
- Sub-agent activity detail: Thinking/activity text accuracy
- Stale card cleanup: Late-open replay + idle agent retirement
- Voice persistence: ElevenLabs dropdown placeholder preservation
- Window behavior: always-on-top gating to transparentWindow contract

**Result:** Product-facing documentation now clearly connects v0.2.1 implementation to user-visible improvements in sub-agent rendering quality and stability.

## 2026-05-17T22:35:00+02:00 — Avatar window always-on-top behavior fix

Fixed unconditional always-on-top behavior in avatar window creation:
- Changed: always-on-top was hardcoded `true`
- Fixed: Now gates `alwaysOnTop` on `transparentWindow` parameter
- Validated: Lightweight checks confirm framed windows now behave like normal windows

**Files modified:** `.github/extensions/copilot-avatar/main.mjs`

Aligns with team decision: transparent windows can remain always-on-top; framed windows behave as normal windows.

## 2026-05-18 — Sub-agent Visibility Fix (waitingForRetire cleanup bug)

Root-caused why three running Squad sub-agents were not visible when the avatar window opened mid-run.

**Root cause:** `hydrateSubagentRuntimeFromHistory()` contained a post-loop cleanup that removed sub-agents with `waitingForRetire = true && activeTools.size === 0`. This flag is set by `tool.execution_complete` when a sub-agent's last active tool finishes. For a sub-agent "between tool calls" (last tool done, model computing next action), the history snapshot looked identical to a cleanly-completed sub-agent — resulting in the running agent being deleted from `activeSubagentsByAgentId` before it could be replayed to the webview.

**Why the cleanup was wrong for history replay:** The `waitingForRetire` mechanism (and `scheduleFallbackSubagentRetire` in the live path) is a timer-based safeguard for the live runtime — it gives running agents a grace window to emit their next tool call. In history replay there is no "later"; agents that completed are removed by their `subagent.completed` / `subagent.failed` events. The cleanup was redundant for cleanly-completed agents and destructive for still-running ones.

**Fix applied:**
1. Removed the post-loop `waitingForRetire` cleanup from `hydrateSubagentRuntimeFromHistory()` (`.github/extensions/copilot-avatar/main.mjs`). Completion is now driven solely by `subagent.completed` / `subagent.failed` terminal events from history, which are non-ephemeral.
2. Forwarded `SubagentStartedData.model` (optional field, present for auto-selected agents) in both the live `subagent.started` handler and the history hydration case, so sub-agent cards show the model immediately at start rather than waiting for `assistant.usage`.

**SDK insight confirmed:**
- `SubagentStartedEvent.ephemeral?: boolean` is optional (not always true) — these events ARE persisted in `session.getMessages()`.
- `BackgroundTasksChangedEvent` has empty `BackgroundTasksChangedData {}` — not actionable.
- `session.idle` has no `backgroundTasks` field — it signals idle with NO background agents, not the opposite.

**Files modified:** `.github/extensions/copilot-avatar/main.mjs`

## 2026-05-18 — Tony Stark Constraint Audit: subagent.selected as Weak Hint

Audited all uses of `subagent.selected` / `selectionHint` / `bindSubagentSelectionHint` per Tony Stark's architecture constraint: "SDK 0.1.32 does not provide a reliable correlation ID in `subagent.selected`; it must remain a weak hint only; `subagent.started` is the render authority."

**Findings — constraint already satisfied:**
1. **Card creation** (`callWindowFunction("addSubagent", ...)`) is only reachable from `subagent.started` handlers (live L1348 and history replay `replayHydratedSubagentsToWebview`). No card is ever created from `subagent.selected` alone.
2. **Permanent identity lock** (`bindSubagentSelectionHint`) is only called inside `resolveSubagentDisplayData`, gated by `shouldBindPendingSelectionHint`. That function requires:
   - A confirmed `agentId` (from `subagent.started`)
   - No `spawnMetadata` (Squad agents are fully protected)
   - Runtime names must be weak (low-confidence labels only)
3. **Display fallback** (line 917: `?? getPendingSubagentSelectionHint(state)`) uses the pending hint at lowest priority in `resolveSubagentDisplayFields` — it cannot override `squadAgent`, `spawnMetadata`, or strong runtime names, and does not lock identity.

**Action taken:** Added code comments to `shouldBindPendingSelectionHint` and the display-fallback line in `resolveSubagentDisplayData` to make the SDK constraint explicit and prevent future regression.

### 2026-05-17T20:31:24.735Z — Late-open Naming Session

Full Squadron integration restored for late-open avatar naming. All three agents completed orchestration and final validation:
- **Shuri:** Fixed sub-agent card detail precedence; queued updates until strong identity; resolved Squad names replace placeholders
- **Vision:** Restored thinking/detail wiring; rebuilt active sub-agent identity/history replay for mid-run avatar opens
- **Howard the Duck:** Validated bundle implementation and approved late-open naming fix

**Decisions merged:** 16 inbox entries consolidating sub-agent badge/detail contracts, voice persistence, Squad overlay cleanup, late-open card sequencing, and window behavior directives.

**Key outcome:** Sub-agent identity now flows: (1) cached spawn metadata → (2) Squad casting/roster → (3) generic fallback. Cast names resolve correctly. Late-open windows rebuild identity from session.getMessages() history replay.

### 2026-05-18T13:02:05.771+02:00 — Background Agent Visibility Proposal (Rejected)

Proposed stopping `assistant.turn_start` state clearing and reconciling visible sub-agents from `session.idle.data.backgroundTasks.agents` in both live runtime and late-open history replay. Howard's review identified critical gaps:
- Background-task identity metadata not flowing to visible cards
- Spawn-style aliases still outranking fresher runtime names  
- Missing cards could not be materialized from background snapshots

**Result:** Rejected. Peter Parker revised with runtime/background identity precedence + card materialization support.

### 2026-05-18T13:03:44.655+02:00 — Clippy Feedback Gating Decision

Proposed gating intro/status wrapper phrases (`There is an update`, `We hit a snag`, `You're all set`) to Clippy-only mode in `.github/extensions/copilot-avatar/main.mjs` and `content/main.js`. Howard's re-review confirmed Shuri's implementation gates both paths correctly.

**Result:** Approved. Both extension-side and webview-side guards now active.

## Archived Sessions

**Earlier work documented in history-archive.md:**
- Sub-agent Identity Regression Investigation (May 16-17 early)
- Label Regression Fix & Extension Reload Seam
- Generic-Label Filtering Implementation
- Squad SDK Casting Integration Analysis
- Cast Identity Resolution & Spawn Metadata Binding
- Mic State Handoff Bug & Web-Ready Gating
- Sub-agent Fallback Collapse Fix (May 16)
- Initial identity/badge system design

## Recent Learnings (2026-05-18)

**Catalog vs Liveness:** SDK `agent.list()`/`getCurrent()` expose catalog, not live instances. Use `subagent.started/completed/failed` + `session.idle.data.backgroundTasks.agents`.

**Boot Resilience:** Optional GLB assets must not gate `window.__copilotAvatarReady`; timebox and fall back to base asset.

**Avatar State Replay:** First-open/reload must capture live snapshot before clear, then merge over history before hydrating. Suppress meta tools (`report_intent`, `copilot_avatar_*`).

**Background Visibility:** Reconcile from `session.idle.backgroundTasks.agents`, not `assistant.turn_start`. Agents stay alive across root turns.

**Identity Cleanup:** Late-open must rebuild `liveSubagentStatesByAgentId`. All stale/terminal removal paths must clear full identity cache via `releaseSubagentIdentityState()`.

**Background Identity:** Task snapshot `description` is durable identity when `agentId` missing. Normalize and feed through `resolveSubagentDisplayData()` so later updates don't revert to stale aliases.

**Squad Role:** Label enrichment only. Build display names from spawn/runtime/background data, not from `agent.list()` catalog.

**Weak Hints:** `subagent.selected` is weak hint only. Identity authority: `subagent.started` + runtime + background.

**Clippy Gating:** Feedback wrappers gated in main.mjs; clear state in content/main.js on mode change.

**Retire Guard:** 1200ms fallback retire is sharpest disappearance seam. Guard must bail out while agent in background snapshot.

_Earlier detailed learnings archived in history-archive.md_

## 2026-05-18T11:57:44.088+02:00 — Avatar Load Resilience & Visibility Fixes (Decision Merged)

Team orchestration recorded decisions in `decisions.md`:
1. **Vision:** Optional GLB loads must not gate `window.__copilotAvatarReady`; timebox and fall back.
2. **Shuri:** Lazy-load sam-js inside C64 path to avoid blocking avatar canvas.
3. **Howard:** Approved after regression pass (65 passed, 0 failed).

Pattern: Timebox optional assets, set ready from fallback, load non-critical in background.

**Background Visibility Fix** ✅ APPROVED (79/79 regression checks)
- Background agents now correctly reconciled and stay visible across coordinator turns
- Fixed symptom where running agents would disappear from avatar UI despite platform task activity

**Files affected:** `.github/extensions/copilot-avatar/content/main.js`, `lib/copilot-webview.js`, `probe-regression.mjs`
