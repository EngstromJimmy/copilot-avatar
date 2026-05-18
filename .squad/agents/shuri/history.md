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
