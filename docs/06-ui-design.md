# Can You Coach - Current UI Design

The UI is mobile-first and touchline-friendly. It uses Tailwind CSS and a small set of shared primitives under `src/components/ui/`.

## Shared UI Primitives

Built components include:

- `Button`
- `PageHeader`
- `SectionCard`
- `StatusBadge`
- `Alert`
- `EmptyState`
- `ModalShell`
- `StatCard`
- form style helpers

The app still contains some feature-specific styling where it is simpler than abstracting everything.

Recent polish made shared page headers, section cards, empty states, mobile spacing, and the top navigation more consistent and phone-friendly.

## Global Navigation

The top navigation links to:

- Home
- Club Setup
- Players
- Fitness
- Match Day

The old `/track` prototype is not linked as a primary MVP workflow.

## Home

Purpose: navigation and overview of the MVP areas.

Current behaviour:

- Links users into Club Setup, Players, Fitness, and Match Day.
- Does not yet show a full analytics dashboard.

## Club Setup

Purpose: manage clubs and teams.

Current UI:

- Club/team setup cards and forms.
- Delete guards surface why a team cannot be removed.

## Players

Purpose: manage active and archived players.

Current UI:

- Player list with add/edit flows.
- Player profile/detail page.
- Archived players are handled through active status.

## Fitness

Purpose: create sessions, record results, and review outputs.

Current UI:

- Fitness session list and creation modal.
- Fitness Test Types settings page at `/fitness/test-types` for custom test type creation/editing and persisted recording-mode settings.
- Session detail page with metadata, lifecycle status, recording links, saved results, and CSV download when results exist.
- Live dropout and timer pages with large controls.
- Rankings table.
- Progress reporting with Recharts.
- Completed locked/read-only summary panels with rankings/progress links and Reopen for Correction.

## Match Day List

Purpose: create and find matches.

Current UI:

- Match list cards/table.
- Create match modal.
- Status and score summaries.

## Match Day Detail

### Draft State

Order is:

1. Squad setup
2. Tracking focus
3. Event setup
4. Start match

Draft UI rules:

- Squad setup controls starter/substitute/not involved status.
- Tracking focus explains that event tracking does not affect squad involvement or substitutions.
- Event setup chooses standard event types available for the match.

### Live State

Live match UI contains:

- Score display, live GOAL/undo goal controls, and half/timer controls.
- Player/substitution controls.
- Event recording controls.

Event recording supports player-first and event-first modes. Only tracked players currently on the pitch are shown.

Goal controls are separate from event recording. Goals can be added or undone during live play only, and goal recording is paused at half-time.

### Completed State

Completed matches show a report only:

- Final score.
- Minutes played.
- Team event totals.
- Player event counts.
- Most involved players.
- Timeline.
- CSV export buttons.

## CSV Export UI

Fitness:

- `Download results CSV` appears when a fitness session has saved results.

Match Day:

- `Download summary CSV` and `Download events CSV` appear on completed match reports.

## Design Constraints

- Keep live recording controls large and direct.
- Avoid adding modal-heavy flows during live play.
- Keep completed reports read-only.
- Prefer clear labels over internal enum names.
