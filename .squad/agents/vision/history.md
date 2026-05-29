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

## 2026-05-27T10:21:23.313+02:00 — User Install Authority Resync

**Work Completed:**
1. ✅ Mirrored the repo extension into C:\Users\JimmyEngstrom\.copilot\extensions\copilot-avatar while preserving the user's local .tts-settings.json
2. ✅ Mirrored the same runtime files into the legacy AppData copy to remove stale bootstrap drift there too
3. ✅ Verified the non-user-specific installed files now match the repo copy in both locations
4. ✅ Repaired C:\Users\JimmyEngstrom\.copilot\settings.json so project:copilot-avatar stays disabled and user:copilot-avatar is allowed to load

**Key Finding:**
- The live extension registry still has both avatar copies marked disabled until the runtime reload boundary is crossed, so on-disk repair alone is not enough to flip the running process.

## Learnings

- 2026-05-27T10:21:23.313+02:00 — **Preserve user TTS state during install resync:** mirror the repo extension into user space, but do not overwrite .tts-settings.json or you risk destroying the user's runtime configuration while fixing code drift.
- 2026-05-27T10:21:23.313+02:00 — **Disable only the project copy when user space is intended authority:** keeping project:copilot-avatar in disabledExtensions avoids dual-authority loading while leaving the repaired user:copilot-avatar eligible after reload/restart.

---

## 2026-05-27T10:21:23.313+02:00 — User Install Authority and Sync Completion

**Session:** user-install-sync  
**Status:** User extension resync + settings authority finalized. Pending CLI restart.

### Work Completed

- Identified stale lib/copilot-webview.js and probe-regression.mjs in installed user copy (old SDK seam)
- Synced repo-managed files from project copy to user install
- Preserved local .tts-settings.json settings during sync
- Updated settings: disabled project:copilot-avatar, kept user:copilot-avatar enabled
- Documented that extensions_reload does not clear disabled-state cache; full CLI restart required

### Key Finding

The user extension is authoritative once the Copilot CLI process restarts and re-reads settings and the repaired installed files.

### Next Owner

Awaiting CLI restart. Runtime activation is no longer a code seam.

## Learnings

- 2026-05-29T17:44:38.614+02:00 — **Avatar TTS suppliers need four explicit seams:** when adding a new engine, wire it in `.github/extensions/copilot-avatar/main.mjs` defaults, `content/index.html` controls, `content/main.js` preview/save/speak branches, and `probe-regression.mjs`, or the engine can silently fall through to Web Speech.
- 2026-05-29T17:44:38.614+02:00 — **Deepgram fits the existing supplier pattern without new plumbing layers:** persist `deepgramApiKey` and `deepgramVoice`, keep a provider-specific request function, and reuse the shared AI-voice panel only for common UI chrome.

---

## 2026-05-29T17:44:38.614+02:00 — Deepgram TTS Supplier Integration

**Session:** deepgram-tts  
**Status:** Completed and validated.

### Work Completed

- Added Deepgram as a selectable TTS supplier in the avatar settings UI
- Wired Deepgram API key + Aura voice persistence through the extension settings seam
- Added explicit Deepgram preview/speak routing with provider-specific request handling in `content/main.js`
- Extended `probe-regression.mjs` so supplier wiring is checked alongside existing avatar regression coverage
- Ran the extension validation target successfully from `.github/extensions/copilot-avatar`

### Key Finding

Reusing the shared AI-voice UI works safely only when the provider keeps explicit save/load and speech-routing branches; hiding that behind generic fallback logic would make the failure seam ambiguous.

### Next Owner

None. The Deepgram supplier seam is in place and validated.

---

## 2026-05-29T15:44:38Z — Scribe: Session Consolidation

**Scribe Status:** Decisions merged, orchestration logged.

**Decisions Recorded:**
- Deepgram TTS Supplier Contract: Explicit supplier wiring per seam (no generic abstraction)
- Repository Sync: Local main synchronized with origin/main

**Session Artifacts:**
- Inbox merged (vision-deepgram-tts.md, vision-sync-main.md) → decisions.md
- Orchestration log: 2026-05-29T15-44-38Z-Vision.md
- Archive: Not triggered (2.6 KB < 20 KB threshold)
