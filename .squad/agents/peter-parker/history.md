# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.

## 2026-05-16T13:42:38.842Z — Proposed Casting Slots for Squad Avatar Names

**Status:** ✅ Incorporated into approved solution

**What:** Proposed using `.squad/casting/history.json` slot aliases to bridge runtime agent names to Squad roster cast identities.

**Insight:** Squad roster files are keyed by cast names like `Peter Parker`, while runtime lifecycle events identify agents by:
- Durable slot names like `backend-dev` (in `agentName` / `agentDisplayName`)
- Opaque per-run handles like `agent-call_H` (in `agentId`)

Solution: Load the latest casting snapshot into the roster lookup to keep avatar labels human-readable without leaking transient IDs.

**Outcome:** Shuri's approved implementation incorporates this design; casting alias loading now wired into `resolveSquadAgentMetadata()` in `squad-context.mjs`.
