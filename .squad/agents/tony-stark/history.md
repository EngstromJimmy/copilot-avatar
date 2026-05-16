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
