# Can You Coach - Current Product Vision

Can You Coach helps grassroots football clubs see progress beyond the scoreline.

Grassroots coaches often rely on memory, opinion, and final results. Can You Coach gives clubs a simple way to record match events, fitness results, and player development over time so coaching decisions can be supported by clearer evidence.

## Mission

Help grassroots coaches answer whether players and teams are genuinely improving.

## Product Principles

- Mobile-first: usable on a phone at training or on the touchline.
- Development-focused: support coaching decisions beyond the final score.
- Evidence-led: record simple events, results, minutes, and trends.
- Pragmatic: avoid heavyweight analysis tools and unnecessary admin.
- Role-aware: coaches, assistants, owners, and parent/spectator contributors see the right routes and guidance.

## Built Product Areas

- Public landing page and authenticated dashboard.
- Clerk authentication, local dev fallback, onboarding, and invitations.
- Club, team, access, and club tracking-library setup.
- Player management, profiles, archive/restore, and CSV import.
- Fitness testing, guidance, live recording modes, rankings, progress, and CSV export.
- Match Day setup, curriculum event recommendations, tactical presets, live mobile recording, substitutions, reports, and CSV export.
- Parent/contributor linked-player views, assignments, submitted observations, and coach review.
- Reports for team event trends, tactical observations, professional metrics, and fitness progress.
- Super Admin global event library and tracking-mapping management.

## Current Users

- Club owners and head coaches.
- Coaches and assistant coaches.
- Volunteers helping collect match or fitness data.
- Parents/spectators and other contributors linked to players or assignments for scoped views and submitted observations.

## Long-Term Direction

Can You Coach should remain a coaching observation and development tool, not a full match administration product.

The longer-term development loop is:

```text
Observation -> Coaching Theme -> Training Block -> Session Plan -> Player/Team Outcomes -> Review
```

The app now has first-stage Match Day curriculum recommendations, but not a persisted Season Plan module. Future planning features should build on the existing event library, age-group context, match format inference, and reporting.

## Not Built Yet

- Payments/subscriptions.
- Video upload or video analysis.
- Multi-coach live sync.
- Persisted season planning or training blocks.
- XLSX/PDF exports.
- Tactical sequence-linking UX and operational causal tactical analytics.
