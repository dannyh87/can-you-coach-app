# Can You Coach - Built MVP Scope

This document reflects what has actually been built so far.

## In Scope And Built

### Local MVP User

- The app uses `getLocalUser()` to create/use a local demo user.
- A default `Demo Club` can be created automatically for the local MVP user.
- Production sign up, sign in, sign out, roles, and permissions are not built.

### Club Setup

- Create and manage clubs and teams.
- Teams include name, age group, season, league, and football pyramid step.
- Team delete is guarded when teams have players, fitness sessions, or match days.

### Players

- Add, edit, view, and archive players.
- Player fields include first name, surname, squad number, preferred position, date of birth, joined club date, and active status.
- Archived players are excluded from active recording lists.

### Fitness Testing

- Manage default and custom fitness test types at `/fitness/test-types`.
- Create custom user-owned fitness test types.
- Edit test type name, unit, ranking direction, allowed recording modes, and preferred recording mode.
- Persisted recording modes are stored on `FitnessTestType` as `allowedRecordingModes` and `preferredRecordingMode`.
- Supported recording modes are `MANUAL`, `LIVE_DROPOUT`, and `LIVE_TIMED_FINISH`.
- Create fitness sessions for a team and test type.
- Session statuses: `DRAFT`, `IN_PROGRESS`, `COMPLETED`.
- Recording modes include manual entry, live dropout, and timed finish flows.
- Results support numeric value, display text, result status, and notes.
- Completed sessions are read-only.
- Completed sessions have an admin-style Reopen for Correction action that returns the session to in-progress while preserving saved results.
- Rankings and progress reporting are built.
- Completed summaries show metadata, result count, top/bottom performers, rankings links, and progress links.
- CSV export is available for saved fitness results.

### Match Day

- Create matches with team, opposition, kickoff date/time, match type, venue, score, and status.
- Match statuses: `DRAFT`, `IN_PROGRESS`, `HALF_TIME`, `COMPLETED`.
- Draft setup includes squad setup, tracking focus, event setup, and start match controls.
- Squad setup marks players as starter, substitute, or not involved.
- Tracking focus chooses which involved players are available for event recording.
- Event setup selects from the built-in standard event set.
- Live match controls include score display, GOAL/undo goal controls, first/second half lifecycle, and completed match state.
- Goals can be added or undone during live play only; goal recording is paused at half-time.
- Substitution/minutes tracking uses player stints and includes all involved players.
- Event recording is limited to tracked players who are currently on the pitch.
- Completed matches show a read-only report.
- CSV exports are available for completed match summary and event timeline data.

### Reporting And Export

- Fitness rankings and progress reports are built.
- Match completed report includes final score, minutes, team event totals, player event counts, most involved players, and timeline.
- CSV exports are client-side and do not mutate data.

## Built Standard Match Events

- Goal
- Assist
- Shot on target
- Shot off target
- Pass complete
- Pass incomplete
- 1v1 success
- 1v1 unsuccessful

## Out Of Scope For Current MVP

- Production auth.
- Payments/subscriptions.
- Parent portals.
- Assistant coach roles.
- Video.
- AI recommendations.
- Custom match event definitions.
- Team/opposition-only events.
- Multi-coach live sync.
- XLSX/PDF export.
- Migrating old `/track` localStorage data.
