# Can You Coach App

Can You Coach is a local MVP for grassroots football coaches to manage squads, record fitness testing, run Match Day tracking, and review/download useful reports.

The app is built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. It currently uses a local demo user flow rather than production authentication.

## What Is Built

- Home/navigation page with links to the main MVP areas.
- Club Setup for creating clubs and teams.
- Player management for adding, editing, viewing, and archiving players.
- Fitness testing sessions with draft, in-progress, and completed states.
- Fitness recording modes for manual entry, dropout-style tests, and timed finish tests.
- Fitness rankings, progress reports, completed summaries, and CSV result downloads.
- Match Day setup, squad selection, tracking focus, event setup, live match controls, substitutions, score controls, completed reports, and CSV downloads.
- Shared UI primitives under `src/components/ui/`.
- Prisma PostgreSQL database with migrations in `prisma/migrations`.
- Archived SQLite migration history in `prisma/migrations_sqlite_archive` for reference.

## Main Routes

- `/` - app home and navigation.
- `/club-setup` - club and team setup.
- `/players` - player list and player management.
- `/players/[id]` - player profile/details.
- `/fitness` - fitness session list and creation.
- `/fitness/sessions/[id]` - fitness session detail, manual results, completed result view, CSV export.
- `/fitness/sessions/[id]/live` - live dropout recording.
- `/fitness/sessions/[id]/timer` - live timed finish recording.
- `/fitness/sessions/[id]/rankings` - rankings for a fitness session.
- `/fitness/progress` - fitness progress reporting.
- `/match-day` - match list and creation.
- `/match-day/[id]` - match setup, live match, completed match report, CSV export.
- `/track` - legacy localStorage prototype; not part of the Prisma Match Day MVP.

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and set a PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/can_you_coach?schema=public"
```

Apply migrations, seed default data, and generate Prisma Client:

```bash
npx prisma migrate dev
npx prisma db seed
npx prisma generate
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run lint
npm run build
npx prisma migrate dev
npx prisma studio
```

There is currently no `typecheck` script in `package.json`.

## Vercel Deployment

Use a managed Postgres provider on or with Vercel and set this required environment variable in Vercel:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

`DIRECT_URL` is not currently required because `prisma/schema.prisma` only uses `env("DATABASE_URL")`.

Production migrations should be applied deliberately with:

```bash
npm run db:migrate:deploy
```

Do not use `prisma migrate dev` against production. Seed demo/default data only deliberately, usually once:

```bash
npm run db:seed
```

Do not auto-seed on every deployment. `.env` is for local development only and should not be committed.

## Data And Auth Status

- Database: PostgreSQL via Prisma.
- Auth: local MVP helper creates/uses a demo user and default club.
- Hosting: ready for Vercel with a managed Postgres `DATABASE_URL`.
- Payments: not implemented.
- Video: not implemented.
- Custom match event definitions: not implemented; the app uses a fixed standard event set.

## Current Non-Goals

- Production authentication and roles.
- Parent portals.
- Payments/subscriptions.
- Cloud hosting setup.
- Video upload or analysis.
- AI recommendations.
- Multi-coach live sync.
- XLSX/PDF exports.
