# Project Context (Archived)

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Archived Work (2026-05-16 earlier than 20:00)

### 2026-05-16: Sub-agent visibility race condition investigation
- Identified fundamental synchronization gap: webview never auto-opens, Squad events fire before window ready
- Root cause: callWindowFunction silently fails if webview._handle is null
- Decided on Option A: Auto-show on Squad detection (simplest, lowest-risk fix)

### 2026-05-16T15:42:38.842+02:00: Auto-Show on Squad Detection Decision
- Approved and implemented Squad auto-detection in refreshSessionContext()
- Pre-emptively call webview.show() with error handling if Squad found

### 2026-05-16: Review: Stable Agent Identity for Naming
- Established that agentId is runtime instance ID, not Squad roster key
- Display-name fallback chain: agentDisplayName → Squad roster → agentName → agentId

### 2026-05-16T16:02:40.457+02:00: Design Review: Multi-Agent Identity & Badge System
- Comprehensive design review for agent names, activity badges, model information
- Key findings: name resolution broken at seam, badge missing activity detail, model sync race
- Architectural decisions: centralized name resolver, dynamic badge content, agent-based model queuing

### 2026-05-16T16:02:40.457+02:00: Runtime State Sync for Squad Sub-Agents
- Centralized sub-agent identity, model, tool activity in main.mjs
- Guarded Squad naming against placeholder SDK labels
- Added richer activity payloads

### 2026-05-16T14:02:40.457Z: Session Complete: Approved Sub-Agent Identity & Badge Fix
- Team: Tony Stark (Lead), Vision, Peter Parker, Shuri, Howard the Duck (QA)
- Outcomes: Squad aliases resolve to cast names, per-subagent model updates, badge tracks activity
- Files: main.mjs, squad-context.mjs, content/main.js

### 2026-05-16T17:28:38.428+02:00: Runtime/Event-Bridge Revision
- Implemented guarded runtime/event-bridge revision for live task subtasks
- Extended squad-context.mjs for stable-alias filtering
- Validation: node --check passed; regression probes covered
- Decision: Approved and merged by Howard the Duck

## This Archive
Contains the foundational work and design decisions leading up to the final fixes for stale subagent replay. See history.md for current/ongoing work.
