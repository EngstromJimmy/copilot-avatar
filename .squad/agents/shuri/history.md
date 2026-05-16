# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.

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
