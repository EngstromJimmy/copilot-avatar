# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.
- 2026-05-16T16:02:40.457+02:00 — Squad name resolution should join on stable identity fields only, but the lookup map should be enriched with casting slot aliases from `.squad/casting/history.json` and `.squad/casting/registry.json` so names like `lead`, `tester`, and `backend-dev` resolve to `Tony Stark`, `Howard the Duck`, and `Peter Parker`. Key files: `.github/extensions/copilot-avatar/lib/squad-context.mjs`, `.github/extensions/copilot-avatar/main.mjs`, `.squad/casting/history.json`, `.squad/casting/registry.json`.
- 2026-05-16T23:01:57.563+02:00 — When avatar cards must mirror live Copilot sub-agents, visibility should stay keyed to Copilot runtime `agentId` and lifecycle events only; Squad roster/casting data remains metadata-only enrichment, and webview update calls must not create non-root cards by themselves.
- 2026-05-16T23:01:57.563+02:00 — If Squad chrome is hidden, keep the loaded roster/casting lookup map on the hidden context and let metadata resolution key off lookup presence, not `active`, so cast names still resolve for Copilot-owned cards.
- 2026-05-16T23:25:38.850+02:00 — If Copilot SDK already emitted `subagent.started`, that presence is enough to render the card. First-render evidence gates and debounces only hide legitimate Copilot-owned agents; keep Squad metadata strictly as display enrichment.

## 2026-05-16T14:02:40.457Z — Session Complete: Approved Sub-Agent Identity & Badge Fix

**Status:** ✅ Approved by Howard the Duck

**Team:** Tony Stark (Lead), Vision, Peter Parker, Shuri, Howard the Duck (QA)

**Role:** Specified display-name resolver contract with agentId lookup and casting alias enrichment.

**Summary:** Part of multi-agent identity & badge system fix. Defined Squad display-name resolver contract that stays on stable identity fields (`agentName`, `agentDisplayName`) while enriching the Squad lookup map with casting-slot aliases. This ensures Squad metadata remains optional enrichment, not a hard dependency.

**Key Contribution:**
- Designed resolver contract to try agentDisplayName → Squad roster (by stable fields) → agentName → agentId
- Specified casting alias enrichment for `lead`, `tester`, `backend-dev` → cast names
- Ensured no hidden coupling between transient runtime IDs and human-readable labels
- Maintained graceful degradation when Squad absent

**Files Modified:**
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` — resolver enhancement
- `.github/extensions/copilot-avatar/main.mjs` — payload consumption

**Validation:** Syntax smoke tests passed; targeted lookup probes passed; approved by Howard the Duck.

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

## 2026-05-16T13:42:38.842Z — Initial Fix Rejected; Approved Revision by Shuri Replaces It

**Status:** ❌ Rejected

**Why:** Initial approach added `agentId` to Squad roster lookups, but `agentId` is a per-instance identifier, not a stable roster key. Analysis showed:
- Direct `agentId` lookups still fail for opaque internal IDs (e.g., `agent-call_H` → `howard-the-duck` mapping missing)
- Worst-case fallback still resolves to opaque ID users were complaining about
- Does not solve the root issue of distinguishing stable identity from transient handles

**Approved Revision (by Shuri):** Centralized sub-agent display metadata resolution in `main.mjs` using stable identity fields (`agentName`, `agentDisplayName`) for Squad roster joins, with `agentId` as final emergency fallback only. Shuri's implementation:
- Single trim-aware resolver across all lifecycle handlers
- Casting slot aliases bridge runtime names to Squad roster
- Correct fallback order enforced
- Approved by Howard the Duck and Tony Stark

**Key lesson:** Use stable identity fields for roster joins; keep opaque instance IDs out of metadata lookups. This fix maintains the correct seam between runtime state tracking (agentId) and human-readable naming (stable identity + Squad roster).

## 2026-05-16T19:23:20Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

**Cycle Status:** Complete
**Contributors:** Tony Stark (lead), Howard the Duck (review), Peter Parker (implementation)

**Key Decisions:**
- Stale sub-agent cards retire on work completion (no terminal event required)
- Visible sub-agent identities collapse to single stable identity
- Badge metadata removed from role text, kept in task-summary/activity text

**Tests:** All smoke checks and regression assertions passed.
**Next:** Integration ready.

## 2026-05-16T21:01:57.563Z — Copilot-owned Sub-Agent Visibility (Architecture Codification)

**Status:** ✅ Implemented and documented

**Role:** Implemented the Copilot-owned visibility seam to ensure cards persist until Copilot ends them and Squad-only agents cannot surface.

**Summary:** Codified the architectural split between Copilot SDK (visibility owner) and Squad SDK (enrichment-only):
- Copilot `subagent.started` triggers card creation; terminal events and session resets retire it
- Squad roster/casting data enriches display name, role, description, stable identity — but does NOT create cards, suppress present cards, or collapse multiple live instances
- Webview isolation: `addSubagent` is the only permitted card-creation entrypoint; all updates must no-op if the card wasn't created yet

**Impact:** Enables Squad identity and metadata enrichment without risking duplicate cards, visibility drift, or Squad-only "ghost agents" surfacing in non-Squad contexts.

**Files Affected:**
- `.github/extensions/copilot-avatar/main.mjs` — Copilot visibility seam enforcement
- `.github/extensions/copilot-avatar/content/main.js` — Webview card-creation gate
- `.squad/decisions.md` — Architecture decision recorded

## 2026-05-16T21:25:38.850Z — First-Render Gate Removed: Copilot Subagent Start Visibility

**Status:** ✅ Implemented and documented

**Role:** Removed the first-render evidence gate so Copilot sub-agent presence alone is enough for initial visibility.

**Summary:** Removed the first-render evidence gate that was hiding legitimate Copilot-owned sub-agents. Visibility now responds directly to Copilot SDK `subagent.started` without requiring extra tool activity or debounce gates:
- Sub-agents render immediately on `subagent.started` event
- First-render gates suppressed legitimate Copilot-owned agents unnecessarily
- Squad roster/casting data remains enrichment-only, no card creation or suppression
- Webview update-only calls continue to no-op if Copilot-owned card not yet created

**Impact:** Sub-agents become visible as soon as Copilot marks them started, providing better user experience for Squadron delegation and background tasks.

**Files Affected:**
- `.github/extensions/copilot-avatar/main.mjs` — First-render gate removed from visibility logic
- `.squad/decisions.md` — Team decisions merged and archived
