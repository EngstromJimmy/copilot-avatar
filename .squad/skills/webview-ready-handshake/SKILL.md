---
name: "webview-ready-handshake"
description: "Replay extension state only after the webview page declares its own ready flag."
domain: "extension-ui, lifecycle"
confidence: "high"
source: "earned"
---

## Context
Use this when a Copilot extension pushes state into a native webview during startup, reload, or reopen. A live bridge/socket is not enough evidence that the page module, exported window functions, or root scene objects are actually ready to receive that state.

## Patterns
- Treat transport readiness and page readiness as separate states.
- Have the page set a single ready flag only after its root UI/scene is initialized.
- Poll that ready flag from the extension before replaying startup state such as title, Squad context, or other root chrome.
- Keep the real UI seam unchanged after the handshake succeeds; the handshake should only guard timing, not invent a second source of truth.
- Add a small page-side debug snapshot for lifecycle-sensitive visuals so live probes can confirm the rendered state without poking private scene objects directly.

## Examples
- `.github/extensions/copilot-avatar/main.mjs` waits for `window.__copilotAvatarReady` before replaying title + Squad context on window show/reopen.
- `.github/extensions/copilot-avatar/content/main.js` sets `window.__copilotAvatarReady = true` after initial boot and updates `window.__copilotAvatarState.rootMicVisible` inside `updateRootSquadMicBoom()`.

## Anti-Patterns
- Assuming a connected bridge means `window.set...` handlers already exist.
- Replaying startup state immediately after `webview.show()` with no page-ready gate.
- Solving a lifecycle race by duplicating state in a second render-specific flag path.
