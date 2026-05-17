# Mic Boom Visibility — Manual Repro Checklist

**Symptom:** Squad root avatar mic boom does not render, despite geometry existing and being wired.

**Root Cause:** Data-flow timing gap — `initializeRootAvatar()` (content/main.js:3714) runs before `window.setSquadContext()` is called, so the mic boom starts invisible (`squadRootMicActive = false`) and never updates.

---

## Quick Repro Steps

### Setup
1. Navigate to a folder with an active `.squad/` directory (e.g., C:\Code\CopilotAvatar or another Squad workspace)
2. Ensure `.squad/agents/` exists with at least one defined agent

### Step 1: Launch avatar window
```bash
/avatar
```
Expected: Avatar window opens (Copilot head visible, Squad context loading)

### Step 2: Start a Squad agent activity
```bash
/ask
```
Then trigger any Squad agent spawn (e.g., a background task that uses `agent_type: "explore"` or `agent_type: "task"`).

Expected after fix: When avatar window is already open, the Squad root mic boom should be visible as a thin curved arm + capsule extending from the temple area down toward the mouth, dark graphite color (`0x1c1c1c`).

**Before fix:** Mic boom invisible (none visible on avatar head).

### Step 3: Verify mic position
Open browser dev tools (F12) → Elements tab → Search for `.squadMicBoom` or check THREE.js scene:
```javascript
// In dev console:
const root = window._avatar?.group;  // or access scene directly
const micBoom = root?.children.find(c => c.userData?.isMicBoom);
console.log("Mic boom visible:", micBoom?.visible);
console.log("Mic boom geometry:", micBoom?.children?.[0]?.geometry?.type);
```

Expected: `visible: true`, TubeGeometry and CapsuleGeometry present.

---

## Failure Mode #1: Mic boom stays invisible after Squad context sync

**How to catch it:**
1. Open avatar window before Squad loads
2. Watch for mic boom to appear when `syncSquadContext()` completes in main.mjs
3. If mic boom never appears → timing gate not working or `updateRootSquadMicBoom()` not called

**Dev check:**
```javascript
// In dev console after Squad loads:
const squadMicBoom = document.querySelector('[data-test="mic-boom"]') 
  || window._avatarScene?.getObjectByName('squadMicBoom');
console.log("Squadmicboom visible before fix:", squadMicBoom?.visible);  // Should be false before fix, true after
```

---

## Failure Mode #2: Mic boom appears but then disappears on window reopen

**How to catch it:**
1. Open avatar window (mic boom visible)
2. Close avatar window
3. Open avatar window again `/avatar`
4. If mic boom is invisible on reopen → state not preserved or `updateRootSquadMicBoom()` not called on window reopen

**Dev check:**
Look in main.mjs for `reopenWebviewForWindowStyleChange()` and `webview.show()` calls — each must be followed by or include `syncSquadContext()` to refresh mic visibility.

---

## Assertion Checklist

- [ ] Mic boom created in `createAvatarInstance()` for root avatar only (line 2333)
- [ ] Mic boom added to `modelRoot` when created (line 2357)
- [ ] `updateRootSquadMicBoom()` called from `window.setSquadContext()` handler (should set visibility)
- [ ] `asyncSquadContext()` called after `webview.show()` (so mic state syncs)
- [ ] `asyncSquadContext()` called on `assistant.turn_start` (so mic state refreshes each turn)
- [ ] Mic boom geometry: TubeGeometry + CapsuleGeometry with dark graphite material
- [ ] Mic boom renderOrder correct (4 for capsule, 3 for boom tube)

