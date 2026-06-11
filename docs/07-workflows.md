# Can You Coach - Current Workflows

This document describes the workflows currently supported by the built MVP.

## Workflow 1: Set Up A Club, Team, And Players

1. Open `/club-setup`.
2. Create or update club details.
3. Create a team with age group, season, league, and pyramid step if needed.
4. Open `/players`.
5. Add active players with squad number and preferred position.

Notes:

- Players belong to one team in the MVP.
- Archived players are excluded from active recording lists.

## Workflow 2: Create A Fitness Session

1. Open `/fitness`.
2. Create a fitness session for a team and test type.
3. Add date and optional notes.
4. Start the session when ready.

Supported lifecycle:

- Draft
- In progress
- Completed

## Workflow 3: Record Fitness Results

The app supports multiple recording modes depending on the test type.

Manual entry:

1. Open the session detail page.
2. Enter numeric result, display result, status, and notes for players.
3. Save results.

Dropout tests:

1. Open the live dropout page.
2. Track the current level/stage.
3. Mark players as dropped out at their final level.

Timed finish tests:

1. Open the timer page.
2. Start timing.
3. Record each player's finish result.

Completed sessions:

- Hide recording controls.
- Show read-only summaries/results.
- Link to rankings and progress.
- Allow CSV download when results exist.

## Workflow 4: Review Fitness Data

Rankings:

1. Open a session's rankings page.
2. Numeric results are ranked by the test type's `higherIsBetter` rule.
3. Missing or invalid numeric results are shown separately.

Progress:

1. Open `/fitness/progress`.
2. Review historical results and charts.

Exports:

- Use `Download results CSV` on a session with saved results.

## Workflow 5: Create A Match

1. Open `/match-day`.
2. Create a match with team, opposition, kickoff, venue, and match type.
3. Open the match detail page.

Matches start as draft records.

## Workflow 6: Set Up A Draft Match

Draft setup order:

1. Squad setup.
2. Tracking focus.
3. Event setup.
4. Start match.

Squad setup:

- Pull active team players into the match.
- Mark each player as starter, substitute, or not involved.

Tracking focus:

- Choose all on-pitch players or selected players only for event recording.
- This does not affect squad involvement, substitutions, or minutes.

Event setup:

- Choose from the standard event types available for the match.

## Workflow 7: Run A Live Match

1. Start the match.
2. Starters are put on the pitch for first-half minutes.
3. Update score manually when needed.
4. Record selected events for tracked players currently on the pitch.
5. Sub players on/off to track stints and minutes.
6. End first half.
7. Start second half.
8. Complete the match.

Important rules:

- Score changes are separate from event recording.
- Events do not update score automatically.
- Event recording is paused at half-time.
- Completed matches become read-only.

## Workflow 8: Review A Completed Match

Completed match report includes:

- Final score.
- Match metadata.
- Minutes played.
- Team event totals.
- Player event counts.
- Most involved players.
- Match timeline.

CSV exports:

- `Download summary CSV` gives one row per involved player.
- `Download events CSV` gives one row per recorded event.

## Legacy Workflow

`/track` remains a legacy localStorage prototype. It is not connected to the Prisma Match Day MVP and should not be used as the source of truth for new features.
