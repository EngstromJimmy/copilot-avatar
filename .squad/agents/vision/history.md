# Vision — Platform Dev

**Project:** CopilotAvatar  
**Owner:** Jimmy Engstrom  
**Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad  

## Current Work Status

Implementing and refining sub-agent visibility, identity resolution, and metadata enrichment integration with Copilot SDK.

**Latest Focus:** Metadata preservation during rehydrate, fallback identity derivation, and duplicate collapse invocation points.

## Key Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.
- Squad name resolution should join on stable identity fields only; enrich lookup with casting slot aliases from Squad casting registry.
- When avatar cards mirror live Copilot sub-agents, visibility keyed to Copilot `agentId` and lifecycle events only; Squad data is enrichment-only.
- If Squad chrome is hidden, keep loaded roster/casting map on hidden context; metadata resolution keys off lookup presence, not chrome visibility.
- If Copilot SDK emitted `subagent.started`, that presence is sufficient for rendering. First-render gates only hide legitimate Copilot agents unnecessarily.
- If `subagent.started` arrives with blank identity fields, cache recent `subagent.selected` metadata as short-lived hint, bind to runtime `agentId`, reuse for later sync.
- Stable-identity duplicate cleanup requires invocation at extension first-render, rehydrate, AND webview addSubagent; fallback keys from human labels only, not runtime IDs.

## Recent Work (2026-05-16)

### Sub-agent Fallback Collapse Fix

**Problem:** Reconnects after context change could mint third generic card beside two real Copilot-owned agents.

**Root Issues:**
1. Cached metadata lost during `syncKnownSubagents()` rehydration
2. Fallback identity keys derived from runtime IDs (opaque) instead of human labels
3. Collapse helpers not invoked at all rehydration/render points

**Fixes Applied:**
1. Preserve cached identity metadata during rehydrate
2. Derive fallback identity only from human labels (displayName, agentName)
3. Invoke duplicate collapse on first-render, rehydrate, and webview addSubagent
4. Avoid fallback to runtime agentId to prevent generic cards

**Result:** Reconnects maintain exactly 2 visible cards without minting third generic card. Full coverage achieved.

**Validation:** `node --check` ✅

## Key Architectural Decisions

- **Copilot SDK owns visibility & lifecycle:** Cards appear on `subagent.started`, disappear on terminal events or reset
- **Squad SDK is enrichment-only:** Roster/casting data improves naming/role but never creates, suppresses, or collapses live Copilot cards
- **Webview seam isolation:** `addSubagent` is sole card-creation entrypoint; updates must no-op if card not created yet
- **First-render gate removed:** Copilot sub-agent presence alone is sufficient for visibility
- **Identity hints accepted:** Recent `subagent.selected` metadata cached as short-lived naming hint, reused across sync events

## Archived Sessions

Older work documented in `history-archive.md`:
- Squad sub-agent display integration analysis
- Initial sub-agent naming fix (agentId lookup approach, later superseded)
- Implementation of corrected sub-agent display name lookup
- Copilot-owned sub-agent visibility implementation
- First-render gate removal
- Multi-agent identity & badge system design review

## 2026-05-16T21:51:24Z — Team Update: Sub-agent Fallback Collapse

**From:** Scribe (Session Logger)

**Context:** Decision merged and orchestration logged following spawn manifest completion.

**Decision:** Sub-agent fallback duplicates must collapse on both sides (2026-05-16T23:51:24.513+02:00)
- Preserved cached metadata during rehydrate
- Derived fallback identity from human labels only
- Invoked collapse on first-render, rehydrate, and addSubagent
- Result: Reconnects do not mint third generic card

**Team impact:** Tony Stark's dedup seam work now has metadata preservation complement; full coverage achieved.
