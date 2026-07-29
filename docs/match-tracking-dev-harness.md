# Match Tracking Dev Harness

The Match Day V2 tracking harness is an internal development tool at `/dev/match-tracking`.

## Enablement

Set:

```text
ENABLE_MATCH_TRACKING_DEV_HARNESS=true
```

The route also requires an authenticated super-admin according to `SUPER_ADMIN_EMAILS` or the local development super-admin fallback. When the flag or access check fails, the route returns `notFound()`.

## Database Setup

Run pending migrations before using the harness:

```bash
npx prisma migrate status
npx prisma migrate dev
npx prisma generate
```

Do not reset the database to use the harness.

## Test Data

Use an existing manageable match with:

- match squad players
- selected `MatchDayEventType` rows
- at least one coach/owner with management access
- optional `SpectatorAccess` rows for parent/spectator eligibility checks

## Harness Workflow

1. Select a match.
2. Create a PLAYER, UNIT or TEAM tracking task.
3. Attach one or more selected match events.
4. Mark the task ready.
5. Inspect eligible contributors.
6. Create a self assignment, direct assignment or group offer.
7. Exercise assignment transitions as the current logged-in user.
8. Create assignment-linked observations only after an assignment is started.
9. Copy previous tracking tasks into the selected match.

The harness intentionally does not simulate another authenticated browser user. Use separate test accounts for contributor actions, or use the explicit integration test below.

## Atomic Group-Claim Check

The integration test is skipped unless all variables are supplied:

```text
ENABLE_MATCH_TRACKING_DEV_HARNESS=true
MATCH_TRACKING_GROUP_CLAIM_TASK_ID=<ready-task-id>
MATCH_TRACKING_GROUP_CLAIM_ASSIGNED_BY_USER_ID=<manager-user-id>
MATCH_TRACKING_GROUP_CLAIM_RECIPIENT_A_USER_ID=<eligible-user-id>
MATCH_TRACKING_GROUP_CLAIM_RECIPIENT_B_USER_ID=<eligible-user-id>
```

Run:

```bash
npm run test:integration
```

The test creates one group-offer assignment for the supplied ready task, issues two competing claims with `Promise.allSettled`, asserts exactly one success, and deletes only the assignment it created.

## Cleanup

Delete test tasks and assignments created through the harness when finished. The group-claim integration test deletes its own assignment record.

## Limitations

- This is not the polished Match Day V2 wizard.
- No notifications, emails or contributor live screen are included.
- The route displays internal IDs for development diagnostics.
- Do not enable this tool publicly.
