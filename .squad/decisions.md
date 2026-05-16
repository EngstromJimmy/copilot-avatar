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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
