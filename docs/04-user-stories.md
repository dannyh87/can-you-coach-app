# Can You Coach - Built User Stories

This document records the user stories currently supported by the MVP.

## Club And Team Setup

As a coach, I can create a club and team so that players, fitness sessions, and matches are organised.

Built acceptance criteria:

- Create club and team records.
- Capture team name, age group, season, league, and football pyramid step.
- Prevent deleting teams that still have related players, fitness sessions, or match days.

## Player Management

As a coach, I can manage players so that my active squad is available for testing and matches.

Built acceptance criteria:

- Add and edit player details.
- Capture first name, surname, squad number, preferred position, date of birth, and joined club date.
- Archive players with `isActive` rather than hard-deleting active history.
- View player detail pages.

## Fitness Session Creation

As a coach, I can create a fitness session so that I can record a squad test.

Built acceptance criteria:

- Select team, test type, date, and notes.
- Save sessions as draft.
- Start sessions and mark sessions complete through supported recording flows.
- Display sessions in the Fitness area.

## Fitness Result Recording

As a coach, I can record fitness results so that I can compare player performance.

Built acceptance criteria:

- Manual entry for suitable tests.
- Live dropout recording for dropout-style tests.
- Timed finish recording for timed tests.
- Result statuses include completed, did not start, injured, absent/missed, and dropped out.
- Results support numeric values, display text, and notes.
- Completed sessions hide recording controls and become read-only.

## Fitness Rankings And Progress

As a coach, I can review rankings and progress so that I can understand performance and improvement.

Built acceptance criteria:

- Session rankings sort by the test type ranking direction.
- Missing or invalid numeric results are shown separately.
- Progress reporting shows historical results and simple charts.
- Completed summary panels show key session metadata and top/bottom performers.
- Fitness results can be downloaded as CSV.

## Match Creation

As a coach, I can create a match so that I can prepare a Match Day record.

Built acceptance criteria:

- Select team.
- Enter opposition and kickoff date/time.
- Select venue and match type.
- Match starts in draft state.

## Match Squad Setup

As a coach, I can set up a match squad so that involvement and substitutions are tracked.

Built acceptance criteria:

- Pull active team players into a match squad.
- Mark players as starter, substitute, or not involved.
- Lock squad editing once the match starts.
- Keep not-involved players out of live substitution/event workflows.

## Match Tracking Focus

As a coach or parent helper, I can select which involved players are tracked for events so that recording can focus on one player or a small group.

Built acceptance criteria:

- Choose all on-pitch players or selected players only.
- Tracking focus is draft-only.
- Tracking focus does not remove players from the squad.
- Tracking focus does not affect substitutions or minutes.
- Event recording only shows tracked players currently on the pitch.

## Match Live Recording

As a coach, I can run a live match so that score, halves, minutes, substitutions, and events are captured.

Built acceptance criteria:

- Start first half, end first half, start second half, complete match.
- Update score during live play or half-time.
- Sub players on and off during active halves.
- Track player stints and minutes played.
- Record selected standard events for tracked on-pitch players.
- Undo events before completion.

## Completed Match Report

As a coach, I can review a completed match so that I can share and analyse what happened.

Built acceptance criteria:

- Completed report shows final score, minutes, team event totals, player event counts, most involved players, and timeline.
- Completed matches are read-only.
- Download summary CSV.
- Download events CSV.
