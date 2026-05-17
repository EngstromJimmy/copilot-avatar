---
name: "stable-agent-identity"
description: "Use stable agent identity fields for metadata joins and reserve instance ids for runtime bookkeeping."
domain: "extension-architecture"
confidence: "high"
source: "observed"
---

## Context

This applies when an event-driven extension has to merge runtime agent events with roster or config metadata. The runtime payload often carries both a stable identity and a per-run instance id; mixing them creates brittle joins.

## Patterns

- Join metadata on stable identity fields such as `agentName`, `agentDisplayName`, or roster-derived ids.
- If the team uses casting, load the latest casting snapshot's slot aliases into the lookup map so stable runtime names like `tester` or `backend-dev` resolve to cast identities without touching runtime instance ids.
- Treat empty strings as missing before running fallback chains; blank values are common enough that `??` alone is not safe.
- Treat low-confidence placeholders such as `General Purpose Agent` as missing when richer roster or casting metadata is available.
- If Copilot emits `subagent.selected` before `subagent.started`, treat that selection payload as a short-lived identity hint only. Bind it to the concrete runtime `agentId` once `subagent.started` arrives, then reuse the bound hint for later updates or reconnect sync.
- Use instance ids only for per-run state maps, event correlation, and last-resort labels.
- If the product contract says every Copilot-present sub-agent should stay visible, keep one visible card per runtime `agentId` and use stable identity only to enrich name/role/description metadata.
- If the product contract is “one visible card per cast identity,” add a separate stable-identity ownership seam above runtime instance ids so a reactivated old instance cannot render a second Tony/Howard/etc. card beside the current one.
- If stable-identity cards usually collapse to one owner, let truly concurrent live instances coexist instead of hiding active work just because the cast name matches.
- When stable-identity collapse does happen, merge the richest shared identity metadata (display name, role, description, task summary) into the surviving owner before hiding siblings so the card keeps its human name.
- If duplicate-collapse is part of the contract, invoke the existing collapse helper on every seam that can (re)introduce a visible card — first render, reconnect rehydrate, and webview `addSubagent` — or the helper is just dead code.
- If `stableIdentityKey` is absent, derive a fallback only from labels that already passed the low-confidence filters; never promote a runtime `agentId` into a stable identity key.
- Keep mutable UI state (active tool label, live model, completion status) in a per-agent runtime map keyed by instance id, then enrich outgoing payloads from that single state seam.
- If root-level Squad visuals are gated by coordinator/session state, keep a separate metadata context for sub-agent identity lookup so cast names do not disappear when the root gate turns Squad chrome off.
- If hidden chrome still needs sub-agent enrichment, preserve the loaded `agentsByKey`/team metadata on the hidden context and let metadata lookup key off lookup presence rather than `active`.
- If stable identity fields arrive blank, log that drift so the upstream contract problem is visible.

## Examples

- `.github/extensions/copilot-avatar/lib/squad-context.mjs` builds a roster lookup keyed by stable agent aliases.
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` enriches that lookup with `.squad/casting/history.json` slot aliases so `tester` can resolve to `Howard the Duck`.
- `.github/extensions/copilot-avatar/main.mjs` tracks live avatar state by `event.agentId`, which is appropriate for runtime instance ownership.
- `.github/extensions/copilot-avatar/main.mjs` reuses that per-agent runtime state to push consistent `displayName`, `model`, and `activityLabel` data through started/completed/failed/tool events.
- `.github/extensions/copilot-avatar/main.mjs` can gate root Squad chrome through `getVisibleSquadContext()` while still resolving sub-agent metadata from `resolvedSquadContext` via a dedicated helper.
- `.github/extensions/copilot-avatar/main.mjs` can return an `active: false` visible context that still carries `agentsByKey`, `teamName`, and `coordinatorName`, so root chrome stays hidden while Copilot-owned cards still resolve cast names.
- `.github/extensions/copilot-avatar/main.mjs` can derive a `stableIdentityKey` from Squad metadata / stable runtime labels, then collapse visible duplicates before calling `addSubagent`.
- `.github/extensions/copilot-avatar/main.mjs` can preserve cached metadata during `syncKnownSubagents()` and rerun duplicate collapse there, so reconnects do not revive a generic third card.
- `.github/extensions/copilot-avatar/main.mjs` can also keep every live Copilot-owned runtime `agentId` visible while still resolving each card's display name and role from Squad roster or casting metadata.
- `.github/extensions/copilot-avatar/content/main.js` can derive a fallback identity key from `resolveAvatarDisplayName()` and call `collapseAvatarIdentityDuplicates()` inside `window.addSubagent`, so the page-side surface matches the extension's duplicate policy.
- `.github/extensions/copilot-avatar/main.mjs` can cache a recent `subagent.selected` payload for `Scribe`, then attach that metadata to the first low-confidence `subagent.started` instance so the rendered card shows `Scribe` without letting selection events mint cards.
- `.github/extensions/copilot-avatar/main.mjs` can keep two `Peter Parker` runtime instances visible when both still have live tool activity, but fold a stale/no-tool duplicate back into one owner once only one instance is actually working.
- `.github/extensions/copilot-avatar/main.mjs` can merge a stale sibling's richer `displayName` / `role` / `description` into the surviving runtime owner so fresh-but-blank events do not wipe the visible card label.
- In Squad UI flows, a placeholder SDK label like `General Purpose Agent` should not outrank roster names such as `Howard the Duck`.
- Copilot SDK `session-events.d.ts` documents `agentId` as a sub-agent instance identifier and `agentName` / `agentDisplayName` as identity-bearing fields.

## Anti-Patterns

- Using runtime `agentId` to join against roster metadata.
- Letting `subagent.selected` create or suppress cards instead of treating it as metadata-only enrichment for a later `subagent.started`.
- Reusing a root-visibility gate as the only source of sub-agent roster metadata.
- Letting stable-identity collapse override an explicit product rule that visibility should mirror Copilot runtime presence.
- Driving visible-card ownership straight from runtime `agentId` when multiple live instances can resolve to the same cast identity.
- Collapsing same-identity cards even when both runtime instances still have active live work.
- Hiding a stale duplicate without first salvaging the best human-facing metadata into the remaining owner.
- Defining stable-identity collapse helpers but never invoking them on reconnect or initial webview add.
- Using separate ad hoc fallback chains per event type.
- Storing model or badge state on tool-call maps after the agent id is known.
- Letting `""` short-circuit naming fallback and force the UI onto internal ids.
- Letting generic placeholder labels outrank cast names or roster display names.
