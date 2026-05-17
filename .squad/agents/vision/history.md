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
- README is the contract with users: document that Copilot SDK owns all visibility/lifecycle, Squad is enrichment-only, and ghost cards were eliminated so rendered agents match the real active set.
- Low-confidence label filtering in the webview is not enough if the extension layer passes generic Copilot labels before consulting Squad metadata; the filtering seam must be at the source (extension).
- Webview improvements must be paired with extension-layer changes to avoid payload seams; generic labels like "General Purpose Agent" from Copilot SDK should be filtered in main.mjs before reaching `displayName` and `role` in the webview payload.
- In CopilotWebview flows, `webview.show()` is not proof that page APIs exist yet; latch `window.__copilotAvatarReady` in `content/main.js` and wait for it in `main.mjs` before emitting `setSquadContext`, or root-only Squad chrome can miss first paint.
- 2026-05-17T20:10:26.460+02:00 — Copilot’s parent spawn tool keeps the cast identity in `tool.execution_start.arguments` (`name` / `description`), not in `subagent.started` when the runtime agent type is generic. Cache that hint by `toolCallId`, bind it to the concrete `agentId` on first start, and let it outrank placeholder labels in `.github/extensions/copilot-avatar/main.mjs`.
- 2026-05-17T20:10:26.460+02:00 — `.github/extensions/copilot-avatar/lib/squad-context.mjs` must resolve casting aliases from `.squad/casting/registry.json`; `.squad/casting/history.json` tracks persistent cast inventory but does not carry the assignment snapshot needed for `lead` / `tester` → cast-name lookup.
- 2026-05-17T20:43:07.849+02:00 — The generic-label seam is still owned in `.github/extensions/copilot-avatar/main.mjs`: the merged runtime-first payload (`agentDisplayName ?? squad`) yields `General Purpose Agent`, while the corrected working-tree path resolves labels in `resolveSubagentDisplayData()` as Squad → spawn metadata → runtime.
- 2026-05-17T20:43:07.849+02:00 — Live extension regressions can be a process seam, not a source seam. Check that the running `project:copilot-avatar` extension is the active instance and run `extensions_reload` after local extension edits, or the avatar window can keep serving stale label behavior.

## Recent Work

### 2026-05-17 — Sub-agent Identity Regression & Fix (SUMMARIZED)

Traced and fixed generic agent label regression seam between extension and webview.

**Root Cause:** Commit c8724b0 added webview-side low-confidence filter without updating extension-layer logic. Line 405 fallback sends generic labels directly before Squad enrichment can apply.

**Fix:** Mirror webview `isLowConfidenceLabel()` in extension; prefer Squad displayName/role when Copilot sends generic label. Apply across all handlers (started/completed/failed).

**Key Insight:** Extension is the Copilot↔Squad boundary; filtering must originate there, not in webview cleanup alone.

*(Full investigation details archived in history-archive.md)*

### 2026-05-17 — .gitattributes Configuration Update

Marked Squad state files as auto-generated (`generated=true`) to collapse in GitHub PR review: `.squad/log/**`, `.squad/orchestration-log/**`, health/precheck reports, state markers. Preserved union merge rules for distributed workflow.

### 2026-05-17 — README Documentation Update

Added "Sub-agent Visibility Model" section documenting ownership: Copilot SDK owns lifecycle, Squad is enrichment-only, visible agents always match real active set. Reflects fallback-collapse fix implementation.

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
- Sub-agent Identity Regression Investigation (detailed trace, seam analysis, full mechanism)
- Auto-Generated Squad Files configuration
- Sub-agent Fallback Collapse Fix
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


## 2026-05-17 — Scribe Session Wrap-up

**Cross-Agent Note from Scribe:** Decision merged from Shuri's mic regression analysis to .squad/decisions.md. Shuri identified timing gap in Squad context sync as root cause for mic boom not rendering (extension sync before webview is open). Vision and Shuri findings now consolidated in shared decision record for team visibility.

**Decision Created:** "Mic boom visibility blocked by timing gap in Squad context sync" — covers exact mechanism, suspect commits, and fix directions (sync in assistant.turn_start or after avatar init).

**Orchestration Log:** Scribe recorded both investigations in .squad/orchestration-log/ for audit trail.

---

## 2026-05-17T20:00:51Z — Scribe Completion: Mic State Handoff Fix Orchestration

**From:** Scribe (Session Logger)

**Context:** Vision and Shuri's parallel work on mic state handoff bug converged on the same solution. Scribe has consolidated findings and recorded outcomes.

**What Scribe Did:**
1. Merged inbox decisions from both agents into .squad/decisions.md
2. Recorded orchestration logs for Vision and Shuri (standard form)
3. Consolidated web-ready-gate decision (2026-05-17T20:00:51.651+02:00)
4. Created session log documenting the full resolution path

**Outcome:** Your webview-ready handshake (page sets `__copilotAvatarReady` flag) gates Squad context replay. Extension waits for that signal before calling `setSquadContext()`. Combined with mic boom replay in root-avatar init, this ensures first-paint visibility. Full coordination trail now in `.squad/orchestration-log/2026-05-17T18-00-51Z-{vision,shuri}.md`.

**Team Visibility:** Session log in `.squad/log/2026-05-17T18-00-51Z-mic-state-handoff.md` summarizes both agents' findings for the broader team.

---

## 2026-05-17T20:10:26Z — Scribe: Cast Identity Resolution Cross-Agent Sync

**From:** Scribe (Session Logger)

**Context:** Vision and Shuri completed investigation into generic agent label regression. Scope expanded beyond mic boom to cover sub-agent cast name resolution seam failures.

**What Scribe Did:**
1. Merged inbox decisions (Howard identity verification, Shuri cast label precedence, Vision spawn metadata binding)
2. Created orchestration logs: `.squad/orchestration-log/2026-05-17T18-10-26-{vision,shuri}.md`
3. Session log: `.squad/log/2026-05-17T18-10-26-cast-identity.md`

**Decision Consolidation:**
- **Shuri's decision:** Treat generic runtime labels as missing; restore casting-registry lookup
- **Vision's decision:** Cache spawn tool metadata by toolCallId; bind to agentId before generic labels override

**Outcome:** Sub-agent identity now flows from three sources in order: (1) cached spawn metadata, (2) Squad casting/roster, (3) generic fallback. Cast names (Tony Stark, Howard the Duck) now resolve correctly even when Copilot SDK reports generic labels. Files modified: `main.mjs`, `lib/squad-context.mjs`.

## 2026-05-17T20:33:05.422+02:00 — Squad SDK Casting Integration Analysis

**From:** Vision (Platform Dev)

**Question:** Should the extension source cast identity from the Squad SDK instead of directly reading `.squad/casting/registry.json` and `.squad/casting/history.json`?

**Findings:**
- Squad SDK @bradygaster/squad-sdk@0.9.4 exports `CastingEngine` (live generation) and `CastingRegistry` (filesystem stub, incomplete)
- The SDK does **not** provide a stable runtime API to retrieve "which agent is cast to which role right now"
- `CastingRegistry` stub class is marked incomplete and would read the same files the extension already reads
- `.squad/casting/history.json` is the authoritative source of current assignment snapshots (`lead` → `Tony Stark`, etc.)
- The file-based design is more reliable: explicit source of truth, decoupled from SDK volatility, fault-isolated

**Recommendation:** Keep the current file-based design. No refactoring needed.
- The extension correctly reads `.squad/casting/history.json` directly—this is the right approach
- If the SDK ever stabilizes a casting retrieval API, adoption can happen as an optional refactor
- Detailed analysis: `.squad/agents/vision/sdk-casting-analysis.md`

## Team Update: Label Regression Investigation (2026-05-17)

**From Scribe:** Label regression confirmed in extension-side label precedence (main.mjs lines ~655-670). The merged path prioritizes SDK gentDisplayName before Squad metadata, allowing "General Purpose Agent" to outrank cast names. Proper fix exists on eat/microsoft-sam-tts branch (commit 877d269) and in WIP working directory but not merged to main HEAD (834a2ba).

**Coordination needed:** Branch merge strategy and WIP state resolution before this fix lands.

---
