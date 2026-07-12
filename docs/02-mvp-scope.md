# Can You Coach - Built MVP Scope

This document reflects what is currently built.

## Auth, Onboarding, And Access

- Clerk authentication is supported for production.
- Local development can run without Clerk using a demo user fallback.
- Public sign-up and sign-in routes exist.
- First-time onboarding supports club officials, coaches, and parent/spectator users.
- Invite acceptance supports team coach, team assistant, player parent, and player spectator invites.
- Navigation and empty states are role-aware.
- Server-side permissions remain the source of truth.

## Club Setup

- Create and manage clubs and teams.
- Teams store name, age group, season, league, and football pyramid step.
- Team delete is guarded when related records exist.
- Owners can manage staff access, team assignments, parent/spectator links, and pending invites.
- Owners can create club-specific match event definitions.
- Report email preferences exist for match and fitness reports.

## Players

- Add, edit, view, archive, and restore players.
- Player fields include first name, surname, squad number, preferred position, date of birth, joined club date, and active status.
- CSV player import is available.
- Assistant coaches can view assigned-team players without misleading create/admin controls.

## Fitness Testing

- Manage default and custom fitness test types at `/fitness/test-types`.
- Fitness test types include recording modes, guidance, target-score guidance, setup instructions, equipment, scoring notes, coach notes, and optional video URL.
- Supported recording modes: `MANUAL`, `LIVE_DROPOUT`, `LIVE_TIMED_FINISH`.
- Fitness sessions have `DRAFT`, `IN_PROGRESS`, and `COMPLETED` states.
- Manual entry, live dropout, and live timed finish flows are built.
- Completed sessions are read-only but can be reopened for correction.
- Rankings, progress reporting, completed summaries, and CSV exports are built.

## Match Day

- Match creation supports team, opposition, kickoff, match type, and venue.
- Match Day Wizard includes squad setup, tracking focus, event setup, and curriculum recommendations.
- Curriculum recommendations infer match format from team age group and match against available global/club events.
- Event setup supports global event definitions and club-specific event definitions scoped to the selected team club.
- Live match controls include score, halves, timer state, and completion.
- Substitution/minutes tracking uses player stints.
- Mobile event recording has compact player chips, category chips, dense event buttons, sticky context, and immediate undo.
- Location events open the pitch picker only when required.
- Completed matches show read-only reports and CSV exports.

## Parent/Spectator Access

- Linked-player users can view player details, recent fitness results, and recent match reports in `/my-player`.
- Linked-player users can submit observations for linked players during live matches through `/my-player/matches`.
- Parent submissions currently use legacy enum-backed event types only.

## Reporting

- `/reports` lists Team Event Trends and Fitness Progress.
- Team Event Trends charts selected match events across completed matches.
- Fitness Progress charts historical fitness results.
- Completed match and fitness sessions support CSV exports.

## Global Event Library

- Super Admin users can manage global event definitions.
- Seeded global event definitions include legacy-backed events and selected DB-only events such as `Carry`, `Forward pass`, `Interception`, `Tackle won`, `Key pass`, `Cross`, `Cutback`, and `Shot blocked`.

## Out Of Scope

- Payments/subscriptions.
- Video upload/analysis.
- Multi-coach live sync.
- Persisted season plans/training blocks.
- XLSX/PDF exports.
- Auto-created missing curriculum events.
