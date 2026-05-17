# Mic Boom Visibility Bug — Architecture & Data Flow

## The Issue in Pictures

```
BEFORE FIX (Current State):
─────────────────────────────

main.mjs                           content/main.js
─────────────────────────────────────────────────────────────
                                   Page Load
                                      ↓
                                 initializeRootAvatar()
                                      ↓
                              createAvatarInstance(root)
                                      ↓
                          squadMicBoom = createSquadMicBoom()
                          squadRootMicActive = false ← ← ← BUG!
                          micBoom.visible = false
                                      ↓
                          [mic boom invisible on screen]
                                      ↓
  user runs /avatar
      ↓
  webview.show()
      ↓
  syncSquadContext() ← Too late! Mic already created invisible
      ↓
  window.setSquadContext({ active: true })
      ↓
  squadRootMicActive = true
  BUT updateRootSquadMicBoom() not called ← ← ← Nothing updates visibility!
      ↓
  [mic boom still invisible — geometry exists but hidden]


AFTER FIX (Expected):
────────────────────

main.mjs                           content/main.js
─────────────────────────────────────────────────────────────
                                   Page Load
                                      ↓
                                 initializeRootAvatar()
                                      ↓
                              createAvatarInstance(root)
                                      ↓
                          squadMicBoom = createSquadMicBoom()
                          squadRootMicActive = false
                          micBoom.visible = false
                                      ↓
  user runs /avatar
      ↓
  webview.show()
      ↓
  syncSquadContext() ← CALLED AFTER WEBVIEW OPEN
      ↓
  window.setSquadContext({ active: true })
      ↓
  squadRootMicActive = true
  updateRootSquadMicBoom() ← ← ← CALLED: sets visible = true
      ↓
  [mic boom visible ✓]
      ↓
  On each assistant.turn_start:
  syncSquadContext() called ← KEEPS STATE FRESH
      ↓
  [mic boom stays visible ✓]
```

## Code Locations

### Root Cause
- **main.mjs:222-224** — `syncSquadContext()` function
- **main.mjs:238** — `refreshSessionContext()` calls `syncSquadContext()` but too early (before webview exists)
- **content/main.js:2308-2311** — `updateRootSquadMicBoom()` — visibility gate function (exists but not called)

### Geometry & Material
- **content/main.js:2064-2108** — `createSquadMicBoom()` — mic boom created with TubeGeometry + CapsuleGeometry, dark graphite material
- **content/main.js:2333** — Mic boom created only for root avatar
- **content/main.js:2310** — Visibility gate: `micBoom.visible = squadRootMicActive`

### State & Gate
- **content/main.js:45** — `let squadRootMicActive = false` — global visibility state
- **content/main.js:window.setSquadContext handler** — Updates `squadRootMicActive`, but doesn't call `updateRootSquadMicBoom()`

## Fix Strategy

Shuri's implementation must ensure:

```javascript
// In main.mjs:

// Option A: Call after webview.show()
async function reopenWebviewForWindowStyleChange() {
    // ... existing code ...
    await webview.show();
    await syncTitle();
    await syncSquadContext();  // ← ADD THIS (or ensure already there)
}

// Option B (safer): Also call in assistant.turn_start
session.on("assistant.turn_start", async (event) => {
    if (event.agentId) return;
    // ... existing code ...
    await syncSquadContext();  // ← ADD THIS for fresh state each turn
});

// And in content/main.js:
// When setSquadContext is called, also trigger the update:
window.setSquadContext = (payload = {}) => {
    squadRootMicActive = !!payload.active;
    // ... existing code ...
    updateRootSquadMicBoom();  // ← ADD THIS call
};
```

## Validation Sequence

1. ✓ **Mic boom created** — TubeGeometry + CapsuleGeometry visible in THREE.js inspector
2. ✓ **Visibility gate exists** — `updateRootSquadMicBoom()` function present and wired
3. ✓ **State syncs** — `syncSquadContext()` called after `webview.show()` 
4. ✓ **Updates on refresh** — `syncSquadContext()` called in `assistant.turn_start` 
5. ✓ **No regressions** — Squad sub-agent names/roles stable (metadata lookup not broken)

See `.squad/tests/mic-boom-visibility-manual-repro.md` for reproduction steps and `.squad/tests/mic-boom-validation-probes.md` for post-fix verification.

