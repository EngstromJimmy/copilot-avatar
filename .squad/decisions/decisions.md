# CopilotAvatar Decision Log

## Decision 1: Avatar Extension SDK Migration & Extension Registry Fix (2026-05-27)
**Agent:** Howard the Duck (Tester)  
**Status:** ✅ Superseded by Decision 4  

### Summary
Avatar keyword not recognized when used from another project. Root causes:
1. Missing ESM exports in vscode-jsonrpc (transitive dependency)
2. Deprecated Copilot SDK API (`joinSession()` → `extension.createSession()`)
3. Missing required permission handler (`onPermissionRequest: approveAll`)

### Fixes Applied
- Updated main.mjs: `extension.createSession()` with `approveAll` handler
- Updated lib/copilot-webview.js: bootstrap with `approveAll` handler
- Added exports field to vscode-jsonrpc/package.json
- Extended probe-regression.mjs with 7 new SDK migration tests

### Result
133/133 regression tests passing; extension syntax valid; user profile synced.

---

## Decision 2: Reject approval until entrypoint/bootstrap coverage proves avatar really loads (2026-05-27)
**Agent:** Howard the Duck (Tester)  
**Status:** ❌ Rejection (Requires Revision)  
**Date:** 2026-05-27T09:34:17.883+02:00

### Coverage Gaps Identified
1. Real entry file (`extension.mjs`) not exercised by regression probe
2. Source assertions alone insufficient; need activation proof
3. Bootstrap session missing explicit `onPermissionRequest` handler

### Decision
Request **different agent** to revise before sign-off with hard evidence on entrypoint seam, not source-only validation.

---

## Decision 3: Keep avatar entrypoint activation blocking & mirror approveAll on bootstrap (2026-05-27)
**Agent:** Peter Parker (Backend Dev)  
**Status:** ✅ APPROVE  
**Date:** 2026-05-27T09:34:17.883+02:00

### Changes
1. `extension.mjs` now awaits `main.mjs` during activation (blocking, not fire-and-forget)
2. `lib/copilot-webview.js` bootstrap sessions now pass `onPermissionRequest: approveAll`
3. `probe-regression.mjs` exercises real `extension.mjs` seam with stubbed import probe

### Validation
- `node --check` passes on all modified files
- Lightweight probe covers real entrypoint seam with failure logging
- Bootstrap and main session creation share same permission contract

### Result
140/140 regression tests passing.

---

## Decision 4: Approve Peter's entrypoint/bootstrap regression coverage revision (2026-05-27)
**Agent:** Howard the Duck (Tester, Reviewer Gate)  
**Status:** ✅ APPROVE  
**Date:** 2026-05-27T09:34:17.883+02:00

### Verification
- `extension.mjs` uses `await import("./main.mjs")` inside guarded startup wrapper
- `lib/copilot-webview.js` bootstrap now creates session with `onPermissionRequest: approveAll`
- `probe-regression.mjs` covers previously missing seam:
  - Stubbed success path proves entrypoint waits for main.mjs evaluation
  - Stubbed failure path proves startup errors are logged
  - Source assertions prove bootstrap keeps `approveAll` permission contract

### Test Results
140 passed, 0 failed.

---

## Decision 5: Extension Settings and Version Sync — Avatar Keyword Resolution (2026-05-27)
**Agent:** Vision (Platform Dev)  
**Status:** ✅ Completed  
**Date:** 2026-05-27T09:15:52.041+02:00

### Issues Found
1. Extension explicitly disabled in settings.json
2. Stale user-profile version (v0.2.1 vs v0.2.2 in repo)

### Fixes Applied
1. Removed `"user:copilot-avatar"` from `disabledExtensions` in settings.json
2. Added error handling to `extension.mjs` with .catch()
3. Synced user-profile extension to v0.2.2
4. Updated package.json version 0.2.1 → 0.2.2

### Result
✓ "avatar" keyword now recognized
✓ Extension properly registers tools
✓ Error handling in place for graceful degradation

---

## Decision 6: Guard late-open replay on page readiness (2026-05-27)
**Agent:** Vision (Platform Dev)  
**Status:** ✅ Completed  
**Date:** 2026-05-27T09:34:17.883+02:00

### Issue
Avatar open/reload can silently drop replay state if webview misses ready handshake window.

### Solution
Treat page-ready handshake as contract for destructive replay work. Only proceed with `clearSubagents()` / `resetSubagentRuntimeState()` if `window.__copilotAvatarReady === true`.

### Implementation
- `main.mjs` aborts destructive replay branch on ready handshake timeout
- Schedules one bounded retry instead of silent drop
- `probe-regression.mjs` asserts ready guard happens before destructive operations

### Result
Slow late-open/reload paths now preserve live runtime state. Failures point at readiness seam.
