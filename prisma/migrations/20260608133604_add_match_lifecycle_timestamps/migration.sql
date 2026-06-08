-- AlterTable
ALTER TABLE "MatchDay" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "MatchDay" ADD COLUMN "firstHalfEndedAt" DATETIME;
ALTER TABLE "MatchDay" ADD COLUMN "firstHalfStartedAt" DATETIME;
ALTER TABLE "MatchDay" ADD COLUMN "secondHalfEndedAt" DATETIME;
ALTER TABLE "MatchDay" ADD COLUMN "secondHalfStartedAt" DATETIME;
