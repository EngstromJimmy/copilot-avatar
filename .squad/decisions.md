## 2026-05-27

# Decision: User install is the authoritative avatar runtime

**Agent:** Vision (Platform Dev)  
**Date:** 2026-05-27T10:21:23.313+02:00  
**Requested by:** Jimmy Engstrom

## Decision
Treat C:\Users\JimmyEngstrom\.copilot\extensions\copilot-avatar as the authoritative live install for Copilot Avatar. Keep project:copilot-avatar disabled in C:\Users\JimmyEngstrom\.copilot\settings.json to avoid dual-load ambiguity.

## Why
- The live extension registry currently discovers the user and project copies, not the legacy AppData copy.
- The user copy had runtime drift relative to the repo in shipped support files, so the install must be explicitly mirrored and dependencies refreshed.
- Preserving the user's .tts-settings.json keeps personal runtime configuration intact while code/runtime files are repaired.

## Operational Notes
- extensions_reload may not clear the already-cached disabled state for the current runtime.
- If reload does not activate user:copilot-avatar, require a full Copilot CLI/Desktop restart so the process re-reads settings and the repaired user install.


---

---
date: 2026-05-27T10:21:23.313+02:00
from: Howard the Duck
subject: User install runtime gate
---

# Decision

REJECT runtime approval for the user install right now.

# What I verified

- The repo copy, the user copy, and the AppData runtime cache now match on repo-managed extension files.
- The stale bootstrap drift in `lib/copilot-webview.js` is gone from both installed copies.
- `C:\Users\JimmyEngstrom\.copilot\settings.json` no longer disables `user:copilot-avatar` or `project:copilot-avatar`.
- Existing repo regression probe still passes.

# Why I am rejecting

- The live extension manager still reports both avatar extensions as disabled after the on-disk repair.
- That means I do not have hard runtime evidence that the current Copilot session will actually launch the repaired install.

# Required next owner

Peter Parker should take the next revision, because this is now a runtime activation/refresh seam rather than a plain file-sync problem.


## 2026-05-27

---
date: 2026-05-27T10:06:21.718+02:00
author: Howard the Duck
---

# Decision: Classify current avatar failure modes before chasing runtime ghosts

## Context

Jimmy reported that both the project avatar extension and the installed user/runtime copy were failing. I reproduced the current seams against the repo copy, the installed user copy, the Copilot CLI extension registry, and the bundled SDK bootstrap path.

## Decision

- Treat the current **project** failure as **settings disablement / extension not loading**, not as an active repo code crash.
- Treat the current **user/runtime** failure as **stale installed code plus settings disablement**.
- Do **not** classify the current report as a webview-ready handshake failure; the failing user copy dies before the webview bootstrap can run.
- Peter Parker's `joinSession()` / `getEvents()` repo fix is good evidence for the project copy, but it does **not** fully address the installed user/runtime failure until the user copy is synced and both extensions are re-enabled.

## Why

- `C:\Users\JimmyEngstrom\.copilot\settings.json` currently lists both `project:copilot-avatar` and `user:copilot-avatar` under `extensions.disabledExtensions`, and after extension reload only `copilot-xray` was running.
- The repo copy passed the existing lightweight validation (`node --check` trio plus `node probe-regression.mjs`) at 143/143 and its `lib/copilot-webview.js` imported successfully under the CLI-bundled SDK bootstrap.
- The installed user copy is stale: `main.mjs` matches the repo, but `lib/copilot-webview.js` and `probe-regression.mjs` do not. The stale user `lib/copilot-webview.js` still imports `{ extension }` from `@github/copilot-sdk/extension` and calls `extension.createSession()`, which fails under the bundled CLI SDK with `The requested module '@github/copilot-sdk/extension' does not provide an export named 'extension'`.
- The installed user `probe-regression.mjs` also remains stale enough to call `git rev-parse --show-toplevel` from the extension directory and crash outside a git repo, so it cannot be trusted as a portable runtime smoke check.

---

---
date: 2026-05-27T10:06:21.718+02:00
author: Peter Parker
---

# Decision: Use joinSession/getEvents for avatar extension session wiring

## Context

Both the project extension and the installed user copy were failing against the current Copilot CLI SDK. Runtime logs showed startup crashes from importing `{ extension }` out of `@github/copilot-sdk/extension`, and the next shared failure path was `session.getMessages()` missing on the resumed session object.

## Decision

- Use `joinSession({ onPermissionRequest: approveAll, ... })` for the avatar extension session seam in both `main.mjs` and `lib/copilot-webview.js`
- Use `session.getEvents()` for history replay/hydration
- Keep the regression probe aligned with that contract so SDK drift gets caught before manual runtime testing

## Why

The currently shipped SDK under `C:\Users\JimmyEngstrom\.copilot\pkg\win32-x64\1.0.54\copilot-sdk` exports `joinSession()` from `extension.js` and documents `getEvents()` on `CopilotSession`. The prior `extension.createSession()` / `getMessages()` combination is stale and now breaks both activation and replay.

---

## Decision: Keep one avatar authority and treat disabled-state refresh as restart-bound

- **Date:** 2026-05-27T10:06:21.718+02:00
- **Agent:** Vision
- **Status:** Proposed

### What we found

1. The repo extension passed the existing lightweight validation, so the project source is not the current failure seam.
2. Installed user and AppData copies had drift in `extension.mjs` and `main.mjs`; the AppData copy also had stale `vscode-jsonrpc` metadata that broke `@github/copilot-sdk/extension` import.
3. After syncing installed files and restoring `user:copilot-avatar` workspace approval, `extensions_reload` still kept `user:copilot-avatar` in a disabled state.

### Decision

- Keep **project:copilot-avatar** disabled in settings so the workspace does not try to run two copies of the same avatar extension.
- Treat **user:copilot-avatar** as the intended authority once the Copilot runtime is restarted.
- Do not chase path-resolution or shared-content fixes here; the remaining live seam is runtime state refresh, not repo code.

### Required operator action

Restart the Copilot CLI/Desktop runtime so it re-reads the repaired settings, approvals, and synced user extension files.





