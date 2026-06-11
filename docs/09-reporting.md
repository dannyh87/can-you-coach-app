# Can You Coach - Current Reporting And Exports

Reporting currently focuses on simple, useful outputs coaches can review or share.

## Fitness Reporting

### Session Summary

Completed sessions show:

- Test type.
- Team.
- Date.
- Status.
- Started/completed timestamps.
- Saved result count.
- Top performer.
- Bottom performer.
- Links to rankings and progress.

### Rankings

The rankings page shows:

- Rank.
- Player.
- Squad number.
- Result.
- Status.
- Notes.

Ranking rules:

- Numeric `resultValue` is required for ranking.
- `higherIsBetter` on the test type controls sort direction.
- Missing or invalid numeric results are shown separately.

### Progress

Fitness progress reporting uses historical results and simple charts to show improvement over time.

### Fitness CSV Export

Available from a fitness session when saved results exist.

Button:

- `Download results CSV`

Columns:

- Session
- Date
- Team
- Club
- Test Type
- Status
- Player
- Squad Number
- Result
- Result Value
- Result Status
- Rank
- Notes

Example filename:

- `fitness-results-gacon-test-brereton-social-2026-06-09.csv`

## Match Day Reporting

Completed matches show a read-only report.

### Match Report Sections

- Final score.
- Match result card.
- Team event total card.
- Players used card.
- Minutes played.
- Team event totals.
- Player event counts.
- Most involved players.
- Match timeline.

### Minutes Reporting

Minutes are based on `MatchPlayerStint` records.

Important rule:

- Minutes include all involved players, not just players tracked for events.

### Event Reporting

Event counts come from `MatchEvent` records.

Current event types:

- Goal
- Assist
- Shot on target
- Shot off target
- Pass complete
- Pass incomplete
- 1v1 success
- 1v1 unsuccessful

### Match Summary CSV Export

Available from completed match reports.

Button:

- `Download summary CSV`

Columns:

- Match
- Date
- Team
- Opposition
- Venue
- Match Type
- Final Score
- Player
- Squad Number
- Squad Status
- Tracked For Events
- Minutes Played
- Total Events
- Goals
- Assists
- Shots On Target
- Shots Off Target
- Pass Complete
- Pass Incomplete
- 1v1 Success
- 1v1 Unsuccessful

Example filename:

- `match-summary-brereton-social-vs-uttoxeter-2026-06-09.csv`

### Match Events CSV Export

Available from completed match reports.

Button:

- `Download events CSV`

Columns:

- Match
- Date
- Team
- Opposition
- Venue
- Match Type
- Final Score
- Half
- Match Time
- Player
- Event
- Score At Time

Example filename:

- `match-events-brereton-social-vs-uttoxeter-2026-06-09.csv`

## Not Yet Built

- Season-long match trends.
- Position comparisons.
- Benchmark reporting.
- Team average improvement reports.
- PDF export.
- XLSX export.
- Automated insights or recommendations.
