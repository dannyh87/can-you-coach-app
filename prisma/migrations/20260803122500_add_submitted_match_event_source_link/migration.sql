-- Add nullable source link for idempotent event submission acceptance.
ALTER TABLE "MatchEvent" ADD COLUMN "submittedMatchEventId" TEXT;

CREATE UNIQUE INDEX "MatchEvent_submittedMatchEventId_key" ON "MatchEvent"("submittedMatchEventId");

ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_submittedMatchEventId_fkey" FOREIGN KEY ("submittedMatchEventId") REFERENCES "SubmittedMatchEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
