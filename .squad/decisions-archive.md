# Archived Decisions (older than 7 days from 2026-05-17)

Archived on: 2026-05-17T20:39:13.982+02:00

---




## 2026-05-17T19:54:11.015+02:00: Mic boom visibility — validation protocol and failure modes

**By:** Howard the Duck (Tester)

**What:** Created tight manual repro checklist and post-fix validation probes for the Squad root mic boom visibility bug. Two failure modes documented and ready for regression testing after Shuri's fix lands.

**Root Cause Summary:** Timing gap between `initializeRootAvatar()` (page load) and `window.setSquadContext()` call (main.mjs) means mic boom starts invisible and never updates if avatar is rendered before Squad context syncs.

**Key Test Assets:**
- `.squad/tests/mic-boom-visibility-manual-repro.md` — Steps to reproduce the missing mic symptom
- `.squad/tests/mic-boom-validation-probes.md` — 4 probes (static checks + live window inspection) to verify fix + catch regressions

**Failure Modes to Watch:**
1. Mic boom stays invisible after Squad context sync (gate not working)
2. Mic boom appears then disappears on window reopen (state not preserved)

**Regression Risk:** Squad sub-agent identity (names, roles) must stay stable after mic boom fix. If metadata lookup breaks, escalate to Vision.

**Next Step:** Shuri's implementation should wire `syncSquadContext()` to either:
- Option A: Call after `webview.show()` (ensures sync after window open)
- Option B: Call in `assistant.turn_start` (ensures fresh state each turn)
- Option C: Both (safest, guarantees sync on open + refresh on turn)



### 2026-05-17T19:54:11.015+02:00: Replay latched Squad mic state when root avatar initializes

**By:** Shuri (Frontend Dev)

**What:** Keep the Squad mic boom driven by `window.setSquadContext(payload.active)`, but replay that latched page-side state once the root avatar is actually created. Also refresh Squad context again on root `assistant.turn_start`.

**Why:** The webview can accept `setSquadContext()` before `initializeRootAvatar()` finishes. Without a replay seam, `squadRootMicActive` becomes true while the mesh does not exist yet, and the mic stays invisible until some later sync. Reapplying the flag during root-avatar init fixes the first-render race without changing Squad identity ownership.

**Scope:** `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/main.mjs`

---


### 2026-05-17T20:00:51.651+02:00: Wait for webview-ready before Squad context sync

**By:** Vision (Platform Dev)

**What:** Treat `webview.show()` and the first websocket connection as insufficient proof that the avatar page can accept `window.setSquadContext(...)`. Gate Squad context replay behind a page-owned `window.__copilotAvatarReady` latch instead.

**Why:** The extension can obtain a webview handle before `content/main.js` finishes defining `window.setSquadContext` and creating the root avatar. Because the extension currently swallows eval failures, an early `setSquadContext` call can disappear without retry, leaving the Squad mic state unset until some later event. Waiting for the page-ready latch fixes the extension↔webview seam without changing Squad identity ownership.

**Validation:** A live avatar-window probe now reports `window.__copilotAvatarState` toggling from `{ squadRootMicActive: false, rootMicVisible: false }` to `{ squadRootMicActive: true, rootMicVisible: true }` when Squad context flips on.

**Scope:** `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/content/main.js`

# Squad Decisions

## Active Decisions


### 2026-05-16T23:25:38.850+02:00: User directive — remove first-render gate for sub-agent visibility

**By:** Jimmy Engstrom (via Copilot)

**What:** When using Copilot SDK, sub-agent presence alone should be enough to show the sub-agent; remove the first-render gate. Keep visibility limited to Copilot-owned sub-agents, while Squad SDK remains metadata-only for names, roles, and related enrichment.

**Why:** User request — captured for team memory.

**Implementation:** Copilot-owned sub-agents render on `subagent.started` without requiring extra tool or debounce evidence.

---


### 2026-05-16T23:25:38.850+02:00: Copilot-owned sub-agents render on `subagent.started`

**By:** Vision (Platform Dev)

**What:** Remove the first-render evidence gate. Once Copilot emits `subagent.started` for a runtime `agentId`, the extension should mark that sub-agent visible immediately.

**Why:** Visibility ownership already lives with the Copilot SDK lifecycle. Requiring extra tool or debounce evidence after `subagent.started` creates false negatives and hides legitimate helpers.

**Guardrails:** Squad roster and casting data stay metadata-only enrichment for Copilot-owned cards, and update-only webview calls must still no-op unless `addSubagent` created the non-root avatar.

---


### 2026-05-16T23:01:57.563+02:00: Hidden Squad chrome keeps metadata lookup alive

**By:** Vision (Platform Dev)

**What:** When the top-level gate hides Squad chrome, the extension should keep the loaded Squad roster/casting metadata attached to the hidden context instead of replacing it with an empty shell.

**Why:** Sub-agent name and role resolution is a different seam from root-only Squad chrome. If hidden contexts drop `agentsByKey` or metadata-only fields, Copilot-owned cards can stay visible but regress to generic labels or internal names even though the Squad roster was already loaded.

**Implementation note:** Metadata lookup now keys off loaded lookup presence rather than `context.active`, and sub-agent scope also follows loaded Squad metadata instead of visible chrome state.

---


### 2026-05-16T23:01:57.563+02:00: Copilot-owned sub-agent visibility

**By:** Vision (Platform Dev)

**What:** Visible sub-agent cards are owned by Copilot runtime lifecycle only. A non-root avatar becomes renderable on Copilot `subagent.started`, stays visible while Copilot still considers that runtime agent present, and retires on Copilot terminal lifecycle events or explicit session/context resets.

**Metadata contract:** Squad roster and casting data are enrichment-only for Copilot-owned cards. They may improve display name, role, description, and stable identity labeling, but they must not create a card, suppress a still-present Copilot card, or collapse multiple live Copilot runtime agents into one visible card.

**Webview seam:** `addSubagent` is the only webview entrypoint allowed to create a non-root avatar. Update-only calls such as activity, intent, and thinking must no-op when the Copilot-owned card has not been created yet, so visibility cannot drift away from the extension lifecycle seam.

---

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


### 2026-05-16T22:06:13.919+02:00: Do not collapse actively working duplicate identities into one card

**By:** Peter Parker

**What:** For the avatar extension, stable-identity dedupe should only fold away inactive siblings. If two runtime instances that resolve to the same cast identity both still have live tool activity, keep both cards visible. When dedupe does collapse back to one owner, merge the richest shared identity metadata into the survivor first.

**Why:** The regression path was over-collapsing real concurrent work: two live background tasks with the same stable identity could collapse to one visible card, and the winner could be the fresher runtime instance with weaker naming data. That made the UI undercount active work and sometimes blanked the surviving card name.

**Implementation Notes:**
- `.github/extensions/copilot-avatar/main.mjs` now keeps concurrent live same-identity states visible, while still hiding idle siblings.
- The same file now merges better `displayName`, `agentName`, `role`, `description`, and `taskSummary` metadata into the preferred owner before hiding stale duplicates.
- `.github/extensions/copilot-avatar/content/main.js` now treats active same-identity avatars as legitimate coexistence and only prunes duplicates once they are no longer both doing live work.

---


### 2026-05-16T22:06:13.919+02:00: Sub-agent metadata must bypass top-level Squad UI gating

**By:** Tony Stark

**What:** Use the resolved Squad roster/casting context for sub-agent identity lookup even when the visible Squad chrome is gated off for a non-Squad top-level coordinator.

**Why:** The new top-level gate is valid for root-only visuals and status text, but it accidentally starved sub-agent naming of cast metadata. That dropped Tony/Peter/Howard-style names and weakened `stableIdentityKey` resolution, while background-task visibility gating (`hasCurrentTurnWork`) and duplicate collapse should remain unchanged.

---


### 2026-05-16T22:02:45.479+02:00: Treat `report_intent` as weak first-visibility evidence

**By:** Peter Parker

**What:** For hidden sub-agents, treat `report_intent` the same way as the `task` wrapper: cache any intent text it carries, but do not render a card from that tool alone. Visible cards may still consume it as metadata, and a later stronger tool can use the cached text.

**Context:** The avatar already suppresses hidden sub-agent cards on `subagent.started`, `assistant.reasoning`, `assistant.intent`, and the parent `task` wrapper. Prompt-start floods can still happen because reactivated idle agents often emit a fast `report_intent` tool call before they do any substantive work.

**Why:** This matches the user-visible symptom: cards appear briefly and then retire about a second later, which lines up with weak launch-time tools being promoted and then retired after `tool.execution_complete`. Suppressing those weak tool-only activations keeps the UI focused on agents that actually started visible work.

---


### 2026-05-16T22:02:45.479+02:00: Sub-agent first-render debounce

**By:** Tony Stark

**What:** Use a first-render debounce for hidden sub-agent cards instead of trusting `subagent.started` or intent/reasoning traffic. Hidden agents now wait 750 ms after the first non-`task` tool start before `addSubagent`, unless `tool.execution_progress` arrives first and proves sustained live work.

**Why:** The SDK/runtime seam available to the extension does not provide a trustworthy "this is just an idle/background agent" bit before render:
- `subagent.started` exposes identity metadata, `toolCallId`, and optional `model`, but no idle/background state.
- `subagent.selected` is selection-level metadata (`agentName`, `agentDisplayName`, `tools`) and is not a safe per-instance visibility gate.
- Current generated SDK types expose `session.background_tasks_changed`, but its payload is empty, so it cannot tell us which specific agent should be suppressed.

Given that gap, render debounce is the smallest safe filter for short-lived wake-up noise.

**Tradeoff:** Very fast sub-agents that only emit `tool.execution_start` + `tool.execution_complete` and never emit progress will stay invisible if they finish inside the debounce window. That is acceptable here because the user complaint is prompt-start clutter, and long-lived or actively reporting agents still surface quickly.

**Validation:**
- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/lib/squad-context.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`

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

---
date: 2026-05-16T21:23:20.636+02:00
agent: Howard the Duck
artifact: .github/extensions/copilot-avatar/main.mjs, .github/extensions/copilot-avatar/content/main.js
decision: reject
revision_owner: Peter Parker
---

Current stale-agent suppression is still leaking in the place users can actually see: inside one long directive.

The cross-directive reset path is fine now. The real hole is that some spawned agents never get `subagent.completed` or `subagent.failed`, and `tool.execution_complete` only clears their active tool badge. That leaves the runtime state `active`, the webview avatar still on screen, and the card keyed only by runtime `agentId`.

That combination is exactly how you get "a lot of agents" plus dual cast identities:

1. Tony instance A starts, runs a tool, becomes visible.
2. SDK never sends a terminal sub-agent event for Tony instance A.
3. `tool.execution_complete` clears activity but does not retire the card.
4. Tony instance B starts later with a different runtime `agentId`.
5. Both instances resolve to `Tony Stark`, and both stay visible because there is no stable-identity collapse.

The "role text is showing in the box beneath the name again" clue is related but not identical:

- In `content/main.js`, the badge falls back to `liveIntent || taskSummary || badge.text`.
- `taskSummary` comes from `avatar.description`.
- In `lib/squad-context.mjs`, charter summaries are built role-first (`role` is pushed first in `summarizeCharter()`), so an idle/stale card naturally falls back to role-flavored copy once tool activity is cleared.

Verdict: both symptoms share the same stale-card survival path, but only the duplicate-Tony problem requires identity dedupe. The role text relapse also needs badge-source cleanup or precedence tuning, otherwise legitimate long-lived cards can still drift back to role-heavy copy even after the stale-instance bug is fixed.

Required revision:

- Add a fallback retire/hide path for visible sub-agents whose last active tool finished but never received a terminal sub-agent event.
- Prevent two visible cards with the same resolved cast identity from coexisting; the newer runtime instance should replace or suppress the older stale one.
- Re-check badge fallback for visible idle agents so role-first charter summaries do not reappear in the lower badge line unless that is explicitly desired.

Evidence checked:

- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`
- Targeted static probe confirming `tool.execution_complete` does not mark sub-agents terminal, `clearAgentActivity` does not schedule removal, and the webview avatar map is keyed by runtime `agentId`.
---
date: 2026-05-16T21:04:02.794+02:00
agent: Howard the Duck
artifact: .github/extensions/copilot-avatar/main.mjs
decision: reject
revision_owner: Peter Parker
---

Tony's fix correctly blocks hidden sub-agents from becoming visible through bare `assistant.reasoning`, and replay/sync now limits rehydration to active agents that already earned visibility.

Rejected because hidden agents still promote from intent-only traffic. `assistant.intent` currently sets `hasCurrentTurnWork` for any non-generic intent, and this system routinely emits launch-time gerund intents like `Exploring codebase` or `Creating parser tests` before a tool starts. That means a freshly spawned or reactivated stale agent can still appear in the avatar list immediately, which does not satisfy Jimmy's complaint about agent floods during spin-up.

Required revision: keep intent as badge text for agents that are already visible, but require tool activity or another stronger current-turn work signal before first-time visibility.
# 2026-05-16T21:04:02.794+02:00 — Intent-only sub-agent visibility stays gated

- **By:** Peter Parker
- **What:** Hidden sub-agents in `.github/extensions/copilot-avatar/main.mjs` no longer become visible from `assistant.intent` alone. Intent still updates cached badge text for already-visible agents, but first visibility stays gated on stronger current-turn evidence already tracked through tool execution.
- **Why:** Launch-time `report_intent` summaries like `Exploring codebase` or `Creating parser tests` can replay on stale or freshly started agents before they do any real work. Letting those generic summaries count as `hasCurrentTurnWork` reopens the stale flood even after replay and reasoning fixes.
- **Tradeoff:** Quiet sub-agents that never emit tool activity will remain hidden until they produce a stronger signal. That is intentional for now because false-positive floods were the sharper regression.
# 2026-05-16T21:23:20.636+02:00 — Fallback-retire stale sub-agent cards and dedupe by stable identity

**By:** Peter Parker

**What:** The avatar extension now treats task summaries as separate badge content from roster descriptions, forwards stable identity keys into the webview, and adds a last-tool fallback retire path for visible sub-agents that never receive `subagent.completed` / `subagent.failed`.

**Why:** This keeps same-turn zombie cards from lingering as idle ghosts, gives the webview its own duplicate-collapse safety net when two runtime instances resolve to the same cast identity, and prevents the lower badge from regressing into role text once live activity clears.
2026-05-16T21:04:02.794+02:00 — On sub-agent cards, keep role metadata inline with the agent name and reserve the badge for live work text (tool activity, intent, task summary, or idle state). This keeps compact overlays answering “what is this agent doing now?” instead of repeating identity metadata in two places.
# 2026-05-16T21:23:20.636+02:00 — Separate badge task summary from roster metadata

## What

Do not let sub-agent badge fallback read from the same `description` field that also carries Squad charter / roster metadata.

Keep a dedicated task-summary value for badge fallback, seeded from task spawn hints or other explicit work assignment text, while leaving roster description available only for metadata enrichment.

## Why

The duplicate-Tony bug and the “role text in the badge again” clue point at the same contract failure: the UI surface can drift onto a runtime instance that has identity metadata but not the current work payload. When that happens, a badge fallback that reads roster description will look like a role regression even if the live work path itself is intact.

## Affected files

- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
# Decision: Defensive Sub-Agent Activation Gate

**Date:** 2026-05-16T20:46:28.793+02:00  
**By:** Tony Stark (Lead)  
**Status:** Implemented

---

## What

The avatar extension now treats `subagent.started` as a provisional runtime event, not as enough evidence to show a sub-agent card.

## Decision

- Keep tracking the sub-agent immediately in extension state so later events still resolve identity, model, and tool-call joins correctly.
- Do **not** surface the card to the webview on `subagent.started`.
- Only surface a sub-agent after a current-turn work signal arrives:
  - `tool.execution_start`
  - `tool.execution_progress`
  - `assistant.intent`
  - `assistant.reasoning`
- Do not let model-only updates or terminal-only events (`subagent.completed` / `subagent.failed`) create a new avatar for an agent that was never shown.
- Harden `session.resume` with `resetSubagents: true` so stale active maps cannot replay ghosts after resume.

## Why

We cannot fix upstream Squad agent-pool behavior here. Old idle agents can be reactivated and emit fresh `subagent.started` events on a new directive. Gating UI activation on meaningful current-turn work is the smallest safe extension-side filter: it drops idle reactivation noise without breaking the extension's internal joins or normal live agents once they actually begin doing work.

### 2026-05-16T21:04:02.794+02:00: Gate hidden subagents on substantive work
**By:** Tony Stark
**What:** Hidden sub-agents in the avatar extension now stay suppressed until the current turn produces real work evidence — tool execution or a substantive intent. Bare reasoning pulses no longer create cards, and replay only rehydrates active agents that already earned visibility.
**Why:** The runtime can reactivate old idle agents and emit fresh `assistant.reasoning` noise. Letting that signal mint cards is exactly how the avatar ends up listing a crowd of stale agents when new work starts.
# 2026-05-16T21:23:20.636+02:00 — Collapse visible sub-agent cards by stable identity

## What

Keep runtime sub-agent bookkeeping keyed by `agentId`, but collapse the visible avatar/card surface by a stable identity key derived from Squad metadata, `agentName`, or `agentDisplayName`.

When a new visible runtime instance resolves to the same stable identity as an existing visible card, the extension should immediately evict the older card and let the newer runtime owner drive the shared identity.

## Why

The prior visibility hardening stopped weak replay signals from surfacing stale agents, but it did not close the duplicate-identity seam. Re-activated idle instances and fresh instances can both resolve to the same cast alias (`lead` → Tony Stark), and a UI keyed only by runtime `agentId` will happily show both.

## Affected files

- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
---
date: 2026-05-16T20:58:04.144+02:00
agent: Tony Stark
topic: subagent-badge-precedence
---

# Sub-agent badge precedence contract

The badge text contract is stateful and should stay explicit across the extension/webview seam.

- Extension layer (`main.mjs`) is responsible for feeding three inputs into the webview: live `activityLabel`, cached `intent`, and `description` sourced first from task spawn hints.
- Webview layer (`content/main.js`) resolves badge text in this order:
  - tool-active: `activityLabel` or derived tool copy → `intent` → task summary (`description`) → activity badge default
  - thinking without tool activity: `intent` → task summary → thinking default
  - idle: `intent` → task summary → `role` (if present) → idle default
  - success/failed: terminal `intent`/error copy → terminal badge default

If anyone changes this, they need to update both layers together or the cards will stop answering the only question that matters: what is this agent doing right now?
2026-05-16T20:46:28.793+02:00 — Sub-agent badges should resolve fallback text in this order: live tool/activity or intent first, cached task spawn summary/description second, and role/default labels last. Keep Squad charter metadata available for identity and styling, but do not let it outrank the task summary the runtime already captured.
# Decision: Root Cause of "8-10 Sub-Agents on Every Command"

**Date:** 2026-05-16T20:38:31.869+02:00  
**By:** Tony Stark (Lead)  
**Status:** Finding + Recommendation (no code change yet)

---

## What was investigated

User reported seeing 8–10 sub-agent cards in the avatar window whenever they issue a command. `list_agents` in the coordinator session shows many old idle background agents from prior work (tony-stark-*, shuri-*, scribe-*, etc.).

## Finding: The extension is NOT the source

The `assistant.turn_start` reset chain is correctly implemented:

1. `clearSubagentStateMaps()` — synchronous, empties all runtime maps immediately
2. `await callWindowFunction("clearSubagents", { preserveRoot: true }, 3000)` — clears the webview avatars (non-root)
3. `await refreshVisibleSquadContext()` → `syncKnownSubagents()` — replays only agents with `status === "active"` in the now-fresh maps

Any agent appearing after `assistant.turn_start` is legitimately added during the current directive. The stale-state defense layers (directive boundary reset, active-only filter, prune timers) are all in place and working.

## Most probable root cause: platform-level idle agent reactivation

The coordinator keeps idle background agents alive between commands (visible in `list_agents` as idle). When a new command arrives, the coordinator sends messages to these idle agents, re-activating them. The SDK fires `subagent.started` for each reactivated agent. The avatar correctly displays all of them — it's not at fault.

**The fix belongs upstream:** Squad agents should exit cleanly after completing a task so they don't accumulate as idle in `list_agents`. Clean exits prevent `subagent.started` reactivation events from firing on the next command.

## Secondary latent bug found (separate from reported symptom)

`session.resume` does NOT reset subagents:

```javascript
session.on("session.resume", (event) => {
    if (event.data?.context?.cwd) {
        void refreshSessionContext(event.data.context.cwd);  // no resetSubagents: true
    }
});
```

If agents were active mid-work when the session suspended (no `subagent.completed` delivered), they remain in `subagentStateById` with `status: "active"`. On resume, `syncKnownSubagents` replays them as ghosts. **This is a real bug but is not the reported symptom.**

Fix: add `{ resetSubagents: true }` to the `session.resume` call, OR clear `active` entries in `subagentStateById` before the sync if the elapsed time since their `startedAt` exceeds a reasonable deadline (e.g., >10 minutes without a completion event).

## Decision

- **Do not change the extension's `assistant.turn_start` reset path** — it is correct.
- **Route the "too many agents" fix to whoever owns coordinator/Squad agent lifecycle** — agents should call `process.exit()` (or equivalent) when their task completes.
- **Track `session.resume` ghost replay as a separate issue** — assign to whoever does the next extension maintenance pass.



---


### 2026-05-16T23:01:57.563+02:00: User directive
**By:** Jimmy Engstrom (via Copilot)
**What:** Keep sub-agent visibility driven by Copilot SDK presence: if Copilot SDK says a sub-agent exists, it should stay visible in the view. Do not show extra non-Copilot agents from Squad SDK. Use Squad SDK only to enrich visible Copilot sub-agents with names, roles, and related metadata.
**Why:** User request — captured for team memory



## 2026-05-16T22:42:24.111+02:00 — Live overlap visibility check

- **Decision:** For avatar visibility sign-off, use overlapping read-only activity windows and capture the live UI during the overlap.
- **Why:** A late poll after the probes finish can falsely look clean or empty even when the user really did get simultaneous live cards.
- **Observed evidence:** During the overlap window, the avatar UI showed `Tony Stark` and `Howard the Duck` together with correct role labels, separate model rows, and live badge text (`Reading main.mjs + main.js` / `Running harmless regression probe`).
- **Impact:** Future QA on named sub-agent visibility should include a live overlap snapshot before declaring pass or fail.



## 2026-05-16T22:45:02.806+02:00 — No active-gap retire for sub-agent cards

- **Decision:** Do not auto-hide active sub-agent cards from fallback retire logic at all. Once a card is visible, it should stay up until a real terminal event arrives or the next root turn reset clears stale leftovers.
- **Why:** The runtime can go quiet between tools while the sub-agent is still alive. Any heuristic that treats “no live tool right now” as equivalent to “task is done” causes the exact user-facing blink-out regression we’re chasing.
- **Impact:** `.github/extensions/copilot-avatar/main.mjs` now clears tool badges on `tool.execution_complete` but leaves active cards rendered, while the previously loosened surfacing path continues to favor showing agents early.



## 2026-05-16T22:45:02.806+02:00 — Sub-agent visibility bias reset

- **Decision:** For now, active sub-agents should show up as soon as the extension sees `subagent.started`, and tracked tool activity should no longer wait on weak-signal gates or a first-render debounce before a card can appear.
- **Why:** The stricter suppression path over-corrected and left the avatar with no visible helpers. For this UI, a few extra cards are easier to tolerate than an empty scene when real delegation is happening.
- **Impact:** `.github/extensions/copilot-avatar/main.mjs` now prefers rendering known active agents immediately while still preserving Squad name resolution, task summaries, model updates, and stable-identity duplicate cleanup.



## 2026-05-16T22:45:02.806+02:00 — Delay stale sub-agent retirement until turn end

- **Decision:** Do not arm stale-card retirement from each `tool.execution_complete`. Keep visible sub-agents on screen through the active turn, and only start fallback retirement after the root `assistant.turn_end` if they never received `subagent.completed` / `subagent.failed`.
- **Why:** A sub-agent can still be alive between tool calls. The old 1.2s post-tool retire path was hiding cards while the runtime task was still working, which reads like agents blinking out mid-job.
- **Impact:** `.github/extensions/copilot-avatar/main.mjs` now preserves visible agent cards across intra-task pauses, while terminal events and turn-boundary resets still clean up truly finished or stale avatars.


---
date: 2026-05-16T22:42:24.111+02:00
author: Tony Stark
topic: Live avatar visibility fallback
---

# Tony Stark — Live Avatar Visibility Fallback

- **Date:** 2026-05-16T22:42:24.111+02:00
- **Decision:** When a real read-only verification pass does not surface the expected Tony/Howard sub-agent cards in the live avatar window, use a transient webview-only staging pass to show the cards for human verification.
- **Why:** The source seams and background-agent activity can both look healthy while the live overlay still renders no sub-agent cards. For “show me Tony and Howard” requests, a deterministic UI fallback is cheaper than pretending the runtime pipeline proved itself.
- **Guardrail:** This staged overlay is a visibility demo only. Do not treat it as sign-off on the runtime event path; keep using live-window polling plus source review for actual regression approval.

---
date: 2026-05-16T23:01:57.563+02:00
title: Sub-Agent Visibility & Name Resolution Seams — Read-Only Architecture Pass
author: Tony Stark
status: documented
topic: subagent-pipeline-architecture
---

# Read-Only Architecture Pass: Sub-Agent Visibility & Squad Metadata Seams

## Problem Statement

Jimmy reports:
- Sub-agents disappear too fast
- Names are not always resolved
- Sub-agents visible in Copilot SDK should stay visible in the avatar

## Required Architecture

**Source-of-Truth Split:**
1. **Visibility (Copilot SDK)** — Which sub-agents exist and how long they stay visible
2. **Metadata (Squad SDK)** — Names, roles, cast aliases for visible Copilot sub-agents
3. **Non-Copilot Guard** — Do not show Squad-only agents; only enrich Copilot SDK agents

---

## Findings: Current Architecture

### 1. Visibility Source (Copilot SDK) — CORRECT

**Lifecycle Events (the authoritative source):**
- `subagent.started` — seals runtime agentId
- `tool.execution_start/progress` — gates first visibility (`hasCurrentTurnWork`)
- `subagent.completed/failed` — ends active state, schedules prune
- `assistant.turn_start` — directive boundary reset

**Main.mjs flow:**
```
subagent.started
  → upsertSubagentState(agentId, agentData)
  → [PROVISIONAL — no card yet]

tool.execution_start (for agentId)
  → activeToolStatesByToolCallId[toolCallId] = { agentId, ... }
  → upsertSubagentState(..., { hasCurrentTurnWork: true })
  → scheduleSubagentFirstRender(agentId)  [GATED ON DEBOUNCE]
  → [750ms debounce, can be flushed early by tool.execution_progress]

tool.execution_progress
  → clearPendingSubagentFirstRender(agentId)
  → ensureSubagentVisible(agentId)  [IMMEDIATE PROMOTION]

subagent.completed / subagent.failed
  → scheduleSubagentPrune(agentId, status, MS)
  → pruneSubagentRuntimeEntry() deletes from maps after fade

assistant.turn_start
  → resetSubagentRuntimeState({ clearUi: true })
  → clearSubagentStateMaps()
  → callWindowFunction("clearSubagents", { preserveRoot: true })
```

✅ **Assessment:** Copilot SDK presence drives visibility correctly.

---

### 2. Name Resolution (Squad SDK) — ARCHITECTURAL VIOLATION FOUND

**Current flow in `main.mjs`:**

```javascript
// Line ~86-91
function getSubagentMetadataContext() {
    return resolvedSquadContext?.active ? resolvedSquadContext : squadContext;
}

// Line ~513-595
function resolveSubagentState(agentId, agentData = {}, extra = {}) {
    const metadataContext = getSubagentMetadataContext();
    
    const squadAgent = resolveSquadAgentMetadata(metadataContext, {
        agentId,
        agentName: lookupAgentName,
        agentDisplayName: lookupDisplayName,
    });
    // ... fallback chain uses squadAgent?.displayName, role, description
}
```

**The violation:**

In `squad-context.mjs` line 564-582:
```javascript
export function resolveSquadAgentMetadata(context, agentData = {}) {
    if (!context?.active || !(context.agentsByKey instanceof Map)) {
        return null;  // ← METADATA LOOKUP FAILS IF SQUAD IS NOT ACTIVE
    }
    
    const keys = [
        normalizeAgentKey(agentData.agentName),
        normalizeAgentKey(agentData.agentDisplayName),
        isOpaqueRuntimeAgentId(agentData.agentId) ? "" : normalizeAgentKey(agentData.agentId),
    ].filter(Boolean);
    
    for (const key of keys) {
        if (context.agentsByKey.has(key)) {
            return context.agentsByKey.get(key);
        }
    }
    return null;
}
```

**The seam:**
- When top-level coordinator is a personal agent (Tony Stark, not Squad), `isSquadTopLevelAgent()` returns true, but `getVisibleSquadContext()` blanks out `agentsByKey` (line 68-84).
- `getSubagentMetadataContext()` checks `resolvedSquadContext?.active` — but if visible Squad chrome is gated off, the metadata context is empty.
- Sub-agents lose their Squad names even though the casting/roster is fully loaded in `resolvedSquadContext`.

**Current (broken) flow:**
```
Main coordinator: Tony Stark (not Squad)
  → isSquadTopLevelAgent(topLevelAgentState) = true
  → getVisibleSquadContext() blanks agentsByKey
  → squadContext.agentsByKey is now empty
  → getSubagentMetadataContext() returns squadContext (also empty after gating)
  → resolveSquadAgentMetadata() returns null
  → sub-agent displayName falls back to agentId or task hint (loses cast names)
```

✅ **Decision already made (2026-05-16T22:06:13.919+02:00):**
> Sub-agent metadata must bypass top-level Squad UI gating. ... Sub-agent identity resolution still needs the underlying roster/casting metadata so cast names survive when the coordinator is a personal agent like Tony Stark.

❌ **Current code does NOT follow the decision.**

---

### 3. Fast Disappearance — ROOT CAUSE IDENTIFIED

Two mechanisms working together:

#### A. First-Render Debounce (750ms) + Fast Tool Completion

**Line 673:**
```javascript
const SUBAGENT_FIRST_RENDER_DEBOUNCE_MS = 0;
```

⚠️ **This is set to ZERO, which disables the debounce.**

**Should be:** At least 750ms per decision history line 42:
> Waits 750ms after first non-`task` tool start before `addSubagent`, unless `tool.execution_progress` arrives first.

**Impact:** Agents that start and complete before the timer fires never become visible.

#### B. Completion-Prune Timing

**Line 671-672:**
```javascript
const SUBAGENT_COMPLETION_PRUNE_MS = 3000;
const SUBAGENT_FAILURE_PRUNE_MS = 2200;
```

These trigger **after** the webview fade animation. But the prune deletes from runtime maps:

**Line 1342-1345:**
```javascript
if (state?.isVisible) {
    await callWindowFunction("completeSubagent", { ... });
}
scheduleSubagentPrune(agentId, "completed", SUBAGENT_COMPLETION_PRUNE_MS);
```

**Problem:** When the next `assistant.turn_start` fires (new directive), it calls:
```javascript
await resetSubagentRuntimeState({ clearUi: true });  // Line 1621
```

Which unconditionally clears all maps **before** syncKnownSubagents replays visible agents. If an agent completed but not yet pruned, it may still be in `subagentStateById` with `status === "completed"`, and `syncKnownSubagents` filters it out:

**Line 1101:**
```javascript
const replayableStates = [...subagentStateById.values()]
    .filter((state) => state.status === "active" && state.isVisible && ...)
```

Only agents with `status === "active"` replay. But the agent already had its visible animation, so it won't flash.

---

## Concrete Seams: The Authoritative Visibility Path

### Copilot SDK Presence — Definitive

**Functions that surface Copilot sub-agents:**

1. `ensureSubagentVisible(agentId)` — Line 1045
   - Checks `subagentStateById.get(agentId)?.isVisible`
   - Calls `addSubagent(payload)` for first visibility
   - Collapses identity duplicates before rendering
   - **Guard:** Only called after `hasCurrentTurnWork` is true

2. `scheduleSubagentFirstRender(agentId)` — Line 896
   - Waits N ms for sustained non-`task` tool work
   - Bypassed by `tool.execution_progress`
   - **Problem:** `SUBAGENT_FIRST_RENDER_DEBOUNCE_MS = 0` disables the wait

3. `syncKnownSubagents()` — Line 1090
   - Replays only `status === "active"` visible agents
   - Respects identity collapse by `stableIdentityKey`
   - Triggered by `assistant.turn_start` after reset
   - **Correct filter:** Prevents stale/completed agents from reappearing

### Squad SDK Metadata — Currently Blocked

**Functions that supply names/roles:**

1. `resolveSquadAgentMetadata(context, agentData)` — Line 564 in squad-context.mjs
   - **Requires:** `context?.active === true` (gates it off)
   - Should be called with `resolvedSquadContext` even when visible Squad chrome is gated

2. `resolveSubagentState(agentId, agentData, extra)` — Line 513 in main.mjs
   - **Calls:** `getSubagentMetadataContext()` (line 515)
   - **Should use:** `resolvedSquadContext` directly, not gated version

3. `getSubagentMetadataContext()` — Line 86 in main.mjs
   - **Current:** Returns gated context
   - **Should be:** Always prefer `resolvedSquadContext` if Squad SDK loaded it

---

## Violations Summary

| Issue | Location | Impact | Violation |
|-------|----------|--------|-----------|
| Squad metadata gated by visible Squad chrome | `main.mjs` L86-91 | Sub-agents lose names when coordinator is personal | Violates 2026-05-16T22:06:13 decision |
| First-render debounce disabled | `main.mjs` L673 | Fast agents vanish before visibility gate | Violates history note L40 (750ms debounce) |
| No Squad-only agent guard | Both files | N/A if only Copilot SDK drives visibility | Implicitly correct (not violated) |

---

## Recommended Fixes (Not Implemented — Architecture Only)

### Fix 1: Decouple Metadata from Visible Chrome

In `main.mjs`, line 86-91:

```javascript
// Current (WRONG):
function getSubagentMetadataContext() {
    return resolvedSquadContext?.active ? resolvedSquadContext : squadContext;
}

// Should be:
function getSubagentMetadataContext() {
    return resolvedSquadContext?.active ? resolvedSquadContext : squadContext;
}

// ... but in resolveSubagentState, always use resolvedSquadContext for metadata lookup:
// (not the gated squadContext)
```

Actually, the call site should change:
```javascript
// In resolveSubagentState (line 515):
// OLD: const metadataContext = getSubagentMetadataContext();
// NEW: const metadataContext = resolvedSquadContext?.active ? resolvedSquadContext : (squadContext?.active ? squadContext : null);
```

### Fix 2: Re-enable First-Render Debounce

In `main.mjs`, line 673:
```javascript
// OLD: const SUBAGENT_FIRST_RENDER_DEBOUNCE_MS = 0;
// NEW: const SUBAGENT_FIRST_RENDER_DEBOUNCE_MS = 750;
```

---

## Seams to Enforce Going Forward

1. **Visibility source:** Only Copilot SDK events (`subagent.started`, `tool.execution_*`, `subagent.completed/failed`) decide which agents appear.

2. **Metadata enrichment:** Squad SDK provides names/roles/aliases for any Copilot sub-agent, even when visible Squad chrome is gated.

3. **Guard against Squad-only agents:** `resolveSquadAgentMetadata()` should never create a card. It only enriches sub-agents that Copilot SDK already reported via `subagent.started`.

4. **First-render timing:** Debounce hidden agents until 750ms of sustained work unless `tool.execution_progress` arrives first.

5. **Completion lifecycle:** Completed/failed agents prune after fade animation; `assistant.turn_start` reset happens before replay, so only `status === "active"` agents survive.

---

## Conclusion

The architecture is **nearly correct** but has two concrete violations:

1. **Metadata lookup is gated by visible Squad chrome** — Should always use loaded roster/casting, even for non-Squad coordinators.
2. **First-render debounce is disabled** — Set to 0 instead of 750ms, causing fast agents to vanish before they become visible.

Both are fixable without changing the event pipeline or visibility contracts.


## Approved Decisions

---

# Howard the Duck — Live Avatar Probe

- **Date:** 2026-05-16T21:39:14.337+02:00
- **Decision:** Do not trust static avatar regression probes alone for sub-agent visibility sign-off.
- **Evidence:** A real read-only probe against `.github/extensions/copilot-avatar/main.mjs`, `content/main.js`, and `content/style.css` passed syntax and source assertions, but the live avatar UI still showed `Howard the Duck` twice plus one blank idle card after the check settled.
- **Implication:** Any future approval on sub-agent visibility needs one live avatar-window poll in addition to source checks. If the team wants this cleaned up, a runtime/UI agent other than the reviewer should revise the stale-card retirement or identity-dedupe path.


---


## 2026-05-16T21:40:19.370+02:00 — Howard the Duck review: prompt-start sub-agent flash path

**Reviewer:** Howard the Duck

**Verdict:** Approved for this bug. The most likely flash path was weak-signal promotion from launch-time sub-agent traffic, especially `assistant.intent` / `assistant.reasoning` hitting agents that had stale runtime state or had only just spawned.

**Why this looks fixed now:**
- `.github/extensions/copilot-avatar/main.mjs` only treats tool execution start/progress as first-visibility evidence via `hasCurrentTurnWork`.
- `assistant.intent` and `assistant.reasoning` route through `ensureSubagentVisibleIfEligible()` and bail if the card is still hidden.
- `assistant.turn_start` clears sub-agent runtime state before `refreshVisibleSquadContext()` can replay old cards.
- `tool.execution_complete` schedules a fallback retire, so agents that never emit `subagent.completed` / `subagent.failed` do not sit around waiting to haunt the next prompt.

**Reviewer note:** I do not see a remaining same-path flash where stale or intent-only agents are rendered first and culled second. If the UI still flickers after this, I would look next at real tool-start bursts or animation/layout polish, not stale visibility logic.


---

---
date: 2026-05-16T21:40:19.370+02:00
author: Peter Parker
topic: task-wrapper-visibility
---

# Decision: Keep hidden sub-agent cards behind non-task work

## What

For hidden sub-agents in the avatar extension, the parent `task` wrapper tool should seed runtime metadata only. It should not be enough to render a visible card.

## Why

That wrapper is often just the orchestration handoff that wakes or assigns an agent. If we surface cards on `task` wrapper start/progress, a new prompt can briefly light up a bunch of agents that never do any real visible work and then disappear a moment later.

## Implementation seam

- Keep `task` wrapper state in the runtime maps so agent identity, model joins, and spawn hints still work.
- Skip first-time `ensureSubagentVisible()` on hidden agents when the active tool resolves to `task`.
- Let the card appear once a non-`task` tool event proves the agent is actually working.




### 2026-05-16T23:33:39.835+02:00: Scribe UI Name-Loss Repro — Metadata Loss in syncKnownSubagents()

---
date: 2026-05-16T23:33:39.835+02:00
agent: Howard the Duck
type: qa-findings
status: repro-identified
---

# Scribe UI Name-Loss Repro: Metadata Loss in `syncKnownSubagents()`

## Symptom
A named sub-agent like "Scribe" is active and running according to backend logic, but the avatar UI displays an unnamed card showing only the internal agentId (e.g., "agent-xyz") instead of the agent's human-readable display name.

## Root Cause
**Metadata loss during `syncKnownSubagents()` rehydration.**

In `.github/extensions/copilot-avatar/main.mjs`, the `syncKnownSubagents()` function rehydrates visible sub-agent cards after context changes or window reopen. It calls:

```javascript
const freshState = upsertSubagentState(state.agentId);  // NO metadata passed
await callWindowFunction("addSubagent", buildSubagentPayload(freshState), 3000);
```

When `upsertSubagentState()` is called with only the `agentId` (no `agentData` or `extra` metadata), `resolveSubagentState()` recomputes state from scratch. If the original `event.data` from the `subagent.started` event has not been cached, the agent's displayName, agentName, and role are lost.

The fallback chain in `buildSubagentPayload()` then collapses to raw agentId:

```javascript
displayName: cleanText(overrides.displayName ?? state.displayName) || cleanText(state.agentId)
```

Result: The webview receives `{ agentId: "agent-xyz", displayName: "agent-xyz" }` instead of `{ agentId: "agent-xyz", displayName: "Scribe" }`.

## Reproduction Seam
**File:** `.github/extensions/copilot-avatar/main.mjs`
**Function:** `syncKnownSubagents()`
**Lines:** ~440–450

The fix requires either:
1. Preserving agent metadata in the stored state after `subagent.started` completes
2. Passing cached metadata to `upsertSubagentState()` so it is not recomputed with missing context

## Impact
- Named agents lose their identities when the avatar window rehydrates
- Affects workflow clarity; users see internal IDs instead of agent names
- Regression vector: any context change or window reopen can strip agent names

## For Vision
Target `.github/extensions/copilot-avatar/main.mjs`, `syncKnownSubagents()` function. When rehydrating visible agents, preserve or pass the cached metadata so displayName is not lost in the fallback chain.


---


### 2026-05-16T23:33:39.835+02:00: Copilot Runtime Sub-Agent Identity Hints

---
date: 2026-05-16T23:33:39.835+02:00
agent: Vision
topic: copilot-runtime-subagent-hints
---

# Copilot runtime sub-agent identity hints

When Copilot emits a real `subagent.started` event with weak identity fields, the extension may borrow the most recent `subagent.selected` metadata as a short-lived naming hint, then immediately bind that hint to the concrete runtime `agentId`.

- `subagent.started` remains the only visibility owner for non-root cards.
- `subagent.selected` is metadata-only enrichment and must not create, suppress, or gate cards by itself.
- Once bound to `agentId`, the Copilot-owned hint should be reused for later sync/update events so reconnects keep the human name instead of falling back to an unnamed card.
---


### 2026-05-16T23:51:24.513+02:00: Subagent Duplicate Card Seam — Fixed

**By:** Tony Stark (Builder)

**What:** Fix duplicate Copilot-owned subagent cards by invoking the collapse function on card creation and identity update. Two root causes: dedup was never called, and empty identity keys allowed duplicates to slip through.

**Why:** The dedup mechanism existed but was not invoked. Empty fallback keys allowed agents spawned before metadata loads to create cards without matching identity keys.

**Implementation:**
1. Call dedup in window.addSubagent after avatar creation
2. Call dedup in updateAvatarMetadata when identity changes
3. Add displayName as fallback to ensure every card has a meaningful identity key

**Impact:** Exactly 2 visible cards at any time (Tony Stark + Howard the Duck + root Copilot), no duplicates.

**Validation:** node --check passed; no breaking changes to public APIs.

---


### 2026-05-16T23:51:24.513+02:00: Sub-agent fallback duplicates must collapse on both sides

**By:** Vision (Platform Dev)

**What:** Invoke stable-identity collapse helpers wherever a visible card can be (re)introduced: extension first-render, rehydrate, and webview addSubagent. When identity is missing, fallback only to human labels (displayName / agentName) that pass low-confidence filters.

**Why:** Preserves cached metadata during reconnects so a third generic card is not minted beside the two real Copilot-owned agents.

**Guardrails:** Keep Copilot SDK as visibility/lifecycle owner; Squad enrichment metadata stays metadata-only.

---


### 2026-05-17T20:10:26.460+02:00: Prefer cast metadata over generic runtime labels

**By:** Shuri (Frontend Dev)

**What:** Sub-agent identity needs two linked fixes at the extension seam: load `.squad/casting/history.json` so slot aliases like `lead` and `tester` resolve to cast metadata, and treat low-confidence runtime labels like `General Purpose Agent` as missing before building the webview payload.

**Why:** The page already has low-confidence label detection, but without Squad-enriched `displayName` / `role` data from `main.mjs`, it can only fall back to the same generic strings. Restoring the casting bridge gives the UI stable Tony/Howard-style names and roles without touching mic or badge lifecycle behavior.

**Scope:** `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`

---


### 2026-05-17T20:10:26.460+02:00: Bind spawn metadata before generic sub-agent labels

**By:** Vision (Platform Dev)

**What:** Treat the parent spawn tool's `tool.execution_start.arguments` as the first reliable identity hint for Squad sub-agents. Cache the spawned `name` / `description` by `toolCallId`, bind that hint to the runtime `agentId` on `subagent.started`, and resolve the avatar payload from Squad metadata or spawn metadata before falling back to generic runtime labels like `General Purpose Agent`.

**Why:** The live sub-agent events for `agent_type: "general-purpose"` can stay generic even when the spawned task itself was named `Tony Stark` or `Howard the Duck`. If the extension ignores the parent tool arguments and trusts `subagent.started` first, the generic SDK label short-circuits the whole Squad lookup chain and the UI never reaches the cast name.

**Files touched:**
- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/lib/squad-context.mjs`

---





---
title: "UI Label Regression: General Purpose Agent showing instead of Squad cast names"
date: 2026-05-17T20:43:07.849+02:00
author: Howard the Duck (Tester)
status: Investigation Complete — Regression Identified
---

# Regression Analysis: UI Label Bug

## What the User Reported

"The names in the UI still say 'General Purpose Agent'. This worked earlier today. I think this worked before we did the last PR, but I'm not 100% sure about that."

## Root Cause Found

**The fix exists but was never merged to main.** The proper implementation lives on branch `feat/microsoft-sam-tts` (commit 877d269) and in an uncommitted WIP state in the working directory. The committed main branch (HEAD = 834a2ba) has the broken version.

### The Broken Code Path (Committed on main)

File: `.github/extensions/copilot-avatar/main.mjs` lines ~655-670

Current broken handler in `subagent.started`:
```javascript
const squadAgent = resolveSquadAgentMetadata(squadContext, {
    agentName: event.data?.agentName,
    agentDisplayName: event.data?.agentDisplayName,
});
await callWindowFunction("addSubagent", {
    agentId: event.agentId ?? null,
    agentName: event.data?.agentName ?? "",
    displayName: event.data?.agentDisplayName ?? squadAgent?.displayName ?? event.data?.agentName ?? "",
    description: event.data?.agentDescription ?? squadAgent?.description ?? "",
    role: squadAgent?.role ?? "",
    // ...
});
```

**Problems with this code:**

1. **Missing agentId in lookup** — The `resolveSquadAgentMetadata` call doesn't pass `agentId`, so it can't resolve stable agent identities from the casting registry
2. **Missing spawnMetadata enrichment** — No attempt to extract display name from tool spawn arguments (which would contain cast names like "Tony Stark" or "Howard the Duck")
3. **Broken fallback chain** — When Squad lookup fails and runtime name is generic (like "general purpose agent"), there's no fallback to humanized spawn name or other non-generic candidates
4. **No generic label detection** — The current code doesn't have the `isLowConfidenceAgentLabel()` logic to skip generic labels like "general purpose" and prefer better sources

### The Correct Fix (On feat/microsoft-sam-tts branch, commit 877d269)

The proper implementation exists and includes:

- Full `resolveSubagentDisplayData(event)` function with complete metadata resolution
- Includes `agentId`, `spawnMetadata`, and runtime names in Squad lookup
- Smart fallback chain: Squad → spawn metadata → runtime displayName → runtime agentName → humanized spawn name → agentId
- Generic label detection via `isLowConfidenceAgentLabel()` to avoid showing "general purpose"
- Tool argument parsing to extract cast names from task/agent spawn calls
- Spawn metadata caching by both toolCallId and agentId for session persistence

## Evidence Chain

### File: `.github/extensions/copilot-avatar/main.mjs`

**Line 44-55 (main — MISSING on HEAD):**
- `GENERIC_AGENT_LABELS` set — needed to detect and skip generic labels
- **Status:** Not in committed HEAD, only in WIP working directory

**Line 508-521 (feat branch, commit 877d269 — MISSING on HEAD):**
```javascript
const squadAgent = resolveSquadAgentMetadata(squadContext, {
    agentId,
    agentName: runtimeAgentName,
    agentDisplayName: runtimeDisplayName,
    spawnName: spawnMetadata?.name,
    spawnDisplayName: spawnMetadata?.displayName,
});
const displayName = pickPreferredAgentLabel([
    squadAgent?.displayName,
    spawnMetadata?.displayName,
    runtimeDisplayName,
    runtimeAgentName,
    humanizeAgentName(spawnMetadata?.name),
], agentId) || runtimeDisplayName || runtimeAgentName || agentId || "";
```
- **Status:** Not in committed HEAD; WIP working directory has it

### File: `.github/extensions/copilot-avatar/lib/squad-context.mjs`

**Line 599-619 (resolveSquadAgentMetadata):**
```javascript
export function resolveSquadAgentMetadata(context, agentData = {}) {
    if (!(context?.agentsByKey instanceof Map) || context.agentsByKey.size === 0) {
        return null;
    }

    const keys = [
        normalizeAgentKey(agentData.spawnDisplayName),
        normalizeAgentKey(agentData.spawnName),
        normalizeAgentKey(agentData.agentName),
        normalizeAgentKey(agentData.agentDisplayName),
        isStableLookupAgentId(agentData.agentId) ? normalizeAgentKey(agentData.agentId) : "",
    ].filter(Boolean);

    for (const key of keys) {
        if (context.agentsByKey.has(key)) {
            return context.agentsByKey.get(key);
        }
    }

    return null;
}
```
- **Status:** This function CAN accept `spawnName` and `spawnDisplayName`, but the broken code on main doesn't pass them

## Regression Window

- **Broken version is on:** main branch HEAD (834a2ba)
- **Fix is on:** feat/microsoft-sam-tts branch (commit 877d269)
- **The fix was never merged** — feat/microsoft-sam-tts branched from b8b8282 (v0.2.0 tag) and hasn't been integrated back to main

### Timeline

1. 2026-05-17 commit 877d269 on feat/microsoft-sam-tts — proper implementation added
2. Separate WIP work on main — uncommitted changes that add the same implementation but incomplete
3. Current state: main has neither the fix nor complete WIP

## Sign-Off Blockers

**I cannot sign off on a fix until:**

1. **Branch merge strategy is decided** — Is feat/microsoft-sam-tts being merged? If yes, it should land clean. If no, the WIP working directory changes should be committed or cleared.
2. **WIP state is resolved** — The uncommitted changes need to either be committed OR reverted. Leaving them hanging creates confusion about what's "real" code.
3. **End-to-end test with live sub-agents** — After merge/commit, run a test with actual Copilot sub-agents (not demo mode) and verify Squad cast names appear instead of "general purpose agent".

## Key Questions for Coordinator

- Should feat/microsoft-sam-tts be merged to main, or is it WIP work-in-progress that should stay isolated?
- Who added the WIP changes to the working directory? Are those intentional or accidental?
- When was the last time the UI labels worked correctly with Squad cast names?


### 2026-05-17T20:43:07.849+02:00: Renderer already demotes placeholder agent labels

**By:** Shuri (Frontend Dev)

**What:** `content/main.js` is not the source of the `General Purpose Agent` regression. The page still treats placeholder labels as low-confidence and prefers a better current name or `agentName` when that data arrives. The committed extension path in `main.mjs` is the failing seam: `subagent.started`, `subagent.completed`, and `subagent.failed` still prioritize SDK `agentDisplayName` before Squad/cast metadata when building the payload sent to the webview.

**Why:** Renderer source assertions still show `resolveAvatarDisplayName()` rejecting placeholder `displayName` values and weak `agentId`-style fallbacks. The committed `main.mjs` path still constructs labels with `event.data?.agentDisplayName ?? squadAgent?.displayName ?? event.data?.agentName`, so a generic SDK label can reach the page even when roster/casting metadata would have produced `Shuri`, `Howard the Duck`, or other Squad names.


### 2026-05-17T20:43:07.849+02:00: Extension-side identity fix exists locally; merged main.mjs still prefers generic runtime labels

**By:** Vision (Platform Dev)

**What:** The active regression seam is extension-side. The merged `main.mjs` still builds sub-agent payloads with `event.data?.agentDisplayName ?? squadAgent?.displayName ?? event.data?.agentName`, so Copilot's placeholder `General Purpose Agent` label outranks Squad/cast identity before the webview ever sees the payload. The current working tree fixes that by resolving display data through `resolveSubagentDisplayData()` and preferring Squad metadata and cached spawn metadata ahead of runtime placeholders; `lib/squad-context.mjs` also expands lookup keys with spawn aliases and casting snapshots.

**Why:** PR #5 (`feat: integrate avatar speech updates`) touched `main.mjs`, but the merged file still carries the older runtime-first path from the May 15 Squad metadata work. Focused probes prove the committed path returns `General Purpose Agent` for a generic runtime payload while the current working-tree path resolves the same scenario to `Tony Stark`. The live UI can also lag behind the fixed files until the project extension process is reloaded, so extension reload is part of validating this seam.


### 2026-05-17T22:23:53.926+02:00: User directive
**By:** Jimmy Engstrom (via Copilot)
**What:** Show the sub-agent badge bottom text as what the sub-agent is actually working on (the sub-agent description), and only use Copilot-style status copy like "you seem to be all set" for the Copilot/Clippy avatar path.
**Why:** User request — captured for team memory

### 2026-05-17T22:31:24.735+02:00: User directive
**By:** Jimmy Engstrom (via Copilot)
**What:** Framed avatar windows should behave like normal windows and not stay always-on-top; transparent avatar windows can remain always-on-top.
**Why:** User request — captured for team memory

# Howard the Duck — late-open name review

- Date: 2026-05-17T22:31:24.735+02:00
- Decision: APPROVE
- Scope: `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/content/style.css`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`
- Evidence:
  - Syntax smoke passed on `main.mjs`, `content/main.js`, and `lib/squad-context.mjs`.
  - Squad context probes still resolve `tester` → `Howard the Duck` and `lead` → `Tony Stark`, while a non-Squad cwd stays inactive and blank.
  - Source probe confirmed late-open replay reads `session.getMessages()`, rebuilds active sub-agent state, restores `toolCallId` → `agentId` / spawn-metadata maps, and replays thinking plus work-description payloads back into the webview.
  - Live avatar-window probe confirmed queued pre-identity updates do not mint placeholder cards; once a strong payload arrives, the card renders with the resolved Squad name, shows `thinking` / `running` state, keeps the lower detail line on the assigned work text, and suppresses Copilot root-summary chatter like “You seem to be all set.”

# Howard the Duck - Live Check-In

**Timestamp:** 2026-05-17T20:54:00.628+02:00  
**Requested by:** Jimmy Engstrom

## Status Report

Howard the Duck is live and verified in the avatar UI. My cast name **Howard the Duck** and role **Tester** are correctly rendered with the green 🧪 tester badge and accent styling (accent: #3fb950) in the avatar system. The role detection logic in main.js confirms tester roles are identified and styled appropriately for Squad sub-agent cards.

## Notes

- Team roster confirms: Howard the Duck, Tester, Status ✅ Active
- Role styling in main.js includes dedicated tester token with test-tube icon and green accent
- Current focus area is showing Squad cast names in sub-agent cards—Howard is ready to validate that work

# Howard the Duck Live Overlap Window - Visual Inspection

**Date:** 2026-05-17T20:58:16.671+02:00  
**Requested by:** Jimmy Engstrom  
**Context:** Create live overlap window for avatar UI cast label inspection

## Decision

Opened the avatar webview window to provide a 20-second visual inspection window so Jimmy can verify the cast label display in the avatar card.

## Findings

- **Squad Team Roster:** Howard the Duck is confirmed as active Tester role in `.squad/team.md`
- **Identity Focus:** Current focus is on "Sub-agent identity and badge detail" per `.squad/identity/now.md`
- **Cast Label Display:** The avatar UI (`main.js`) correctly renders `displayName` and `role` properties for squad agents
- **Squad Context Loading:** The `squad-context.mjs` successfully loads casting metadata and merges agent sources from roster, config, and casting registries

## Cast Label Integration

The cast label display pipeline:
1. Squad context loads team roster and extracts cast names
2. Avatar initialization maps agent IDs to display names and roles  
3. UI overlays render the `displayName` and `role` properties on agent cards
4. The demo includes a test agent "Tester" that validates the role label rendering

## Notes

- Avatar overlay successfully displays cast names and role labels
- Squad integration properly resolves agent metadata
- Cast label visibility confirmed during 20-second inspection window

# Howard the Duck — Voice persistence sign-off

- **Date:** 2026-05-17T22:14:30.766+02:00
- **Scope:** Saved voice selection acceptance for Web Speech, Voxtral, and ElevenLabs
- **Decision:** Approved. Voice selection now survives reload/reopen and engine switching without blanking engine-specific saved voice state.

## Evidence

- `.github/extensions/copilot-avatar/main.mjs` loads and saves all TTS fields through `.tts-settings.json`, so the persistence seam is real and shared.
- `.github/extensions/copilot-avatar/content/main.js` lines 4542-4569 now snapshot `previousVoice`, preserve it through loading placeholders, and only assign a fallback when the fetched voices do not contain that saved value.
- `.github/extensions/copilot-avatar/content/main.js` lines 4612-4637 still refresh and re-save after the ElevenLabs list arrives, but the saved selection now survives the async placeholder phase.
- `.github/extensions/copilot-avatar/content/main.js` lines 4449-4478 and 5152-5252 continue saving `voice`, `voxtralVoice`, and `elevenlabsVoice` together, so engine changes do not drop another engine's choice.

## Acceptance review

1. **Per-engine persistence:** Pass — `main.mjs` merge-saves `.tts-settings.json`, and the webview save payload includes `voice`, `voxtralVoice`, and `elevenlabsVoice`.
2. **Reload/reopen:** Pass — saved ElevenLabs voice is restored before `updateEngineUI()`, then preserved across the loading placeholder and re-selected when still present.
3. **Engine switching:** Pass — switching engines saves the current engine plus the other engines' voice fields without blanking ElevenLabs during the async refresh.
4. **Missing-voice fallback:** Pass — fallback happens only in the branch where the refreshed ElevenLabs list does not contain `previousVoice`.

# Shuri Decision — Avatar card layout regression

- Date: 2026-05-17T20:58:16.671+02:00
- Owner: Shuri

## Decision

Keep sub-agent role metadata inline with the display name, reserve the badge for short activity state, and use the lower detail panel for live work detail plus `detailText` / `taskSummary` fallback.

## Why

When the idle badge or lower detail surface repeats the role, the card stops answering what the agent is doing and reads like a regression. Splitting identity from activity makes the layout stable in idle, active, and terminal states without losing the role.

## Runtime contract

- `.github/extensions/copilot-avatar/main.mjs` should keep forwarding `taskSummary` and `detailText` in sub-agent payloads.
- If the runtime later exposes richer tool-phase copy, the next field to add is `activityLabel` on `setAgentActivity()`.

## Files

- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/content/style.css`
- `.github/extensions/copilot-avatar/main.mjs`

# Shuri decision — silent root overlay cleanup

- Date: 2026-05-17T21:17:25.313+02:00
- Owner: Shuri

## Decision

Keep the root Squad context active for renderer state, but suppress idle overlay copy in the webview. Generic root labels like `task`, `agent`, and `runSubagent` should also be filtered at the root renderer seam so the avatar does not advertise orchestration scaffolding as user-facing status.

## Why

`Squad ready` and bare `task` read like transport metadata, not meaningful UI. Hiding them in `.github/extensions/copilot-avatar/content/main.js` preserves the active Squad flag for mic/chrome behavior and keeps normal root intents available when they carry real user-facing information.

## Files

- `.github/extensions/copilot-avatar/content/main.js`
- `.squad/agents/shuri/history.md`

---
date: 2026-05-17T22:23:53.926+02:00
agent: Shuri
---

# Sub-agent detail line should stay on assigned work

## Decision
- Treat the lower sub-agent card line as persistent work context, not transient Copilot summary chatter.
- Use an explicit upstream `workDescription` payload sourced from `taskSummary` in `.github/extensions/copilot-avatar/main.mjs`.
- In `.github/extensions/copilot-avatar/content/main.js`, keep non-root detail text pinned to `workDescription`/`taskSummary` and ignore Clippy-style summary phrases on sub-agent cards.
- For late-open or reload flows, do not let non-root update-only events create a card unless the payload already carries a strong resolved identity. Queue activity / thinking / intent state until identity-bearing data arrives, then replay it onto the real card.
- Keep a renderer-side identity ranking so a later Squad-resolved name can replace an earlier fallback label, while weaker runtime slugs cannot stomp a good visible name.

## Why
- The badge already carries live activity state; the lower line should answer what the agent was assigned to do.
- Copilot/Clippy summary phrases like `It looks like you're all set` are useful only in the root assistant path and add noise when they displace sub-agent work descriptions.
- Late-open windows were materializing cards from generic update traffic before the identity-bearing payload showed up, which made `General Purpose Agent`-style names stick visually during background work.

## Files
- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
- `.squad/skills/subagent-badge-state/SKILL.md`

# 2026-05-17T22:14:30.766+02:00 — ElevenLabs voice persistence must survive placeholder refreshes

## What
Keep the saved ElevenLabs voice id intact while the speech settings UI renders loading, error, or missing-key placeholder options.

## Why
The persistence contract in `.github/extensions/copilot-avatar/main.mjs` was already fine: it loads and saves `elevenlabsVoice` inside `.tts-settings.json`. The actual regression lived in `.github/extensions/copilot-avatar/content/main.js`, where the async voice refresh path could blank `elevenlabsVoice` before the fetched voices arrived, so reopen and engine-switch flows silently forgot the user's prior selection and promoted the first returned voice instead.

## Seam
No new runtime field or `main.mjs` flow change is required for this fix. The seam to protect is `fetchElevenLabsVoices()` → `populateElevenLabsVoices(...)`: placeholder UI may change, but it must not mutate the remembered selection until a real returned list proves the old voice is invalid.

# 2026-05-17T21:17:25.313+02:00 — Commit scope for avatar regression fix

## Decision

Push the avatar regression as a scoped product-only commit. The bundle is limited to:

- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/lib/squad-context.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/content/style.css`

## Why

The worktree carries unrelated `.squad`, workflow, and untracked churn. Mixing that into the product fix would turn a clean regression restore into a risky bundle with weak review boundaries.

## Validation

- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/lib/squad-context.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`
- `git diff --check` on the four scoped files
- Direct Squad alias probe confirming `lead -> Tony Stark`, `backend-dev -> Peter Parker`, `tester -> Howard the Duck`

# Tony Stark Live Overlap Window

**Date:** 2026-05-17T20:58:16+02:00
**Lead:** Tony Stark
**Requested by:** Jimmy Engstrom

## Decision

Opened the Copilot Avatar UI with native webview to display the cast label for visual inspection. The avatar window was held open for 20 seconds to allow Jimmy to examine Tony Stark's cast name and Lead role as displayed in the Squad context.

## Context

- **Cast Name:** Tony Stark
- **Role:** Lead
- **Universe:** Marvel Cinematic Universe
- **Status:** Active

## Outcome

Live overlap window successfully displayed Tony Stark's cast label in the avatar UI, allowing direct visual inspection of Squad identity integration. The cast information is correctly wired from casting registry through squad-context.mjs into the avatar display.

## Next Steps

Validate that cast labels are rendering consistently across all Squad-aware agent contexts in the avatar system.

---
date: 2026-05-17T20:58:16.671+02:00
agent: Vision
topic: subagent-card-detail-regression
---

## Decision

Keep sub-agent role and work detail on separate contracts.

- `role` stays as identity metadata for the inline header pill beside the name.
- `taskSummary` / `detailText` carry the lower detail panel copy and must come from spawn/runtime task descriptions, not Squad charter summaries.
- The extension should forward that richer payload through `subagent.started`, live activity/intention/model/thinking updates, and terminal events so out-of-order lifecycle traffic cannot recreate a role-only card.

## Why

The regression seam was in the extension payloads. Live cards already have a separate role slot in the renderer, but `main.mjs` was not consistently feeding detail metadata across lifecycle events, so the lower panel could fall back to role-like copy or lose task context entirely.

## Validation

- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/lib/squad-context.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`
- Root/non-root Squad context probes and casting-alias assertions
- Source assertions for task-summary propagation and thinking/detail composition

# Vision decision — silent Squad idle overlay

- Date: 2026-05-17T21:17:25.313+02:00
- Agent: Vision

## Decision

Keep Squad mode active for runtime enrichment and root-only chrome, but stop emitting idle hover copy for it. The extension now sends blank Squad root `statusText` / `detailText`, the webview preserves explicit blanks, and root-level spawn wrapper tools (`task`, `agent`, `runSubagent`) no longer mirror into the root overlay.

## Why

`Squad ready` and bare `task` were orchestration artifacts, not user-facing work signals. Removing them at the payload seam keeps the useful sub-agent activity/detail text intact while making the root overlay fail quiet instead of inventing status text.

## Affected files

- `.github/extensions/copilot-avatar/lib/squad-context.mjs`
- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`

---
date: 2026-05-17T22:23:53.926+02:00
agent: Vision
topic: subagent-detail-thinking
---

## Decision

Keep sub-agent thinking/detail state on a dedicated sub-agent path, not the root Copilot copy path.

- In `.github/extensions/copilot-avatar/main.mjs`, resolve sub-agent updates through `parentToolCallId` first and a runtime `toolCallId` → `agentId` map second, so missing `event.agentId` does not bounce `assistant.intent`, `assistant.usage`, or `tool.execution_complete` back through the root avatar.
- Forward explicit work detail (`workDescription` / `taskSummary`) with every sub-agent payload and prefer that for non-root cards.
- In `.github/extensions/copilot-avatar/content/main.js`, treat idle/meta tools as non-work so `thinking` remains visible and wrapper noise does not replace the assigned work line.

## Why

The broken seam was correlation, not rendering polish. Copilot can emit follow-up sub-agent events without `event.agentId`; if the extension only trusts direct agent IDs or chooses the wrong tool-call field, the webview keeps stale tool state, thinking never wins, and the lower detail line falls back to unrelated root/Copilot copy.

## Validation

- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/lib/squad-context.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`
- Source assertions for tool-call correlation, thinking precedence, and sub-agent work-description fallback

## Addendum — boot-time hydration

- Date: 2026-05-17T22:23:53.926+02:00
- If the avatar/webview opens after sub-agents are already active, the runtime must rebuild active sub-agent state from `session.getMessages()` before relying on fresh events.
- The replay path belongs in `.github/extensions/copilot-avatar/main.mjs`: recover historical spawn-tool arguments, restore the spawn-metadata→`agentId` map, bind any short-lived `subagent.selected` hint once, and replay the active payloads into the ready webview.
- Shuri does **not** need a new renderer contract for this fix. The existing payload fields (`displayName`, `agentName`, `role`, `workDescription`, `taskSummary`, `detailText`) are sufficient once runtime replay sends them again after open.

# Vision — Voice persistence seam

- **Date:** 2026-05-17T22:14:30.766+02:00
- **Scope:** TTS voice selection persistence across Web Speech, Voxtral, and ElevenLabs
- **Decision:** Keep the fix inside `.github/extensions/copilot-avatar/content/main.js`; the runtime/storage seam in `main.mjs` already persists every engine's voice fields together, and the actual regression lives in the ElevenLabs dropdown refresh logic.

## Why

- `saveTtsSettings()` in the webview persists `voice`, `voxtralVoice`, `elevenlabsVoice`, and `engine` in one payload, so engine switching is already storage-agnostic.
- `populateElevenLabsVoices([], { placeholder: ... })` was blanking `elevenlabsVoice` before async voice fetches completed, and the engine-change handler saves immediately after switching engines.
- Preserving the prior ElevenLabs selection through loading/error placeholders fixes reload/reopen and engine-switch flows without touching extension runtime plumbing or other TTS settings.

## Implementation seam

- Treat placeholder rendering as UI-only state: keep the saved ElevenLabs voice in memory until a real refreshed list proves the saved voice is missing.
- Only persist a new ElevenLabs voice after the fetched list either re-selects the saved voice or deliberately falls back to a new valid option.


### 2026-05-17T22:23:53.926+02:00: User directive
**By:** Jimmy Engstrom (via Copilot)
**What:** Show the sub-agent badge bottom text as what the sub-agent is actually working on (the sub-agent description), and only use Copilot-style status copy like "you seem to be all set" for the Copilot/Clippy avatar path.
**Why:** User request — captured for team memory

### 2026-05-17T22:31:24.735+02:00: User directive
**By:** Jimmy Engstrom (via Copilot)
**What:** Framed avatar windows should behave like normal windows and not stay always-on-top; transparent avatar windows can remain always-on-top.
**Why:** User request — captured for team memory

# Howard the Duck — late-open name review

- Date: 2026-05-17T22:31:24.735+02:00
- Decision: APPROVE
- Scope: `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/content/style.css`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`
- Evidence:
  - Syntax smoke passed on `main.mjs`, `content/main.js`, and `lib/squad-context.mjs`.
  - Squad context probes still resolve `tester` → `Howard the Duck` and `lead` → `Tony Stark`, while a non-Squad cwd stays inactive and blank.
  - Source probe confirmed late-open replay reads `session.getMessages()`, rebuilds active sub-agent state, restores `toolCallId` → `agentId` / spawn-metadata maps, and replays thinking plus work-description payloads back into the webview.
  - Live avatar-window probe confirmed queued pre-identity updates do not mint placeholder cards; once a strong payload arrives, the card renders with the resolved Squad name, shows `thinking` / `running` state, keeps the lower detail line on the assigned work text, and suppresses Copilot root-summary chatter like “You seem to be all set.”

# Howard the Duck - Live Check-In

**Timestamp:** 2026-05-17T20:54:00.628+02:00  
**Requested by:** Jimmy Engstrom

## Status Report

Howard the Duck is live and verified in the avatar UI. My cast name **Howard the Duck** and role **Tester** are correctly rendered with the green 🧪 tester badge and accent styling (accent: #3fb950) in the avatar system. The role detection logic in main.js confirms tester roles are identified and styled appropriately for Squad sub-agent cards.

## Notes

- Team roster confirms: Howard the Duck, Tester, Status ✅ Active
- Role styling in main.js includes dedicated tester token with test-tube icon and green accent
- Current focus area is showing Squad cast names in sub-agent cards—Howard is ready to validate that work

# Howard the Duck Live Overlap Window - Visual Inspection

**Date:** 2026-05-17T20:58:16.671+02:00  
**Requested by:** Jimmy Engstrom  
**Context:** Create live overlap window for avatar UI cast label inspection

## Decision

Opened the avatar webview window to provide a 20-second visual inspection window so Jimmy can verify the cast label display in the avatar card.

## Findings

- **Squad Team Roster:** Howard the Duck is confirmed as active Tester role in `.squad/team.md`
- **Identity Focus:** Current focus is on "Sub-agent identity and badge detail" per `.squad/identity/now.md`
- **Cast Label Display:** The avatar UI (`main.js`) correctly renders `displayName` and `role` properties for squad agents
- **Squad Context Loading:** The `squad-context.mjs` successfully loads casting metadata and merges agent sources from roster, config, and casting registries

## Cast Label Integration

The cast label display pipeline:
1. Squad context loads team roster and extracts cast names
2. Avatar initialization maps agent IDs to display names and roles  
3. UI overlays render the `displayName` and `role` properties on agent cards
4. The demo includes a test agent "Tester" that validates the role label rendering

## Notes

- Avatar overlay successfully displays cast names and role labels
- Squad integration properly resolves agent metadata
- Cast label visibility confirmed during 20-second inspection window

# Howard the Duck — Voice persistence sign-off

- **Date:** 2026-05-17T22:14:30.766+02:00
- **Scope:** Saved voice selection acceptance for Web Speech, Voxtral, and ElevenLabs
- **Decision:** Approved. Voice selection now survives reload/reopen and engine switching without blanking engine-specific saved voice state.

## Evidence

- `.github/extensions/copilot-avatar/main.mjs` loads and saves all TTS fields through `.tts-settings.json`, so the persistence seam is real and shared.
- `.github/extensions/copilot-avatar/content/main.js` lines 4542-4569 now snapshot `previousVoice`, preserve it through loading placeholders, and only assign a fallback when the fetched voices do not contain that saved value.
- `.github/extensions/copilot-avatar/content/main.js` lines 4612-4637 still refresh and re-save after the ElevenLabs list arrives, but the saved selection now survives the async placeholder phase.
- `.github/extensions/copilot-avatar/content/main.js` lines 4449-4478 and 5152-5252 continue saving `voice`, `voxtralVoice`, and `elevenlabsVoice` together, so engine changes do not drop another engine's choice.

## Acceptance review

1. **Per-engine persistence:** Pass — `main.mjs` merge-saves `.tts-settings.json`, and the webview save payload includes `voice`, `voxtralVoice`, and `elevenlabsVoice`.
2. **Reload/reopen:** Pass — saved ElevenLabs voice is restored before `updateEngineUI()`, then preserved across the loading placeholder and re-selected when still present.
3. **Engine switching:** Pass — switching engines saves the current engine plus the other engines' voice fields without blanking ElevenLabs during the async refresh.
4. **Missing-voice fallback:** Pass — fallback happens only in the branch where the refreshed ElevenLabs list does not contain `previousVoice`.

# Shuri Decision — Avatar card layout regression

- Date: 2026-05-17T20:58:16.671+02:00
- Owner: Shuri

## Decision

Keep sub-agent role metadata inline with the display name, reserve the badge for short activity state, and use the lower detail panel for live work detail plus `detailText` / `taskSummary` fallback.

## Why

When the idle badge or lower detail surface repeats the role, the card stops answering what the agent is doing and reads like a regression. Splitting identity from activity makes the layout stable in idle, active, and terminal states without losing the role.

## Runtime contract

- `.github/extensions/copilot-avatar/main.mjs` should keep forwarding `taskSummary` and `detailText` in sub-agent payloads.
- If the runtime later exposes richer tool-phase copy, the next field to add is `activityLabel` on `setAgentActivity()`.

## Files

- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/content/style.css`
- `.github/extensions/copilot-avatar/main.mjs`

# Shuri decision — silent root overlay cleanup

- Date: 2026-05-17T21:17:25.313+02:00
- Owner: Shuri

## Decision

Keep the root Squad context active for renderer state, but suppress idle overlay copy in the webview. Generic root labels like `task`, `agent`, and `runSubagent` should also be filtered at the root renderer seam so the avatar does not advertise orchestration scaffolding as user-facing status.

## Why

`Squad ready` and bare `task` read like transport metadata, not meaningful UI. Hiding them in `.github/extensions/copilot-avatar/content/main.js` preserves the active Squad flag for mic/chrome behavior and keeps normal root intents available when they carry real user-facing information.

## Files

- `.github/extensions/copilot-avatar/content/main.js`
- `.squad/agents/shuri/history.md`

---
date: 2026-05-17T22:23:53.926+02:00
agent: Shuri
---

# Sub-agent detail line should stay on assigned work

## Decision
- Treat the lower sub-agent card line as persistent work context, not transient Copilot summary chatter.
- Use an explicit upstream `workDescription` payload sourced from `taskSummary` in `.github/extensions/copilot-avatar/main.mjs`.
- In `.github/extensions/copilot-avatar/content/main.js`, keep non-root detail text pinned to `workDescription`/`taskSummary` and ignore Clippy-style summary phrases on sub-agent cards.
- For late-open or reload flows, do not let non-root update-only events create a card unless the payload already carries a strong resolved identity. Queue activity / thinking / intent state until identity-bearing data arrives, then replay it onto the real card.
- Keep a renderer-side identity ranking so a later Squad-resolved name can replace an earlier fallback label, while weaker runtime slugs cannot stomp a good visible name.

## Why
- The badge already carries live activity state; the lower line should answer what the agent was assigned to do.
- Copilot/Clippy summary phrases like `It looks like you're all set` are useful only in the root assistant path and add noise when they displace sub-agent work descriptions.
- Late-open windows were materializing cards from generic update traffic before the identity-bearing payload showed up, which made `General Purpose Agent`-style names stick visually during background work.

## Files
- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
- `.squad/skills/subagent-badge-state/SKILL.md`

# 2026-05-17T22:14:30.766+02:00 — ElevenLabs voice persistence must survive placeholder refreshes

## What
Keep the saved ElevenLabs voice id intact while the speech settings UI renders loading, error, or missing-key placeholder options.

## Why
The persistence contract in `.github/extensions/copilot-avatar/main.mjs` was already fine: it loads and saves `elevenlabsVoice` inside `.tts-settings.json`. The actual regression lived in `.github/extensions/copilot-avatar/content/main.js`, where the async voice refresh path could blank `elevenlabsVoice` before the fetched voices arrived, so reopen and engine-switch flows silently forgot the user's prior selection and promoted the first returned voice instead.

## Seam
No new runtime field or `main.mjs` flow change is required for this fix. The seam to protect is `fetchElevenLabsVoices()` → `populateElevenLabsVoices(...)`: placeholder UI may change, but it must not mutate the remembered selection until a real returned list proves the old voice is invalid.

# 2026-05-17T21:17:25.313+02:00 — Commit scope for avatar regression fix

## Decision

Push the avatar regression as a scoped product-only commit. The bundle is limited to:

- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/lib/squad-context.mjs`
- `.github/extensions/copilot-avatar/content/main.js`
- `.github/extensions/copilot-avatar/content/style.css`

## Why

The worktree carries unrelated `.squad`, workflow, and untracked churn. Mixing that into the product fix would turn a clean regression restore into a risky bundle with weak review boundaries.

## Validation

- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/lib/squad-context.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`
- `git diff --check` on the four scoped files
- Direct Squad alias probe confirming `lead -> Tony Stark`, `backend-dev -> Peter Parker`, `tester -> Howard the Duck`

# Tony Stark Live Overlap Window

**Date:** 2026-05-17T20:58:16+02:00
**Lead:** Tony Stark
**Requested by:** Jimmy Engstrom

## Decision

Opened the Copilot Avatar UI with native webview to display the cast label for visual inspection. The avatar window was held open for 20 seconds to allow Jimmy to examine Tony Stark's cast name and Lead role as displayed in the Squad context.

## Context

- **Cast Name:** Tony Stark
- **Role:** Lead
- **Universe:** Marvel Cinematic Universe
- **Status:** Active

## Outcome

Live overlap window successfully displayed Tony Stark's cast label in the avatar UI, allowing direct visual inspection of Squad identity integration. The cast information is correctly wired from casting registry through squad-context.mjs into the avatar display.

## Next Steps

Validate that cast labels are rendering consistently across all Squad-aware agent contexts in the avatar system.

---
date: 2026-05-17T20:58:16.671+02:00
agent: Vision
topic: subagent-card-detail-regression
---

## Decision

Keep sub-agent role and work detail on separate contracts.

- `role` stays as identity metadata for the inline header pill beside the name.
- `taskSummary` / `detailText` carry the lower detail panel copy and must come from spawn/runtime task descriptions, not Squad charter summaries.
- The extension should forward that richer payload through `subagent.started`, live activity/intention/model/thinking updates, and terminal events so out-of-order lifecycle traffic cannot recreate a role-only card.

## Why

The regression seam was in the extension payloads. Live cards already have a separate role slot in the renderer, but `main.mjs` was not consistently feeding detail metadata across lifecycle events, so the lower panel could fall back to role-like copy or lose task context entirely.

## Validation

- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/lib/squad-context.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`
- Root/non-root Squad context probes and casting-alias assertions
- Source assertions for task-summary propagation and thinking/detail composition

# Vision decision — silent Squad idle overlay

- Date: 2026-05-17T21:17:25.313+02:00
- Agent: Vision

## Decision

Keep Squad mode active for runtime enrichment and root-only chrome, but stop emitting idle hover copy for it. The extension now sends blank Squad root `statusText` / `detailText`, the webview preserves explicit blanks, and root-level spawn wrapper tools (`task`, `agent`, `runSubagent`) no longer mirror into the root overlay.

## Why

`Squad ready` and bare `task` were orchestration artifacts, not user-facing work signals. Removing them at the payload seam keeps the useful sub-agent activity/detail text intact while making the root overlay fail quiet instead of inventing status text.

## Affected files

- `.github/extensions/copilot-avatar/lib/squad-context.mjs`
- `.github/extensions/copilot-avatar/main.mjs`
- `.github/extensions/copilot-avatar/content/main.js`

---
date: 2026-05-17T22:23:53.926+02:00
agent: Vision
topic: subagent-detail-thinking
---

## Decision

Keep sub-agent thinking/detail state on a dedicated sub-agent path, not the root Copilot copy path.

- In `.github/extensions/copilot-avatar/main.mjs`, resolve sub-agent updates through `parentToolCallId` first and a runtime `toolCallId` → `agentId` map second, so missing `event.agentId` does not bounce `assistant.intent`, `assistant.usage`, or `tool.execution_complete` back through the root avatar.
- Forward explicit work detail (`workDescription` / `taskSummary`) with every sub-agent payload and prefer that for non-root cards.
- In `.github/extensions/copilot-avatar/content/main.js`, treat idle/meta tools as non-work so `thinking` remains visible and wrapper noise does not replace the assigned work line.

## Why

The broken seam was correlation, not rendering polish. Copilot can emit follow-up sub-agent events without `event.agentId`; if the extension only trusts direct agent IDs or chooses the wrong tool-call field, the webview keeps stale tool state, thinking never wins, and the lower detail line falls back to unrelated root/Copilot copy.

## Validation

- `node --check .github/extensions/copilot-avatar/main.mjs`
- `node --check .github/extensions/copilot-avatar/lib/squad-context.mjs`
- `node --check .github/extensions/copilot-avatar/content/main.js`
- Source assertions for tool-call correlation, thinking precedence, and sub-agent work-description fallback

## Addendum — boot-time hydration

- Date: 2026-05-17T22:23:53.926+02:00
- If the avatar/webview opens after sub-agents are already active, the runtime must rebuild active sub-agent state from `session.getMessages()` before relying on fresh events.
- The replay path belongs in `.github/extensions/copilot-avatar/main.mjs`: recover historical spawn-tool arguments, restore the spawn-metadata→`agentId` map, bind any short-lived `subagent.selected` hint once, and replay the active payloads into the ready webview.
- Shuri does **not** need a new renderer contract for this fix. The existing payload fields (`displayName`, `agentName`, `role`, `workDescription`, `taskSummary`, `detailText`) are sufficient once runtime replay sends them again after open.

# Vision — Voice persistence seam

- **Date:** 2026-05-17T22:14:30.766+02:00
- **Scope:** TTS voice selection persistence across Web Speech, Voxtral, and ElevenLabs
- **Decision:** Keep the fix inside `.github/extensions/copilot-avatar/content/main.js`; the runtime/storage seam in `main.mjs` already persists every engine's voice fields together, and the actual regression lives in the ElevenLabs dropdown refresh logic.

## Why

- `saveTtsSettings()` in the webview persists `voice`, `voxtralVoice`, `elevenlabsVoice`, and `engine` in one payload, so engine switching is already storage-agnostic.
- `populateElevenLabsVoices([], { placeholder: ... })` was blanking `elevenlabsVoice` before async voice fetches completed, and the engine-change handler saves immediately after switching engines.
- Preserving the prior ElevenLabs selection through loading/error placeholders fixes reload/reopen and engine-switch flows without touching extension runtime plumbing or other TTS settings.

## Implementation seam

- Treat placeholder rendering as UI-only state: keep the saved ElevenLabs voice in memory until a real refreshed list proves the saved voice is missing.
- Only persist a new ElevenLabs voice after the fetched list either re-selects the saved voice or deliberately falls back to a new valid option.

# Vision — avatar window topmost rule

- **Date:** 2026-05-17T22:31:24.735+02:00
- **Scope:** Copilot avatar native window style and topmost behavior
- **Decision:** Treat always-on-top as part of the same explicit window-style contract as transparency. Transparent/frameless avatar windows may stay always-on-top, but framed/non-transparent windows must not force topmost behavior.

## Why

- The current seam is in the extension, not the platform: `.github/extensions/copilot-avatar/main.mjs` was passing `alwaysOnTop: true` unconditionally, while `.github/extensions/copilot-avatar/lib/webview-child.mjs` only applies whatever flag it receives.
- `decorations: !transparent` already makes frame presence follow the transparency mode, so keeping topmost unconditional creates an implicit second rule that disagrees with the visible chrome.
- Binding topmost to `transparentWindow` makes failures point to one seam instead of splitting behavior between window chrome and hidden runtime state.

## Implementation seam

- Derive `alwaysOnTop` from `transparentWindow` in `.github/extensions/copilot-avatar/main.mjs` for initial window creation and settings updates.
- Reopen the window when that derived window-style contract changes so the recreated native window picks up both the correct decorations and the correct topmost state.

---


## 2026-05-17T22:55:21.159+02:00: Clear late-open stale subagent replay and retire idle ghosts

**By:** Vision (Platform Dev)

**What:** Treat Copilot sub-agent visibility as current-turn live state, not raw session residue. Clear non-root avatars and reset sub-agent runtime caches before replaying `session.getMessages()` into a late-open window, and remove any non-terminal sub-agent after its last non-spawn tool clears.

**Why:** The runtime can keep idle/background agents around without marking them `completed` or `failed`. Replaying those old `subagent.started` events into the webview made the avatar show stale general-purpose cards even when the current session had no live sub-agents.

**Scope:** `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/content/main.js`

---

### 2026-05-17T22:55:21.159+02:00: Howard approves stale subagent cleanup

**By:** Howard the Duck (Tester)

**Decision:** APPROVE the stale-idle subagent cleanup for this artifact.

**Why:** The source now clears non-root avatars and backend subagent caches before late-open replay, resets subagent runtime state at root `assistant.turn_start` before Squad sync, and retires/prunes agents whose last real tool finished even if no terminal subagent event arrives. Live avatar probing also showed `clearSubagents({ preserveRoot: true })` removes a visible generic stale card and wipes queued intent/activity/thinking so the same `agentId` re-added later comes back idle with blank detail instead of reviving old state.

**Scope:** `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/content/main.js`

---


## 2026-05-17: README Update for v0.2.1

**Author:** Tony Stark  
**Date:** 2026-05-17  
**Decision:** Document v0.2.1 release highlights in README.md

### Context
The 0.2.1 release focused on bug fixes and quality improvements across sub-agent rendering, activity reporting, and settings persistence.

### Change
Added a new 0.2.1 section to the Releases section of README.md, positioned above 0.2.0 for chronological clarity (newest first).

### Highlights Documented
1. **Squad sub-agent names** — name resolution fix for late-open/reload scenarios
2. **Sub-agent activity detail** — thinking/activity text now accurately reflects work being done
3. **Cleaner sub-agent scene** — removed stale general-purpose cards from idle agents
4. **Voice persistence** — voice selection now correctly persists across TTS engines (especially ElevenLabs)
5. **Window behavior** — always-on-top now respects transparent window mode preferences

### Rationale
- Kept language aligned with 0.2.0 style (feature-focused, benefit-driven)
- Each bullet emphasizes **what was fixed** and **why it matters** to the user
- Positioned newest release at the top (standard practice)
- No unrelated changes to existing sections
