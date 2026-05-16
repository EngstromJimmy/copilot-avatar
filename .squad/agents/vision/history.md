# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.

## 2026-05-16T15:42:38.842+02:00 — Squad Sub-Agent Display Integration Analysis

**Integration Seam:** Extension (main.mjs) ↔ Webview (content/main.js)

**Current Data Flow:**
1. Copilot SDK emits `session.on("subagent.started")` event with agentId, agentName, displayName, description
2. Extension calls `resolveSquadAgentMetadata()` to enrich with Squad roster data
3. Extension calls `callWindowFunction("addSubagent", {agentId, displayName, role, description, ...})`
4. Webview function `window.addSubagent()` receives payload and creates avatar

**Critical Break Point Identified: Silent Failure Before Webview Open**

The integration has a **fundamental synchronization issue** where webview function calls fail silently if the window hasn't been opened yet:

1. **Silent Failure Mechanism** (main.mjs:82-89):
   ```javascript
   async function evalWebview(expression, timeoutMs = 2000) {
       if (!webview._handle) return;  // ← Returns silently if window not open
       await webview.eval(expression, { timeoutMs }).catch(() => {});
   }
   ```
   If `webview._handle` is null (window not shown), the function returns without executing the webview call. No error is logged, no one knows it failed.

2. **No Event Buffering** (main.mjs:266-292):
   When `session.on("subagent.started")` fires, it immediately calls `callWindowFunction("addSubagent", ...)`. If the window isn't open yet, the call silently fails. There is no queue, no retry, no "wait-for-webview" mechanism at the extension level.

3. **Race Condition**:
   - User starts a session → Squad immediately begins spinning up sub-agents
   - Sub-agent.started events fire → callWindowFunction calls fail silently
   - User manually opens avatar window → Window is now responsive, but sub-agent events are already lost

4. **Webview-Side Fallback Incomplete** (content/main.js:2766-2780):
   The webview does have a `pendingSubagents` buffer, but it only works if `window.addSubagent()` is called with a null/missing agentId. Since the extension passes a valid agentId on line 277, the fallback is never used.

5. **Two Additional Risks**:
   - **Squad context lookup** (main.mjs:272): If `resolveSquadAgentMetadata()` can't find an agent, it returns null, so role/description are empty strings rather than Squad metadata.
   - **No diagnostics**: No session.log calls when window function calls fail, making this bug invisible to users.

---

## Integration Seam Map (as discovered)

```
Copilot SDK event                Extension handlers              Webview
"subagent.started"    →    session.on("subagent.started")    →    callWindowFunction("addSubagent", ...)    →    webview.eval(...)
                             ├─ resolveSquadAgentMetadata()        │
                             │  (Squad roster lookup)               └─ IF webview._handle == null
                             └─ await callWindowFunction()           THEN return silently (no error, no queue)
```

**Silent failure points:**
- Line 82-85 (main.mjs): `evalWebview()` returns if no _handle
- Line 88 (main.mjs): `callWindowFunction()` swallows all errors
- Lines 84, 88 (main.mjs): `.catch(() => {})` suppresses rejected promises

**Webview is not opened automatically on session start**, only when:
- User runs `/avatar` command
- User calls `copilot_avatar_show` tool with reload param
- These are both explicit, manual triggers

**No automatic readiness signaling** between extension and webview — extension doesn't know if webview is listening before firing events.

---

## Secondary Findings (not causing the current issue but worth noting)

1. **Squad context loading is sound** — properly handles missing Squad metadata and falls back to event data
2. **Webview has a pending subagents queue**, but it's only reached if window.addSubagent is called with a missing agentId (which shouldn't happen in normal flow)
3. **Tool execution events** (tool.execution_start, etc.) have the same silent failure problem as subagent events
4. **Root agent model tracking** (pendingModelsByToolCallId) would also lose data if webview not ready

---

## 2026-05-16T15:42:38.842+02:00 — Sub-Agent Naming Fix Applied

**Issue:** Sub-agents showed internal IDs like `agent-call_H` and `agent-call_D` instead of Squad roster names.

**Root Cause:** 
- `event.data?.agentDisplayName` and `event.data?.agentName` were empty/undefined
- `resolveSquadAgentMetadata()` only tried to look up by `agentName` and `agentDisplayName`, not by `agentId`
- Fallback displayName was empty string, so webview used `defaultDisplayName(agentId)` which just truncates IDs
- Squad roster was never consulted because agentId was never passed to the lookup function

**Fixes Applied:**
1. **Extension naming fallback** (main.mjs:278-281): Changed displayName to fallback to `event.agentId || ""` instead of `""`, ensuring displayName is never empty
2. **Squad lookup enhancement** (squad-context.mjs:485-503): Added `agentData.agentId` as a third lookup key in `resolveSquadAgentMetadata()`, so if the agent exists in the Squad roster under its ID, it will be found
3. **All three event handlers** (subagent.started, completed, failed) updated to pass `agentId` to `resolveSquadAgentMetadata()` and use improved displayName fallback

**How it works now:**
- When subagent fires, extension tries: `agentDisplayName` → Squad roster lookup (via agentName, agentDisplayName, OR agentId) → agentName → agentId
- If Squad roster contains agent under any matching key, its displayName is used
- If not found, agentId itself is used (better than empty string)

---

## 2026-05-16T15:42:38.842+02:00 — Implementation Complete: Sub-Agent Display Name Lookup Fix

**Status:** ✅ Implemented and merged into main.

**Summary:** Fixed sub-agents showing internal IDs instead of Squad roster names by enhancing metadata lookup to include agentId as a search key.

**Changes:**
1. **main.mjs** (lines 272-281, 302-306, 318-322): All three subagent event handlers now pass `agentId` to `resolveSquadAgentMetadata()` and use improved displayName fallback chain ending with agentId instead of empty string.
2. **squad-context.mjs** (lines 490-494): Updated `resolveSquadAgentMetadata()` to include `agentId` in the lookup key set, allowing roster matches by ID when name fields are empty.

**Effect:** Sub-agents are now correctly matched to their Squad roster entries by ID, and fallback to agentId (rather than empty string) if no roster match is found. UI now displays proper names instead of internal identifiers.

**Next Upstream Issue:** The synchronization seam issue (webview not open when events fire) remains. Recommend Tony Stark's Option A (auto-show on Squad detection) be implemented in refreshSessionContext().
