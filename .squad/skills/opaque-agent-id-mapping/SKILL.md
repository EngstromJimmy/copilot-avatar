---
name: "opaque-agent-id-mapping"
description: "Do not treat opaque runtime handles as stable roster identities"
domain: "integration-testing"
confidence: "high"
source: "earned"
---

## Context
This applies when UI code tries to decorate runtime agent events with roster metadata. If the runtime emits opaque handles like `agent-call_H` but the roster is keyed by durable slugs like `howard-the-duck`, a direct lookup on `agentId` will still miss.

## Patterns
- **Verify both namespaces:** Check whether runtime IDs and roster IDs are actually from the same naming scheme before wiring lookups together.
- **Map opaque IDs explicitly:** If runtime IDs are transient handles, introduce an explicit translation layer to persistent roster identities.
- **Keep fallbacks human-first:** Use runtime `displayName` or persistent roster names before falling back to raw internal IDs.
- **Test the real miss case:** Reproduce with the actual failing opaque ID, not only the happy path where `agentId` already equals the roster slug.

## Examples
- Roster key: `howard-the-duck`; runtime event ID: `agent-call_H` → direct `agentId` lookup fails without translation.
- Safe fallback order: `event displayName` → roster display name from translated identity → `agentName` → raw `agentId`.

## Anti-Patterns
- Assuming `agentId` is automatically the same as a roster slug.
- Declaring a lookup fix complete without testing the reported opaque ID format.
- Using raw internal IDs as an acceptable user-facing fallback when a human-readable roster exists.
