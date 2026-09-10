# Can You Coach - Current Workflows

This document describes the workflows currently supported by the app.

## Workflow 1: Sign Up, Onboard, Or Accept An Invite

1. Open `/sign-up`, `/sign-in`, or an invite link.
2. Complete onboarding as a club official, coach, or parent/spectator.
3. If invited, accept the invite with the invited email.
4. Navigation and empty states update based on access.

## Workflow 2: Set Up A Club, Team, And Access

1. Open `/club-setup`.
2. Create or update club details.
3. Create teams with age group, season, league, and pyramid step.
4. Use `/club-setup/access` to invite coaches, assistants, parents, and spectators.
5. Add or review club tracking-library definitions, aliases, mappings, and club-only observations if the global library does not cover a club-specific coaching focus.

## Workflow 3: Manage Players

1. Open `/players`.
2. Add players manually or import a CSV from `/players/import`.
3. Edit player details as needed.
4. Archive players rather than deleting history.

## Workflow 4: Create And Record A Fitness Session

1. Open `/fitness`.
2. Create a session for a team and fitness test type.
3. Use the configured recording mode: manual, live dropout, or live timed finish.
4. Save results and complete the session.
5. Reopen for correction only when needed.

## Workflow 5: Review Fitness Data

1. Open a session rankings page to compare player results.
2. Open `/fitness/progress` to review historical progress.
3. Download results CSV from a session with saved results.

## Workflow 6: Create A Match With Recommendations

1. Open `/match-day/new`.
2. Enter match details.
3. Select the team.
4. Pick the squad.
5. Review curriculum recommendations in event setup.
6. Apply a tactical preset, use recommended events, use the default event set, copy a previous setup, or manually select events.
7. Create the match.

Recommendation notes:

- Match format is inferred from team age group.
- Recommendations match against global and club-scoped event definitions.
- Missing recommended events are shown but not created automatically.
- Coaches can override all recommendations.
- Tactical presets apply atomically; if a prerequisite such as `Ball recovery` is missing, the preset is not partially applied.

## Workflow 7: Set Up A Draft Match

Draft setup includes:

1. Match details.
2. Squad setup.
3. Tracking focus.
4. Event setup.
5. Start match.

Rules:

- Squad setup is locked after kick-off.
- Event setup is locked after kick-off.
- Tracking focus affects event recording only.

## Workflow 8: Run A Live Match

1. Start the first half.
2. Add/undo goals through score controls.
3. Sub players on/off to track stints and minutes.
4. Record selected standard, professional-stat, custom, and tactical observations for tracked players currently on the pitch where player attribution is required.
5. Use compact mobile player chips and event buttons for faster recording.
6. Attribute supported observations to our team or the opposition.
7. Add tactical detail values and pitch location where the selected observation requires them.
8. Undo the latest event from the persistent bottom row if needed.
9. End first half, start second half, and complete the match.

Important rules:

- Score changes are separate from event recording.
- Events do not update score automatically.
- Goal and event recording pause at half-time.
- Location events open the pitch picker only when required.
- Completed matches become read-only.
- Tactical sequence linking is not available through the UI, so causal tactical measures remain unfinished unless valid links already exist.

## Workflow 9: Parent/Spectator And Contributor Match Observations

1. Parent/spectator users open `/my-player/matches`.
2. They can submit observations for linked players during live matches.
3. Contributors open `/my-assignments` for direct, self, or group-offer tracking assignments.
4. They record focused player, unit, or team observations without broader club-admin access.
5. Coaches review pending submissions on the match page.
6. Accepted submissions become official match events or official pattern observations.

Preservation rules:

- Accepted event submissions preserve standard/custom identity, club provenance, team side, tactical metadata, optional tactical sequence ID, location, score context, and supported player attribution.
- Repeated acceptance returns the existing official observation instead of creating duplicates.

## Workflow 10: Review A Completed Match

Completed match report includes:

- Final score and metadata.
- Minutes played.
- Team event totals.
- Tactical/professional sections where applicable.
- Club observation provenance where applicable.
- Player event counts.
- Most involved players.
- Timeline.
- Location maps where available.

CSV exports:

- `Download summary CSV` gives one row per involved player.
- `Download events CSV` gives one row per recorded event.

## Workflow 11: Review Trends And Exports

1. Open `/reports/team-trends`.
2. Filter by team, date range, event, match type, and tactical side where relevant.
3. Compare standard, custom, professional, and tactical observations across completed matches.
4. Use CSV exports from completed match and fitness reports for offline analysis.

## Legacy Workflow

`/track` remains a legacy localStorage prototype. It is not connected to the Prisma Match Day workflow and should not be used as the source of truth for new features.
