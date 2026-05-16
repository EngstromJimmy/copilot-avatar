# Tony Stark — Lead
## Current Work

**Project:** CopilotAvatar  
**Owner:** Jimmy Engstrom  
**Expertise:** Backend architecture, state management, event consolidation  

### Recent Completions (2026-05-16)

#### Stale Subagent Ghost Fix
- **Problem:** Completed/failed subagents reappeared in avatar window after CLI cleared them
- **Root Cause:** `syncKnownSubagents()` re-synced all agents including completed/failed, resetting fade timers
- **Solution:** Filter sync to `status === "active"` only; schedule pruning of terminal agents
- **Validation:** `node --check` ✅

#### Directive-Boundary Subagent Reset Fix  
- **Problem:** Agents from old directive persisted into new directive
- **Root Cause:** `assistant.turn_start` had no reset like `session.start` and `session.context_changed`
- **Solution:** Call `resetSubagentRuntimeState({ clearUi: true })` at directive boundary
- **Defense Layers:** (1) directive-boundary reset, (2) active-only sync filter, (3) post-completion prune timer
- **Validation:** `node --check` ✅

#### 2026-05-16 — "8-10 sub-agents on every command" investigation

- **Symptom:** User sees 8–10 sub-agent cards appear in the avatar window each time they issue a command. `list_agents` in the coordinator session shows many idle background agents from prior work (tony-stark-*, shuri-*, scribe-*, etc.).
- **Investigation scope:** Source inspection of `main.mjs` (extension) + `content/main.js` (webview). No code changes made.
- **Finding 1 — Extension state is NOT the cause.** The `assistant.turn_start` reset pipeline is correctly implemented: (1) `clearSubagentStateMaps()` synchronously empties all runtime maps, (2) `callWindowFunction("clearSubagents")` clears the webview, (3) `refreshVisibleSquadContext()` → `syncKnownSubagents()` replays only `status === "active"` agents. Any agents appearing after the reset are freshly-added during the new directive.
- **Finding 2 — Most likely root cause is platform-level agent reactivation.** The coordinator has idle background agents from prior work that were never exited. When a new command arrives, the coordinator sends messages to these idle agents. The SDK fires `subagent.started` for each one. The avatar correctly displays them all — the extension is not at fault; the coordinator's agent pool hygiene is.
- **Finding 3 — Confirmed secondary risk: `session.resume` has no subagent reset.** Unlike `session.start` and `session.context_changed`, the `session.resume` handler calls `refreshSessionContext` WITHOUT `resetSubagents: true`. If agents were mid-work at suspend time (no `subagent.completed` delivered), they'd still be in the maps as `active` and `syncKnownSubagents` would replay them as ghosts. This is a separate latent bug, not the reported symptom.
- **Recommendation — smallest correct fix:** Fix is upstream, not in the extension. Squad agents should exit cleanly when they complete a task rather than remaining in idle state. Clean exits prevent `subagent.started` reactivation events on the next command. Extension-only fix for `session.resume` edge case: add `resetSubagents: true` to that handler.

### 2026-05-16T22:06:13.919+02:00 — Sub-agent Metadata Bypass & First-Render Debounce Decisions

**Scribe Cross-Agent Update:**

Two decisions recorded and merged to `decisions.md`:

1. **Sub-agent metadata must bypass top-level Squad UI gating** — The new top-level Squad UI gate is valid for root-level visuals and status text, but it accidentally starved sub-agent naming of cast metadata. Now resolves Squad roster/casting context even when visible Squad chrome is gated off for non-Squad coordinators. Keeps stableIdentityKey resolution strong while preserving background-task visibility gating and duplicate collapse logic.

2. **Sub-agent first-render debounce (750ms)** — Implemented debounce on hidden sub-agent card rendering instead of trusting `subagent.started` or intent/reasoning traffic alone. Waits 750ms after first non-`task` tool start before `addSubagent`, unless `tool.execution_progress` arrives first. Tradeoff: very fast agents finishing within debounce window stay invisible, but solves prompt-start clutter from rapid IDE wake-up noise.

**Implementation Context:** Complements Peter Parker's concurrent-identity work to keep UI focused on agents with real sustained work.

## Archived Work

Earlier sessions documented in `history-archive.md`:
- Sub-agent visibility race investigation & auto-show-on-Squad-detection decision
- Multi-agent identity & badge system design review (with Vision, Shuri, Peter Parker, Howard the Duck)
- Runtime/event-bridge revision & casting-slot alias resolution
- Model sync race fixes and state centralization

## Learnings

- 2026-05-16T20:46:28.793+02:00 — When upstream agent pools can re-fire `subagent.started` for old idle instances, the avatar extension should treat `subagent.started` as provisional only. Surface the card only after a current-turn work signal (`tool.execution_*`, `assistant.intent`, or `assistant.reasoning`) and suppress model/terminal-only events for never-shown agents.
- 2026-05-16T20:46:28.793+02:00 — Sub-agent badge fallback order needs three tiers: live tool or intent text first, cached task spawn summary next, and role/default labels last. If Squad charter descriptions outrank spawn hints in the runtime map, the badge loses the useful “what am I doing?” phrase even though the extension already captured it.
- 2026-05-16T20:58:04.144+02:00 — The badge contract is stateful, not one flat chain. `main.mjs` supplies live `activityLabel`, cached `intent`, and a `description` seeded from task spawn hints; then `content/main.js#getAvatarBadgeText()` resolves them as tool-active `activity > intent > task summary > status`, thinking `intent > task summary > status`, idle `intent > task summary > role/status`, and terminal `intent > terminal status`.
- 2026-05-16T21:04:02.794+02:00 — Bare `assistant.reasoning` pulses are too weak to promote hidden sub-agents. For stale-agent suppression, only tool activity or a substantive intent should flip visibility; reasoning can decorate cards that already have current-turn evidence, but it should not mint new ones by itself.
- 2026-05-16T21:21:35.376+02:00 — Read-only trace confirmed the live gate is still narrow: `subagent.started` only seeds runtime state, tool execution sets `hasCurrentTurnWork` and unlocks first visibility, and replay only re-adds active visible agents with that evidence. Badge fallback remains `live activity > live intent > clipped task summary > status/default`, with a separate model row and two-line badge clamp preserving readable task text on compact cards.
- 2026-05-16T21:23:20.636+02:00 — Stable naming alone is not enough. If visible sub-agent cards are still owned by runtime `agentId`, two live instances that both resolve to the same cast identity can render duplicate cards (for example dual Tony Stark). Keep runtime state per instance, but collapse visible-card ownership by a high-confidence stable identity key and evict the older card when ownership shifts.
- 2026-05-16T21:23:20.636+02:00 — Duplicate identity and role-text badge regressions were the same seam. When the visible card drifts onto the wrong runtime instance, live activity stays on one agent while the rendered card falls back to metadata from another; if task fallback reads Squad charter/role copy, the badge looks like a role regression. Keep a dedicated task-summary field separate from roster description, and choose the visible identity owner by strongest live work signal rather than raw start order.
- 2026-05-16T22:06:13.919+02:00 — Do not reuse a top-level Squad visibility gate for sub-agent naming. `getVisibleSquadContext()` can legitimately blank Squad chrome when the coordinator is a personal agent, but sub-agent identity resolution still needs `resolvedSquadContext` so cast names and stable identity keys survive.
- 2026-05-16T22:06:13.919+02:00 — A CLI/background-task count can exceed visible avatar cards for two intentional seams: hidden agents stay suppressed until `hasCurrentTurnWork` is true from a non-weak tool signal, and visible cards collapse by `stableIdentityKey` so parallel instances of the same cast identity render as one owner.
- 2026-05-16T22:02:45.479+02:00 — The current SDK seam still does not expose a trustworthy per-instance idle/background flag before render. `subagent.started` gives identity, `toolCallId`, and optional `model`; `subagent.selected` is selection-level only; `session.background_tasks_changed` carries no payload. If transient agents still flash, the practical fix is a first-render debounce on sustained non-`task` tool work, with `tool.execution_progress` allowed to promote immediately.

## 2026-05-16T19:23:20Z — Sub-Agent Visibility + Duplicate Identity Fix Cycle

**Cycle Status:** Complete
**Contributors:** Tony Stark (lead), Howard the Duck (review), Peter Parker (implementation)

**Key Decisions:**
- Stale sub-agent cards retire on work completion (no terminal event required)
- Visible sub-agent identities collapse to single stable identity
- Badge metadata removed from role text, kept in task-summary/activity text

**Tests:** All smoke checks and regression assertions passed.
**Next:** Integration ready.
