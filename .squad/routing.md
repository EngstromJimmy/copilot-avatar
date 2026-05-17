# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| 3D avatar UI and rendering | Shuri | Avatar visuals, interaction polish, scene composition, rendering flow |
| Copilot CLI and Squad integration | Vision | Extension lifecycle, platform wiring, cross-system contracts, orchestration glue |
| Node.js runtime logic and tooling | Peter Parker | MJS modules, async workflows, service plumbing, utility refactors |
| Test coverage and edge cases | Howard the Duck | Regression tests, weird-path QA, repro steps, reviewer rejection |
| Code review | Tony Stark | Review PRs, challenge architecture, catch risky abstractions |
| Testing strategy | Howard the Duck | Write tests, find edge cases, verify fixes |
| Scope and priorities | Tony Stark | What to build next, trade-offs, decisions |
| Session logging | Scribe | Automatic - never needs routing |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Tony Stark |
| `squad:{member}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it - analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" - untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** - spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts -> coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." -> fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn Howard the Duck to write test cases from requirements simultaneously.
7. **Issue-labeled work** - when a `squad:{member}` label is applied to an issue, route to that member. Tony Stark handles all `squad` triage.
