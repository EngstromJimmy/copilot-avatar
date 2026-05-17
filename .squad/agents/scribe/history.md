# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.

## 2026-05-16T17:28:38.428+02:00 — Session Log: Live Sub-Agent Naming Fix (Runtime/Event-Bridge Revision)

**Summary:** Completed revision cycle for live sub-agent display name resolution via runtime event-bridge. Initial design review identified system-level Squad integration but missed a critical runtime seam where opaque agentId values could outrank actual cast names. Revision cycle addressed the gap through guarded alias lookup, bringing stable Squad names (from casting-slot aliases) to the event handler layer without breaking non-Squad sessions.

**Participants:**
- **Tony Stark (Implementation Lead):** Implemented runtime/event-bridge revision with guarded agentId fallback and casting-slot alias resolution
- **Howard the Duck (QA Lead):** Identified runtime naming bug in initial design, assigned revision owner, validated final implementation
- **Peter Parker (Complementary Work):** Prior stale-state reset mechanism enabled this revision to work correctly on context boundaries
- **Scribe (Logging):** Consolidated team memory and cross-agent context

**Timeline:**
1. Tony Stark completed initial multi-agent identity & badge design review with Squad metadata schema
2. Howard the Duck rejected batch due to runtime naming bug—opaque agentId values could still leak into display layer
3. Tony Stark implemented revision with guarded agentId lookup (stable aliases only, no opaque handles)
4. Howard the Duck re-validated all QA gates and approved final state

**Deliverables:**
- Extended `squad-context.mjs` agentId lookup with stable-alias filtering
- Updated `main.mjs` event handlers with consistent display-name resolution
- Verified `content/main.js` badge system compatible with resolved Squad names
- All QA gates passed; syntax clean; no regressions to non-Squad paths

**Key Insight:**
The runtime naming bug revealed an important architectural distinction: Squad roster lookups must stay anchored to stable identity fields (`agentName`, `agentDisplayName`, casting-slot aliases) rather than opaque runtime instance IDs. This ensures that Squad metadata enrichment is optional and graceful, not a hidden dependency.

---

## Cross-Agent Learnings

### Revision Cycles Benefit from Role Clarity
When a design review produces a technically sound but architecturally incomplete solution, explicit role assignment (Tony Stark as revision owner) + detailed critique (Howard the Duck's QA gate) + complementary work (Peter Parker's state reset) produces higher-quality outcomes than iterating within a single agent's scope.

**Action:** Continue defining clear ownership and critique roles for complex systems. This helps catch seams between lifecycle stages, event ordering, and optional features.

### Guarded Fallbacks for Optional Integrations
The runtime naming bug demonstrated that fallback chains in optional systems (Squad enrichment on top of Copilot SDK) need guards to prevent transient values from short-circuiting the chain. Accepting any stable-looking agentId value (e.g., `tony-stark`) while rejecting opaque handles (e.g., `agent-call_H`) keeps Squad metadata optional without risking label pollution.

**Action:** When designing fallback chains for optional features, define "safe" vs "unsafe" fallback values rather than treating all non-empty strings equally.

### Event Handler Consolidation Enables Better Validation
Centralizing display-name resolution through a single `resolveSquadAgentMetadata()` contract made it easy to apply consistent guards and validation across all subagent lifecycle events. This is harder to maintain if resolution logic is scattered across three event handlers.

**Action:** Prefer consolidated contracts for cross-cutting concerns (name resolution, model sync, activity tracking) over scattered implementations.

### State Reset Boundaries Must Precede Optional Metadata Sync
Peter Parker's prior stale-state reset work (clearing `subagentStateById` on session/context boundaries) was essential for this revision to work correctly. Without explicit reset, stale Squad-backed cards could replay from prior contexts. This is a good example of "invisible" groundwork that enables cleaner feature implementation downstream.

**Action:** When building optional metadata systems, ensure state reset boundaries are in place before implementing metadata-specific logic.

---

## 2026-05-16T22:11:33Z — Routine Squad Housekeeping

**Summary:** Executed routine squad memory maintenance. No decisions needed archival (all entries from current day). No inbox files to process. Recorded orchestration event for vision-5's .gitattributes platform work.

**Work:**
- Pre-check: decisions.md at 70459 bytes (within threshold, all entries recent)
- Decision archive: No entries older than 7 days (all from 2026-05-16)
- Decision inbox merge: 0 files processed
- Orchestration log: Recorded vision-5 platform work
- Session log: Created housekeeping session record
- Cross-agent updates: Vision history already reflects .gitattributes work
- No history files exceeded summarization threshold

**Health:** System running clean; memory hygiene maintained.
