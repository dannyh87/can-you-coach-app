# Can You Coach - Current Agent Instructions

Build on the existing app. Do not treat these docs as greenfield requirements.

## Stack

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Prisma.
- PostgreSQL.
- Clerk.
- Recharts.

Do not replace these without explicit approval.

## Current Architecture

- Prisma schema and PostgreSQL migrations live in `prisma/`.
- Previous SQLite migrations are archived in `prisma/migrations_sqlite_archive/` for reference.
- Auth helpers live in `src/lib/auth.ts`; local fallback helpers live in `src/lib/localUser.ts`.
- Access and permission helpers live in `src/lib/accessWhere.ts`, `src/lib/permissions.ts`, `src/lib/accessSummary.ts`, and related auth files.
- Invitations live in `src/lib/invitations.ts` and `/invite/accept`.
- Prisma client singleton lives in `src/lib/prisma.ts`.
- Fitness helpers live in `src/lib/fitnessSessionActions.ts`, `src/lib/fitnessRecordingModes.ts`, and `src/lib/fitnessSessionStatus.ts`.
- Event-definition helpers live in `src/lib/eventDefinitions.ts` and `src/lib/eventDefinitionSimilarity.ts`.
- Match Day curriculum recommendations live in `src/lib/curriculumRecommendations.ts`.
- Shared UI primitives live in `src/components/ui/`.
- Fitness routes live under `src/app/fitness/`.
- Match Day routes live under `src/app/match-day/`.
- Parent/spectator routes live under `src/app/my-player/`.
- Legacy `/track` exists but should not be changed unless explicitly requested.

## Development Rules

- Prefer the smallest correct change.
- Preserve server-side permission checks.
- Do not grant access through navigation or UI changes.
- Preserve invite acceptance behavior unless explicitly asked to change it.
- Preserve completed/read-only states for completed matches and completed fitness sessions.
- Do not add Prisma schema changes or migrations unless persisted data is required.
- Run `npm run lint` and `npm run build` after meaningful changes.
- Check `package.json` before running a typecheck script; there is currently no `typecheck` script.

## Product Rules To Preserve

- Completed fitness sessions are read-only.
- Reopen for Correction should preserve saved fitness results and only reopen completed sessions.
- Completed matches are read-only/report-only.
- Squad involvement, on-pitch state, and tracked-for-events are separate concepts.
- Tracking focus affects event recording only.
- Substitution and minutes tracking must include all involved players, not just tracked players.
- Match events do not automatically update the score.
- Score controls are separate from event recording.
- Goals can be added/undone during live play only; goal recording is paused at half-time.
- Parent submissions currently use legacy enum-backed events only.
- Club custom events must remain scoped to the selected club/team.
- Curriculum recommendations must not auto-create event definitions or force selections.

## Do Not Add Without Approval

- Payments/subscriptions.
- Video upload or analysis.
- Multi-coach live sync.
- Persisted Season Plan or Training Block models.
- XLSX/PDF exports.
- Auto-generated event libraries or AI-driven recommendations.
- Changes that weaken roles, permissions, invite checks, or parent/spectator restrictions.

## Verification Expectations

For normal code changes:

```bash
npm run lint
npm run build
```

For schema changes:

```bash
npx prisma migrate dev --name <migration-name>
git diff -- prisma/schema.prisma prisma/migrations
```

Use a PostgreSQL `DATABASE_URL`, for example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/can_you_coach?schema=public"
```

For production migrations on managed Postgres, use:

```bash
npm run db:migrate:deploy
```

Do not run `prisma migrate dev` against production. Seed production deliberately and only when wanted with `npm run db:seed`.
