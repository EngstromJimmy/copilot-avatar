# Tony Stark — Lead
## Current Work

**Project:** CopilotAvatar  
**Owner:** Jimmy Engstrom  
**Expertise:** Backend architecture, state management, event consolidation  

### Recent Completions (2026-05-16)

#### Stale Subagent Ghost Fix
- **Problem:** Completed/failed subagents reappeared in avatar window after CLI cleared them
- **Root Cause:** `syncKnownSubagents()` re-synced all agents including completed/failed, resetting fade timers
- **Solution:** Filter sync to `status === "active"` only; schedule pruning of terminal agents
- **Validation:** `node --check` ✅

#### Directive-Boundary Subagent Reset Fix  
- **Problem:** Agents from old directive persisted into new directive
- **Root Cause:** `assistant.turn_start` had no reset like `session.start` and `session.context_changed`
- **Solution:** Call `resetSubagentRuntimeState({ clearUi: true })` at directive boundary
- **Defense Layers:** (1) directive-boundary reset, (2) active-only sync filter, (3) post-completion prune timer
- **Validation:** `node --check` ✅

## Archived Work

Earlier sessions documented in `history-archive.md`:
- Sub-agent visibility race investigation & auto-show-on-Squad-detection decision
- Multi-agent identity & badge system design review (with Vision, Shuri, Peter Parker, Howard the Duck)
- Runtime/event-bridge revision & casting-slot alias resolution
- Model sync race fixes and state centralization
