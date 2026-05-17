## 2026-05-17

# Release v0.2.1 Commit Decision

**Decided by:** Tony Stark (Lead)  
**Date:** 2026-05-17T23:21:43  
**Requested by:** Jimmy Engstrom

## Summary
Created and pushed the v0.2.1 release commit containing user-facing avatar product fixes and the updated README.

## Scope Decision

### Included in Release Commit
Four files with product changes:
1. **README.md** — Updated with v0.2.1 release notes describing the fixes
2. **.github/extensions/copilot-avatar/content/main.js** — Avatar scene logic fixes (sub-agent name resolution, activity display, window behavior, voice persistence)
3. **.github/extensions/copilot-avatar/lib/squad-context.mjs** — Avatar squad integration fixes
4. **.github/extensions/copilot-avatar/main.mjs** — Avatar extension runtime fixes

### Excluded from Release Commit
All `.squad/` internal state and orchestration files:
- Agent history logs
- Health reports
- Orchestration logs
- Skill definitions and state
- Squad configuration and metadata

These were excluded because they are internal tooling/CI state, not user-facing product changes.

## Release Notes
The v0.2.1 release addresses:
- **Squad sub-agent names**: fixed name resolution and late-open/reload behavior so sub-agents always show correctly
- **Sub-agent activity detail**: fixed thinking/activity text display so cards show the actual work being done
- **Cleaner sub-agent scene**: removed stale lingering general-purpose cards from old idle agents
- **Voice persistence**: fixed voice selection to persist correctly across TTS engines, especially with ElevenLabs
- **Window behavior**: made always-on-top setting follow transparent window mode instead of forcing it on framed windows

## Commit Details
- **Commit hash:** `c152904dd97e337608df0b7a50fc8819dab8eb59`
- **Push result:** Successfully pushed main branch to origin/main
- **Files changed:** 4 files with 1057 insertions, 109 deletions

## Rationale
This release represents a complete feature set of avatar fixes that have been validated through Squad testing. Separating the product commit from internal state files keeps the repository history clean and makes release tracking clear.
