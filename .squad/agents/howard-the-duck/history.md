# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Role

Howard the Duck — QA & Validation specialist for the CopilotAvatar extension.

## Key Learnings (Summary)

- **Mic Boom Visibility:** Root Squad mic created only for root avatar; visibility toggled by squadRootMicActive variable set via window.setSquadContext(). Capsule geometry parameters (0.024, 0.052) are critical; corruption in WIP merge (0.0264, 0.0572) breaks visual design.
- **Stale Subagent Replay Risk:** Late-open replay requires clearing both backend caches and UI before hydration; critical seam at main.mjs session.getMessages() and content/main.js clearSubagents().
- **Voice Persistence:** TTS settings merge via .tts-settings.json in main.mjs, but populateElevenLabsVoices() must preserve previous voice through async placeholders to avoid blanking saved selection.
- **Sub-agent Naming:** Squad metadata must bypass top-level UI gating for sub-agent identity lookup; casting-slot aliases resolve to human names (e.g., lead → Tony Stark).
- **Duplicate Identity Collapse:** Hidden agents stay hidden until real tool work starts; intent/reasoning alone insufficient for visibility.
- **Late-Open Avatar Review:** Two-part validation: (1) source probe of cached metadata/toolCallId maps in main.mjs, (2) live DOM probe queuing update calls before ddSubagent to confirm proper state upgrade.

## Key Learnings (cont.)

- **SAM Engine Is Custom Formant Synthesis:** The SAM TTS engine in content/main.js is a fully browser-native Web Audio API formant synthesizer (`synthesizeSamAudio`, `SAM_PHONEME_DATA`, `samG2P`) — no external sam-js or CDN dependency. The SAM_VOICES presets (sam/elf/cylon/vader/stuffy/gruff) drive pitch/formantShift/rate.
- **SAM Persistence Ordering:** `savedTts.samVoice` is restored before `populateSamVoices()` is called; `populateSamVoices()` reads the module-level `samVoice` var and marks the matching `<option>` selected, so a saved non-default voice survives init.
- **Three-Sub-Agent Visibility Miss:** The `assistant.turn_start` guard (`!event.agentId`) is correctly present in `hydrateSubagentRuntimeFromHistory`. However, if the root agent's second turn fires AFTER `subagent.started × N` (coordinator multi-step loop), those N sub-agents are wiped from `activeSubagentsByAgentId` in the replay, making them invisible in a late-open window. This is the probable root cause of the historical "three invisible agents" incident.

## Current Focus

QA validation for avatar sub-agent visibility and identity refresh in background-task handling. Recent approval cycle closed on Peter Parker's three-part fix: provisional visibility owners, background metadata caching, and runtime-first identity resolution.

---

## 2026-05-18 — Team QA Review Cycle: Decisions & Approval Path

### Recent Decisions Affecting QA Strategy

**1. Background Snapshot Retire Guard** ✅ APPROVED (2026-05-18T15:35:44.313+02:00)
- Problem: Live cards pruned by fallback retire even when `session.idle` showed agent active
- Fix: Guard retire against background snapshot; if agent in snapshot, bail out
- Your role: Validate both first-open merge + retire guard

**2. Fake `call_*` ID Subtask Leak** ❌ REJECTED (2026-05-18T15:35:44.313+02:00)
- Problem: Fake non-root cards appear (raw `call_*` IDs, avatar-control tool text)
- Fix needed: Filter raw IDs; exclude meta tools; add probe coverage
- Lockout: Revision goes to Peter Parker (not Vision)
- Your role: Enhance probe to assert no fake `call_*` / avatar-control cards

**3. SDK Sub-agent Acceptance Criteria** 📋 PROPOSED (2026-05-18T16:11:43.269+02:00)
- Visibility: Must come from one SDK-observable inventory seam (not parsing/scoring/fallback)
- Naming: Must resolve directly via Squad lookup (not description parsing)
- Minimum contract: (1) Live agents stay visible; (2) Aliases resolve to cast names; (3) No heuristic repair
- Your role: Probe must prove one inventory source, direct Squad resolution, zero heuristic name repair

### SAM & Load Resilience Summary

SAM library migration to external `sam-js` complete; C64/MS_SAM seams properly separated.
Avatar load resilience: Optional GLB loads timebox, set ready from fallback, load non-critical in background.

### Background Identity & Visibility Summary

✅ Background agents now stay visible and correctly reconciled; runtime/background names outrank spawn aliases.
Cards materialize from background-task snapshots; prevents disappearing agents during reload/idle handoff.

_Earlier detailed session logs and learnings archived in history-archive.md_

## Learnings

- 2026-05-27T09:34:17.883+02:00 — **Entrypoint coverage gap is closed when the probe imports the real entry module shape:** the updated `probe-regression.mjs` now stubs `extension.mjs` with a replacement `./main.mjs` URL, proving activation waits for `main.mjs` evaluation and that startup failures are logged instead of escaping silently.
- 2026-05-27T09:34:17.883+02:00 — **Bootstrap permission coverage must stay explicit:** approval is justified only because `lib/copilot-webview.js` now passes `onPermissionRequest: approveAll` in `extension.createSession(...)` *and* the probe asserts that bootstrap seam directly. Keep both the code path and the probe check together.
- 2026-05-27T09:34:17.883+02:00 — **Green probe is not entrypoint proof:** `probe-regression.mjs` is still a lightweight source-assertion harness. It does not exercise `extension.mjs`, and it does not prove the Copilot CLI can activate the extension end-to-end.
- 2026-05-27T09:34:17.883+02:00 — **Bootstrap permission seam needs explicit coverage:** `main.mjs` passes `onPermissionRequest: approveAll`, but `lib/copilot-webview.js` bootstrap still calls `extension.createSession()` bare. Treat that path as suspect until the regression probe or another repo-local check covers it explicitly.
- 2026-05-27T09:15:52.041+02:00 — **Avatar Extension SDK Migration Fix:** Three-part issue found and resolved:
  1. **vscode-jsonrpc ESM exports:** Transitive dependency from copilot-sdk@0.1.32 lacked ESM `exports` field, causing "Cannot find module 'vscode-jsonrpc/node'" error. Fixed by adding exports to node_modules package.json.
  2. **Copilot SDK breaking API change:** `joinSession()` removed; replaced with `extension.createSession()`. Migrated all call sites in main.mjs and lib/copilot-webview.js.
  3. **Missing permission handler:** `createSession()` now requires `onPermissionRequest: approveAll` parameter. Imported approveAll and added to session config.
  - Regression probe extended from 126 to 133 tests; all passing.
  - User profile synced with fresh dependencies and fixed code.
  - Extensions no longer fail to load; now runnable from external projects.

- 2026-05-18T16:32:01.320+02:00 — `.github/extensions/copilot-avatar/probe-regression.mjs` now imports `lib/squad-context.mjs` directly, proves Squad alias resolution with `tester` → `Howard the Duck`, and finds an inactive parent cwd so the same probe covers non-Squad projects.
- 2026-05-18T16:32:01.320+02:00 — The sub-agent regression contract is now explicit: Copilot runtime/background state owns visibility, while Squad metadata is optional enrichment only; non-Squad naming must still fall back to runtime labels before stale spawn aliases.

## 2026-05-18 — Squad-Optional Probe Contract

**From:** Scribe (team decision recorded via orchestration)

Howard's regression probe contract finalized: probe-regression.mjs must verify sub-agent visibility in both Squad and non-Squad contexts.
- Squad is enrichment-only, not a visibility requirement
- Probes must assert: visibility stays runtime/background-owned
- Coverage: positive probe from repo root, negative probe from inactive cwd
- Real regressions: early disappearance, wrong visible names, hidden Squad dependency

This contract ensures the cleanup works for both Squad and non-Squad projects, as per user directive.

---

## 2026-05-27T09:34:17.883+02:00 — Entrypoint/Bootstrap Coverage Approval

**Your Decisions:**
- Decision 2: Reject initial coverage claim (identified 3 coverage gaps)
- Decision 4: Approve Peter Parker's entrypoint/bootstrap revision (140/140 tests)

**What You Verified:**
1. `extension.mjs` now uses `await import("./main.mjs")` inside guarded startup wrapper
2. `lib/copilot-webview.js` bootstrap creates session with `onPermissionRequest: approveAll`
3. `probe-regression.mjs` covers previously missing seams:
   - Stubbed success path proves entrypoint waits for main.mjs evaluation
   - Stubbed failure path proves startup errors are logged
   - Source assertions prove bootstrap keeps `approveAll` permission contract

**Impact:** Real entry module shape now exercised. Bootstrap permission contract verified. Extension ready for integration.

- 2026-05-27T10:06:21.718+02:00 — **Current failure split is settings-disabled project vs stale user install:** the repo copy now passes the lightweight suite (143/143) and its `lib/copilot-webview.js` imports cleanly under the CLI-bundled SDK bootstrap, so today's project-side non-start is the `disabledExtensions` setting rather than a current code crash.
- 2026-05-27T10:06:21.718+02:00 — **User runtime still has stale bootstrap drift even after the repo fix:** `C:\Users\JimmyEngstrom\.copilot\extensions\copilot-avatar\lib\copilot-webview.js` still imports `{ extension }` and calls `extension.createSession()`, which crashes under the bundled CLI SDK before any webview can start, and the installed `probe-regression.mjs` is stale enough to die outside a git repo.
- 2026-05-27T10:06:21.718+02:00 — **Do not blame the ready handshake before activation survives startup:** with both avatar extensions disabled in settings and the user copy still failing during SDK import, there is no live evidence of a `__copilotAvatarReady`/webview race in the current failure report.

## 2026-05-27 — Cross-Agent Session: Failure Classification

**Coordinated with:** Peter Parker (Backend), Vision (Platform)  
**Context:** Diagnosing avatar extension failures in project and user copies

### Your Finding

- Project copy: Settings disablement (not code failure) — disabled in ~/.copilot/settings.json
- User copy: Stale installed code + settings disablement — still uses dead SDK exports
- Both project:copilot-avatar and user:copilot-avatar are disabled

### Classification Decision

Do not classify current report as webview-ready handshake failure. The failing user copy dies before webview bootstrap can run. This is an installed/settings seam, not a source code issue in the repo.

### Validation

- Repo copy passed existing lightweight validation (143/143)
- lib/copilot-webview.js imported successfully under bundled SDK bootstrap
- Stale user copy imports fail: `extension.createSession()` dead, `getMessages()` missing
- User probe (probe-regression.mjs) also stale and unsafe to run

### Impact

Peter's SDK contract fix is good evidence for project copy, but user copy needs sync + re-enable before it matters. Vision confirmed repair steps complete.

- 2026-05-27T10:21:23.313+02:00 — **User install parity is fixed on disk, but live runtime can still stay disabled until the CLI refreshes its extension state:** the user copy under `C:\Users\JimmyEngstrom\.copilot\extensions\copilot-avatar` and the runtime cache under `C:\Users\JimmyEngstrom\AppData\Roaming\Copilot CLI\extensions\copilot-avatar` now match the repo on all repo-managed files, with only ignored `.tts-settings.json` remaining user-specific.
- 2026-05-27T10:21:23.313+02:00 — **Settings are no longer the on-disk blocker, but runtime proof still needs a fresh enable signal:** `settings.json` now has an empty `extensions.disabledExtensions` list and permission approvals still exist, yet the live extension manager continues to report both `user:copilot-avatar` and `project:copilot-avatar` as disabled, so QA should not approve runtime readiness without a clean reload/restart that actually launches the avatar extension.

---

## 2026-05-27T10:21:23.313+02:00 — User Install Sync Verification and Runtime Gate

**Session:** user-install-sync  
**Status:** File sync verified. Runtime readiness REJECTED pending restart.

### Verification Work

- Independently verified user install and AppData sync completeness
- Confirmed repo-managed files now match between repo copy and installed user copy
- Verified only local .tts-settings.json differs (expected, preserved)
- Tested project extension against existing regression probe: passed (143/143)
- Checked live extension manager state after extensions_reload: both avatar extensions still disabled

### QA Decision

Runtime readiness is restart-bound, not reload-bound. File sync is complete and verified.

### Handoff

Next phase is runtime activation seam (Peter Parker).
