# Can You Coach - Current Reporting And Exports

Reporting focuses on simple outputs that help coaches review progress over time.

## Reports Index

`/reports` currently links to:

- Team Event Trends
- Fitness Progress

Access is role-aware. Parent/spectator users are guided to My Player instead of coaching reports.

## Fitness Reporting

### Session Summary

Completed fitness sessions are locked/read-only and show:

- test type
- team
- date
- status
- started/completed timestamps
- saved result count
- top performer
- bottom performer
- links to rankings and progress

Completed sessions keep CSV export available when saved results exist and include Reopen for Correction.

### Rankings

The rankings page shows ranked numeric results using the test type's `higherIsBetter` rule. Missing or invalid numeric results are shown separately.

### Progress

Fitness progress reporting uses historical results and charts to show improvement over time by team, player, and test type.

### Fitness CSV Export

Available from a fitness session when saved results exist.

Button:

- `Download results CSV`

Key columns include session, date, team, club, test type, player, squad number, result, result value, status, rank, and notes.

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
- Location maps where location data exists.
- Parent submission review history where relevant.
- Tactical observation totals and coverage labels where tactical observations exist.
- Professional metric sections where event identities support the metric catalogue.
- Club observation sections and provenance where club tracking definitions are used.

### Minutes Reporting

Minutes are based on `MatchPlayerStint` records and include all involved players, not only players tracked for events.

### Event Reporting

Event counts come from `MatchEvent` records and can be backed by either legacy enum event types or `EventDefinition` records.

Current event library includes legacy events, DB-only seeded global events, synced tactical events, and optional club tracking definitions.

Tactical reports distinguish our-team and opposition observations through `teamSide`. Detail metadata, such as route or zone values, is preserved where the tactical definition supports it.

Causal tactical measures remain unavailable unless valid `TacticalSequence` links exist. The schema/reporting logic can consume links, but the app does not currently expose a UI/action to create them.

### Team Event Trends

`/reports/team-trends` compares one selected match event across completed matches over time.

Filters include:

- team
- date from
- date to
- event
- match type
- tactical side where relevant

The report uses both selected match event types and recorded match events so trends can include global, tactical, and club-defined event definitions.

### Match Summary CSV Export

Available from completed match reports.

Button:

- `Download summary CSV`

Columns include match metadata, player, squad status, tracked-for-events flag, minutes played, total events, standard event summary counts, tactical counts where relevant, and provenance fields where available.

### Match Events CSV Export

Available from completed match reports.

Button:

- `Download events CSV`

Columns include match metadata, half, match time, player, event label, event identity, club provenance, team side, tactical detail metadata, optional tactical sequence ID, location, and score at time where available.

### Pattern And Club Observation Exports

Pattern exports preserve outcome, scope, target, player/unit context, location, review status, and mapping provenance.

Club-only/custom observations remain visible in club/provenance sections and exports but are not collapsed into standard totals unless their mapping is standard-approved.

## Not Yet Built

- PDF export.
- XLSX export.
- Automated insight generation.
- Season-plan reporting.
- Position comparison reports.
- Benchmark datasets.
- Tactical sequence-linking UI and causal tactical metrics without valid sequence links.
