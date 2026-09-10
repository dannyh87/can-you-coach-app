# Can You Coach - Current UI Design

The UI is mobile-first and touchline-friendly. It uses Tailwind CSS and shared primitives under `src/components/ui/`.

## Shared UI Primitives

Built components include:

- `ActionLink`
- `Button`
- `PageHeader`
- `SectionCard`
- `StatusBadge`
- `Alert`
- `EmptyState`
- `ModalShell`
- `StatCard`
- table and form helpers

Feature-specific styling remains where it keeps implementation simpler.

## Public Landing Page

The public landing page is concise and outcome-led:

- Hero: `See progress beyond the scoreline`.
- One strong primary CTA: `Start tracking what matters`.
- Short problem/solution sections.
- Three benefit cards: record what matters, see progress over time, share the workload.
- Detailed explanations are left to `/how-to-use`.

## Global Navigation

Navigation is role-aware:

- Public users see public home/how-to-use/auth paths.
- Parent-only users see My Player and Match Observations.
- No-access users see onboarding and appropriate invite/setup guidance.
- Coaches and assistants see relevant coaching routes.
- Owners see Club Setup.
- Super Admin users see Super Admin routes.

## Authenticated Home

The authenticated home acts as a dashboard:

- No-access state and onboarding guidance.
- Parent/spectator dashboard panels for linked players.
- Coach/club dashboard with active sessions, active matches, recent activity, and reports.

## Club Setup

- Owners manage clubs, teams, report email preferences, staff/parent access, and club tracking-library definitions/mappings.
- Non-owner/parent direct-route states show guidance instead of admin UI.

## Players

- Coaches/owners can manage players.
- Assistants can view assigned team players without misleading edit/archive actions.
- CSV import supports bulk player creation.

## Fitness

- Fitness list separates tasks, sessions, filters, and results.
- Fitness test type setup includes practical guidance fields.
- Live dropout/timer screens use large direct controls.
- Completed sessions become read-only with clear correction and export options.

## Match Day Wizard

The new match wizard includes:

- Match details.
- Team selection.
- Squad setup.
- Match settings.
- Event setup with curriculum recommendation panel, tactical preset buttons, standard/custom search, and copy-previous setup options.
- Review and create.

The recommendation panel shows age group, inferred format, theme, week focus, matched events, missing events, and a `Use recommended events` CTA. It does not auto-select events.

Tactical presets apply only when all prerequisite definitions resolve. Missing prerequisites keep the user on the setup step and avoid partial selection.

## Live Match Recording

The live event-recording UI is compact on mobile:

- Sticky recording header with current player/event context and mode switch.
- Horizontal player chips.
- Horizontal category chips.
- Dense two/three-column event button grid.
- Our-team/opposition controls where the selected observation supports side attribution.
- Tactical detail controls where the selected tactical event exposes detail options.
- Persistent bottom row with latest event and Undo.
- Full event history is collapsed by default.
- Location picker opens only for location-required events.

Score controls, substitutions, and event recording remain separate.

## Completed Match Reports

Completed matches show read-only reports:

- Final score.
- Minutes played.
- Team event totals.
- Tactical observation sections and side-aware totals where tactical data exists.
- Professional metric sections where the recorded event set supports them.
- Player event counts.
- Most involved players.
- Timeline.
- Location maps where location data exists.
- CSV export buttons.

## Contributor And Parent Interfaces

- Parent/spectator users see scoped My Player panels and match-observation routes only.
- Contributors see assignment lists and focused recording screens under `/my-assignments`.
- Coach review cards keep submitted observations separate from official observations until acceptance.
- Review UI surfaces club identity, recorded standard identity, mapping status/revision, submitter, target, time, note, location status, team side, and stale/retired warnings where relevant.

## Design Constraints

- Keep live controls direct and tap-friendly.
- Avoid modal-heavy flows during live play.
- Preserve accessible tap targets even when layouts are compact.
- Keep completed reports read-only.
- Prefer clear coach-facing labels over enum names.
