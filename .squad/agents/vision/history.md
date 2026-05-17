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
