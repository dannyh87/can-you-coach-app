# Can You Coach - Current Default Data

This document reflects default data and standard values currently used by the app.

## Local Development Seed

`prisma/seed.mjs` seeds safe local development data:

- local demo user
- Demo Club
- Brereton Social demo team
- demo players
- default fitness test types
- global match event definitions

Production should only be seeded deliberately.

## Fitness Test Types

Seeded default tests:

- Yo-Yo Test
- Gacon Test
- Bleep Test
- Bronco Test

Fitness test types support:

- result unit
- higher/lower-is-better ranking direction
- allowed recording modes
- preferred recording mode
- setup instructions
- equipment needed
- scoring notes
- coach notes
- target-score guidance
- optional video URL

Recording modes:

- `MANUAL`
- `LIVE_DROPOUT`
- `LIVE_TIMED_FINISH`

## Fitness Result Statuses

- `COMPLETED`
- `DID_NOT_START`
- `INJURED`
- `ABSENT`
- `DROPPED_OUT`

## Match Types

- `LEAGUE`
- `CUP`
- `FRIENDLY`

These are match context values, not match formats such as 7v7 or 11v11.

## Match Venues

- `HOME`
- `AWAY`
- `NEUTRAL`

## Match Statuses

- `DRAFT`
- `IN_PROGRESS`
- `HALF_TIME`
- `COMPLETED`

## Match Squad Statuses

- `STARTER`
- `SUBSTITUTE`
- `NOT_INVOLVED`

## Match Event Definitions

The app now uses `EventDefinition` records for global and club-specific match event libraries.

Legacy enum-backed global events:

- Goal
- Assist
- Shot on target
- Shot off target
- Pass complete
- Pass incomplete
- 1v1 success
- 1v1 unsuccessful
- Touch

Seeded DB-only global events include:

- Possession gained
- Possession lost
- Shot position
- Cross position
- Carry
- Forward pass
- Interception
- Tackle won
- Key pass
- Cross
- Cutback
- Shot blocked

Notes:

- DB-only events work for coach event recording and reporting.
- Parent submissions currently use legacy enum-backed event types only.
- Club owners can add club-specific events in Club Setup.
- Super Admin users can manage global event definitions.

## Curriculum Recommendation Defaults

Match Day recommendations are code-based, not persisted season plans.

`inferMatchFormat(ageGroup)` maps:

- U6-U7 -> 3v3
- U8-U9 -> 5v5
- U10-U11 -> 7v7
- U12-U13 -> 9v9
- U14+, Open Age, Adult, Senior, Veterans -> 11v11
- unknown -> generic recommendation

Recommendations match by event name, slug, normalized name, and aliases. Missing recommended events are shown to coaches but not created automatically.

## CSV Exports

CSV export filenames are generated client-side using readable slugs.

Examples:

- `fitness-results-gacon-test-brereton-social-2026-06-09.csv`
- `match-summary-brereton-social-vs-uttoxeter-2026-06-09.csv`
- `match-events-brereton-social-vs-uttoxeter-2026-06-09.csv`

## Not Seeded Yet

- Benchmark datasets.
- Age-group standards.
- Persisted coaching templates.
- Season plans or training blocks.
- Advanced tactical event templates beyond the current global event library.
