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

Relations include clubs, memberships, spectator access, invitations, fitness test types, notifications, submitted/accepted parent or contributor match events, reviewed pattern observations, club tracking definitions, and match tracking assignments.

## Club, Memberships, And Access

`Club` stores club details, report email preferences, teams, memberships, invitations, spectator links, tracking setup templates, and club tracking definitions.

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

## EventDefinition And Tactical Library

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

Legacy enum-backed events keep compatibility with older event paths. DB-only events support coach and contributor recording and reporting through `eventDefinitionId`.

The current global library includes legacy-backed events, professional DB-only events, 53 synced tactical definitions, and the standard `Ball recovery` prerequisite used by tactical presets.

Tactical definitions use the same `EventDefinition` model and carry tactical metadata through phase, category, subcategory, group, description, and detail options in code. Six tactical presets are verified by `prisma/verify-tactical-presets.mjs`.

## Club Tracking Definitions

`ClubTrackingDefinition` stores club-scoped observation definitions and mappings.

Important concepts:

- definition kind: event alias, event mapped, event custom, pattern alias, or pattern mapped
- status: draft, pending review, approved, rejected, or retired
- visibility scope: team or club
- mapping status: none, proposed, club approved, standard approved, or rejected
- mapping revision and recorded standard identity snapshots
- creator, updater, approver, and standard-mapping reviewer relations

Club tracking definitions preserve club-level language while allowing reports to distinguish native standard observations, aliases, approved mappings, rejected/local mappings, and club-only custom observations.

## MatchDayEventType

Purpose: selected event definitions for a match.

Key fields:

- `matchDayId`
- `eventType` legacy fallback
- `category`
- `eventDefinitionId`

Selected match events can represent legacy events, standard event definitions, tactical event definitions, and club-scoped definitions surfaced through setup flows.

Unique rules prevent duplicate event selections per match.

## MatchEvent

Purpose: one recorded event during a match.

Key fields:

- `matchDayId`
- `playerId`
- `eventType` legacy fallback
- `eventDefinitionId`
- `clubTrackingDefinitionId`
- recorded club mapping snapshot fields
- `teamSide` (`OUR_TEAM` or `OPPOSITION`)
- optional `detailCode`
- optional `tacticalSequenceId`
- `half`
- `matchSecond`
- score at time
- optional pitch location `x` / `y`

Rule: player-attributed live coach events require an involved, tracked player who is currently on the pitch. Team, unit, contributor, and opposition-supported flows can create playerless or opposition-side observations where the workflow allows it.

## SubmittedMatchEvent

Purpose: parent/spectator or contributor submitted live observations.

Submitted observations can preserve legacy event type, standard event definition, club tracking definition, recorded mapping snapshot fields, `teamSide`, tactical `detailCode`, optional `tacticalSequenceId`, location, score context, and supported player attribution. Accepted submissions create official `MatchEvent` rows with a `submittedMatchEventId` source link.

Statuses:

- `PENDING`
- `ACCEPTED`
- `IGNORED`

## Match Tracking Tasks And Contributor Assignments

`MatchTrackingTask` describes a player, unit, or team observation task for a match.

`MatchContributorAssignment` and `MatchContributorAssignmentRecipient` support direct, self, and group-offer assignment flows. Group-offer claiming is protected so only one eligible recipient can claim a given offer.

Submitted observations remain separate from official observations until reviewed and accepted by an authorized coach/owner.

## Pattern Observations

`MatchTrackingPatternObservation` and `SubmittedTrackingPatternObservation` store official and submitted tracking-pattern observations, including outcome, scope, target, location, review status, and club mapping provenance.

Pattern observations are separate from `MatchEvent` rows and have dedicated report/export handling.

## Tactical Sequences

`TacticalSequence` exists so reports can consume valid links between tactical start and outcome observations.

Current limitation: there is no app UI/action that creates or maintains tactical sequence links. Causal tactical metrics must remain treated as unfinished/unavailable unless valid sequence links exist.
