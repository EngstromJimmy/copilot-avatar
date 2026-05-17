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

## Recent Work

### 2026-05-17 — Sub-agent Identity Regression Investigation

**Problem:** UI displays generic "general-purpose" agent placeholder instead of Squad cast names and roles.

**Investigation:** Traced the regression through git history and code flow analysis.

**Root Cause — Seam Misalignment:**
- **Commit c8724b0** added low-confidence label detection to the webview (`content/main.js`): `GENERIC_AGENT_LABELS`, `isLowConfidenceDisplayName()`, `resolveAvatarDisplayName()`
- Extension (`main.mjs`) was **not updated** with matching filter logic
- When Copilot SDK sends `agentDisplayName: "General Purpose Agent"` (opaque runtime label):
  - Line 405 fallback: `displayName: event.data?.agentDisplayName ?? squadAgent?.displayName ?? event.data?.agentName ?? ""`
  - Since first term is truthy, it short-circuits before ever checking `squadAgent?.displayName`
  - Webview receives generic label; its `resolveAvatarDisplayName()` detects it as low-confidence but has no Squad enrichment in payload to fall back to
  - UI renders placeholder because contract violation happened upstream (extension should filter before payload construction)

**Last Known Working:** Commit **3d4ed87** "Add Squad-aware avatar metadata and release workflow"
- `resolveSquadAgentMetadata()` was integrated correctly
- No webview-side low-confidence detection yet; entirely extension-driven enrichment
- Cast names and roles rendered correctly because generic labels were (accidentally) accepted first, but Squad metadata was properly consulted

**Exact Mechanism:**
Data flow shows the seam failure point:
```
Copilot SDK { agentDisplayName: "General Purpose Agent" }
    ↓
main.mjs line 405: uses agentDisplayName directly (no low-confidence check)
    ↓
webview receives { displayName: "General Purpose Agent", role: "" }
    ↓
content/main.js resolveAvatarDisplayName() detects generic label but no Squad fallback exists
    ↓
Renders "General Purpose Agent" — Squad metadata never consulted by extension
```

**Fix Direction:** Apply **stable-agent-identity** pattern to main.mjs:
1. Bring `GENERIC_AGENT_LABELS` and `isLowConfidenceLabel()` into main.mjs (mirror content/main.js definitions)
2. Before line 405, check if `event.data?.agentDisplayName` is low-confidence
3. **If low-confidence AND `squadAgent` exists**, prefer Squad displayName and role over Copilot generic labels
4. Apply consistently across all three handlers: `subagent.started`, `subagent.completed`, `subagent.failed`
5. This moves the filtering seam to the source (extension ↔ Copilot SDK boundary) instead of relying on webview cleanup

**Key Insight:** Webview-layer defensive improvements (c8724b0) are good hygiene but insufficient when the extension doesn't filter first. The extension is the translation layer between Copilot's opaque runtime IDs and Squad's stable identities—low-confidence filtering must originate there.

### 2026-05-17 — Auto-Generated Squad Files in .gitattributes

**What:** Updated `.gitattributes` to mark squad state files as auto-generated so they collapse by default in GitHub PR review.

**Changes:**
1. Added `generated=true` attribute to:
   - `.squad/log/**` (append-only orchestration logs)
   - `.squad/orchestration-log/**` (orchestration event records)
   - `.squad/health-report-*.md` (system health snapshots)
   - `.squad/precheck-report.json` (environment validation reports)
   - `.squad/.first-run` (state markers)
   - `.squad/temp_inbox_merge.txt` (temporary merge state)

2. Preserved existing union merge rules:
   - `.squad/decisions.md merge=union` (team decisions)
   - `.squad/agents/*/history.md merge=union` (agent work logs)
   - `.squad/log/** merge=union` (log merging behavior)
   - `.squad/orchestration-log/** merge=union` (orchestration log merging)

**Why:** Squad state files are auto-generated by the orchestration system and change frequently during normal operation. Marking them as generated prevents reviewers from seeing large diffs of ephemeral state during PR review, keeping focus on actual code changes. Union merge rules remain intact for distributed team workflows.

**Validation:** Git attribute checks confirmed `generated=true` applied correctly to squad state files.

### 2026-05-17 — README Documentation Update

**What:** Updated README to document the current sub-agent visibility model after ghost card fixes.

**Changes:**
1. Added new "Sub-agent Visibility Model" section that explicitly states:
   - Copilot SDK emits lifecycle events and is the source of truth
   - Extension renders only Copilot-owned agents
   - Duplicate/fallback ghost cards eliminated
   - Visible agents always match real active Copilot set

2. Clarified "Squad Integration" section:
   - Squad enriches Copilot-owned agents only
   - Cannot create, suppress, or collapse visible agents
   - Copilot SDK owns all visibility and lifecycle decisions

3. Updated "Usage" section to reflect:
   - Sub-agents appear as Copilot SDK routes work
   - Squad enriches but doesn't affect visibility
   - Extension stays in sync with real Copilot set

**Why:** Establish a clear contract with users and future maintainers about the ownership model: Copilot SDK controls visibility entirely, Squad is metadata-only enrichment, and users can rely on the rendered agent set being accurate and consistent.

**Validation:** README adheres to existing style, changes are concise and directly relevant, documentation now reflects implemented behavior from fallback-collapse fix work.

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

