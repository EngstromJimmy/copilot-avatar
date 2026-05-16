# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.

### 2026-05-16: Sub-agent visibility race condition investigation

**Problem:** When Squad spins up sub-agents, they don't show up visually in the avatar window.

**Root cause:** The extension architecture has a fundamental synchronization gap:
- The webview window is **never automatically opened** — it only opens when user explicitly calls `/avatar` or uses the `copilot_avatar_show` tool
- Squad agent events (`subagent.started`, etc.) fire immediately and try to call `callWindowFunction("addSubagent", ...)` to update the UI
- But `callWindowFunction` silently discards all calls if `webview._handle` is null (window not open)
- By the time the user opens the window, those events have already fired and been lost

**Key code path breakdown:**
1. Extension initializes CopilotWebview (main.mjs:61) but does NOT call .show()
2. Session event `subagent.started` fires (main.mjs:266) during Squad agent spinup
3. Handler calls `callWindowFunction("addSubagent", {...}, 3000)` (main.mjs:276)
4. callWindowFunction → evalWebview checks `if (!webview._handle) return` (main.mjs:83)
5. If window not open, the call silently fails with zero logging/error indication
6. When user later opens window, the subagents were never rendered because those events are gone

**Affected code locations:**
- `main.mjs:82-89` — evalWebview/callWindowFunction silently fail when window closed
- `main.mjs:217-235` — webview.show() only called on explicit user action
- `main.mjs:266-292` — subagent event handlers have no fallback if display fails
- `content/main.js:2766-2779` — window.addSubagent expects to be called, assumes DOM is ready

**Likely root causes (in order of probability):**
1. **Missing early initialization:** The webview should be shown automatically when Squad is detected, OR early in session startup, not wait for user action
2. **No state sync on connect:** When webview finally opens, there's no mechanism to replay or re-fetch pending subagent state
3. **Silent failure design:** callWindowFunction swallows all errors, making it impossible to diagnose in production
4. **No queuing mechanism:** Events that fire before webview opens are lost; there's no accumulation/replay queue beyond pendingSubagents

**What owner/specialist is needed:**
- **Backend/Architecture (me):** Need to decide on initialization strategy — should webview auto-show when Squad active, or add state persistence?
- **Frontend specialist:** Once we decide the sync strategy, they'll need to implement either: (a) automatic show on Squad detection, (b) state sync handler on webview connect, or (c) hybrid queue-based replay
- **Testing specialist:** Need to verify sub-agents appear immediately when spinning up during live sessions, not just in demo mode

**Next decision needed:** Should the fix be "auto-show on Squad" (simplest) or "state sync on connect" (more flexible for future)?

---

## 2026-05-16T15:42:38.842+02:00 — Decision: Auto-Show on Squad Detection

**Status:** Recommended and approved.

**Outcome:** After coordinating with the team on two architecturally different approaches, chose **Option A: Auto-show on Squad detection** for implementation:

- Simplest and lowest-risk fix
- In `refreshSessionContext()`, detect if Squad is active via squadContext
- Pre-emptively call `webview.show()` with error handling if Squad found
- This ensures webview is ready before first `subagent.started` event arrives
- No state queuing or complex sync protocol needed

**Rationale:** If Squad is running with agents, the avatar should be visible. The cost of always showing the window is justified by the visibility benefit. Users who don't want Squad metadata loaded wouldn't have Squad in their cwd anyway.

**Next action:** Frontend specialist implements in main.mjs, one method that checks squadContext.active and calls webview.show() early in session lifecycle.

---

## 2026-05-16T15:42:38.842+02:00 — Review: Stable Agent Identity for Naming

- Copilot SDK defines `agentId` as a sub-agent **instance identifier**; it is the right key for runtime avatar state, not for Squad roster enrichment.
- Squad metadata joins should stay on stable identity fields (`agentName`, `agentDisplayName`, roster-derived ids) and should normalize blank strings before fallback selection.
- Display-name fallback should treat `""` as missing for both Squad and non-Squad events; otherwise empty SDK fields short-circuit the chain and the UI falls back to internal ids.
- Key files: `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`, `.squad/team.md`.

---

## 2026-05-16T16:02:40.457+02:00 — Design Review: Multi-Agent Identity & Badge System

**What:** Comprehensive design review for displaying agent names, activity in badges, and model information in sub-agents while maintaining non-Squad compatibility.

**Key Findings:**

1. **Name Resolution Broken at Seam:** `resolveSquadAgentMetadata()` only tries `agentName`/`agentDisplayName`, never tries `agentId`. Must extend lookup to include ID-based roster search.

2. **Badge Content Missing Activity Detail:** Badge shows activity type ("Running commands") but not what tool is actually running. Should prioritize: Intent > Tool Name > Role > Activity Badge.

3. **Model Sync Race Condition:** If `assistant.usage` fires before `subagent.started`, model is queued in `pendingModelsByToolCallId` but entry is deleted after first use. Switch to `pendingModelsByAgentId` and sync on avatar creation.

4. **Squad Context Not Reaching Sub-Agents:** Team name and coordinator are loaded but never sent in `addSubagent` payload. Should add optional `squadTeamName` and `squadCoordinator` fields.

5. **Non-Squad Sessions Must Work:** All Squad fields must be optional; system should gracefully degrade to agentId-based names and generic badges when Squad absent.

**Architectural Decisions:**

- **Centralized name resolver** in main.mjs: `resolveAgentDisplayName()` tries agentDisplayName → Squad roster (with agentId lookup) → agentName → agentId (never empty)
- **Dynamic badge content** in content/main.js: Show intent when active, tool name when running, role when idle
- **Agent-based model queuing** in main.mjs: Use agentId as key, not toolCallId (eliminates race conditions)
- **Optional Squad enrichment:** All Squad fields in payloads are optional; UI skips when undefined

**Owner & Sequencing:**

- Squad specialist: Extend `resolveSquadAgentMetadata()` in squad-context.mjs (Phase 1)
- Tony Stark: Refactor main.mjs event handlers, name resolver, model sync (Phase 2)
- Fenster: Update badge rendering logic, optional Squad UI (Phase 3)
- All: Integration testing (Phase 4)

**Key Files:**
- `lib/squad-context.mjs`: Extend name lookup to include agentId
- `main.mjs`: Create `resolveAgentDisplayName()`, refactor subagent event handlers, fix model sync queuing
- `content/main.js`: Dynamic badge text priority (intent → tool → role → activity)

**Non-Breaking:** All changes are additive; existing Squad-absent sessions unchanged. SQuAD-specific code gated by `squadContext.active` checks or optional payload fields.

**Detailed spec:** `.squad/decisions/inbox/tony-stark-avatar-squad-identity-design-review.md`

## 2026-05-16T13:42:38.842Z — Approved Shuri's Sub-Agent Name-Mapping Revision

**Status:** ✅ Approved

**What:** Shuri's centralized resolver in `main.mjs` with correct fallback order:
1. `agentDisplayName` from event (trimmed)
2. `displayName` from Squad roster (stable identity fields only)
3. `agentName` from event (trimmed)
4. Raw `agentId` (final fallback)

**Validation:**
- Confirmed centralized resolver handles `subagent.started`, `subagent.completed`, `subagent.failed` consistently
- Verified `agentId` excluded from roster joins (emergency label only)
- Validated trim-aware handling of blank strings prevents empty strings from blocking fallback chain

**Key decision:** This is the correct seam. Runtime instance IDs stay for live state tracking; human labels come from stable identity first, with blanks normalized away before fallback selection.

## 2026-05-16T16:02:40.457+02:00 — Runtime State Sync for Squad Sub-Agents

- Centralized sub-agent identity, model, tool activity, and completion state in `.github/extensions/copilot-avatar/main.mjs` so every lifecycle event resolves through one state map before talking to the webview.
- Guarded Squad naming against placeholder SDK labels like `General Purpose Agent`; when Squad metadata exists, stable roster/casting names now win while `agentId` stays an emergency label only.
- Added richer activity payloads (`activityLabel`) plus `tool.execution_progress` handling so sub-agent badges can show real work-in-flight text instead of generic running states.
- Carried model state per agent and injected it into `addSubagent` / `setAgentModel` flows, which makes sub-agent model badges survive ordering races between `assistant.usage`, `session.model_change`, and `subagent.started`.
- Key files: `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`.

## 2026-05-16T14:02:40.457Z — Session Complete: Approved Sub-Agent Identity & Badge Fix

**Status:** ✅ Approved by Howard the Duck

**Team:** Tony Stark (Lead), Vision, Peter Parker, Shuri, Howard the Duck (QA)

**Summary:** Tony Stark led comprehensive design review for multi-agent identity & badge system. Vision specified display-name resolver contract with agentId lookup. Shuri enhanced badge content to prefer live work details. Peter Parker cleared stale sub-agent state on session/context boundaries. Howard the Duck revalidated and approved final implementation.

**Key Outcomes:**
- Squad aliases now resolve to cast names (Tony Stark, Peter Parker, Howard the Duck)
- Per-subagent model updates fire correctly
- Badge text tracks current activity (intent → tool name → role → activity)
- Non-Squad sessions stay generic without Squad label leakage
- No stale Squad cards replay after context changes

**Deliverables:**
- Multi-agent identity & badge system design spec (Tony Stark)
- Squad display-name resolver contract (Vision)
- Runtime state reset mechanism (Peter Parker)
- Badge content prioritization (Shuri)
- QA validation and approval (Howard the Duck)

**Files Modified:**
- `.github/extensions/copilot-avatar/main.mjs` — event consolidation, name resolver, model sync
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` — agentId lookup, casting alias enrichment
- `.github/extensions/copilot-avatar/content/main.js` — badge prioritization, webview clear hook

**Validation:** All QA gates passed; syntax smoke tests; targeted regression probes; no breaking changes to non-Squad sessions.
