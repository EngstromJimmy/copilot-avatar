# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.
- 2026-05-16T16:02:40.457+02:00 — Sub-agent cards now resolve display names through shared extension-side event mapping in `.github/extensions/copilot-avatar/main.mjs`, then render richer live badge text and per-agent model lines in `.github/extensions/copilot-avatar/content/main.js`.
- 2026-05-16T16:02:40.457+02:00 — For avatar overlays, the stable UX pattern is: preferred Squad/cast name first, live model line on the card, and badge text driven by current tool activity or active intent instead of static role text.
- 2026-05-16T16:02:40.457+02:00 — Key files for sub-agent UI work: `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`, `.github/extensions/copilot-avatar/content/main.js`, and `.github/extensions/copilot-avatar/content/style.css`.
- 2026-05-16T19:27:16.955+02:00 — Squad-only root avatar flair should reuse the existing visible Squad context from `.github/extensions/copilot-avatar/main.mjs`; in the webview, gate `modelRoot` accessories from `window.setSquadContext(payload.active)` instead of re-detecting Squad from cwd.
- 2026-05-16T19:27:16.955+02:00 — Root accessory work stays surgical in `.github/extensions/copilot-avatar/content/main.js`: attach geometry in `createAvatarInstance()`, dispose it in `disposeAvatar()`, and keep the root-only visibility toggle isolated in a helper like `updateRootSquadMicBoom()`.
- 2026-05-16T19:48:28.844+02:00 — Squad-only root comms flair reads better as a single-sided ear anchor, thin curved boom, and compact mouth capsule than as a full headset; keep the silhouette light so it feels like status, not costume.
- 2026-05-16T19:56:44.385+02:00 — The current root Squad mic reads cleaner without any ear-side anchor at all; keep only a face-side boom plus capsule, and reuse the Squad pink accent (`#f778ba`) so the flair stays recognizable without crowding the silhouette.

## 2026-05-16T14:02:40.457Z — Session Complete: Approved Sub-Agent Identity & Badge Fix

**Status:** ✅ Approved by Howard the Duck

**Team:** Tony Stark (Lead), Vision, Peter Parker, Shuri, Howard the Duck (QA)

**Role:** Enhanced sub-agent badge content and UI rendering.

**Summary:** Part of multi-agent identity & badge system fix. Implemented dynamic badge text prioritization and updated sub-agent card rendering to show live work details instead of static labels. Badge now prefers active intent text, then tool names, then role, then activity fallback.

**Key Contribution:**
- Implemented badge text priority: active intent → tool name → role → activity
- Enhanced sub-agent cards to show resolved Squad names on stable first pass
- Model labels now stay visible on sub-agent cards
- Non-Squad sessions render generic labels without errors

**Files Modified:**
- `.github/extensions/copilot-avatar/content/main.js` — badge prioritization, card rendering
- `.github/extensions/copilot-avatar/main.mjs` — payload enrichment for Squad metadata

**Validation:** UI behavior verified across Squad and non-Squad sessions; no regressions; approved by Howard the Duck.

## 2026-05-16T13:42:38.842Z — Approved: Sub-Agent Name-Mapping Fix

**Status:** ✅ Approved by Howard the Duck and Tony Stark

**What:** Centralized sub-agent display metadata resolution in `main.mjs` across started/completed/failed handlers, implementing stable-first fallback chain:

1. `agentDisplayName` from event (trimmed, blanks treated missing)
2. `displayName` from Squad roster (via `resolveSquadAgentMetadata()` on stable identity fields)
3. `agentName` from event (trimmed, blanks treated missing)
4. Raw `agentId` (final fallback only)

**Implementation details:**
- Single `resolveSubagentDisplayData(event)` function shared by all lifecycle handlers
- Casting alias bridge: `.squad/casting/history.json` slot names wired into roster lookup
- Squad roster joins use only stable identity fields (`agentName`, `agentDisplayName`)
- `agentId` explicitly excluded from Squad metadata lookups (instance ID, not roster key)

**Validation:**
- `node --check` on modified files passed
- Targeted smoke checks verified fallback order, resolver consistency, casting alias wiring
- Confirmed `tester` slot alias resolves to `howard-the-duck` in Squad roster

**Key insight:** Stable identity + casting slots bridge runtime names to Squad roster identities without leaking opaque instance IDs into the display pipeline.

## 2026-05-16T15:42:38.842+02:00 — Rendering and Name Lookup Investigation

**Assigned:** Investigate why sub-agents show as internal IDs (e.g., `agent-call_H`) in the avatar UI instead of display names.

**Analysis:**

1. **Rendering Pipeline:** Traced the flow from Copilot SDK `subagent.started` event through extension to webview DOM update. Confirmed visible cards are the correct, expected UI output—the avatar and card structure are working.

2. **Display Name Source:** Identified that visible cards show the `displayName` property passed from the extension's `callWindowFunction("addSubagent", {...})` call.

3. **Critical Integration Point:** The display name lookup involves two layers:
   - **Layer 1 (Extension):** Event carries `agentDisplayName`, `agentName`, `agentId` from Copilot SDK
   - **Layer 2 (Extension):** `resolveSquadAgentMetadata()` attempts Squad roster lookup to find the agent's defined display name
   - If lookup fails, fallback displayName becomes empty string
   - Webview then renders with truncated agentId instead

4. **Hypothesis:** The lookup is failing because `resolveSquadAgentMetadata()` only tries to match by `agentName` and `agentDisplayName`, but SDK events provide only `agentId`. Missing `agentId` in the lookup key set means many agents go unmatched against the Squad roster.

**Recommendation:** Enhanced display name fallback chain and added `agentId` as a lookup key to `resolveSquadAgentMetadata()`.

**Status:** Vision implemented the fix. All three event handlers now pass `agentId` and use improved fallback chain.

## 2026-05-16T15:42:38.842+02:00 — Stable Sub-Agent Name Resolution

- Reviewer-approved seam: keep Squad roster joins on stable fields (`agentName`, `agentDisplayName`) and never on runtime `agentId`, which is only safe as a last-resort UI label.
- Frontend pattern: centralize sub-agent display metadata resolution in `.github/extensions/copilot-avatar/main.mjs` so started/completed/failed handlers share the same trim-aware fallback chain.
- Key paths for future avatar-label work: `.github/extensions/copilot-avatar/main.mjs` and `.github/extensions/copilot-avatar/lib/squad-context.mjs`.

## 2026-05-16T17:53:47Z — Session: Squad Root Accessory Consolidation & Decision Capture

**Status:** ✅ Decisions captured and orchestration logged

**Work Summary:**
- Completed root Squad mic-boom accessory implementation (lighter, single-sided silhouette replacing chunky headset)
- Merged 2 decision entries from inbox into decisions.md
- Validated gating: Squad accessories attach only when `window.setSquadContext(payload.active)` is true
- Confirmed root-only creation and toggle wiring in `.github/extensions/copilot-avatar/content/main.js`

**Decisions Captured:**
1. **2026-05-16T19:27:16.955+02:00** — Gate Squad root accessories from visible Squad context (Shuri)
   - Root avatar flair reuses existing `getVisibleSquadContext()` signal from main.mjs
   - Avoids second frontend detection path; keeps non-Squad sessions unchanged

2. **2026-05-16T19:48:28.844+02:00** — Root Squad comms accessory should stay mic-boom light (Shuri)
   - Single-sided ear anchor, thin curved boom, compact mouth capsule
   - Reads as subtle comms gear, not costume piece
   - Preserves existing non-Squad boundary while improving avatar motion stability

**Key Learnings:**
- Squad-only root visuals should gate from `window.setSquadContext(payload.active)` rather than re-detecting Squad in webview
- Keeping accessory light and subtle improves avatar stability in motion and visual consistency
- Root-only creation path in `createAvatarInstance()` and cleanup in `disposeAvatar()` keep implementation surgical

## 2026-05-16T17:58:07Z — Session: Squad Root Mic Finalization — Face-Side Only, Squad Pink

**Status:** ✅ Complete and validated

**Coordinator:** Jimmy Engstrom

**Work Summary:**
- Removed ear-side anchor from Squad root mic-boom accessory
- Recolored remaining face-side mic boom and capsule to Squad pink (#f778ba)
- Preserved existing root-only + visible-Squad gating

**Implementation:**
- Updated `.github/extensions/copilot-avatar/content/main.js` to remove ear-anchor geometry and apply pink color
- Validation: `node --check` passed for all extension files

**Key Change:**
- User feedback indicated the ear-side piece read like clutter; face-side-only mic keeps the Squad signal subtle and clean

**Decision Captured:**
- **2026-05-16T19:56:44.385+02:00** — Keep the Squad root mic face-side only (merged to decisions.md)
  - Remove ear-anchor, keep face-side boom plus capsule
  - Apply Squad pink (#f778ba)
  - Preserve root-only + visible-Squad gating
