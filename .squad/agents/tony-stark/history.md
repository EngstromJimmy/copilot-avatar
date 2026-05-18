# Tony Stark — Lead

**Project:** CopilotAvatar  
**Owner:** Jimmy Engstrom  
**Expertise:** Backend architecture, state management, event consolidation  

## Current Work Status

Architecture review and simplification initiative for sub-agent visibility model. Team now aligned on single-authority approach.

**Latest Focus:** Enforcing Copilot runtime as sole visibility authority; Squad as metadata enrichment only.

---

## 2026-05-18 — Team Architecture Decision: Subagent Simplification Baseline

**From:** Scribe (orchestration log 2026-05-18T14:11:43.269Z)  
**User Directive:** Jimmy Engstrom — "Prefer the simplest approach for Avatar sub-agent listing and naming"

### Decision Summary

For the next avatar fix:
- **Sole visibility authority:** Copilot runtime (`subagent.started`, `subagent.completed`, `subagent.failed`, `session.idle.data.backgroundTasks.agents`)
- **Squad's role:** Optional metadata enrichment (display name, role, description) when runtime/spawn provides stable alias
- **`subagent.selected`:** Not authoritative; at most, weak fallback hint
- **Explicit non-goal:** Do not chase undocumented payload fields; degrade cleanly if name unavailable

### Minimum Acceptable Architecture

1. One visible-card state map
2. One spawn/runtime correlation seam
3. One late-open replay path
4. One optional Squad enrichment lookup

**What to Delete:**
- State that invents a second ownership model above Copilot runtime
- Heuristic caches and score-based pairing
- Count/order fallback logic

### Visibility Checkpoint (2026-05-18)

Posted identity check-in notification at 15:34 UTC+2 to enable cross-team verification of Avatar UI layer, notification system, and orchestration logs during simultaneous 3-agent visibility window. ✅ Complete.

---

## Recent Work (2026-05-16)

### Subagent Duplicate Card Seam — Fixed

**Problem:** User reported >2 visible Copilot-owned cards when only 2 intended.

**Root Causes:** `collapseAvatarIdentityDuplicates()` defined but not invoked; empty identity keys bypassed dedup.

**Fixes:** Invoked dedup on card creation and identity update; added displayName fallback.

**Result:** Exactly 2 visible Copilot-owned cards maintained. Full seam sealed. ✅

---

## Key Decisions — 2026-05-18

**Sub-agent Simplification Baseline** (coordinated with Jimmy + Peter Parker + Vision)
- Copilot runtime is sole visibility authority
- Squad provides optional metadata enrichment only (display name/role/description)
- `subagent.selected` is weak hint at best; not authoritative identity
- Explicit non-goal: Do not chase undocumented payload fields

**Visibility Checkpoint** (2026-05-18 15:34 UTC+2)
- Posted identity check-in notification for cross-team UI/notification/orchestration verification
- Enabled simultaneous 3-agent visibility window for team sync
- ✅ Complete

---

## Learnings Summary

- SDK `session.rpc.agent.list()` exposes catalog, not live instances; use `subagent.started/completed/failed`
- Stable naming requires full seam closure: authority + identity key + display fallback
- Squad visibility gates must not apply to sub-agent enrichment; metadata lookup needs full Squad context
- Fallback chains essential: final key (displayName or opaque ID) keeps downstream functional
- One visible-card state map per architecture decision required for robustness

_Earlier detailed work and decisions archived in history-archive.md_
