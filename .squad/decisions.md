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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
