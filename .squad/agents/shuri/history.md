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

## Learnings

- 2026-05-17T19:45:16.556+02:00 — Mic boom regression: visibility controlled by `squadRootMicActive` flag, set only via `window.setSquadContext()` from extension. Root avatar created at webview init (line 5334) before Squad context sync arrives, leaving boom hidden. Extension calls `syncSquadContext()` during session startup but webview not yet open (checked at evalWebview line 161), so call returns early. Fix: ensure `syncSquadContext()` runs after webview is ready and avatar initialized, or add sync to `assistant.turn_start` handler to refresh context each turn.
- Mic boom 3D geometry and lifecycle pattern: created in `createSquadMicBoom()` (lines 731-778), added to root avatar only (line 2381), visibility set by `squadRootMicActive` boolean via `updateRootSquadMicBoom()` (line 2310). Squad-gating means boom is hidden until `window.setSquadContext({active: true})` is called from extension.


## 2026-05-17 — Scribe Session Wrap-up

**Cross-Agent Note from Scribe:** Your mic regression analysis has been merged into .squad/decisions.md. Decision entry captures the full timing mechanism, risk/scope assessment, and implementation options. Vision's parallel identity regression investigation (extension-layer label precedence) is also documented in decisions for team alignment.

**Decision ID:** "Mic boom visibility blocked by timing gap in Squad context sync" — available for future reference and implementation.

**Session Artifact:** Session log written to .squad/log/2026-05-17T17-45-16Z-squad-investigation-wrap.md summarizing both investigations.
