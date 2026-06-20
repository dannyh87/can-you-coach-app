-- AlterTable
ALTER TABLE "MatchDayPlayer" ADD COLUMN "isTracked" BOOLEAN NOT NULL DEFAULT true;

-- Backfill not-involved players so event tracking stays separate from squad setup.
UPDATE "MatchDayPlayer" SET "isTracked" = false WHERE "squadStatus" = 'NOT_INVOLVED';
