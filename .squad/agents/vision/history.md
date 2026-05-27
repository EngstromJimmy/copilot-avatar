# Vision — Platform Dev

**Project:** CopilotAvatar
**Owner:** Jimmy Engstrom
**Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad

## Current Work Status

Sub-agent visibility, identity resolution, and metadata enrichment integration with Copilot SDK. Extension error handling and user-space deployment finalized. Platform glue restored for cross-project avatar usage.

**Latest Focus:** Cross-project extension reliability, user-space authority confirmation, and webview-ready replay hardening.

## Key Decisions (2026-05-18)

**Runtime Authority Cleanup** (Finalized)
- Visibility ownership: Copilot runtime events + session.idle.data.backgroundTasks.agents
- Squad role: enrichment-only (metadata), not visibility authority
- Roster source: .squad/team.md preferred, .squad/roster.md as legacy fallback
- Provisional cards: bind on exact stable identity overlap or unambiguous 1:1 pairs

## Recent Sessions Summary

**2026-05-27T10:06:21.718+02:00 (Project vs user/runtime drift audit)**
- Repo extension is healthy: lightweight validation stayed green (140/140) and the project copy is not failing from shared code or path resolution.
- User and AppData copies had drift in `extension.mjs`/`main.mjs`; the AppData copy also still carried the old `vscode-jsonrpc` package metadata seam that breaks `@github/copilot-sdk/extension` import.
- Synced both installed copies back to the repo version, restored workspace approval for `user:copilot-avatar`, and reduced `disabledExtensions` to `project:copilot-avatar` so only one authority should remain.
- Important remaining seam: `extensions_reload` still reports `user:copilot-avatar` as disabled after on-disk repair, so this runtime needs a full Copilot restart to pick up the corrected state.

**2026-05-27 (Final Resolution)**
- Root cause identified: extension explicitly disabled in ~/.copilot/settings.json
- Removed "user:copilot-avatar" from disabledExtensions list
- Project extension (project:copilot-avatar) now running and active
- "avatar" keyword now recognized and functional
- Decision finalized: vision-extension-error-handling.md
- Files synchronized and versions matched (0.2.2)

**2026-05-27T09:34:17.883+02:00 (Handshake Hardening)**
- Lightweight validation still passed, so the likely live seam moved to late webview readiness during open/reload.
- Hardened `syncVisibleWindowState()` so a missed ready handshake no longer clears backend/runtime sub-agent state before replay can actually land.
- Added a bounded retry plus probe coverage for the ready-gate contract.

**2026-05-27 (Initial Investigation)**
- Global Copilot Avatar extension deployed to user space
- Extension v0.2.2 deployed to: C:\Users\JimmyEngstrom\AppData\Roaming\Copilot CLI\extensions\copilot-avatar
- Verified: sleep-fix logic present; dependencies installed; version matched
- User-space extension now authoritative for CLI loads

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

## 2026-05-27T09:34:17.883+02:00 — Team Avatar Failure Resolution

**Team:** Vision (Platform Dev), Howard the Duck (Tester), Peter Parker (Backend Dev)

**Work Completed:**
1. ✅ Extension settings barrier removed; disabled extension re-enabled
2. ✅ Page-ready handshake guard implemented (`syncVisibleWindowState` now awaits readiness before destructive replay)
3. ✅ Bounded retry logic added to late-open/reload activation path
4. ✅ Peter Parker's entrypoint/bootstrap revision approved by Howard (140/140 tests)

**Key Decisions:**
- Decision 5: Extension Settings and Version Sync
- Decision 6: Guard late-open replay on page readiness

**Impact:** Avatar activation pathway now guards against readiness timeout; replay operations no longer risk erasing runtime state before UI is ready.

---

## Learnings

- 2026-05-27T10:06:21.718+02:00 — **Shared avatar code was not the failing seam:** repo validation stayed green, while drift was isolated to installed bootstrap/runtime files (`extension.mjs`, `main.mjs`, and the AppData `vscode-jsonrpc` package metadata).
- 2026-05-27T10:06:21.718+02:00 — **`extensions_reload` is not enough to clear this disabled-state seam:** after fixing settings and workspace approval on disk, the live runtime still reported `user:copilot-avatar` as disabled. Treat that as a restart-required boundary, not proof that the repaired files are still wrong.

**Detailed work archived in history-archive.md**

## 2026-05-27 — Cross-Agent Session: Runtime Authority & Disabled-State Refresh

**Coordinated with:** Peter Parker (Backend), Howard the Duck (QA)  
**Context:** End-to-end avatar extension failure and recovery path

### Your Findings & Decision

1. Repo extension is healthy (lightweight validation: 140-143 passed)
2. Installed user and AppData copies had drift in extension.mjs and main.mjs
3. AppData copy carried stale vscode-jsonrpc metadata breaking @github/copilot-sdk/extension import
4. After syncing files + restoring user:copilot-avatar approval: extensions_reload still kept disabled state

### Decision: Restart-Bound Refresh

Keep project:copilot-avatar disabled in settings (no dual-copy conflict). Treat user:copilot-avatar as intended authority once Copilot runtime is restarted.

Do not chase path-resolution or shared-content fixes — remaining live seam is runtime state refresh, not repo code.

### Required Operator Action

Full Copilot CLI/Desktop runtime restart so it re-reads:
- Repaired settings (disabledExtensions list)
- Restored user approval
- Synced user extension files

### Status

System state reconciliation complete. Platform readiness confirmed for user copy once user performs restart.
