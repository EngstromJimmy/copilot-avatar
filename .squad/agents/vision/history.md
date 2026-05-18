# Vision — Platform Dev

**Project:** CopilotAvatar
**Owner:** Jimmy Engstrom
**Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad

## Current Work Status

Sub-agent visibility, identity resolution, and metadata enrichment integration with Copilot SDK. Runtime authority cleanup finalized; Squad acts as enrichment-only layer.

**Latest Focus:** Monitoring regression probes and cross-project validation (Squad and non-Squad).

## Key Decisions (2026-05-18)

**Runtime Authority Cleanup** (Finalized)
- Visibility ownership: Copilot runtime events + session.idle.data.backgroundTasks.agents
- Squad role: enrichment-only (metadata), not visibility authority
- Roster source: .squad/team.md preferred, .squad/roster.md as legacy fallback
- Provisional cards: bind on exact stable identity overlap or unambiguous 1:1 pairs

## Recent Sessions Summary

**2026-05-18**
- Runtime authority cleanup decision finalized
- Background visibility/identity reconciliation approved (79/79 regression checks)
- Sub-agent visibility fix (waitingForRetire cleanup bug removed)
- Constraint audit: subagent.selected remains weak hint only

**2026-05-17**
- Late-open naming session completed
- Full Squadron integration restored
- v0.2.1 release documented
- Avatar window always-on-top behavior fixed (gated to transparentWindow)

---

**Detailed work archived in history-archive.md**
