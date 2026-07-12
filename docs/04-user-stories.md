# Can You Coach - Built User Stories

This document records the user stories currently supported by the app.

## Public Landing, Auth, And Onboarding

As a new user, I can understand the product quickly, sign up or sign in, and choose the right onboarding path.

Built acceptance criteria:

- Public landing page explains progress beyond the scoreline.
- Clerk sign-in/sign-up routes exist.
- Local fallback auth exists for development.
- Onboarding supports club officials, coaches, and parent/spectator users.
- No-access users get role-aware guidance.

## Club And Team Setup

As a club owner, I can create a club and teams so that players, fitness sessions, matches, and reports are organised.

Built acceptance criteria:

- Create and update club records.
- Create and update team records with age group, season, league, and football pyramid step.
- Prevent deleting teams that still have related records.
- Manage match and fitness report email preferences.

## Access And Invitations

As a club owner, I can invite staff and parent/spectator contributors so the right people can help without opening up admin access.

Built acceptance criteria:

- Generate staff invites for coach and assistant coach access.
- Assign staff to teams.
- Generate parent/spectator invites linked to players.
- Revoke pending invites.
- Accept invites from `/invite/accept`.
- Preserve server-side permission checks.

## Player Management

As a coach, I can manage players so that my active squad is available for testing and matches.

Built acceptance criteria:

- Add and edit player details.
- Capture first name, surname, squad number, preferred position, date of birth, and joined club date.
- Archive/restore players using active status.
- View player detail pages.
- Import players from CSV.
- Assistants can view assigned team players without seeing owner/admin controls.

## Fitness Testing

As a coach, I can run and review fitness tests so that I can compare player performance and progress.

Built acceptance criteria:

- Manage default and custom fitness test types.
- Store setup instructions, equipment, scoring notes, coach notes, video URL, and target-score guidance.
- Configure allowed and preferred recording modes.
- Create fitness sessions for a team and test type.
- Record manual, live dropout, and live timed finish results.
- Use statuses: completed, did not start, injured, absent/missed, and dropped out.
- Lock completed sessions as read-only.
- Reopen completed sessions for correction while preserving saved results.
- Review rankings and progress charts.
- Export fitness results as CSV.

## Match Creation And Setup

As a coach, I can create and prepare a match so that live recording is quick and focused.

Built acceptance criteria:

- Create matches with team, opposition, kickoff, venue, and match type.
- Matches start in draft state.
- Set up squad statuses: starter, substitute, not involved.
- Choose tracking focus for event recording.
- Choose global and club-specific event definitions.
- Use curriculum recommendations based on age group, inferred match format, theme, week, and available events.
- Keep manual event selection available.

## Match Live Recording

As a coach, I can run a live match so score, halves, minutes, substitutions, and events are captured.

Built acceptance criteria:

- Start first half, end first half, start second half, and complete match.
- Add or undo team/opposition goals during live play.
- Pause goal and event recording at half-time.
- Sub players on and off during active halves.
- Track player stints and minutes played.
- Record selected events for tracked on-pitch players.
- Open pitch location picker only for events that require location.
- Undo events before completion.
- Keep goal controls separate from event recording.
- Mobile recording uses compact player chips, category chips, event grid, sticky context, and persistent undo.

## Parent/Spectator Linked Player Access

As a parent or spectator, I can follow linked-player information without gaining club admin access.

Built acceptance criteria:

- View linked-player profile, fitness results, and recent match reports in `/my-player`.
- Submit live match observations for linked players from `/my-player/matches`.
- Keep parent observations separate from coach/admin workflows.
- Parent submissions currently use legacy enum-backed event types.

## Completed Match Report

As a coach, I can review a completed match so that I can analyse what happened.

Built acceptance criteria:

- Completed report shows final score, minutes, team event totals, player event counts, most involved players, timeline, and location maps where available.
- Completed matches are read-only.
- Download summary CSV.
- Download events CSV.

## Reports

As a coach, I can review trends so that I can see development over time.

Built acceptance criteria:

- Reports index links to Team Event Trends and Fitness Progress.
- Team Event Trends filters by team, date range, event, and match type.
- Fitness Progress shows historical test results and charts.
