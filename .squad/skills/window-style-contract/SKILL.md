---
name: "window-style-contract"
description: "Keep avatar window chrome and topmost behavior driven by one explicit rule."
domain: "platform, extension-ui"
confidence: "high"
source: "earned"
---

## Context
Use this when changing how the Copilot avatar native window is created or when adding window-style settings. The failure mode here is hidden coupling: the visible frame/decorations say one thing, while an unconditional topmost flag silently says another.

## Patterns
- Treat transparency, decorations/frame, and always-on-top as one window-style contract, not three unrelated toggles.
- In CopilotAvatar, derive `alwaysOnTop` from `transparentWindow` in the extension layer before spawning the native window.
- When that contract changes, reopen the native window so creation-time options like `decorations` and topmost state are reapplied together.
- Keep the child window host simple: it should mirror explicit inputs from the extension, not invent its own policy.

## Examples
- `.github/extensions/copilot-avatar/main.mjs` should use a helper like `shouldKeepAvatarAlwaysOnTop(settings)` and apply it during initial `CopilotWebview` construction plus later `saveSettings()` updates.
- `.github/extensions/copilot-avatar/lib/webview-child.mjs` should keep `decorations: !transparent` and only call `setAlwaysOnTop(true)` when the extension explicitly requested it.

## Anti-Patterns
- Setting `alwaysOnTop: true` unconditionally while also letting transparency control whether the window has a frame.
- Updating transparency in settings without reopening the native window, leaving chrome and topmost state out of sync.
- Hiding the policy in the child window process so the extension can no longer explain why the window behaves differently across modes.
