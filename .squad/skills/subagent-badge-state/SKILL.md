---
name: "subagent-badge-state"
description: "Render live sub-agent badges from resolved identity, current model, and active work state."
domain: "frontend, extension-ui"
confidence: "high"
source: "earned"
---

## Context
Use this when avatar or agent overlays need to explain what each sub-agent is doing right now. These cards have tiny surfaces, so every line has to carry live state instead of decorative filler.

## Patterns
- Resolve the human display name once in the extension layer, then pass that normalized payload into the webview.
- Prefer Squad or cast names over blank or generic runtime labels such as `General Purpose Agent`, but keep a safe fallback chain for non-Squad sessions.
- Keep the model on its own lightweight line inside the card so badge text can focus on activity.
- Put role metadata inline with the display name when it needs to stay visible; do not spend badge text or idle badge iconography on role labels once live work/task copy is available.
- Split compact cards into two semantic layers: keep the badge as the short state label, then render a separate detail panel beneath it for `detailText` / `taskSummary` / live intent so the role never falls back into the lower box.
- Forward the same identity+detail payload (`displayName`, `role`, `taskSummary`, `detailText`) through `subagent.started`, live activity/intention/model/thinking updates, and terminal events. Otherwise an out-of-order progress or completion update can recreate the card with only role-flavored metadata.
- Keep badge task-summary fallback in its own field. Do not reuse roster / charter description for badge copy, or stale identity-only cards will read like a role regression.
- Drive badge text from active intent or tool-derived activity text while work is happening, then fall back to cached task summaries or neutral idle copy instead of repeating the role.
- Remember that Squad charter summaries may be role-first. If badge fallback reads from description after live activity clears, the lower badge line can regress into role-looking text even when the dedicated role treatment already exists elsewhere in the card.
- When live activity drops back to generic thinking/idle text, prefer the cached task spawn summary/description before any role label so the badge still answers what the agent was assigned to do.
- Treat badge precedence as stateful: tool-active cards resolve `activityLabel` before `intent` and task summary, thinking cards resolve `intent` before task summary, idle cards fall through to role/default copy, and success/failed cards skip task summaries entirely in favor of terminal intent/status text.
- If Copilot SDK owns sub-agent visibility, treat `subagent.started` as the render permission for that runtime `agentId`. Show the card immediately; do not add a second evidence gate or debounce on top of Copilot presence.
- Keep `assistant.reasoning`, `assistant.intent`, model updates, and tool-wrapper metadata non-promoting until a matching `subagent.started` exists. Once the Copilot-owned card exists, those signals can enrich it freely.
- For late-open or reload paths, queue non-root activity / thinking / intent updates until `addSubagent` or another payload with a strong resolved identity arrives. Do not let update-only traffic mint a placeholder card with `General Purpose Agent`-style fallback copy.
- Cache pre-start tool/intention/model hints so out-of-order events can still enrich the card when `subagent.started` finally lands, but do not require those hints as extra proof before first render.
- Let update-only webview calls no-op when `addSubagent` has not created the card yet. That keeps visibility ownership in the extension lifecycle seam instead of leaking into badge/activity helpers.
- When a card does exist, keep a small identity-source ranking (`displayName` > resolved `agentName` > fallback/current) so a late Squad-resolved name can replace an earlier fallback label without letting weaker runtime slugs overwrite a good visible name.
- Keep badge fallback text on a dedicated task-summary field. Squad roster descriptions and charter summaries are often role-first, so reusing them for the lower badge line can regress the card into showing `Lead`, `Frontend Dev`, or similar role text after live activity clears.
- If the lower detail line must stay pinned to assigned work, forward an explicit `workDescription`/`taskSummary` field from `main.mjs` and render that for non-root cards instead of reusing transient Copilot intent copy.
- Correlate sub-agent runtime updates by `parentToolCallId` first, but also keep a runtime `toolCallId` → `agentId` map so `assistant.intent`, `assistant.usage`, and `tool.execution_complete` still hit the right card when the SDK omits `event.agentId`.
- If the webview opens after sub-agents already started, rebuild current sub-agent runtime from `session.getMessages()`: recover spawn metadata from historical parent tool calls, bind it back to `agentId`, and replay the active cards into the webview once it is ready.
- Treat `subagent.selected` as a short-lived identity hint for weak runtime labels. Cache it, bind it once to the concrete `agentId` when `subagent.started` or a correlated follow-up event lands, then clear the pending hint so it cannot bleed into another agent.
- Treat replayed badge state as session-scoped data: when context switches or Squad turns off, clear or re-key stored sub-agent state before backfilling the UI.
- When clearing stale state, reset every companion runtime cache (`subagentStateById`, tool-call activity maps, pending model maps) and send a matching webview clear call so backend and UI snapshots stay in lockstep.
- Add a fallback retire path after the last live tool clears. If a visible sub-agent never emits a terminal event, remove it before it settles into stale idle badge copy.
- Allow badge text to wrap to two lines so richer activity phrases stay readable on compact overlays.
- Treat idle/meta tool entries as non-work in the renderer. If a tool resolves to `idle`, let `thinking` and explicit work-description fallback win so wrapper noise like `report_intent` does not hide the real assignment.

## Examples
- `.github/extensions/copilot-avatar/main.mjs` builds a shared `resolveSubagentEventData()` payload for started/completed/failed events.
- `.github/extensions/copilot-avatar/content/main.js` uses `getAvatarBadgeText()` and `describeToolActivity()` to keep badge text aligned with live tool state.
- `.github/extensions/copilot-avatar/content/main.js` can render `.agent-header` + `.agent-role` + `.agent-detail`, while `.github/extensions/copilot-avatar/main.mjs` forwards `detailText` and `taskSummary` through `buildSubagentPayload()` so the lower panel stays about work, not identity.
- `.github/extensions/copilot-avatar/main.mjs` should pass an explicit `taskSummary` payload sourced from task spawn hints, while `content/main.js` uses that field for badge fallback instead of roster description.
- `.github/extensions/copilot-avatar/main.mjs` resets cached sub-agent maps before `refreshSessionContext()` re-syncs a new session or cwd, and `.github/extensions/copilot-avatar/content/main.js` exposes `window.clearSubagents()` to drop non-root avatars immediately.
- `.github/extensions/copilot-avatar/main.mjs` forwards `taskSummary` separately from Squad `description`, and `.github/extensions/copilot-avatar/content/main.js` reads that dedicated `taskSummary` for badge fallback instead of role-flavored charter copy.
- `.github/extensions/copilot-avatar/main.mjs` can call `ensureSubagentVisible()` directly from `subagent.started`, then let `tool.execution_start` / `tool.execution_progress` update badge activity without any first-render debounce.
- `.github/extensions/copilot-avatar/main.mjs` can keep `task` wrapper entries in `activeToolStatesByToolCallId` or pending spawn hints for correlation and richer labels, while still requiring `seenStartedEvent` before any non-root card is shown or updated.
- `.github/extensions/copilot-avatar/main.mjs` can resolve `assistant.intent`, `assistant.usage`, and `tool.execution_complete` through `resolveAgentIdFromEvent()` plus a runtime `toolAgentIdsByToolCallId` map, so missing `event.agentId` does not send sub-agent detail back through the root path.
- `.github/extensions/copilot-avatar/main.mjs` can call `session.getMessages()` on avatar open, scan historical `tool.execution_start` + `subagent.started` events into active sub-agent state, then replay `addSubagent` / `setAgentModel` / `setAgentIntent` / `setAgentActivity` so already-running agents keep their Squad names.
- `.github/extensions/copilot-avatar/main.mjs` schedules a fallback retire when `tool.execution_complete` clears a visible sub-agent's last live tool without a matching `subagent.completed` / `subagent.failed`.
- `.github/extensions/copilot-avatar/content/main.js` can treat `workDescription` as the first non-root detail fallback and ignore idle tool entries when deciding whether `thinking` should be visible.
- `.github/extensions/copilot-avatar/content/main.js` can queue `setAgentActivity` / `setAgentIntent` / `setAgentThinking` for a missing sub-agent, then replay them inside `ensureAvatar()` once `addSubagent` or a strong identity payload creates the card.
- `.github/extensions/copilot-avatar/content/style.css` widens sub-agent cards slightly and clamps badge text to two lines.

## Anti-Patterns
- Repeating separate name fallback chains in each event handler.
- Requiring tool execution, intent text, or debounce timers on top of `subagent.started` before a Copilot-owned card is allowed to appear.
- Letting `assistant.reasoning`, `assistant.intent`, model-only updates, or terminal events mint a new non-root card before Copilot has emitted `subagent.started`.
- Letting the parent `task` wrapper or `report_intent` tool bypass Copilot lifecycle ownership and create cards by themselves.
- Reusing Squad metadata as a visibility gate so roster/casting state can create, hide, or collapse Copilot-owned runtime cards.
- Letting roster description double as badge task summary; once the wrong identity owner is visible, the badge degrades into role text.
- Showing only static role text while a sub-agent is actively editing, searching, or running commands.
- Letting roster descriptions double as badge fallback text and then wondering why the lower line reverts to role labels once intent/tool activity expires.
- Hiding model identity behind the same line as badge status when the card already supports a dedicated model row.
- Replaying old Squad-backed cards after a context change because backend state was never reset.
- Assuming any reappearing role text under the name is always a pure reset bug. Stale-card leaks expose it more often, but role-first description fallback is its own UI-content seam.
- Letting long badge text stay single-line and collapse into useless ellipses.
- Letting idle wrapper tools or root-only Copilot summary copy (`It looks like you're all set`) outrank a non-root card's assigned work description.
- Reopening the avatar and assuming live future events will eventually repair generic labels without replaying the already-running agents from session history.
