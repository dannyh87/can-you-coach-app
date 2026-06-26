# Deployment Checklist

Use this checklist before deploying Can You Coach to Preview or Production.

## Required Production Environment Variables

- `DATABASE_URL`: must point to the intended production PostgreSQL database.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: required for production authentication.
- `CLERK_SECRET_KEY`: required for production authentication.
- `SUPER_ADMIN_EMAILS`: comma-separated allowlist for Super Admin access.
- `ENABLE_ROLE_TESTER`: must be `false` or absent in production.

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
npx prisma migrate deploy
```

- Do not seed demo or test data into production unless this is intentionally documented for a staging/demo environment.
- If seed data is needed for staging, verify exactly what `prisma/seed.mjs` creates before running it.

## Pre-Deploy Verification

Run these checks before deploy:

```bash
npm run lint
npm run build
```

## Access Checks

- Confirm `SUPER_ADMIN_EMAILS` contains only real Super Admin accounts.
- Confirm the Super Admin nav appears only for users in `SUPER_ADMIN_EMAILS`.
- Confirm `ENABLE_ROLE_TESTER` is absent or false in production.
- Check Vercel Environment Variables separately for Preview and Production.

## Current Non-Blocking Warnings

- Next.js may warn that the `middleware` file convention is deprecated in favour of `proxy`.
- Prisma may warn that `package.json#prisma` seed configuration is deprecated for Prisma 7.

These warnings should be addressed later, but they do not block deployment if lint, build, auth configuration, and migrations are correct.
