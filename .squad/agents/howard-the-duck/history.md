# Project Context

- **Owner:** Jimmy Engstrom
- **Project:** CopilotAvatar
- **Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad
- **Created:** 2026-05-16T15:34:40.135+02:00

## Learnings

- Day-1 context: CopilotAvatar is a Copilot CLI extension for a 3D avatar experience with Squad integration.
- 2026-05-16T15:42:38.842+02:00 — Name-mapping review: `.github/extensions/copilot-avatar/lib/squad-context.mjs` builds Squad lookup keys from roster/charted agent slugs like `howard-the-duck`, while failing runtime IDs are opaque handles like `agent-call_H`; adding `agentId` to the lookup does not bridge that mismatch, so `.github/extensions/copilot-avatar/main.mjs` still falls back to internal IDs. `.github/extensions/copilot-avatar/package.json` has no build/test scripts, so validation for this pass was limited to syntax smoke checks plus a targeted runtime lookup repro.

## 2026-05-16T13:42:38.842Z — Approved Shuri's Sub-Agent Name-Mapping Fix

**Status:** ✅ Approved

**What:** Shuri's revision centralizes sub-agent display metadata resolution in `main.mjs` using trim-aware fallback:
1. `agentDisplayName` from event (trimmed, blanks treated missing)
2. `displayName` from Squad roster (via stable `agentName` / `agentDisplayName` fields)
3. `agentName` from event (trimmed)
4. Raw `agentId` (emergency fallback only)

**Validation:**
- Ran `node --check` on `main.mjs` and `lib/squad-context.mjs`
- Targeted smoke tests verified fallback order, shared resolver usage, no agentId roster joins
- Confirmed casting alias wiring: `tester` slot resolves to `howard-the-duck` in roster

**Key insight:** Squad roster joins must stay on stable identity fields, not runtime instance IDs. This fix ensures that even with malformed or non-Squad events, the display name resolves safely.
