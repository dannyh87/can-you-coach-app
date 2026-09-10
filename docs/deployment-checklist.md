# Deployment Checklist

Use this checklist before deploying Can You Coach to Preview or Production.

## Required Production Environment Variables

- `DATABASE_URL`: must point to the intended production PostgreSQL database.
- `APP_URL`: must be the canonical production origin, for example `https://canyoucoach.app`, with no path, query string, fragment, or credentials.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: required for production authentication.
- `CLERK_SECRET_KEY`: required for production authentication.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: normally `/sign-in`.
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`: normally `/`.
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: current `.env.example` uses `/sign-in`.
- `SUPER_ADMIN_EMAILS`: comma-separated allowlist for Super Admin access.
- `ENABLE_ROLE_TESTER`: must be `false` or absent in production.

Optional production email variables:

- `RESEND_API_KEY`: enables report email delivery when configured.
- `REPORT_EMAIL_FROM`: sender address used for report emails.

If the email variables are absent, report email sending is skipped safely, but email delivery is not verified.

## Authentication Safety

- Clerk must be configured in production.
- Local fallback auth is disabled when `NODE_ENV === 'production'`.
- Production must fail closed if Clerk is missing or disabled.
- Production must not create or use demo/local users such as `local-coach@can-you-coach.local`.
- The Dev Role Tester only works when Clerk is disabled and `ENABLE_ROLE_TESTER=true`, which should be local development only.

## Database And Data Safety

- Confirm `DATABASE_URL` points to the correct production Postgres instance before running migrations.
- Run migrations before or during deployment:

```bash
npm run db:migrate:deploy
```

- Do not seed demo or test data into production unless this is intentionally documented for a staging/demo environment.
- If seed data is needed for staging or controlled production defaults, verify exactly what `prisma/seed.mjs` creates before running it. The seed includes demo local data plus global event definitions and default fitness tests.

## Pre-Deploy Verification

Run these checks before deploy:

```bash
npm run lint
npx tsc --noEmit --pretty false
npm test
npm run build
```

Before promoting tactical library changes, run dry-run sync verification first:

```bash
npm run db:sync:tactical-events -- --dry-run
npm run db:sync:tactical-prerequisites -- --dry-run
npm run db:verify:tactical-presets
```

Expected current tactical state:

- 53 tactical definitions resolve without conflicts.
- `Ball recovery` resolves as the standard prerequisite for Counter-attacking.
- Six presets verify: Playing out, Pressing, Counter-attacking, Wide attacks, Defending the box, Set pieces.

## Access Checks

- Confirm `SUPER_ADMIN_EMAILS` contains only real Super Admin accounts.
- Confirm the Super Admin nav appears only for users in `SUPER_ADMIN_EMAILS`.
- Confirm `ENABLE_ROLE_TESTER` is absent or false in production.
- Check Vercel Environment Variables separately for Preview and Production.

## Final Checks

- Confirm `npx prisma generate`, `npx prisma migrate status`, `npm run lint`, `npx tsc --noEmit --pretty false`, `npm test`, and `npm run build` complete successfully before deployment.
- Run `npm run db:seed` only when deliberately updating default/staging data.
- Complete authenticated smoke tests with synthetic owner, coach, assistant, viewer, and parent/contributor accounts before broad external testing.
- Keep tactical sequence linking documented as unfinished unless a UI/action exists to create valid `TacticalSequence` links.
