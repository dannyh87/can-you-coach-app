-- Add lightweight metadata for team tactical observations.
-- This supports side attribution, optional detail codes and explicit sequence links without rewriting historical events.

CREATE TYPE "MatchObservationSide" AS ENUM ('OUR_TEAM', 'OPPOSITION');

CREATE TABLE "TacticalSequence" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "teamSide" "MatchObservationSide" NOT NULL DEFAULT 'OUR_TEAM',
    "sequenceType" TEXT NOT NULL,
    "startHalf" "MatchHalf" NOT NULL,
    "startMatchSecond" INTEGER NOT NULL,
    "endHalf" "MatchHalf",
    "endMatchSecond" INTEGER,
    "timeWindowSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TacticalSequence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MatchEvent" ADD COLUMN "teamSide" "MatchObservationSide" NOT NULL DEFAULT 'OUR_TEAM';
ALTER TABLE "MatchEvent" ADD COLUMN "detailCode" TEXT;
ALTER TABLE "MatchEvent" ADD COLUMN "tacticalSequenceId" TEXT;

ALTER TABLE "SubmittedMatchEvent" ADD COLUMN "teamSide" "MatchObservationSide" NOT NULL DEFAULT 'OUR_TEAM';
ALTER TABLE "SubmittedMatchEvent" ADD COLUMN "detailCode" TEXT;
ALTER TABLE "SubmittedMatchEvent" ADD COLUMN "tacticalSequenceId" TEXT;

CREATE INDEX "TacticalSequence_matchDayId_idx" ON "TacticalSequence"("matchDayId");
CREATE INDEX "TacticalSequence_teamSide_idx" ON "TacticalSequence"("teamSide");
CREATE INDEX "TacticalSequence_sequenceType_idx" ON "TacticalSequence"("sequenceType");
CREATE INDEX "TacticalSequence_timeWindowSeconds_idx" ON "TacticalSequence"("timeWindowSeconds");

CREATE INDEX "MatchEvent_teamSide_idx" ON "MatchEvent"("teamSide");
CREATE INDEX "MatchEvent_detailCode_idx" ON "MatchEvent"("detailCode");
CREATE INDEX "MatchEvent_tacticalSequenceId_idx" ON "MatchEvent"("tacticalSequenceId");

CREATE INDEX "SubmittedMatchEvent_teamSide_idx" ON "SubmittedMatchEvent"("teamSide");
CREATE INDEX "SubmittedMatchEvent_detailCode_idx" ON "SubmittedMatchEvent"("detailCode");
CREATE INDEX "SubmittedMatchEvent_tacticalSequenceId_idx" ON "SubmittedMatchEvent"("tacticalSequenceId");

ALTER TABLE "TacticalSequence" ADD CONSTRAINT "TacticalSequence_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_tacticalSequenceId_fkey" FOREIGN KEY ("tacticalSequenceId") REFERENCES "TacticalSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubmittedMatchEvent" ADD CONSTRAINT "SubmittedMatchEvent_tacticalSequenceId_fkey" FOREIGN KEY ("tacticalSequenceId") REFERENCES "TacticalSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
