# Squad Decisions

## Active Decisions

### 2026-05-16: Sub-agent visibility during Squad spinup — initialization strategy decision

**By:** Tony Stark (Lead)

**What:** CopilotAvatar extension silently loses subagent display updates when they fire before the webview window is opened. Need to decide between two fundamentally different architectural fixes.

**Root cause:** 
- The webview is never automatically shown — it waits for user action (`/avatar` command)
- Squad agents fire events immediately during spinup
- Event handlers call `callWindowFunction()` which silently fails if webview isn't open
- By the time user opens the window, the events are gone

**Two viable fixes (pick one — they have different tradeoffs):**

**Option A: Auto-show on Squad detection (Simplest, minimal risk)**
- During extension initialization, detect if Squad is active in the cwd
- Automatically call `webview.show()` if Squad found
- Pro: Fixes the immediate problem, one-time cost during init
- Con: Window always opens when Squad is present, even if user doesn't want it visible
- Complexity: Low (~10 lines in main.mjs)

**Option B: Stateful sync on connect (More flexible, more code)**
- Keep track of all subagent state in the extension (create `agentStates` Map in main.mjs)
- When subagent events fire, accumulate in this state Map
- When webview connects (detect via `.show()` or add a `setReady()` handler), sync full state into page
- Pro: Window opens only when user requests; all state is preserved and replayed
- Con: More complex state management, requires bidirectional sync protocol
- Complexity: Medium (~80 lines in main.mjs + content/main.js changes)

**Option C: Hybrid — show only during active spinup (Middle ground)**
- Detect Squad spinup (new agents in rapid succession)
- Auto-show window briefly, then allow user to close
- Fall back to Option A if Squad stays active
- Pro: Visible during work, doesn't clutter idle sessions
- Con: Introduces heuristics, harder to get right
- Complexity: High (event tracking, debouncing, state machine)

**Recommendation:** **Option A** — It's the simplest, clearest, and easiest to maintain. If Squad is running with agents, the avatar should be visible. The cost (always showing the window) is justified by the visibility benefit. If a user doesn't want Squad metadata loaded, they wouldn't have Squad in their cwd.

**Decision:** We will implement **Option A** with the following details:
- In `refreshSessionContext()` (called at startup and on context change), if Squad is detected as active, pre-emptively call `webview.show()` with error handling
- This ensures the window is ready before the first `subagent.started` event arrives
- No state queuing needed — all subsequent calls will succeed

**Blockers:** None — this is a pure extension fix.

**Who owns the implementation:** Frontend specialist should implement this. Will be one method in main.mjs that ensures webview is shown when squadContext.active is true.

---

### 2026-05-16T15:42:38.842+02:00: Sub-Agent Display Name Lookup Fix

**By:** Vision (Platform Dev)

**What:** Fixed sub-agents showing internal IDs like `agent-call_H` instead of Squad roster names (e.g., "Planner", "Coder").

**Root Cause:** 
- Copilot SDK events provide only agentId, not agentDisplayName or agentName
- Squad metadata lookup function (`resolveSquadAgentMetadata`) only tried to match by agentName and agentDisplayName — never by agentId
- Extension's fallback displayName was empty string, so webview fell back to truncating the agentId

**Changes Made:**

1. **main.mjs:278-281** — Enhanced displayName fallback chain:
   - Was: `event.data?.agentDisplayName ?? squadAgent?.displayName ?? event.data?.agentName ?? ""`
   - Now: `event.data?.agentDisplayName ?? squadAgent?.displayName ?? event.data?.agentName ?? (event.agentId || "")`
   - Ensures displayName is never empty; worst case is the actual agentId

2. **main.mjs:272-276, 302-306, 318-322** — All three subagent event handlers now pass `agentId` to `resolveSquadAgentMetadata()`

3. **squad-context.mjs:490-494** — Updated lookup key generation to include agentId:
   ```javascript
   const keys = [
       normalizeAgentKey(agentData.agentName),
       normalizeAgentKey(agentData.agentDisplayName),
       normalizeAgentKey(agentData.agentId),  // NEW
   ].filter(Boolean);
   ```

**Effect:** If a Squad agent's ID/name can be derived from agentId, the roster lookup will find it and use its displayName. If not found, agentId itself (still better than empty) is used.

**Risk Level:** Low. The change only adds a fallback lookup key; it doesn't break existing matching on agentName or agentDisplayName.

---

### 2026-05-16T15:42:38.842+02:00: Squad Sub-Agent Events Silently Lost Before Webview Open

**By:** Vision (Platform Dev)

**What:** Sub-agents do not appear in the avatar UI when Squad spins up agents during a session. The root cause is a **synchronization seam** between the extension and the webview: sub-agent events (from Copilot SDK) are processed and sent to the webview before the window is open. Since the webview hasn't been shown yet, webview._handle is null, and callWindowFunction() silently returns without error or logging.

**Why:** The extension's event handlers for `session.on("subagent.started")` immediately call `callWindowFunction("addSubagent", ...)` without checking if the webview is connected. The `evalWebview()` function checks `if (!webview._handle) return;` and exits silently. This means:
- Sub-agents are never added to the UI if the window isn't open when the event fires
- There is no event queue or retry mechanism at the extension level
- No diagnostic logging of the failure
- The user sees no indication that sub-agents exist; they're just missing from the visual experience

**Scope of Issue:**
1. **Direct:** All sub-agent.started, sub-agent.completed, sub-agent.failed events arriving before webview.show() is called
2. **Secondary:** Tool execution events (tool.execution_start, tool.execution_complete) for sub-agents are also lost
3. **Risk:** Squad feature is invisible unless the user manually opens the avatar window before Squad starts spinning up sub-agents (unlikely in practice)

**Compounding Error Suppression:**
The failure is compounded by aggressive error suppression at three levels:
1. `evalWebview()` (main.mjs:83) silently returns if webview._handle is null
2. `callWindowFunction()` (main.mjs:88) calls `.catch(() => {})`, suppressing all errors
3. `webview.eval()` (copilot-webview.js:143) can reject if socket not connected, but the error is caught and ignored
   
This means failures due to _any_ reason (window not open, page not loaded, eval timeout, runtime error in JS) are completely silent. No logging, no diagnostics, no way to troubleshoot.

**Proposed Framing for Fix (not prescribing a solution):**
The extension needs an **event buffering layer** that:
- Queues sub-agent and tool execution events if webview._handle is null or socket not connected
- Flushes the queue when the webview is fully connected (socket + page ready)
- Logs diagnostic messages when events are queued or flushed (for visibility)
- Reports errors to session.log() instead of silently swallowing them

Alternatively, the extension could wait for webview readiness before registering event handlers, or require the avatar window to be open before Squad features become active.

### 2026-05-16T16:02:40.457+02:00: User directive

**By:** Jimmy Engstrom (via Copilot)

**What:** Show Squad cast names inside sub-agent cards and show what each sub-agent is doing inside the badge, while preserving normal Copilot behavior when Squad is not loaded.

**Why:** User request - captured for team memory

---

### 2026-05-16T16:02:40.457+02:00: Multi-Agent Identity & Badge System Design Review

**By:** Tony Stark (Lead)

**Status:** Design Review Complete — Specification & Ownership Ready

This is a comprehensive refactor of the CopilotAvatar extension's agent display system. Key scope:
- Avatar names show Squad roster names (e.g., "Peter Parker") instead of generic fallbacks
- Badge text shows live activity/tool names, not just activity types
- Model updates sync correctly to sub-agents even with event ordering issues
- Squad metadata propagates to UI but is strictly optional (graceful degradation without Squad)

**File ownership:**
- `lib/squad-context.mjs` — Squad specialist: extend `resolveSquadAgentMetadata` to accept agentId lookup
- `main.mjs` — Tony Stark: event handler consolidation, name resolver, model sync fix
- `content/main.js` — Frontend specialist: badge content priority, Squad UI enhancements

**Acceptance criteria (all must pass):**
1. Sub-agents show roster names (Peter Parker, Tony Stark, etc.) instead of agent IDs
2. Badge shows tool names (grep, edit) when active, not just activity type
3. Model updates arrive within ~3 seconds, even if events arrive out of order
4. Non-Squad sessions still work unchanged (graceful degradation)
5. No errors when Squad metadata is malformed or missing

---

### 2026-05-16T16:02:40.457+02:00: Centralize sub-agent runtime state in the avatar extension

**By:** Tony Stark

**What:** Keep sub-agent display identity on stable Squad metadata, but keep live model/activity/completion state in a per-agent runtime map keyed by `agentId`, then build every webview payload from that single source of truth.

**Why:** Names and models were drifting because different lifecycle events each rebuilt partial payloads with different fallbacks. One runtime seam keeps Squad labels like Tony Stark, Peter Parker, and Howard the Duck stable while still letting tool progress and model updates stay attached to the right live avatar instance.

---

### 2026-05-16T16:02:40.457+02:00: Squad display-name resolver contract

**By:** Vision

**What:** `resolveSquadAgentMetadata()` now stays on stable identity fields (`agentName`, `agentDisplayName`) while the Squad lookup map is enriched with casting-slot aliases from `.squad/casting/history.json` and `.squad/casting/registry.json`. Extension payloads should prefer the resolved Squad display name when a match exists, but otherwise keep normal Copilot labels unchanged.

**Why:** This keeps Squad metadata as optional enrichment instead of a hard dependency, and it removes the hidden coupling between transient runtime ids and human-readable card labels. Tony's event-handler refactor can consume the same payload contract without requiring any frontend change.

---

### 2026-05-16T16:02:40.457+02:00: Reset sub-agent runtime state on session/context boundaries

**By:** Peter Parker

**What:** Clear the extension's cached sub-agent runtime maps whenever a new session starts or the working context changes, and tell the webview to dispose non-root avatars at the same boundary.

**Why:** Squad names, badge activity, and per-agent model lines now ride on cached runtime state. Without an explicit reset, old Squad-backed cards can be replayed into later non-Squad views when the avatar window opens or context refresh sync runs.

---

### 2026-05-16T16:02:40.457+02:00: Sub-agent badges prefer live work details over static labels

**By:** Shuri

**What:** Updated avatar sub-agent cards so display names resolve once in the extension payload, model labels stay visible on sub-agent cards, and badge text prefers active intent or tool-derived activity text instead of falling back to role labels during active work.

**Why:** The old cards looked alive but hid the useful state. Showing the resolved Squad name, current model, and actual work text makes the sub-agent swarm readable without harming generic non-Squad sessions.

---

### 2026-05-16T16:02:40.457+02:00: Howard the Duck — Squad badge repro risks

- **Decision:** Do not call the cast-name/model-badge work done without explicit repro coverage for placeholder SDK labels, slot-alias runtime names, and late-opened avatar windows.

**QA Gate (all must pass):**
1. Squad session shows cast names (`Tony Stark`, `Peter Parker`, `Howard the Duck`) instead of generic tool labels.
2. Non-Squad session still shows a sane generic label rather than cast data.
3. Sub-agent model badge updates on first assignment and on mid-run model change.
4. Badge text tracks live activity/intent, then falls back cleanly after completion or failure.

---

### 2026-05-16T16:02:40.457+02:00: Howard the Duck — Reject stale subagent replay

- **Decision:** Reject this batch for one remaining regression: backend sub-agent state survives past the Squad context that created it, so the avatar can replay stale Squad cards later.

**Required Revision:**
1. Scope replayable sub-agent state to the active session/context, or explicitly clear stale entries on session/context boundaries.
2. Re-verify late-open/backfill after the reset so active sub-agents still hydrate correctly.
3. Re-run the non-Squad fallback check to prove no Squad-only labels leak after a context change.

**Next Revision Owner:** Peter Parker — this is runtime-state ownership in `main.mjs`.

---

### 2026-05-16T16:02:40.457+02:00: Howard the Duck — Approve subagent stale-state fix

- **Decision:** Approve Peter Parker's revision. The stale Squad-card replay path is now closed without sacrificing cast names, live model updates, or badge activity text.

**Why this passes:**
- `main.mjs` now clears `subagentStateById`, `subagentIdsByToolCallId`, `activeToolStatesByToolCallId`, and `pendingSubagentModelsByToolCallId` through `resetSubagentRuntimeState()`.
- Session starts, context changes, and scope drift all route through that reset path before any backfill call to `syncKnownSubagents()`.
- The reset also calls `window.clearSubagents({ preserveRoot: true })`, so the webview drops old non-root avatars instead of replaying stale Squad cards later.
- Squad metadata still resolves slot aliases such as `lead`, `backend-dev`, and `tester` to `Tony Stark`, `Peter Parker`, and `Howard the Duck`.
- Model updates are still fed through `assistant.usage`, `tool.execution_complete`, and `session.model_change`, and badge text in the webview still prefers live tool activity over static idle labels.

**Validation (all confirmed):**
- Syntax smoke: `node --check` on all extension files
- Targeted regression probe:
  - Squad alias resolution inside repo root
  - Non-Squad cwd stays inactive and blank
  - Reset/clear hooks exist for stale-state boundaries
  - Per-subagent model sync hooks remain wired
  - Badge text still prioritizes current activity

### 2026-05-16T16:40:39.107+02:00: Prefer specific agent names over generic card labels

**By:** Shuri

**What:** Sub-agent card rendering now treats generic placeholder display names and opaque agent-id labels as low-confidence text, so a specific `agentName` like "Tony Stark" can replace them. Existing generic non-Squad labels still render when no better name exists.

**Why:** The card UI was trusting `displayName` too hard. That let generic runtime labels mask resolved Squad cast names even when a better human name was already present in the payload.

**Status:** Implemented and approved.

---

### 2026-05-16T16:40:39.107+02:00: Stable runtime agentId alias fallback for Squad names

**By:** Vision

**What:** Allow Squad metadata resolution to use the top-level runtime `agentId` only when it looks like a stable alias such as `lead` or `tony-stark`, while still refusing opaque handles like `agent-call_H`.

**Why:** Some runtime events can arrive with generic placeholder labels in `agentDisplayName`, so ignoring a stable-looking `agentId` lets placeholders outrank cast names. Guarded fallback keeps non-Squad behavior intact and avoids reintroducing the rejected opaque-id join.

**Status:** Implemented and approved.

---

### 2026-05-16T16:40:39.107+02:00: Stable runtime agentId alias fallback for Squad names

**By:** Vision

**What:** Allow Squad metadata resolution to use the top-level runtime `agentId` only when it looks like a stable alias such as `lead` or `tony-stark`, while still refusing opaque handles like `agent-call_H`.

**Why:** Some runtime events can arrive with generic placeholder labels in `agentDisplayName`, so ignoring a stable-looking `agentId` lets placeholders outrank cast names. Guarded fallback keeps non-Squad behavior intact and avoids reintroducing the rejected opaque-id join.

**Status:** Implemented and approved.

---

### 2026-05-16T17:28:38.428+02:00: Runtime/Event-Bridge Revision — Live Sub-Agent Naming Fix (APPROVED & MERGED)

**By:** Tony Stark (Implementation), Howard the Duck (QA & Approval)

**What:** Implemented guarded runtime/event-bridge revision enabling live task subtasks to inherit meaningful Squad display names from spawn metadata while preserving Squad precedence hierarchy and non-Squad fallback robustness.

**Root Cause of Initial Rejection:** Howard the Duck identified a runtime naming bug in the initial design review. The multi-agent identity & badge system achieved Squad name resolution at the architectural level but missed a critical runtime seam: the `agentId` lookup was too permissive and risked accepting opaque handles (e.g., `agent-call_H`) as valid Squad roster keys, potentially allowing placeholder SDK labels to outrank actual cast names.

**Implementation & Resolution:**

1. **Guarded agentId Fallback** — Extended `squad-context.mjs` and `main.mjs` to accept stable-looking agentId values (e.g., `tony-stark`, `lead`, `tester`) for roster lookup while explicitly rejecting opaque identifiers
2. **Casting-Slot Alias Resolution** — Squad metadata now resolves slot aliases (e.g., `lead` → `Tony Stark`, `tester` → `Howard the Duck`) in addition to explicit agent names
3. **Centralized Display-Name Contract** — All subagent lifecycle events (`started`, `completed`, `failed`) use the same resolution path, ensuring consistency and enabling easier validation
4. **Complementary State Reset** — Leveraged Peter Parker's prior stale-state reset work (session/context boundaries) to prevent Squad-backed names from leaking into non-Squad or post-context-change views

**Files Modified:**
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` — Extended agentId lookup with stable-alias filtering
- `.github/extensions/copilot-avatar/main.mjs` — Guarded fallback logic and centralized display-name resolution
- `.github/extensions/copilot-avatar/content/main.js` — Badge system validated compatible with resolved Squad names

**Validation (All Passed):**
✓ Squad casting-slot aliases resolve to correct human names (Tony Stark, Peter Parker, Howard the Duck)
✓ Opaque agentId values like `agent-call_H` do not bypass Squad roster joins
✓ Non-Squad sessions display generic labels without Squad metadata pollution
✓ Stale Squad-backed cards do not replay into later contexts (validated with Peter Parker's reset mechanism)
✓ Badge text prioritizes live activity alongside resolved Squad names
✓ Model updates sync correctly across event-order races
✓ Syntax validation passed; targeted regression probes covered all critical seams

**Decision:** ✅ **Approved and merged** by Howard the Duck. The runtime/event-bridge revision closes the naming seam while maintaining graceful degradation for non-Squad sessions.

**Key Architectural Insight:** Squad roster lookups must stay anchored to stable identity fields (`agentName`, `agentDisplayName`, casting-slot aliases) rather than opaque runtime instance IDs. This keeps Squad metadata optional and graceful while preventing transient labels from short-circuiting the display-name resolution chain.

---

### 2026-05-16T19:27:16.955+02:00 — Gate Squad root accessories from visible Squad context

**By:** Shuri

**What:** Squad-only visuals on the root avatar should hang off the existing `window.setSquadContext(payload)` signal and be attached only to the root avatar mesh, rather than inferring Squad directly from cwd inside the webview.

**Why:** `main.mjs` already reduces Squad visibility through `getVisibleSquadContext()`, so `payload.active` reaches the page only when Squad metadata is present and the active top-level agent is actually Squad. Reusing that seam keeps normal Copilot sessions visually unchanged and avoids a second frontend detection path that could drift.

**Affected files:** `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/content/main.js`

---

### 2026-05-16T19:48:28.844+02:00 — Root Squad comms accessory should stay mic-boom light

**By:** Shuri

**What:** Replace the old chunky Squad root headset with a lighter single-sided mic-boom silhouette: small ear anchor, thin curved arm, compact capsule near the mouth.

**Why:** The Squad signal should read as subtle comms gear, not a costume piece. Keeping it root-only and still driven by `window.setSquadContext(payload.active)` preserves the existing non-Squad boundary while making the avatar feel cleaner and more stable in motion.

---

### 2026-05-16T19:56:44.385+02:00: Keep the Squad root mic face-side only

**By:** Shuri

**What:** Remove the ear-anchor geometry from the Squad root mic-boom accessory and recolor the remaining face-side mic boom and capsule to the established Squad pink accent (`#f778ba`). Preserve the existing root-only + visible-Squad gating.

**Why:** User feedback indicated the ear-side piece read like unwanted clutter by the avatar's ear. A face-side-only mic keeps the Squad signal subtle and clean.

**Impacted files:** `.github/extensions/copilot-avatar/content/main.js`

**Status:** Implemented and validated.

---

### 2026-05-16T20:03:34.127+02:00: Squad Root Mic — Dark Graphite Finish, Ear-to-Mouth Boom Arc

**By:** Shuri

**What:** The Squad root mic-boom accessory has been updated from Squad pink (`#f778ba`) to dark graphite (`0x1c1c1c`). The boom curve has been extended from 4 to 6 CatmullRom control points so it now arcs from the temple/ear region (slightly above eye level, at max lateral head width) down around the cheek to the mouth capsule — mimicking a real broadcast boom mic path without adding an anchor ring or bilateral headset geometry.

**Rationale:**
- Pink was too visually loud against the avatar face; dark graphite reads as professional comms gear.
- User wanted the boom to visually "run back up to the ear" — achieved by prepending two control points at the temple (`+0.04y`, `0.245x`) and ear level (`0.235x, eyeY`) before the existing cheek–mouth arc.
- No ear-anchor mesh added; the tube itself terminating at the temple gives the implied ear connection without adding a separate ring piece.

**Scope:** Only `createSquadMicBoom()` in `.github/extensions/copilot-avatar/content/main.js` changed. Gating (`updateRootSquadMicBoom`, `window.setSquadContext`), root-only lifecycle, and all other Squad UI are unchanged.

**Status:** Implemented.

---

### 2026-05-16T20:11:12.638+02:00: Reset Subagent State at Directive Boundary (assistant.turn_start)

**By:** Tony Stark (Lead)

**What:** Every root `assistant.turn_start` event is a directive boundary. Any subagents still in `subagentStateById` at that point are stale — they belong to the previous directive and should be cleared before the new one begins.

**Decision:** In the `assistant.turn_start` handler, call `resetSubagentRuntimeState({ clearUi: true })` before `refreshVisibleSquadContext()`.

**Rationale:**
- `session.start` and `session.context_changed` already call `resetSubagentRuntimeState` — the pattern is established.
- `assistant.turn_start` is the intra-session directive boundary but had no such reset, causing agents from directive N to survive into directive N+1.
- The critical case: the SDK does not always fire `subagent.completed`; agents can stay "active" in the maps indefinitely. The CLI considers them gone but the extension does not.
- The guard `if (event.agentId) return` ensures only root (top-level) turns trigger the reset; subagent-owned sub-turns are untouched.
- `subagent.started` for the new directive fires AFTER `assistant.turn_start`, so there is no race: the clear happens before any new agent registers.

**Defense layers now in place:**
1. **Directive boundary reset** (this decision): `resetSubagentRuntimeState` on root `assistant.turn_start`.
2. **Active-only sync filter**: `syncKnownSubagents` skips completed/failed agents.
3. **Post-completion prune timer**: `scheduleSubagentPrune` removes completed/failed entries from maps after hold+fade buffer.

---

### 2026-05-16T20:11:12.638+02:00: Stale Subagent Pruning Strategy

**By:** Tony Stark (Lead)

**What:** Completed and failed subagents must NOT be replayed by `syncKnownSubagents()`. Once a sub-agent reaches a terminal state, its UI lifecycle is over and re-adding it on every turn start creates ghost cards.

**Decision:** Two-part fix applied in `main.mjs`:
1. `syncKnownSubagents` filters to `status === "active"` only.
2. `scheduleSubagentPrune(agentId, expectedStatus, delayMs)` — after `subagent.completed` (3000ms) or `subagent.failed` (2200ms), the backend map entry is deleted (guarded by expected-status so a restarted agent isn't pruned).

Timing constants (`SUBAGENT_COMPLETION_PRUNE_MS`, `SUBAGENT_FAILURE_PRUNE_MS`) are defined in main.mjs and must stay in sync with `COMPLETION_HOLD_MS` / `FAILURE_HOLD_MS` in `content/main.js` if those ever change.

**Rationale:**
`syncKnownSubagents` is a webview-reconnect safety net for *active* agents. Terminal-state agents have already fired their animations; re-syncing them creates the visual artifact where Scribe (or any completed agent) re-appears on every turn. This pattern costs nothing and eliminates the ghost-card problem without a second state system.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
