# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Current Focus

Avatar 3D rendering and Squad-specific visual flair.

## 2026-05-16T19:23:20Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

**Cycle Status:** Complete
**Contributors:** Tony Stark (lead), Howard the Duck (review), Peter Parker (implementation)

**Key Decisions:**
- Stale sub-agent cards retire on work completion (no terminal event required)
- Visible sub-agent identities collapse to single stable identity
- Badge metadata removed from role text, kept in task-summary/activity text

**Tests:** All smoke checks and regression assertions passed.
**Next:** Integration ready.

## 2026-05-16T22:03:54Z — Cross-Agent Update: Avatar Visibility Model Documentation

**From:** Vision (Platform Dev)

**What:** README updated to document the sub-agent visibility model:
- Copilot SDK owns all visibility and lifecycle events
- Squad metadata enriches visible cards only (no creation/suppression)
- Ghost/fallback duplicates eliminated; rendered agents match active Copilot set

**Why:** Clarify contract with users and maintainers about ownership model.

**Team Impact:** All agents now have clear reference for how Copilot and Squad interact in sub-agent visibility.

## 2026-05-18T07:24:45Z — Cross-Agent Update: SAM Library Migration Complete

**From:** Team orchestration (Shuri, Peter Parker, Howard the Duck)

**What:** SAM text-to-speech engine migration to external sam-js library complete:
- Replaced custom in-browser formant synth with vendored sam-js/discordier dependency
- Updated webview vendor route in lib/copilot-webview.js
- Modified content/main.js to use SamJs.wav() for speech generation
- Preserved and exposed voice/speed/pitch/throat/mouth UI controls
- Logged reusable skill for future engine integrations

**Why:** Delivers honest browser-native SAM implementation, avoids custom synth maintenance, follows existing audio pipeline pattern.

**Team Impact:** Peter handled runtime persistence/migration, Howard updated regression probe contract. All C64 voice controls now route through external library.

## Learnings

### 2026-05-18T11:57:44.088+02:00 — Avatar load resilience after SAM vendor migration

- **Architecture decision:** the avatar scene in `.github/extensions/copilot-avatar/content/main.js` should not hard-fail boot on a speech-engine vendor module; C64 speech can degrade independently, but the canvas and ready handshake must still come up.
- **Pattern:** lazy-load `/__vendor__/sam-js.mjs` inside the C64 speech path and reset the cached promise on failure so a stale or temporarily missing vendor route does not blank the whole webview.
- **User preference:** keep the scope tight to the load failure and only touch directly related regressions.
- **Key file paths:** `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/lib/copilot-webview.js`, `.github/extensions/copilot-avatar/probe-regression.mjs`.

## 2026-05-18T11:57:44.088+02:00 — Avatar Load Resilience Fix (Decision Merged)

Team orchestration recorded three related decisions in `decisions.md`:
1. **Vision:** Optional avatar GLB loads must not gate `window.__copilotAvatarReady`; timebox load and fall back to base asset.
2. **Shuri:** Lazy-load sam-js vendor module inside C64 speech path so boot failures don't block avatar canvas.
3. **Howard the Duck:** Approved implementation on QA grounds after repro + regression probe pass (65 passed, 0 failed).

**Cross-agent impact:** This trio of fixes addresses the boot-blocking load path regression that was preventing the avatar from declaring readiness even when the scene and bridge were healthy. Vision fixed the GLB timeout path, Shuri fixed the vendor module load failure path. Both patterns share: timebox optional assets, set ready from fallback, load non-critical models in background.

**Files affected:** `.github/extensions/copilot-avatar/content/main.js`, `.github/extensions/copilot-avatar/lib/copilot-webview.js`
