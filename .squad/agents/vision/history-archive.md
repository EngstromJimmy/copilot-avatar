# Vision — Platform Dev — Archived Sessions

This file contains older investigation and implementation work (before 2026-05-17 mid-day).

## Detailed Sub-agent Identity Regression Investigation (2026-05-16 to 2026-05-17)

**Root Cause:** Commit c8724b0 added webview-side low-confidence filter without updating extension-layer logic. Line 405 fallback sends generic labels directly before Squad enrichment can apply.

**Fix Applied:** Mirror webview isLowConfidenceLabel() in extension; prefer Squad displayName/role when Copilot sends generic label.

**Key Insight:** Extension is the Copilot↔Squad boundary; filtering must originate there, not in webview cleanup alone.

### Label Regression Seam Details

- Merged main.mjs still builds sub-agent payloads with vent.data?.agentDisplayName ?? squadAgent?.displayName ?? event.data?.agentName, allowing "General Purpose Agent" to outrank Squad/cast identity.
- Working-tree fix resolves display through esolveSubagentDisplayData() preferring Squad metadata and cached spawn metadata ahead of runtime placeholders.
- Live extension regressions can be a process seam: check that running project:copilot-avatar extension is active and run xtensions_reload after edits.

## Cast Identity Resolution & Spawn Metadata Binding

Copilot's parent spawn tool keeps cast identity in 	ool.execution_start.arguments (
ame / description), not in subagent.started when runtime agent is generic. Solution:
- Cache identity hint by 	oolCallId
- Bind it to concrete gentId on first start
- Let it outrank placeholder labels in extension

**Files modified:** .github/extensions/copilot-avatar/main.mjs, .github/extensions/copilot-avatar/lib/squad-context.mjs

.github/extensions/copilot-avatar/lib/squad-context.mjs must resolve casting aliases from .squad/casting/registry.json; .squad/casting/history.json tracks persistent cast inventory for assignment snapshot (lead / 	ester → cast-name).

## Squad SDK Casting Integration Analysis (2026-05-17)

**Question:** Should extension source cast identity from Squad SDK instead of reading .squad/casting/registry.json directly?

**Findings:**
- Squad SDK @bradygaster/squad-sdk@0.9.4 exports CastingEngine and CastingRegistry (filesystem stub, incomplete)
- SDK does **not** provide stable runtime API for current role assignments
- File-based design is more reliable: explicit source of truth, decoupled from SDK volatility

**Decision:** Keep current file-based design. No SDK refactoring needed now.

## Mic State Handoff Bug & Web-Ready Gating (2026-05-17T20:00:51Z)

**Problem:** Squad root mic boom did not render despite geometry existing and being correctly wired. Root cause: timing gap in Squad context sync—extension calls syncSquadContext() before webview exists, so window.setSquadContext() cannot be invoked until after initializeRootAvatar() already created root avatar with squadRootMicActive = false.

**Solution:** Webview-ready handshake gates Squad context replay:
- Page sets __copilotAvatarReady flag
- Extension waits for that signal before calling setSquadContext()
- Combined with mic boom replay in root-avatar init, ensures first-paint visibility

## Sub-agent Fallback Collapse Fix (2026-05-16)

**Problem:** Reconnects after context change could mint third generic card beside two real Copilot-owned agents.

**Root Issues:**
1. Cached metadata lost during syncKnownSubagents() rehydration
2. Fallback identity keys derived from runtime IDs (opaque) instead of human labels
3. Collapse helpers not invoked at all rehydration/render points

**Fixes Applied:**
1. Preserve cached identity metadata during rehydrate
2. Derive fallback identity only from human labels (displayName, agentName)
3. Invoke duplicate collapse on first-render, rehydrate, and webview addSubagent
4. Avoid fallback to runtime agentId to prevent generic cards

**Result:** Reconnects maintain exactly 2 visible cards without minting third generic card.

## Key Architectural Decisions

- **Copilot SDK owns visibility & lifecycle:** Cards appear on subagent.started, disappear on terminal events
- **Squad SDK is enrichment-only:** Roster/casting data improves naming/role but never creates/suppresses/collapses live Copilot cards
- **Webview seam isolation:** ddSubagent is sole card-creation entrypoint; updates must no-op if card not created yet
- **First-render gate removed:** Copilot sub-agent presence alone is sufficient for visibility
- **Identity hints accepted:** Recent subagent.selected cached as short-lived naming hint, reused across sync events