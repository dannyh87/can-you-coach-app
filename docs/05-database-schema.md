# Can You Coach - Current Database Schema

The app uses Prisma with PostgreSQL. The schema is defined in `prisma/schema.prisma` and current migrations are stored in `prisma/migrations`.

Previous SQLite migrations are preserved in `prisma/migrations_sqlite_archive` for reference. Do not delete `prisma/dev.db` or the archive unless there is an explicit data-retention decision.

Expected local `DATABASE_URL` format:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/can_you_coach?schema=public"
```

Postgres compatibility notes:

- The current schema uses `String @id @default(cuid())`, Prisma enums, booleans, `DateTime`, `Float`, and referential actions that are compatible with Postgres.
- No model fields or defaults required changes during the provider switch beyond changing the datasource provider.
- The fresh Postgres baseline migration creates native Postgres enum types.

## Core Hierarchy

```text
User
  └── Club
        └── Team
              └── Player
```

## User

Purpose: local MVP owner account.

Key fields:

- `id`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

Current note: production authentication is not built. The local MVP uses `getLocalUser()`.

## Club

Purpose: club or organisation.

Key fields:

- `id`
- `userId`
- `name`
- `location`
- `notes`

Relations:

- belongs to `User`
- has many `Team`

## Team

Purpose: squad within a club.

Key fields:

- `id`
- `clubId`
- `name`
- `ageGroup`
- `season`
- `league`
- `footballPyramidStep`

Relations:

- belongs to `Club`
- has many `Player`, `FitnessTestSession`, and `MatchDay`

## Player

Purpose: individual player.

Key fields:

- `id`
- `teamId`
- `firstName`
- `surname`
- `squadNumber`
- `preferredPosition`
- `dateOfBirth`
- `joinedClubDate`
- `isActive`

Relations:

- belongs to `Team`
- has fitness results, match squad records, match stints, and match events

## FitnessTestType

Purpose: defines a standard or user-owned fitness test.

Key fields:

- `id`
- `userId`
- `name`
- `description`
- `resultUnit`
- `higherIsBetter`
- `isDefault`

Ranking uses `higherIsBetter`.

## FitnessTestSession

Purpose: one instance of a fitness test for a team.

Key fields:

- `id`
- `teamId`
- `fitnessTestTypeId`
- `date`
- `notes`
- `status`
- `startedAt`
- `completedAt`

Statuses:

- `DRAFT`
- `IN_PROGRESS`
- `COMPLETED`

## FitnessTestResult

Purpose: one player's result in one fitness session.

Key fields:

- `id`
- `fitnessTestSessionId`
- `playerId`
- `resultValue`
- `resultText`
- `status`
- `notes`

Statuses:

- `COMPLETED`
- `DID_NOT_START`
- `INJURED`
- `ABSENT`
- `DROPPED_OUT`

Unique rule:

- one result per player per fitness session

## MatchDay

Purpose: one football match record.

Key fields:

- `id`
- `teamId`
- `kickoffAt`
- `opposition`
- `matchType`
- `venue`
- `ownScore`
- `oppositionScore`
- `status`
- first/second half timestamps
- `completedAt`

Match types:

- `LEAGUE`
- `CUP`
- `FRIENDLY`

Venues:

- `HOME`
- `AWAY`
- `NEUTRAL`

Statuses:

- `DRAFT`
- `IN_PROGRESS`
- `HALF_TIME`
- `COMPLETED`

## MatchDayPlayer

Purpose: a player's involvement in a specific match.

Key fields:

- `id`
- `matchDayId`
- `playerId`
- `squadStatus`
- `startingPosition`
- `shirtNumberSnapshot`
- `isTracked`

Squad statuses:

- `STARTER`
- `SUBSTITUTE`
- `NOT_INVOLVED`

Important rule: `isTracked` affects event recording only. It does not affect squad involvement, substitutions, or minutes.

## MatchPlayerStint

Purpose: tracks when a match squad player is on the pitch.

Key fields:

- `id`
- `matchDayId`
- `matchDayPlayerId`
- `playerId`
- `half`
- `startedAt`
- `endedAt`
- `startMatchSecond`
- `endMatchSecond`

Halves:

- `FIRST_HALF`
- `SECOND_HALF`

## MatchDayEventType

Purpose: selected standard event types for a specific match.

Key fields:

- `id`
- `matchDayId`
- `eventType`
- `category`

Categories:

- `ATTACKING`
- `IN_POSSESSION`
- `OUT_OF_POSSESSION`
- `TRANSITION`

## MatchEvent

Purpose: one recorded event during a match.

Key fields:

- `id`
- `matchDayId`
- `playerId`
- `eventType`
- `half`
- `matchSecond`
- `ownScoreAtTime`
- `oppositionScoreAtTime`

Current event types:

- `GOAL`
- `ASSIST`
- `SHOT_ON_TARGET`
- `SHOT_OFF_TARGET`
- `PASS_COMPLETE`
- `PASS_INCOMPLETE`
- `ONE_V_ONE_SUCCESS`
- `ONE_V_ONE_UNSUCCESSFUL`

Current rule: events require an involved, tracked player who is currently on the pitch.
