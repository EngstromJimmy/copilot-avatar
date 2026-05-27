# Tony Stark — Lead

**Project:** CopilotAvatar  
**Owner:** Jimmy Engstrom  
**Expertise:** Backend architecture, state management, event consolidation  

## Current Work Status

Idle sleep regression fix applied to v0.2.2 and pushed. System now correctly transitions to sleep emotion after 5 minutes of true inactivity.

**Latest Focus:** Maintaining correctness under state transitions; timer semantics matter.

---

## 2026-05-22 — Idle Sleep Regression Fix Commit

**Decision:** Apply sleep-fix directly to v0.2.2 (released main branch) rather than back-merging from feature branch.

**Rationale:** v0.2.2 was already tagged and SAM TTS work had moved the remote ahead by 25 commits. Cleaner to reset to remote main and reapply the sleep fix as a single, focused patch on top of the release.

**Changes:**
1. Restored IDLE_SLEEP_MS timeout check in `getActiveRootEmotion()` to return 'sleep' when root is idle for ≥5 minutes
2. Added timer re-arm in `setWorking(false)` to restart the inactivity countdown when root transitions to idle state

**Commit:** `8ce105e` — "Fix idle sleep regression: restore timeout check and timer reset"  
**Branch:** main  
**Status:** Pushed to origin/main ✅

**Key Learning:** Timer resets on state transitions, not on stale mid-work pings. The distinction between "when last activity happened" and "when we stopped working" is critical for correct idle detection.

---

## 2026-05-18 — Team Architecture Decision: Subagent Simplification Baseline

**From:** Scribe (orchestration log 2026-05-18T14:11:43.269Z)  
**User Directive:** Jimmy Engstrom — "Prefer the simplest approach for Avatar sub-agent listing and naming"

### Decision Summary

For the next avatar fix:
- **Sole visibility authority:** Copilot runtime (`subagent.started`, `subagent.completed`, `subagent.failed`, `session.idle.data.backgroundTasks.agents`)
- **Squad's role:** Optional metadata enrichment (display name, role, description) when runtime/spawn provides stable alias
- **`subagent.selected`:** Not authoritative; at most, weak fallback hint
- **Explicit non-goal:** Do not chase undocumented payload fields; degrade cleanly if name unavailable

### Minimum Acceptable Architecture

1. One visible-card state map
2. One spawn/runtime correlation seam
3. One late-open replay path
4. One optional Squad enrichment lookup

**What to Delete:**
- State that invents a second ownership model above Copilot runtime
- Heuristic caches and score-based pairing
- Count/order fallback logic

### Visibility Checkpoint (2026-05-18)

Posted identity check-in notification at 15:34 UTC+2 to enable cross-team verification of Avatar UI layer, notification system, and orchestration logs during simultaneous 3-agent visibility window. ✅ Complete.

---

## Recent Work (2026-05-16)

### Subagent Duplicate Card Seam — Fixed

**Problem:** User reported >2 visible Copilot-owned cards when only 2 intended.

**Root Causes:** `collapseAvatarIdentityDuplicates()` defined but not invoked; empty identity keys bypassed dedup.

**Fixes:** Invoked dedup on card creation and identity update; added displayName fallback.

**Result:** Exactly 2 visible Copilot-owned cards maintained. Full seam sealed. ✅

---

## Key Decisions — 2026-05-18

**Sub-agent Simplification Baseline** (coordinated with Jimmy + Peter Parker + Vision)
- Copilot runtime is sole visibility authority
- Squad provides optional metadata enrichment only (display name/role/description)
- `subagent.selected` is weak hint at best; not authoritative identity
- Explicit non-goal: Do not chase undocumented payload fields

**Visibility Checkpoint** (2026-05-18 15:34 UTC+2)
- Posted identity check-in notification for cross-team UI/notification/orchestration verification
- Enabled simultaneous 3-agent visibility window for team sync
- ✅ Complete

---

## Learnings Summary

- SDK `session.rpc.agent.list()` exposes catalog, not live instances; use `subagent.started/completed/failed`
- Stable naming requires full seam closure: authority + identity key + display fallback
- Squad visibility gates must not apply to sub-agent enrichment; metadata lookup needs full Squad context
- Fallback chains essential: final key (displayName or opaque ID) keeps downstream functional
- One visible-card state map per architecture decision required for robustness

---

## 2026-05-27T10:56:05.917+02:00 — Avatar Runtime Fix Commit Scope

**Decision:** Ship the repo-side runtime fix as one focused commit limited to the avatar extension sources plus Tony-owned team memory. Leave health reports and unrelated `.squad/` churn out of the commit.

**What shipped:**
1. `extension.mjs` now awaits `main.mjs` and logs startup failures instead of silently dropping activation.
2. `main.mjs` and `lib/copilot-webview.js` now use the current SDK contract (`joinSession({ onPermissionRequest: approveAll })`, `session.getEvents()`).
3. `main.mjs` preserves runtime state when the webview misses the ready handshake and retries sync instead of clearing live cards too early.
4. `probe-regression.mjs` now locks those seams with source assertions and an entrypoint import probe.

**Validation:** `node --check extension.mjs`, `node --check main.mjs`, `node --check lib/copilot-webview.js`, `node --check probe-regression.mjs`, and `node probe-regression.mjs` all passed (`143 passed, 0 failed`).

**Key Learning:** This fix is not "just a loader tweak." The seam is three-part: modern SDK session wiring, non-destructive late-open replay, and visible startup logging. Miss one and the runtime still looks flaky.

_Earlier detailed work and decisions archived in history-archive.md_
