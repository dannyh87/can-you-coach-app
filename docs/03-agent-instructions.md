# Can You Coach - Current Agent Instructions

Build on the existing MVP. Do not treat these docs as greenfield requirements.

## Stack

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Prisma.
- SQLite.
- Recharts.

Do not replace these without explicit approval.

## Current Architecture

- Prisma schema and migrations live in `prisma/`.
- Local MVP user logic lives in `src/lib/localUser.ts`.
- Prisma client singleton lives in `src/lib/prisma.ts`.
- Fitness shared actions/helpers live in `src/lib/fitnessSessionActions.ts`, `src/lib/fitnessRecordingModes.ts`, and `src/lib/fitnessSessionStatus.ts`.
- Shared UI primitives live in `src/components/ui/`.
- Fitness routes live under `src/app/fitness/`.
- Match Day routes live under `src/app/match-day/`.
- Legacy `/track` exists but should not be changed unless explicitly requested.

## Development Rules

- Prefer the smallest correct change.
- Preserve current recording behaviours unless explicitly asked to change them.
- Do not add Prisma schema changes or migrations unless the requested feature requires persisted data.
- Run `npm run lint` and `npm run build` after meaningful changes.
- Check `package.json` before running `npm run typecheck`; there is currently no typecheck script.

## Product Rules To Preserve

- Completed fitness sessions are read-only.
- Completed matches are read-only/report-only.
- Squad involvement, on-pitch state, and tracked-for-events are separate concepts.
- Tracking focus affects event recording only.
- Substitution and minutes tracking must include all involved players, not just tracked players.
- Match events do not automatically update the score.
- Score controls are separate from event recording.

## Do Not Add Without Approval

- Production auth.
- Payments.
- Hosting/deployment setup.
- Video.
- Custom match event definitions.
- Parent portals.
- Roles/permissions.
- Multi-coach live sync.
- AI recommendations.
- XLSX/PDF exports.

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
