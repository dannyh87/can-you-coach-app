# Can You Coach - Current Default Data

This document reflects the default data and standard values currently used by the app.

## Local MVP User And Club

The app uses a local MVP user helper.

Current behaviour:

- `getLocalUser()` creates or returns a local demo user.
- A default `Demo Club` can be created for that user when needed.

Production authentication is not built.

## Fitness Test Types

Fitness test types are stored in `FitnessTestType`.

Important fields:

- `name`
- `description`
- `resultUnit`
- `higherIsBetter`
- `isDefault`
- optional `userId`

The database supports both default and user-owned test types. Seed/default values are managed through the Prisma seed and app data, not hard-coded UI-only state.

Examples supported by the product direction:

- Gacon Test
- Yo-Yo Test
- Bronco Test
- 505 Agility Test
- Sprint tests
- Club-specific tests

## Fitness Result Statuses

Stored enum values:

- `COMPLETED`
- `DID_NOT_START`
- `INJURED`
- `ABSENT`
- `DROPPED_OUT`

Coach-facing labels include:

- Completed
- Did not start
- Injured
- Missed/Absent
- Dropped out

## Match Types

Stored enum values:

- `LEAGUE`
- `CUP`
- `FRIENDLY`

Coach-facing labels:

- League
- Cup
- Friendly

## Match Venues

Stored enum values:

- `HOME`
- `AWAY`
- `NEUTRAL`

Coach-facing labels:

- Home
- Away
- Neutral

## Match Statuses

Stored enum values:

- `DRAFT`
- `IN_PROGRESS`
- `HALF_TIME`
- `COMPLETED`

## Match Squad Statuses

Stored enum values:

- `STARTER`
- `SUBSTITUTE`
- `NOT_INVOLVED`

Coach-facing labels:

- Starter
- Substitute
- Not involved

## Standard Match Event Types

The app currently uses a fixed standard event set. Custom event definitions are not built.

Stored values and labels:

- `GOAL` - Goal
- `ASSIST` - Assist
- `SHOT_ON_TARGET` - Shot on target
- `SHOT_OFF_TARGET` - Shot off target
- `PASS_COMPLETE` - Pass complete
- `PASS_INCOMPLETE` - Pass incomplete
- `ONE_V_ONE_SUCCESS` - 1v1 success
- `ONE_V_ONE_UNSUCCESSFUL` - 1v1 unsuccessful

## Event Categories

Stored values:

- `ATTACKING`
- `IN_POSSESSION`
- `OUT_OF_POSSESSION`
- `TRANSITION`

Current standard categorisation:

- Attacking: goal, assist, shots.
- In possession: passes and 1v1 events.
- Out of possession: no standard events yet.
- Transition: no standard events yet.

## CSV Exports

CSV export filenames are generated client-side using readable slugs.

Examples:

- `fitness-results-gacon-test-brereton-social-2026-06-09.csv`
- `match-summary-brereton-social-vs-uttoxeter-2026-06-09.csv`
- `match-events-brereton-social-vs-uttoxeter-2026-06-09.csv`

## Future Default Data Not Built

- Benchmark data.
- Age-group standards.
- Coaching templates.
- Session plans.
- Development pathways.
- Custom match event libraries.
