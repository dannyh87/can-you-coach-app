# Match Tracking Taxonomy Explorer

The Match Day tracking taxonomy explorer is an internal development tool at `/dev/match-tracking-taxonomy`.

## Enablement

Set:

```text
ENABLE_MATCH_TRACKING_TAXONOMY_DEV_EXPLORER=true
```

The route also requires an authenticated super-admin according to `SUPER_ADMIN_EMAILS` or the local development super-admin fallback. When the flag or access check fails, the route returns `notFound()`.

## Purpose

Use this explorer to verify the UI-neutral tracking resolver before building the final coach setup wizard.

It supports:

- player, unit and team paths
- target-context filtering
- phase and focus-area filtering
- topic search and aliases
- recommended topic event sets
- advanced-compatible standard event inspection
- no-result diagnostics

## Safety

Topics are setup context only. `EventDefinition` remains the recorded and reportable identity for match events.

Do not expose this route publicly.
