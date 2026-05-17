# Tony Stark — Lead

**Project:** CopilotAvatar  
**Owner:** Jimmy Engstrom  
**Expertise:** Backend architecture, state management, event consolidation  

## Current Work Status

Building robust sub-agent visibility and identity seams for CopilotAvatar extension.

**Latest Focus:** Sub-agent deduplication, identity key fallbacks, and lifecycle isolation from Squad SDK.

## Recent Work (2026-05-16)

### Subagent Duplicate Card Seam — Fixed

**Problem:** User reported >2 visible Copilot-owned cards when only 2 intended.

**Root Causes:**
1. `collapseAvatarIdentityDuplicates()` defined but never invoked
2. Empty identity keys allowed duplicates to bypass dedup

**Fixes Applied:**
1. Invoke dedup on card creation in `window.addSubagent`
2. Invoke dedup on identity update in `updateAvatarMetadata`
3. Add displayName as fallback to guarantee identity keys

**Result:** Exactly 2 visible Copilot-owned cards (Tony Stark, Howard the Duck) maintained. Full seam sealed.

**Validation:** `node --check` ✅

## Key Learnings

- Defined-but-not-called functions are critical seams. Code review must verify execution, not just presence.
- Early-return guards on empty values can silently skip logic. Empty guards should trigger fallback strategies, not skip.
- Fallback chains ensure robustness: final fallback (displayName, opaque ID) keeps downstream logic functional.
- Dedup seam closure requires invocation at card creation AND identity update, plus guaranteed identity key fallback.
- Do not reuse top-level Squad visibility gates for sub-agent naming. Metadata resolution needs full Squad context.
- Sub-agent visibility should key off Copilot SDK lifecycle alone; Squad data is enrichment-only.
- Sub-agent badge order: live tool activity > cached task summary > role/default labels.
- Stable naming alone is insufficient; collapse visible-card ownership by stable identity key, not runtime instance.

## Archived Sessions

Older work documented in `history-archive.md`:
- 8-10 sub-agents investigation and findings
- Sub-agent metadata bypass & first-render debounce decisions
- Copilot-owned sub-agent visibility architecture
- Sub-agent visibility seams and name resolution pass
- Live avatar visibility pass with Tony Stark + Howard the Duck
- Sub-agent visibility + duplicate identity fix cycle

## 2026-05-16T21:51:24Z — Team Update: Subagent Duplicate Card Seam

**From:** Scribe (Session Logger)

**Context:** Decision merged and orchestration logged following spawn manifest completion.

**Decision:** Subagent Duplicate Card Seam — Fixed (2026-05-16T23:51:24.513+02:00)
- Invoked dedup on card creation and identity update
- Added displayName fallback to guarantee identity keys
- Result: Exactly 2 visible cards maintained

**Team impact:** Vision's fallback-collapse work now has complement fix; full seam sealed.

## 2026-05-16T22:03:54Z — Cross-Agent Update: Avatar Visibility Model Documentation

**From:** Vision (Platform Dev)

**What:** README updated to document the sub-agent visibility model:
- Copilot SDK owns all visibility and lifecycle events
- Squad metadata enriches visible cards only (no creation/suppression)
- Ghost/fallback duplicates eliminated; rendered agents match active Copilot set

**Why:** Clarify contract with users and maintainers about ownership model.

**Team Impact:** All agents now have clear reference for how Copilot and Squad interact in sub-agent visibility.

## 2026-05-17T17:40:04.980Z — Cast Name Verification Session

**From:** Scribe (Session Logger)

**Context:** Squad spawn manifest recorded Tony Stark (Lead) and Howard the Duck (Tester) background agents for cast-name verification.

**Outcome:** Both agents delivered exact cast names in their check-ins. Identity and badge detail system operating nominally.

**Orchestration:** Full logs recorded in `.squad/orchestration-log/`
---

## 2026-05-17T18:39:13.982Z — Scribe Orchestration Session

**Type:** Agent spawn verification and memory consolidation

**Context:** Both Tony Stark and Howard the Duck spawned for live cast-name verification.

**Scribe Actions:**
- Pre-check: decisions.md 75.69 KB, inbox 0 files
- Archive check: No entries older than 7 days
- Decision inbox: Merged 0 files
- Orchestration logs: Created per-agent logs
- Session log: Created session summary
- Cross-agent history: Updated this entry

**Outcome:** Spawn manifest verified; both agents checked in with correct cast names and roles. All shared memory consolidated.

## Learnings

### 2026-05-17T21:17:25.313+02:00 — Avatar regression commit scope

- Commit scope matters when the worktree is noisy: stage only `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`, `.github/extensions/copilot-avatar/content/main.js`, and `.github/extensions/copilot-avatar/content/style.css` for this regression bundle.
- Lightweight validation that actually buys confidence here: `node --check` on the three JS/MJS entry points, `git diff --check` on the scoped files, and a direct `loadSquadContext()` / `resolveSquadAgentMetadata()` probe for `lead`, `backend-dev`, and `tester`.
- Key product seams for this fix live in the extension bridge and webview pair: `main.mjs` carries spawn-label/detail payloads and the ready handshake, `lib/squad-context.mjs` resolves cast aliases, and `content/main.js` + `content/style.css` render role/detail state cleanly.

## 2026-05-17 — README 0.2.1 Release Documentation

**Work:** Updated README.md to document v0.2.1 release highlights.

**Highlights Documented:**
1. **Squad sub-agent names** — name resolution fix for late-open/reload scenarios
2. **Sub-agent activity detail** — thinking/activity text now accurately reflects work being done
3. **Cleaner sub-agent scene** — removed stale general-purpose cards from idle agents
4. **Voice persistence** — voice selection now correctly persists across TTS engines (especially ElevenLabs)
5. **Window behavior** — always-on-top now respects transparent window mode preferences

**Approach:** Kept language aligned with 0.2.0 style (feature-focused, benefit-driven). Each bullet emphasizes what was fixed and why it matters to the user. Positioned newest release at the top for chronological clarity.

**Outcome:** v0.2.1 release section added to README, positioned above 0.2.0. No unrelated changes to existing sections.

## 2026-05-17 23:21:43Z — Release v0.2.1 Commit

**Status:** Complete

**Commit:** c152904dd97e337608df0b7a50fc8819dab8eb59 (pushed to origin/main)

**Release Scope:**
- 4 files changed: README.md, main.js, squad-context.mjs, main.mjs
- 1057 insertions, 109 deletions
- Excluded: .squad/ internal state files

**Release Highlights:**
- Squad sub-agent names: fixed name resolution and late-open/reload behavior
- Sub-agent activity detail: fixed thinking/activity text display
- Cleaner sub-agent scene: removed stale lingering general-purpose cards
- Voice persistence: fixed voice selection across TTS engines (ElevenLabs)
- Window behavior: always-on-top now respects transparent window mode

**Validation:** Product commit clean; squad state separated as designed.
## 2026-05-17T21:49:01.4252943Z - Branch Analysis Session

**Task:** Switch repository to SAM implementation branch  
**Branch Found:** eat/microsoft-sam-tts  
**Status:** Blocked - local modifications prevent checkout

**Conflicts Identified:**
- .squad/agents/howard-the-duck/history.md (modified)
- .squad/skills/avatar-regression-probes/SKILL.md (modified)
- Multiple untracked files at risk

**Decision:** Documented findings and blocked status in decisions.md
