# Mic Boom Visibility — Post-Fix Validation Probes

After Shuri's fix lands, run these minimal probes to confirm mic visibility is restored without regressing Squad identity.

---

## Probe 1: Static Code Assertions (5 min)

Run these checks after Shuri's changes are merged:

### 1.1 Mic boom creation
```bash
node --check .github/extensions/copilot-avatar/content/main.js
```
Expected: No syntax errors.

Grep check:
```bash
grep -n "createSquadMicBoom\|squadMicBoom.visible = squadRootMicActive" .github/extensions/copilot-avatar/content/main.js
```
Expected: Both found; mic boom created and visibility gate wired.

### 1.2 Context sync calls
```bash
grep -n "syncSquadContext()" .github/extensions/copilot-avatar/main.mjs
```
Expected: Multiple hits including:
- Line ~238 (after `refreshSessionContext`)
- Inside or after `webview.show()` 
- Inside `assistant.turn_start` handler (if added per implementation note)

### 1.3 Window state reset path
```bash
grep -n "reopenWebviewForWindowStyleChange\|updateRootSquadMicBoom" .github/extensions/copilot-avatar/main.mjs
```
Expected: `updateRootSquadMicBoom()` called or `syncSquadContext()` in reopen path, or both.

---

## Probe 2: Live Window Check (10 min)

### Setup
```bash
cd /path/to/squad/workspace
```

### Step 1: Spawn avatar with no initial Squad activity
```bash
/avatar
```
Wait 1 second, then check avatar window. Mic boom may not be visible yet (Squad context not synced).

### Step 2: Trigger Squad context sync
Use any method that triggers `assistant.turn_start`:
```bash
/ask "test"
```
Immediately after typing, look at avatar window.

### Step 3: Inspect mic boom visibility
Open avatar window dev tools (F12 → Console):
```javascript
// Query the DOM or THREE.js scene
const scene = window.renderer?.scene || window.scene;
const root = scene?.getObjectByName('root');
const micBoom = root?.children?.find(c => c.userData?.isMicBoom === true);

console.log({
  micBoomExists: !!micBoom,
  micBoomVisible: micBoom?.visible,
  squadContextActive: window.squadRootMicActive,
  geometries: micBoom?.children?.map(c => c.geometry?.type)
});
```

Expected after fix:
```
{
  micBoomExists: true,
  micBoomVisible: true,     // ← Key assertion
  squadContextActive: true,
  geometries: ['TubeGeometry', 'CapsuleGeometry']
}
```

---

## Probe 3: Regression Catch — Squad Identity Stability (10 min)

Run this to ensure the fix doesn't break Squad sub-agent names or visibility:

### Step 1: Spawn a sub-agent during active Squad session
```bash
/ask "Use the Squad to run a background task"
```
Watch avatar window; you should see both root (Copilot) and sub-agent cards.

### Step 2: Check sub-agent labels
Dev console:
```javascript
// Count visible sub-agent cards
const cards = document.querySelectorAll('.subagent-label');
const visible = Array.from(cards).filter(c => c.textContent?.trim());

console.log('Visible sub-agent cards:', visible.map(c => ({
  name: c.querySelector('[data-field="name"]')?.textContent,
  role: c.querySelector('[data-field="role"]')?.textContent,
  visible: c.style.opacity !== '0'
})));
```

Expected: Sub-agent cards show Squad cast names (e.g., "Tony Stark", "Howard the Duck") not generic labels like "agent-123".

**Regression alert:** If sub-agent names became blank or reverted to agentId, the fix may have broken metadata lookup. Escalate to Vision.

### Step 3: Close and reopen avatar window
```bash
# Close avatar (click X or /avatar close if supported)
# Then reopen:
/avatar
```
Expected: Root mic boom still visible, sub-agent cards still show correct names.

---

## Probe 4: Timing Edge Case (5 min)

Test the original blocking scenario:

### Step 1: Start with avatar window closed
```bash
# Do NOT open /avatar yet
```

### Step 2: Trigger rapid Squad spinup in background
```bash
/ask "Start multiple agents in parallel"
```

### Step 3: Immediately open avatar window (while agents are spinning up)
```bash
/avatar
```

Expected: Mic boom is visible (or becomes visible within 1 sec as Squad context syncs).

**Regression alert:** If mic boom is invisible and never updates, Squad context sync may not be wired to window reopen or to turn_start.

---

## Summary Checklist

- [ ] Mic boom visible when Squad is active
- [ ] Mic boom geometry correct (tube + capsule, dark graphite)
- [ ] Mic boom updates on window reopen
- [ ] Mic boom updates on turn start
- [ ] Sub-agent names stable (Squad identity not broken)
- [ ] No blank or generic labels on Squad agents
- [ ] Timing edge case (avatar open mid-spinup) handled

