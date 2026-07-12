# Can You Coach - Current Database Schema

The app uses Prisma with PostgreSQL. The schema is defined in `prisma/schema.prisma`, with migrations in `prisma/migrations`.

Previous SQLite migrations are preserved in `prisma/migrations_sqlite_archive` for reference.

Expected local `DATABASE_URL` format:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/can_you_coach?schema=public"
```

`DIRECT_URL` is not currently required because the Prisma schema only uses `env("DATABASE_URL")`.

## Core Hierarchy

```text
User
  ├── ClubMembership -> Club -> Team -> Player
  └── SpectatorAccess -> Player
```

## User

Purpose: app account, Clerk-linked in production or local fallback in development.

Key fields include:

- `id`
- `clerkUserId`
- `email`
- `passwordHash`
- `onboardingCompletedAt`
- `onboardingRole`

Relations include clubs, memberships, spectator access, invitations, fitness test types, and submitted/accepted parent match events.

## Club, Memberships, And Access

`Club` stores club details, report email preferences, teams, memberships, invitations, and spectator links.

`ClubMembership` stores user role per club:

- `OWNER`
- `COACH`
- `ASSISTANT_COACH`
- `VIEWER`

`TeamAssignment` links memberships to teams for scoped coach/assistant access.

`SpectatorAccess` links a user to a specific player and club without creating club membership.

## Invitations

`Invitation` supports invite links for:

- `TEAM_COACH`
- `TEAM_ASSISTANT`
- `PLAYER_PARENT`
- `PLAYER_SPECTATOR`

Statuses:

- `PENDING`
- `ACCEPTED`
- `EXPIRED`
- `REVOKED`

## Team

Purpose: squad within a club.

Key fields:

- `clubId`
- `name`
- `ageGroup`
- `season`
- `league`
- `footballPyramidStep`

There is no persisted match-format field. Match Day curriculum recommendations infer match format from `ageGroup`.

## Player

Purpose: individual player.

Key fields:

- `teamId`
- `firstName`
- `surname`
- `squadNumber`
- `preferredPosition`
- `dateOfBirth`
- `joinedClubDate`
- `isActive`

## Fitness Models

`FitnessTestType` stores test configuration, recording modes, and guidance fields:

- result unit and ranking direction
- allowed/preferred recording modes
- setup instructions
- equipment needed
- scoring notes
- coach notes
- video URL
- target scores

`FitnessTestSession` stores one test session for a team with `DRAFT`, `IN_PROGRESS`, or `COMPLETED` status.

`FitnessTestResult` stores one player's result in a session with status, numeric value, display text, and notes.

## MatchDay

Purpose: one football match record.

Key fields:

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

## MatchDayPlayer And Stints

`MatchDayPlayer` stores player involvement in a match:

- squad status
- starting position
- shirt number snapshot
- `isTracked`

Squad statuses:

- `STARTER`
- `SUBSTITUTE`
- `NOT_INVOLVED`

`isTracked` affects event recording only. It does not affect squad involvement, substitutions, or minutes.

`MatchPlayerStint` tracks when a match squad player is on the pitch and stores timing for minutes reporting.

## EventDefinition

Purpose: global and club-specific match event library.

Important fields:

- `scope` (`GLOBAL` or `CLUB`)
- `clubId`
- `legacyEventType`
- `name`
- `slug`
- `normalizedName`
- `description`
- `matchPhase`
- `category`
- `subcategory`
- `matchDayGroup`
- `agePhases`
- `fourCorner`
- `positionRelevance`
- `enabledByDefault`
- `benchmarkable`
- `requiresLocation`
- `isActive`

Legacy enum-backed events keep compatibility with older event paths and parent submissions. DB-only events support coach recording and reporting through `eventDefinitionId`.

## MatchDayEventType

Purpose: selected event definitions for a match.

Key fields:

- `matchDayId`
- `eventType` legacy fallback
- `category`
- `eventDefinitionId`

Unique rules prevent duplicate event selections per match.

## MatchEvent

Purpose: one recorded event during a match.

Key fields:

- `matchDayId`
- `playerId`
- `eventType` legacy fallback
- `eventDefinitionId`
- `half`
- `matchSecond`
- score at time
- optional pitch location `x` / `y`

Rule: events require an involved, tracked player who is currently on the pitch.

## SubmittedMatchEvent

Purpose: parent/spectator submitted live observations.

Current limitation: submitted events use legacy `MatchEventType` values, not arbitrary DB-only event definitions.

Statuses:

- `PENDING`
- `ACCEPTED`
- `IGNORED`
