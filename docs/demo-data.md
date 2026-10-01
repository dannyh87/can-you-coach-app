# Dashboard demonstration dataset

This generator writes fictional records through Prisma into a dedicated local PostgreSQL database. It never invokes actions that send email, invitations, notifications or webhooks, and disables both club report-email preferences. It changes no schema, migrations, authentication or dashboard code.

## Setup and access

Use Node 20.19+ and PostgreSQL. Create an empty database called `cyc_demo` (for example `createdb cyc_demo`). Do not run the older `db:seed` in this database: that creates a separate local-coach account which this generator deliberately refuses to take over.

Set these in your local `.env` (use your own local database credentials):

```dotenv
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/cyc_demo?schema=public"
MATCH_DAY_CUSTOM_OBSERVATIONS=true
```

Leave Clerk keys unset and `ENABLE_ROLE_TESTER` unset. Do not use production mode. The existing local auth fallback signs you in as `local-coach@can-you-coach.local`, which owns only the fictional demo club in this fresh database. No real credentials, passwords or invitations are created. The parent fixture is `demo-parent@example.com`; its access is verified through the existing parent permission queries, but it is not added to the role-tester login menu.

```bash
npm ci
npx prisma generate
npm run db:migrate:deploy
npm run db:demo:dry-run -- --seed 2026 --as-of 2026-10-01
npm run db:demo -- --seed 2026 --as-of 2026-10-01
npm run db:demo:verify
npm run dev
```

Open `http://localhost:3000`. The club is **DEMO — Meadow Vale FC (fictional)**. Visit `/`, `/match-day`, `/fitness`, and `/reports/team-trends`.

For six months of senior-team trends, use:

```text
/reports/team-trends?teamId=cycdemo_v1_team_0&from=2026-04-01&to=2026-10-01
```

The existing team-trends page otherwise defaults to the most recent ten matches. Its team, date, match-type and tactical-side filters remain unchanged. Player details are available at `/players/cycdemo_v1_player_0_2`; fitness reports are in the existing fitness/report routes. Not every requested dashboard has a dedicated UI.

Omit `--as-of` for a newly generated dataset ending today. For reproducible runs, keep the date, seed and feature flag pinned. The homepage snapshot uses the actual current date and a 30-day window, so an old pinned dataset eventually stops appearing in its recent counts.

## Dataset

For seed `2026`, date `2026-10-01`, custom observations enabled:

| Records | Count |
|---|---:|
| Fictional club / teams / players | 1 / 3 / 60 |
| Completed / upcoming matches | 66 / 6 |
| Match squad records | 1,440 |
| Player half/substitution stints | 1,559 |
| Match observations | 9,435 |
| Tactical sequences | 192 |
| Match event selections | 2,484 |
| Completed / upcoming fitness sessions | 18 / 3 |
| Fitness results, including explicit absences | 330 |
| Parent submissions | 3: pending, accepted, ignored |

The three squads are senior, U16 and U12, with synthetic dates of birth, positional variety and 20 players each. Fixtures use 90, 80 and 60 minutes respectively, with 11, 11 and 9 players on the pitch. Substitutions preserve pitch occupancy and half-relative clocks. Fitness results use the existing Yo-Yo Test definition and metres, with null results for absences. Dates of joining prevent results or appearances before a player joins.

## Five things to inspect

1. **Seniors:** early fixtures concede more goals; the last six show a stronger defence and better results.
2. **Charlie Meadows:** six fitness assessments show improving repeat-running scores, alongside more starting involvement later in the dataset.
3. **Jamie Meadows:** consistent selection and effort, compared with low-minute substitutes and new arrivals Noah and Quinn Meadows.
4. **Riley Meadows:** missing match involvement during the middle period, followed by substitute appearances and a return to starting. No health condition is invented.
5. **U16 compared with seniors:** less consistent squad involvement and mixed results; on team-tracked fixtures compare playing out, pressing, wide attacks, defending and set pieces. Tactical reports also contain valid regain-to-shot and corner-to-shot sequences.

Do not interpret match squad involvement as training attendance or a recorded reason for unavailability.

## Repeat, reset and verification

```bash
# No duplicates; reports already-exists for a matching dataset.
npm run db:demo -- --seed 2026 --as-of 2026-10-01

# Inspect a reset without writing.
npm run db:demo:reset -- --dry-run --seed 2026 --as-of 2026-10-01

# Delete only this generator's fixtures; keep shared catalogue definitions.
npm run db:demo:reset -- --seed 2026 --as-of 2026-10-01

npm run test:demo
npm run db:demo:verify
```

Reset requires the original date, seed and feature flag to match the club ownership marker. It checks every Prisma relation for non-demo rows pointing into the demo namespace, including cascade, restrict and set-null relationships. If you attach unrelated records, it refuses to reset. Seeding refuses to adopt an existing local fallback account and never updates existing global definitions. Missing catalogue entries are created from the repository's existing definitions, without making a second catalogue. Inactive prerequisites cause a failure. Existing demo record-count changes cause a refusal instead of silently overwriting edits.

Creation and reset use a serializable transaction plus advisory lock. Failures roll back the entire operation. IDs are deterministic and namespaced. Remote hosts, production mode, unexpected database names and connection host/socket overrides are rejected. Dry run checks the database and ownership without inserting or deleting data.

For destructive reset/rollback integration checks, use a separate seeded database whose URL ends in `cyc_demo_test` and run:

```bash
DEMO_RESET_TEST=true npm run db:demo:verify
```

This creates a temporary unrelated sentinel club, checks reset refusal for an external membership, verifies dry-run and reset preservation, deliberately tests a failed seed rollback, then recreates the dataset. Do not run it while manually editing fixtures.

## Scope and limitations

- The schema has no training session/attendance, explicit availability, cancelled-event or general player coaching-note models. No substitutes for those models are invented. Coach notes use supported fitness fields; contributor notes use submission fields.
- Classic PLAYER tracking requires an eligible on-pitch player; TEAM tracking requires null player attribution. Tactical sequences and opposition events are therefore generated on TEAM fixtures. PLAYER fixtures record our team's events only; their opposition score remains in the match result, so those fixtures do not claim complete opposition goal logging.
- Match and fitness timestamps, not arbitrary creation timestamps, drive the historical comparisons. Counts, minutes and success rates are derived from records rather than prewritten dashboard totals.
- Custom observations are included only when `MATCH_DAY_CUSTOM_OBSERVATIONS=true`. Classic-only mode remains supported. The generator does not change application flags. No v2 tracking tasks, custom club definitions, pattern submissions or assignment notifications are fabricated.
- Linked sequences exercise existing report functions. No tactical sequence-linking UI or analytics rollout is added.
- Sample pass/shot observations are a coaching dataset, not full professional match coding. Existing metric coverage caveats still apply.
- The local verification environment for this checkout used PostgreSQL 16.14 on `127.0.0.1`, a disposable `cyc_demo` database, and the project's 33 migrations with real Prisma queries. This is not a production Postgres concurrency/load test.

## Verification performed for this change

- Existing suite: 232 tests passed, one existing integration test skipped.
- New generator checks: three tests cover reproducibility, production/remote refusal, timing, scoring, scope, eligibility, pitch occupancy and missing fitness values.
- PostgreSQL/Prisma integration: migrations, dry run, insertion, repeat-run idempotency, permissions, demo-only reset, unrelated-row preservation, foreign-reference refusal and failed-seed rollback passed.
- Existing dashboard returned 60 players, nine recently completed matches, three recently completed fitness sessions and one pending parent submission for the verification date.
- Existing trend and tactical functions returned valid results; Charlie Meadows improved from 1,200m to 2,000m in the seeded assessments.
- Development HTTP checks returned 200 and expected content for the dashboard, six-month team trends, a completed match report, a player page and fitness progress.
- ESLint, TypeScript, full tests, tactical preset verification and production build passed. HTTP checks did not visually inspect charts because browser tooling was unavailable in this environment.
