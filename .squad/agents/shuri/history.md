# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.

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
