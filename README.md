# Can You Coach App

Can You Coach helps grassroots football clubs record match events, fitness results, and player development over time. The app is built to show progress beyond the scoreline and give coaches clearer evidence for training and match-day decisions.

The app uses Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, and Clerk authentication. Local development can run without Clerk keys using the demo-user fallback.

## What Is Built

- Public landing page focused on grassroots development beyond the scoreline.
- Clerk sign-in/sign-up routes with local fallback auth for development.
- First-time onboarding for club officials, coaches, and parent/spectator users.
- Role-aware navigation and empty states.
- Club Setup for clubs, teams, access management, invitations, and club custom match events.
- Player management, player profiles, archive/restore, and CSV import.
- Fitness test type management, guidance content, target-score guidance, sessions, live recording modes, rankings, progress reporting, and CSV exports.
- Match Day wizard with squad setup, tracking focus, curriculum event recommendations, club/global event selection, live controls, mobile-first event recording, substitutions, reports, and CSV exports.
- Parent/spectator `My Player` access with linked-player views and live match observations.
- Reports landing page with Team Event Trends and Fitness Progress.
- Super Admin global event library management.

## Main Routes

- `/` - public landing page or authenticated dashboard.
- `/sign-in` and `/sign-up` - Clerk auth routes.
- `/onboarding` - first-time onboarding.
- `/club-setup` - club, team, report email, and club event setup.
- `/club-setup/access` - staff and parent/spectator invitation/access management.
- `/players` - player list and management.
- `/players/[id]` - player profile/details.
- `/players/import` - CSV player import.
- `/fitness` - fitness session list.
- `/fitness/test-types` - default and custom fitness test settings/guidance.
- `/fitness/sessions/new` - create a fitness session.
- `/fitness/sessions/[id]` - session detail, manual results, completed view, CSV export.
- `/fitness/sessions/[id]/live` - live dropout recording.
- `/fitness/sessions/[id]/timer` - live timed finish recording.
- `/fitness/sessions/[id]/rankings` - session rankings.
- `/fitness/progress` - fitness progress reporting.
- `/match-day` - match list.
- `/match-day/new` - Match Day wizard with curriculum recommendations.
- `/match-day/[id]` - draft setup, live match, event recording, completed report.
- `/my-player` - linked-player parent/spectator view.
- `/my-player/matches` - parent/spectator match observations.
- `/reports` - reports index.
- `/reports/team-trends` - team event trend reporting.
- `/super-admin/events` - global event library management.
- `/track` - legacy localStorage prototype; not part of the Prisma Match Day workflow.

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and set a PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/can_you_coach?schema=public"
```

Clerk is optional for local development. If Clerk values are omitted, the app uses the local demo user and Demo Club fallback:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
```

Apply migrations, seed default data, and generate Prisma Client:

```bash
npx prisma migrate dev
npm run db:seed
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
npm run db:migrate:deploy
npm run db:seed
npx prisma migrate dev
npx prisma studio
```

There is currently no `typecheck` script in `package.json`.

## Deployment

Use a managed Postgres provider and set these environment variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
SUPER_ADMIN_EMAILS="admin@example.com"
ENABLE_ROLE_TESTER="false"
```

`DIRECT_URL` is not currently required because `prisma/schema.prisma` only uses `env("DATABASE_URL")`.

Production migrations should be applied deliberately with:

```bash
npm run db:migrate:deploy
```

Do not use `prisma migrate dev` against production. Seed production only deliberately.

## Data And Auth Status

- Database: PostgreSQL via Prisma.
- Auth: Clerk in production, local fallback in development.
- Roles: Owner, Coach, Assistant Coach, Viewer, and linked-player spectator access.
- Invitations: staff and parent/spectator invite links are implemented.
- Custom match events: global Super Admin library plus club-specific event definitions.
- Payments: not implemented.
- Video upload/analysis: not implemented.
- Multi-coach live sync: not implemented.
- XLSX/PDF exports: not implemented.
